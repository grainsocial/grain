//! Records read back from their PDS into the index, as soon as they are
//! written: `social.grain.sync.indexRecords`, which the apps and the
//! command line call after writing to their own PDS, and [`read_back`],
//! which it calls and the web's own writes will too.
//!
//! What the index takes is only ever what the PDS answers. The caller
//! names URIs, never content: each is read with `com.atproto.repo.getRecord`
//! from the PDS the repo's DID document names, and put by its URI and CID,
//! so Jetstream delivering the same record later changes nothing. A record
//! the PDS no longer has is deleted from the index. One new to the index
//! is pushed ([`Index::arrived`]).
//!
//! Whoever holds a service token names the PDS asked, by their DID
//! document, so it is asked only as [`grain::guard`] allows: on https, at
//! a public address, following no redirect.

use crate::App;
use crate::index::{Applied, Index, PutError, record_uri, records};
use crate::xrpc::Failure;
use axum::Json;
use axum::body::Bytes;
use axum::extract::State;
use axum::http::{HeaderMap, StatusCode, header};
use grain::env::Ctx;
use grain::xrpc::{Xrpc, XrpcError};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::sync::Arc;

/// The method, as a service token for it names it in `lxm`.
pub const LXM: &str = "social.grain.sync.indexRecords";

/// The most URIs one call names, as its lexicon allows.
pub const MAX_URIS: usize = 25;

/// What reading records back did, as `indexRecords` answers it.
#[derive(Debug, Default, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReadBack {
    /// Read back from the PDS and put in the index.
    pub indexed: Vec<String>,
    /// Not on the PDS: deleted from the index, if it held them.
    pub not_found: Vec<String>,
}

/// Why records were not read back.
#[derive(Debug)]
pub enum ReadBackError {
    /// Not a record's AT-URI.
    NotARecord(String),
    /// A record in another repo than the one being read.
    RepoMismatch(String),
    /// A record of a collection the index does not keep.
    UnknownCollection(String),
    /// The repo's PDS is not one grain asks ([`grain::guard`]).
    Unaskable(grain::guard::Refused),
    /// The PDS failed to answer for the record, other than to say it has
    /// no such record.
    Pds {
        uri: String,
        error: anyhow::Error,
    },
    /// The PDS has the record, and it does not fit its lexicon.
    Refused {
        uri: String,
        why: String,
    },
    Index(rusqlite::Error),
}

impl std::fmt::Display for ReadBackError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ReadBackError::NotARecord(uri) => write!(f, "{uri} is not a record's AT-URI"),
            ReadBackError::RepoMismatch(uri) => write!(f, "{uri} is not in the caller's repo"),
            ReadBackError::UnknownCollection(uri) => {
                write!(f, "{uri} is of a collection grain does not index")
            }
            ReadBackError::Unaskable(why) => write!(f, "the repo's PDS is not asked: {why}"),
            ReadBackError::Pds { uri, error } => write!(f, "reading {uri}: {error:#}"),
            ReadBackError::Refused { uri, why } => {
                write!(f, "{uri} does not fit its lexicon: {why}")
            }
            ReadBackError::Index(e) => write!(f, "index: {e}"),
        }
    }
}

impl std::error::Error for ReadBackError {}

impl From<ReadBackError> for Failure {
    fn from(e: ReadBackError) -> Failure {
        let message = e.to_string();
        let (status, error) = match e {
            ReadBackError::NotARecord(_) => (StatusCode::BAD_REQUEST, "InvalidRequest"),
            ReadBackError::RepoMismatch(_) => (StatusCode::BAD_REQUEST, "RepoMismatch"),
            ReadBackError::UnknownCollection(_) => (StatusCode::BAD_REQUEST, "UnknownCollection"),
            ReadBackError::Unaskable(_) => (StatusCode::BAD_REQUEST, "InvalidRequest"),
            ReadBackError::Pds { .. } => (StatusCode::BAD_GATEWAY, "UpstreamFailure"),
            ReadBackError::Refused { .. } => (StatusCode::BAD_REQUEST, "InvalidRequest"),
            ReadBackError::Index(_) => (StatusCode::INTERNAL_SERVER_ERROR, "InternalServerError"),
        };
        Failure::new(status, error, message)
    }
}

/// Reads each of `uris`, records in `did`'s repo, back from `pds`, that
/// repo's PDS, and puts it in `index` as the PDS has it, or deletes it
/// from `index` if the PDS has no such record. `did` is tracked from then
/// on, so that Jetstream keeps what it writes next.
///
/// A URI outside `did`'s repo, or of a collection the index does not keep,
/// refuses the whole call before anything is read, as does a `pds` that
/// [`Ctx::may_ask`] does not let be asked. The records are read
/// at once, and each one read is applied whatever became of the others,
/// so a call that fails part way can be made again as it was. A URI named
/// twice is read once.
pub async fn read_back(
    ctx: &Ctx,
    index: &Index,
    did: &str,
    pds: &str,
    uris: &[String],
) -> Result<ReadBack, ReadBackError> {
    let mut named: Vec<(&str, &str, &str)> = Vec::new();
    for uri in uris {
        let Some((repo, collection, rkey)) = record_uri(uri) else {
            return Err(ReadBackError::NotARecord(uri.clone()));
        };
        if repo != did {
            return Err(ReadBackError::RepoMismatch(uri.clone()));
        }
        if records::table_of(collection).is_none() {
            return Err(ReadBackError::UnknownCollection(uri.clone()));
        }
        if !named.iter().any(|(u, _, _)| u == uri) {
            named.push((uri, collection, rkey));
        }
    }
    ctx.may_ask(pds).map_err(ReadBackError::Unaskable)?;
    let pds = Xrpc::new(ctx.guarded.clone(), pds);
    let read = named
        .iter()
        .map(|&(_, collection, rkey)| get_record(&pds, did, collection, rkey));
    let read = futures::future::join_all(read).await;
    index.track(did).map_err(ReadBackError::Index)?;
    let mut done = ReadBack::default();
    let mut failed = None;
    for ((uri, _, _), read) in named.into_iter().zip(read) {
        let applied = match read {
            Ok(Some((cid, record))) => match index.put(uri, &cid, &record) {
                Ok(applied) => {
                    if applied == Applied::Created {
                        index.arrived(uri);
                    }
                    Ok(&mut done.indexed)
                }
                Err(PutError::Refused(why)) => Err(ReadBackError::Refused {
                    uri: uri.to_string(),
                    why: why.to_string(),
                }),
                Err(PutError::Db(e)) => Err(ReadBackError::Index(e)),
            },
            Ok(None) => match index.delete(uri) {
                Ok(_) => Ok(&mut done.not_found),
                Err(e) => Err(ReadBackError::Index(e)),
            },
            Err(error) => Err(ReadBackError::Pds {
                uri: uri.to_string(),
                error,
            }),
        };
        match applied {
            Ok(into) => into.push(uri.to_string()),
            Err(e) => failed = failed.or(Some(e)),
        }
    }
    match failed {
        Some(e) => Err(e),
        None => Ok(done),
    }
}

/// The record at `did`/`collection`/`rkey` as its PDS has it, with its
/// CID; none if the PDS says it has no such record.
pub(crate) async fn get_record(
    pds: &Xrpc,
    did: &str,
    collection: &str,
    rkey: &str,
) -> anyhow::Result<Option<(String, Value)>> {
    #[derive(Deserialize)]
    struct Out {
        cid: String,
        value: Value,
    }
    let params = [("repo", did), ("collection", collection), ("rkey", rkey)];
    let out: Out = match pds.query("com.atproto.repo.getRecord", &params, None).await {
        Ok(out) => out,
        Err(e) if XrpcError::of(&e).is_some_and(|e| e.error == "RecordNotFound") => {
            return Ok(None);
        }
        Err(e) => return Err(e),
    };
    Ok(Some((out.cid, out.value)))
}

#[derive(Deserialize)]
struct Input {
    uris: Vec<String>,
}

/// `social.grain.sync.indexRecords`: the caller's service token checked,
/// then [`read_back`] from the PDS their DID document names. It answers
/// once every record is indexed, so a read after it sees the write.
pub async fn index_records(
    State(app): State<Arc<App>>,
    headers: HeaderMap,
    body: Bytes,
) -> Result<Json<ReadBack>, Failure> {
    let (Some(index), Some(aud)) = (&app.index, &app.did) else {
        let why = "this server keeps no index, or has no DID to take service tokens for";
        return Err(Failure::new(
            StatusCode::NOT_IMPLEMENTED,
            "MethodNotImplemented",
            why,
        ));
    };
    let token = headers
        .get(header::AUTHORIZATION)
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.strip_prefix("Bearer "))
        .ok_or_else(Failure::authentication_required)?;
    let did = grain::auth::verify(&app.ctx, token, aud, LXM)
        .await
        .map_err(|e| Failure::new(StatusCode::UNAUTHORIZED, "InvalidToken", format!("{e:#}")))?;
    let input: Input = serde_json::from_slice(&body)
        .map_err(|e| Failure::invalid(format!("the input is not {{uris}}: {e}")))?;
    if input.uris.is_empty() || input.uris.len() > MAX_URIS {
        let why = format!(
            "uris names 1 to {MAX_URIS} records, not {}",
            input.uris.len()
        );
        return Err(Failure::invalid(why));
    }
    let pds = grain::identity::resolve_pds(&app.ctx, &did)
        .await
        .map_err(unresolved)?;
    let done = read_back(&app.ctx, index, &did, &pds, &input.uris).await?;
    tracing::info!(%did, indexed = done.indexed.len(), not_found = done.not_found.len(),
        "indexRecords");
    Ok(Json(done))
}

/// The caller's PDS not found, as `indexRecords` answers it: the caller's
/// to fix if their DID document names one grain does not ask, else the
/// network's.
fn unresolved(e: anyhow::Error) -> Failure {
    match e.downcast::<grain::guard::Refused>() {
        Ok(refused) => ReadBackError::Unaskable(refused).into(),
        Err(e) => Failure::new(StatusCode::BAD_GATEWAY, "UpstreamFailure", format!("{e:#}")),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn each_failure_answers_as_xrpc_does() {
        let uri = || "at://did:plc:a/social.grain.gallery/3l3qo2vuowo2a".to_string();
        let cases = [
            (ReadBackError::NotARecord(uri()), 400, "InvalidRequest"),
            (ReadBackError::RepoMismatch(uri()), 400, "RepoMismatch"),
            (
                ReadBackError::UnknownCollection(uri()),
                400,
                "UnknownCollection",
            ),
            (
                ReadBackError::Unaskable(grain::guard::Refused(
                    "http://pds is not on https".into(),
                )),
                400,
                "InvalidRequest",
            ),
            (
                ReadBackError::Pds {
                    uri: uri(),
                    error: anyhow::anyhow!("down"),
                },
                502,
                "UpstreamFailure",
            ),
            (
                ReadBackError::Refused {
                    uri: uri(),
                    why: "title: required".into(),
                },
                400,
                "InvalidRequest",
            ),
            (
                ReadBackError::Index(rusqlite::Error::InvalidQuery),
                500,
                "InternalServerError",
            ),
        ];
        let refused = grain::guard::Refused("http://pds is not on https".into());
        let failure = unresolved(refused.into());
        assert_eq!(
            (failure.status.as_u16(), failure.error),
            (400, "InvalidRequest")
        );
        let failure = unresolved(anyhow::anyhow!("did:plc:a names no #atproto_pds service"));
        assert_eq!(
            (failure.status.as_u16(), failure.error),
            (502, "UpstreamFailure")
        );
        for (e, status, error) in cases {
            let said = e.to_string();
            let failure = Failure::from(e);
            assert_eq!(failure.status.as_u16(), status, "{said}");
            assert_eq!(failure.error, error);
            assert_eq!(failure.message, said);
        }
    }
}

//! Records read back from their PDS into the index as soon as they are
//! written: `social.grain.sync.refreshRecords`, which the apps call after
//! writing to their own PDS, and `social.grain.sync.indexRecords`, which
//! it replaces and which answers older apps from the same [`read_back`],
//! in its own shape, until they are past `/app-version.json`'s minimum.
//!
//! What the index takes is only ever what the PDS proves. The caller
//! names URIs, never content: each is read with its proof
//! (`com.atproto.sync.getRecord`) from the PDS the repo's DID document
//! names, the commit held to the key that document names and the record
//! to the tree the commit signed ([`grain::repo::prove`]). The record, or
//! its absence, is kept at the commit's revision, as Jetstream's commits
//! are ([`Index::put_rev`], [`Index::delete_rev`]): Jetstream's copy of the
//! same revision or an older one then changes nothing, and a deletion read
//! back stands against an older write the stream brings late, for as long
//! as backfill keeps deletions. One new to the index is pushed
//! ([`Index::arrived`]).
//!
//! A PDS that proves only what it has (pds.js answers `RecordNotFound`)
//! is taken as saying a record is gone as of its latest revision, asked
//! for between two answers that it is gone, so that a record made since,
//! at a later revision, is not taken as gone.
//!
//! Whoever holds a service token names the PDS asked, by their DID
//! document, so it is asked only as [`grain::guard`] allows: on https, at
//! a public address, following no redirect.

use crate::App;
use crate::index::{Applied, Index, PutError, record_uri, records};
use crate::xrpc::Failure;
use anyhow::{Context, bail, ensure};
use axum::Json;
use axum::body::Bytes;
use axum::extract::State;
use axum::http::{HeaderMap, StatusCode, header};
use grain::crypto::PublicKey;
use grain::env::Ctx;
use grain::repo::{MAX_PROOF, prove};
use grain::xrpc::Xrpc;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::sync::Arc;

/// The method, as a service token for it names it in `lxm`.
pub const LXM: &str = "social.grain.sync.refreshRecords";

/// The method it replaces, served for apps built before it.
pub const INDEX_LXM: &str = "social.grain.sync.indexRecords";

/// The most URIs one call names, as the lexicons allow.
pub const MAX_URIS: usize = 25;

/// Which method reads records back, for what each takes and answers.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Method {
    /// `refreshRecords`: a record of a collection the index does not
    /// keep, or that does not fit its lexicon, is left alone.
    Refresh,
    /// `indexRecords`: either refuses the call.
    Index,
}

/// A record as its PDS proved it: its CID, none once it is gone.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct Refreshed {
    pub uri: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cid: Option<String>,
}

/// What `indexRecords` answers.
#[derive(Debug, Default, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReadBack {
    /// Read back from the PDS and put in the index.
    pub indexed: Vec<String>,
    /// Not on the PDS: deleted from the index, if it held them.
    pub not_found: Vec<String>,
}

impl From<Vec<Refreshed>> for ReadBack {
    fn from(read: Vec<Refreshed>) -> ReadBack {
        let mut done = ReadBack::default();
        for Refreshed { uri, cid } in read {
            match cid {
                Some(_) => done.indexed.push(uri),
                None => done.not_found.push(uri),
            }
        }
        done
    }
}

/// Why records were not read back.
#[derive(Debug)]
pub enum ReadBackError {
    /// Not a record's AT-URI.
    NotARecord(String),
    /// A record in another repo than the caller's.
    NotYours(String),
    /// A record of a collection the index does not keep, to `indexRecords`.
    UnknownCollection(String),
    /// The repo's PDS is not one grain asks ([`grain::guard`]).
    Unaskable(grain::guard::Refused),
    /// The PDS failed to answer for the record, or to prove what it
    /// answered.
    Unreachable {
        uri: String,
        error: anyhow::Error,
    },
    /// The PDS proved the record, and it does not fit its lexicon, to
    /// `indexRecords`.
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
            ReadBackError::NotYours(uri) => write!(f, "{uri} is not in the caller's repo"),
            ReadBackError::UnknownCollection(uri) => {
                write!(f, "{uri} is of a collection grain does not index")
            }
            ReadBackError::Unaskable(why) => write!(f, "the repo's PDS is not asked: {why}"),
            ReadBackError::Unreachable { uri, error } => write!(f, "reading {uri}: {error:#}"),
            ReadBackError::Refused { uri, why } => {
                write!(f, "{uri} does not fit its lexicon: {why}")
            }
            ReadBackError::Index(e) => write!(f, "index: {e}"),
        }
    }
}

impl std::error::Error for ReadBackError {}

impl From<rusqlite::Error> for ReadBackError {
    fn from(e: rusqlite::Error) -> ReadBackError {
        ReadBackError::Index(e)
    }
}

impl ReadBackError {
    /// The failure `method` answers with: `refreshRecords` by its
    /// lexicon's names, `indexRecords` by those it always had.
    pub fn answer(self, method: Method) -> Failure {
        let message = self.to_string();
        let refresh = method == Method::Refresh;
        let (status, error) = match self {
            ReadBackError::NotARecord(_) => (StatusCode::BAD_REQUEST, "InvalidRequest"),
            ReadBackError::NotYours(_) if refresh => (StatusCode::BAD_REQUEST, "NotYours"),
            ReadBackError::NotYours(_) => (StatusCode::BAD_REQUEST, "RepoMismatch"),
            ReadBackError::UnknownCollection(_) => (StatusCode::BAD_REQUEST, "UnknownCollection"),
            ReadBackError::Unaskable(_) if refresh => (StatusCode::BAD_REQUEST, "Unreachable"),
            ReadBackError::Unaskable(_) => (StatusCode::BAD_REQUEST, "InvalidRequest"),
            ReadBackError::Unreachable { .. } if refresh => {
                (StatusCode::BAD_GATEWAY, "Unreachable")
            }
            ReadBackError::Unreachable { .. } => (StatusCode::BAD_GATEWAY, "UpstreamFailure"),
            ReadBackError::Refused { .. } => (StatusCode::BAD_REQUEST, "InvalidRequest"),
            ReadBackError::Index(_) => (StatusCode::INTERNAL_SERVER_ERROR, "InternalServerError"),
        };
        Failure::new(status, error, message)
    }
}

/// The repo records are read back from: whose, the PDS its DID document
/// names, and the key that document says it signs with.
pub struct Repo {
    pub did: String,
    pub pds: String,
    pub key: PublicKey,
}

impl Repo {
    /// `did`'s repo, as its DID document names it now. A PDS grain does
    /// not ask is a [`grain::guard::Refused`].
    pub async fn of(ctx: &Ctx, did: &str) -> anyhow::Result<Repo> {
        let doc = grain::identity::document(ctx, did).await?;
        Ok(Repo {
            did: did.to_string(),
            pds: grain::identity::pds(ctx, did, &doc)?,
            key: atproto::did::signing_key(&doc)?,
        })
    }
}

/// A record named: its URI, collection and key.
pub type Named<'a> = (&'a str, &'a str, &'a str);

/// `uris`, records in `did`'s repo, each once, as `method` takes them: a
/// URI outside `did`'s repo refuses them all, as does, to `indexRecords`,
/// one of a collection the index does not keep.
pub fn named<'a>(
    did: &str,
    uris: &'a [String],
    method: Method,
) -> Result<Vec<Named<'a>>, ReadBackError> {
    let mut named: Vec<Named> = Vec::new();
    for uri in uris {
        let Some((repo, collection, rkey)) = record_uri(uri) else {
            return Err(ReadBackError::NotARecord(uri.clone()));
        };
        if repo != did {
            return Err(ReadBackError::NotYours(uri.clone()));
        }
        if method == Method::Index && records::table_of(collection).is_none() {
            return Err(ReadBackError::UnknownCollection(uri.clone()));
        }
        if !named.iter().any(|(u, _, _)| u == uri) {
            named.push((uri, collection, rkey));
        }
    }
    Ok(named)
}

/// Reads each of `named` ([`named`]) back from `repo` with its proof, and
/// keeps it in `index` as `method` does, at its commit's revision: the
/// record, or that the repo has none there. `repo`'s account is tracked
/// from then on, and read whole if it was not, so that Jetstream keeps
/// what it writes next.
///
/// A `repo` whose PDS [`Ctx::may_ask`] does not let be asked refuses the
/// call before anything is read. The records are read at once, and each
/// one read is applied whatever became of the others, so a call that
/// fails part way can be made again as it was.
pub async fn read_back(
    ctx: &Ctx,
    index: &Index,
    repo: &Repo,
    named: &[Named<'_>],
    method: Method,
) -> Result<Vec<Refreshed>, ReadBackError> {
    ctx.may_ask(&repo.pds).map_err(ReadBackError::Unaskable)?;
    let read = named
        .iter()
        .map(|&(_, collection, rkey)| proved(ctx, repo, collection, rkey));
    let read = futures::future::join_all(read).await;
    let kept = |collection: &str| records::table_of(collection).is_some();
    if named.iter().any(|&(_, collection, _)| kept(collection)) && index.track(&repo.did)? {
        index.resync(&repo.did)?;
    }
    let mut done = Vec::with_capacity(named.len());
    let mut failed = None;
    for (&(uri, collection, _), read) in named.iter().zip(read) {
        let applied = match read {
            Ok(proof) if kept(collection) => keep(index, uri, &proof, method).map(|()| proof),
            Ok(proof) => Ok(proof),
            Err(error) => Err(ReadBackError::Unreachable {
                uri: uri.to_string(),
                error,
            }),
        };
        match applied {
            Ok(proof) => done.push(Refreshed {
                uri: uri.to_string(),
                cid: proof.record.map(|(cid, _)| cid.to_string()),
            }),
            Err(e) => failed = failed.or(Some(e)),
        }
    }
    match failed {
        Some(e) => Err(e),
        None => Ok(done),
    }
}

/// `proof` kept in `index` at its revision: the record at `uri`, or its
/// absence. One that does not fit its lexicon refuses `indexRecords`, and
/// is left alone for `refreshRecords`, as Jetstream leaves it.
fn keep(index: &Index, uri: &str, proof: &Proof, method: Method) -> Result<(), ReadBackError> {
    let Some((cid, block)) = &proof.record else {
        index.delete_rev(uri, &proof.rev)?;
        return Ok(());
    };
    let refused = |why: String| match method {
        Method::Index => Err(ReadBackError::Refused {
            uri: uri.to_string(),
            why,
        }),
        Method::Refresh => {
            tracing::info!(%uri, %why, "refreshRecords: left a record alone");
            Ok(())
        }
    };
    let Ok(record) = atproto::drisl::decode(block) else {
        return refused("a record that is not DRISL".into());
    };
    match index.put_rev(uri, &cid.to_string(), &record.to_json(), &proof.rev) {
        Ok(Applied::Created) => index.arrived(uri),
        Ok(_) => {}
        Err(PutError::Refused(why)) => return refused(why.to_string()),
        Err(PutError::Db(e)) => return Err(e.into()),
    }
    Ok(())
}

/// A record as its repo has it at a revision: its CID and DRISL, or none.
#[derive(Debug, Clone, PartialEq)]
pub struct Proof {
    pub rev: String,
    pub record: Option<(atproto::Cid, Vec<u8>)>,
}

/// The record at `collection`/`rkey` in `repo`, read from its PDS with its
/// proof and proved. A PDS that answers `RecordNotFound` rather than
/// proving there is none is asked its latest revision, then asked again:
/// still none, the record is gone as of that revision.
pub async fn proved(ctx: &Ctx, repo: &Repo, collection: &str, rkey: &str) -> anyhow::Result<Proof> {
    if let Some(proof) = proof(ctx, repo, collection, rkey).await? {
        return Ok(proof);
    }
    #[derive(Deserialize)]
    struct Head {
        rev: String,
    }
    let pds = Xrpc::new(ctx.guarded.clone(), &repo.pds);
    let params = [("did", repo.did.as_str())];
    let head: Head = pds
        .query("com.atproto.sync.getLatestCommit", &params, None)
        .await
        .context("its latest revision")?;
    ensure!(
        atproto::syntax::is_tid(&head.rev),
        "a latest revision that is not one: {}",
        head.rev
    );
    let again = proof(ctx, repo, collection, rkey).await?;
    Ok(again.unwrap_or(Proof {
        rev: head.rev,
        record: None,
    }))
}

/// [`proved`]'s one read: none where the PDS says `RecordNotFound`.
async fn proof(
    ctx: &Ctx,
    repo: &Repo,
    collection: &str,
    rkey: &str,
) -> anyhow::Result<Option<Proof>> {
    let url = format!("{}/xrpc/com.atproto.sync.getRecord", repo.pds);
    let params = [
        ("did", repo.did.as_str()),
        ("collection", collection),
        ("rkey", rkey),
    ];
    let mut res = grain::telemetry::send(ctx.guarded.get(url).query(&params), 0).await?;
    let status = res.status();
    if !status.is_success() {
        let said: Value = res.json().await.unwrap_or_default();
        if said["error"] == "RecordNotFound" {
            return Ok(None);
        }
        bail!("its PDS answered {status}");
    }
    let mut car = Vec::new();
    while let Some(chunk) = res.chunk().await? {
        car.extend_from_slice(&chunk);
        ensure!(
            car.len() <= MAX_PROOF,
            "a proof of more than {MAX_PROOF} bytes"
        );
    }
    let key = format!("{collection}/{rkey}");
    let proved = prove(&car, &repo.did, &repo.key, &key).context("its proof")?;
    Ok(Some(Proof {
        rev: proved.commit.rev,
        record: proved.record,
    }))
}

#[derive(Deserialize)]
struct Input {
    uris: Vec<String>,
}

/// What `refreshRecords` answers.
#[derive(Serialize)]
pub struct Output {
    pub records: Vec<Refreshed>,
}

/// `social.grain.sync.refreshRecords`: the caller, by service token or the
/// web's cookie, then [`read_back`] from the repo their DID document
/// names. It answers once every record is kept, so a read after it sees
/// the write.
pub async fn refresh_records(
    State(app): State<Arc<App>>,
    headers: HeaderMap,
    body: Bytes,
) -> Result<Json<Output>, Failure> {
    let Some(index) = &app.index else {
        let why = "this server keeps no index";
        return Err(Failure::new(
            StatusCode::NOT_IMPLEMENTED,
            "MethodNotImplemented",
            why,
        ));
    };
    let did = crate::viewer::writer(&app, &headers, LXM).await?;
    let input = input(&body)?;
    let records = refresh(&app, index, &did, &input.uris, Method::Refresh).await?;
    let gone = records.iter().filter(|r| r.cid.is_none()).count();
    tracing::info!(%did, records = records.len(), gone, "refreshRecords");
    Ok(Json(Output { records }))
}

/// `social.grain.sync.indexRecords`, deprecated: [`refresh_records`] in
/// its own shape, for apps built before it. Only a service token for it
/// lets a call in.
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
    let did = grain::auth::verify(&app.ctx, token, aud, INDEX_LXM)
        .await
        .map_err(|e| Failure::new(StatusCode::UNAUTHORIZED, "InvalidToken", format!("{e:#}")))?;
    let input = input(&body)?;
    if input.uris.is_empty() {
        return Err(Failure::invalid(format!(
            "uris names 1 to {MAX_URIS} records, not 0"
        )));
    }
    let read = refresh(&app, index, &did, &input.uris, Method::Index).await?;
    let done = ReadBack::from(read);
    tracing::info!(%did, indexed = done.indexed.len(), not_found = done.not_found.len(),
        "indexRecords");
    Ok(Json(done))
}

/// [`read_back`] of `uris` from `did`'s repo, as its DID document names
/// it, as `method` takes them and answers.
async fn refresh(
    app: &App,
    index: &Index,
    did: &str,
    uris: &[String],
    method: Method,
) -> Result<Vec<Refreshed>, Failure> {
    let answer = |e: ReadBackError| e.answer(method);
    let named = named(did, uris, method).map_err(answer)?;
    let repo = Repo::of(&app.ctx, did)
        .await
        .map_err(|e| unresolved(e, method))?;
    read_back(&app.ctx, index, &repo, &named, method)
        .await
        .map_err(answer)
}

/// The input, `{uris}`, naming at most [`MAX_URIS`].
fn input(body: &[u8]) -> Result<Input, Failure> {
    let input: Input = serde_json::from_slice(body)
        .map_err(|e| Failure::invalid(format!("the input is not {{uris}}: {e}")))?;
    if input.uris.len() > MAX_URIS {
        let why = format!(
            "uris names at most {MAX_URIS} records, not {}",
            input.uris.len()
        );
        return Err(Failure::invalid(why));
    }
    Ok(input)
}

/// The caller's repo not found, as `method` answers it: the caller's to
/// fix if their DID document names a PDS grain does not ask, else the
/// network's.
fn unresolved(e: anyhow::Error, method: Method) -> Failure {
    match e.downcast::<grain::guard::Refused>() {
        Ok(refused) => ReadBackError::Unaskable(refused).answer(method),
        Err(e) if method == Method::Refresh => {
            Failure::new(StatusCode::BAD_GATEWAY, "Unreachable", format!("{e:#}"))
        }
        Err(e) => Failure::new(StatusCode::BAD_GATEWAY, "UpstreamFailure", format!("{e:#}")),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn uri() -> String {
        "at://did:plc:a/social.grain.gallery/3l3qo2vuowo2a".into()
    }

    fn refused() -> grain::guard::Refused {
        grain::guard::Refused("http://pds is not on https".into())
    }

    #[test]
    fn each_failure_answers_as_its_method_does() {
        // Each failure, and what indexRecords and refreshRecords answer.
        let cases: [(fn() -> ReadBackError, _, _); 7] = [
            (
                || ReadBackError::NotARecord(uri()),
                (400, "InvalidRequest"),
                (400, "InvalidRequest"),
            ),
            (
                || ReadBackError::NotYours(uri()),
                (400, "RepoMismatch"),
                (400, "NotYours"),
            ),
            (
                || ReadBackError::UnknownCollection(uri()),
                (400, "UnknownCollection"),
                (400, "UnknownCollection"),
            ),
            (
                || ReadBackError::Unaskable(refused()),
                (400, "InvalidRequest"),
                (400, "Unreachable"),
            ),
            (
                || ReadBackError::Unreachable {
                    uri: uri(),
                    error: anyhow::anyhow!("down"),
                },
                (502, "UpstreamFailure"),
                (502, "Unreachable"),
            ),
            (
                || ReadBackError::Refused {
                    uri: uri(),
                    why: "title: required".into(),
                },
                (400, "InvalidRequest"),
                (400, "InvalidRequest"),
            ),
            (
                || ReadBackError::Index(rusqlite::Error::InvalidQuery),
                (500, "InternalServerError"),
                (500, "InternalServerError"),
            ),
        ];
        for (made, index, refresh) in cases {
            for (method, answer) in [(Method::Index, index), (Method::Refresh, refresh)] {
                let said = made().to_string();
                let failure = made().answer(method);
                assert_eq!((failure.status.as_u16(), failure.error), answer, "{said}");
                assert_eq!(failure.message, said);
            }
        }
        for (method, unaskable, gone) in [
            (Method::Index, "InvalidRequest", "UpstreamFailure"),
            (Method::Refresh, "Unreachable", "Unreachable"),
        ] {
            let failure = unresolved(refused().into(), method);
            assert_eq!((failure.status.as_u16(), failure.error), (400, unaskable));
            let no_pds = anyhow::anyhow!("did:plc:a names no #atproto_pds service");
            let failure = unresolved(no_pds, method);
            assert_eq!((failure.status.as_u16(), failure.error), (502, gone));
        }
    }

    #[test]
    fn what_the_index_cannot_keep_refuses_index_records_alone() {
        let index = Index::memory().unwrap();
        let uri = uri();
        let block = b"\xff".to_vec();
        let unread = Proof {
            rev: "3l3qo2vuowo2a".into(),
            record: Some((atproto::Cid::of_cbor(&block), block)),
        };
        // A record that is not DRISL: refused, or left alone.
        match keep(&index, &uri, &unread, Method::Index) {
            Err(ReadBackError::Refused { why, .. }) => {
                assert_eq!(why, "a record that is not DRISL")
            }
            other => panic!("{other:?}"),
        }
        keep(&index, &uri, &unread, Method::Refresh).unwrap();
        // An index that fails fails either.
        index
            .read(|db| db.execute_batch("DROP TABLE record_rev"))
            .unwrap();
        let gallery = atproto::Value::Map(std::collections::BTreeMap::from([
            (
                "$type".into(),
                atproto::Value::String("social.grain.gallery".into()),
            ),
            ("title".into(), atproto::Value::String("Fog".into())),
            (
                "createdAt".into(),
                atproto::Value::String("2026-10-31T12:00:00.000Z".into()),
            ),
        ]));
        let block = atproto::drisl::encode(&gallery);
        let held = Proof {
            rev: "3l3qo2vuowo2a".into(),
            record: Some((atproto::Cid::of_cbor(&block), block)),
        };
        let gone = Proof {
            rev: "3l3qo2vuowo2a".into(),
            record: None,
        };
        for (proof, method) in [(&held, Method::Refresh), (&gone, Method::Index)] {
            match keep(&index, &uri, proof, method) {
                Err(ReadBackError::Index(_)) => {}
                other => panic!("{other:?}"),
            }
        }
    }

    #[test]
    fn index_records_answers_what_was_found_and_what_was_not() {
        let read = vec![
            Refreshed {
                uri: "at://a/b/c".into(),
                cid: Some("bafy".into()),
            },
            Refreshed {
                uri: "at://a/b/d".into(),
                cid: None,
            },
        ];
        assert_eq!(
            ReadBack::from(read),
            ReadBack {
                indexed: vec!["at://a/b/c".into()],
                not_found: vec!["at://a/b/d".into()],
            }
        );
    }
}

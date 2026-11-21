//! The web's writes: `social.grain.repo.createRecord`, `putRecord`,
//! `deleteRecord`, `applyWrites` and `uploadBlob`, which write to the
//! logged-in account's PDS with the session grain-serve holds for it
//! ([`crate::login`]) and put what they wrote in the index before they
//! answer, so a read after one sees the write.
//!
//! Each takes what `com.atproto.repo`'s method of its name takes, less the
//! `repo`, which is the session's. A record is of a collection the index
//! keeps, fits its lexicon, and is refused before it is written if not; one
//! with no `$type` is given its collection's. The index takes the record
//! as the PDS was given it, under the URI and CID the PDS answers, so
//! Jetstream delivering it later changes nothing; a URI outside the
//! account's repo is not taken.
//!
//! Only the web calls them, by its cookie, from a page of the site: the
//! apps write to their own PDS and call `social.grain.sync.refreshRecords`,
//! and a service token here is refused.
//!
//! A PDS refusing the access token has it refreshed and is asked once
//! more; refusing it again ends the session. One refusing for want of
//! scope ends a session asked for less than a login asks for now, so the
//! account logs in again, and answers `ScopeMissingError` for one that was
//! asked for it all and granted less, where logging in again would not
//! help.

use crate::App;
use crate::index::{Applied, PutError, record_uri, records};
use crate::login;
use crate::xrpc::Failure;
use axum::Json;
use axum::body::Bytes;
use axum::extract::State;
use axum::http::{HeaderMap, StatusCode, header};
use grain::oauth;
use grain::session::Session;
use grain::xrpc::{Xrpc, XrpcError};
use serde::Deserialize;
use serde_json::{Value, json};
use std::sync::Arc;

/// The most writes one `applyWrites` makes, as the PDS allows.
pub const MOST_WRITES: usize = 200;

/// The most bytes one `uploadBlob` takes.
pub const MOST_BYTES: usize = 50 * 1024 * 1024;

const APPLY: &str = "social.grain.repo.applyWrites";
const PDS_APPLY: &str = "com.atproto.repo.applyWrites";

/// The errors a PDS refuses a write with that are passed on by name. Any
/// other it refuses with is `InvalidRequest`.
const PASSED: &[&str] = &[
    "InvalidSwap",
    "InvalidRecord",
    "BlobTooLarge",
    "InvalidMimeType",
    "RateLimitExceeded",
    "PayloadTooLarge",
    "AccountDeactivated",
    "AccountTakedown",
    "RepoDeactivated",
    "RepoTakendown",
    "RepoSuspended",
];

/// The account writing: the web's, by its cookie, from a page of the site.
pub async fn writer(app: &App, headers: &HeaderMap, lxm: &str) -> Result<String, Failure> {
    if headers.contains_key(header::AUTHORIZATION) {
        let why = "a service token writes to its own PDS, then calls \
                   social.grain.sync.refreshRecords";
        return Err(Failure::new(StatusCode::FORBIDDEN, "Forbidden", why));
    }
    crate::viewer::writer(app, headers, lxm).await
}

fn parse<T: serde::de::DeserializeOwned>(body: &[u8]) -> Result<T, Failure> {
    serde_json::from_slice(body).map_err(|e| Failure::invalid(format!("the input: {e}")))
}

/// `record`, of `collection`, as it is written: an object, given its
/// collection's `$type` if it names none, that the index would take.
fn record(app: &App, collection: &str, record: Value) -> Result<Value, Failure> {
    if records::table_of(collection).is_none() {
        let why = format!("grain does not index {collection}");
        return Err(Failure::new(
            StatusCode::BAD_REQUEST,
            "UnknownCollection",
            why,
        ));
    }
    let Value::Object(mut fields) = record else {
        return Err(Failure::invalid("the record is not an object"));
    };
    fields
        .entry("$type")
        .or_insert_with(|| Value::String(collection.into()));
    let record = Value::Object(fields);
    match index(app).check(collection, &record) {
        Ok(()) => Ok(record),
        Err(PutError::Refused(why)) => Err(Failure::new(
            StatusCode::BAD_REQUEST,
            "InvalidRecord",
            why.to_string(),
        )),
        Err(PutError::Db(e)) => Err(e.into()),
    }
}

fn index(app: &App) -> &crate::index::Index {
    app.index
        .as_deref()
        .expect("a server that logs in keeps an index")
}

/// What a call to the PDS sends.
enum Input<'a> {
    Json(&'a Value),
    Bytes(&'a Bytes, &'a str),
}

/// Calls `nsid` at `did`'s PDS with its web session ([`with_session`]).
async fn call(app: &App, did: &str, nsid: &str, input: Input<'_>) -> Result<Value, Failure> {
    let sent = with_session(app, did, nsid, |session| {
        let pds = Xrpc::new(app.ctx.guarded.clone(), &session.service);
        let input = &input;
        async move {
            let auth = session.auth();
            match input {
                Input::Json(body) => pds.procedure(nsid, Some(body), Some(&auth)).await,
                Input::Bytes(bytes, mime) => {
                    let bytes = bytes.to_vec();
                    pds.procedure_bytes(nsid, bytes, mime, Some(&auth)).await
                }
            }
        }
    });
    sent.await?.map_err(|e| refused(nsid, e))
}

/// Runs `call`, which calls `nsid` at `did`'s PDS, with `did`'s web
/// session: refreshed and run once more if the PDS refuses its access
/// token, the session ended if it refuses the fresh one too, and
/// [`out_of_scope`] if it refuses for want of scope. Any other failure is
/// the call's, for the caller to answer.
pub async fn with_session<T, F, Fut>(
    app: &App,
    did: &str,
    nsid: &str,
    call: F,
) -> Result<anyhow::Result<T>, Failure>
where
    F: Fn(Session) -> Fut,
    Fut: std::future::Future<Output = anyhow::Result<T>>,
{
    let mut session = login::session(app, did).await?;
    let mut again = true;
    loop {
        let e = match call(session.clone()).await {
            Ok(out) => return Ok(Ok(out)),
            Err(e) => e,
        };
        if oauth::out_of_scope(&e) {
            return Err(out_of_scope(app, &session, nsid, &e).await?);
        }
        let token = XrpcError::of(&e).is_some_and(|x| {
            ["InvalidToken", "ExpiredToken", "invalid_token"].contains(&x.error.as_str())
        });
        if token && again {
            again = false;
            session = login::refreshed(app, did, &session.access_jwt).await?;
            continue;
        }
        if token {
            tracing::info!(%did, %nsid, error = %format!("{e:#}"),
                "a PDS refused a fresh access token");
            index(app).end_web_session(did)?;
            return Err(login::ended());
        }
        return Ok(Err(e));
    }
}

/// The PDS refusing `nsid` for want of scope: the session ended if it was
/// asked for less than a login asks of its PDS now ([`login::asked`]),
/// else refused. One asked for the space scopes is never behind, as a PDS
/// found to serve no spaces may only have failed to answer.
async fn out_of_scope(
    app: &App,
    session: &Session,
    nsid: &str,
    e: &anyhow::Error,
) -> Result<Failure, Failure> {
    let did = &session.did;
    tracing::info!(%did, %nsid, error = %format!("{e:#}"), "a PDS refused for want of scope");
    let asked = login::asked(app, &session.service).await?;
    if oauth::behind(session, &asked) && oauth::behind(session, &oauth::scope(true)) {
        index(app).end_web_session(did)?;
        let why = "the login was granted before grain asked for what this needs: log in again";
        return Ok(Failure::new(
            StatusCode::UNAUTHORIZED,
            "AuthenticationRequired",
            why,
        ));
    }
    let why = format!("the account's PDS did not grant what {nsid} needs");
    Ok(Failure::new(
        StatusCode::FORBIDDEN,
        "ScopeMissingError",
        why,
    ))
}

/// The PDS refusing a write, or failing to answer, as grain-serve answers.
fn refused(nsid: &str, e: anyhow::Error) -> Failure {
    match XrpcError::of(&e) {
        Some(x) if (400..500).contains(&x.status) && x.status != 401 => {
            let error = PASSED.iter().find(|n| **n == x.error);
            let status = StatusCode::from_u16(x.status).expect("a 4xx is a status");
            let why = format!("the PDS refused {nsid}: {}: {}", x.error, x.message);
            Failure::new(status, error.copied().unwrap_or("InvalidRequest"), why)
        }
        _ => {
            let why = format!("{nsid} at the PDS: {e:#}");
            Failure::new(StatusCode::BAD_GATEWAY, "UpstreamFailure", why)
        }
    }
}

/// The `uri` and `cid` a PDS answered with for a write to `collection`
/// in `did`'s repo, if the URI is one.
fn written<'a>(did: &str, collection: &str, out: &'a Value) -> Result<(&'a str, &'a str), Failure> {
    let (uri, cid) = (out["uri"].as_str(), out["cid"].as_str());
    let named = uri.and_then(record_uri);
    match (uri, cid, named) {
        (Some(uri), Some(cid), Some((repo, c, _))) if repo == did && c == collection => {
            Ok((uri, cid))
        }
        _ => {
            let why = format!("the PDS answered a write to {collection} with {out}");
            Err(Failure::new(
                StatusCode::BAD_GATEWAY,
                "UpstreamFailure",
                why,
            ))
        }
    }
}

/// The revision of the commit a PDS answered a write with, if it names
/// one, as `com.atproto.repo`'s writes answer `commit`.
pub(crate) fn rev_of(out: &Value) -> Option<&str> {
    let rev = out["commit"]["rev"].as_str();
    rev.filter(|rev| atproto::syntax::is_tid(rev))
}

/// Puts `record` in the index, as written to the PDS at the revision
/// `rev`, or now if the PDS named none ([`crate::index::Index::put_rev`]),
/// so that Jetstream bringing an older version late changes nothing. A
/// failure is the index's, not the write's, which stands: Jetstream
/// brings it after.
fn keep(app: &App, did: &str, uri: &str, cid: &str, record: &Value, rev: Option<&str>) {
    let index = index(app);
    let kept = index
        .track(did)
        .map_err(PutError::Db)
        .and_then(|_| match rev {
            Some(rev) => index.put_rev(uri, cid, record, rev),
            None => index.put(uri, cid, record),
        });
    match kept {
        Ok(Applied::Created) => index.arrived(uri),
        Ok(_) => {}
        Err(e) => tracing::warn!(%uri, error = %e, "indexing a web write"),
    }
}

/// Deletes `uri` from the index, as deleted at the revision `rev`, or now.
fn forget(app: &App, uri: &str, rev: Option<&str>) {
    let index = index(app);
    let forgot = match rev {
        Some(rev) => index.delete_rev(uri, rev),
        None => index.delete(uri),
    };
    if let Err(e) = forgot {
        tracing::warn!(%uri, error = %e, "unindexing a web delete");
    }
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Create {
    collection: String,
    rkey: Option<String>,
    record: Value,
    swap_commit: Option<String>,
}

/// `social.grain.repo.createRecord`.
pub async fn create_record(
    State(app): State<Arc<App>>,
    headers: HeaderMap,
    body: Bytes,
) -> Result<Json<Value>, Failure> {
    let did = writer(&app, &headers, "social.grain.repo.createRecord").await?;
    let input: Create = parse(&body)?;
    let (uri, cid) = create(
        &app,
        &did,
        &input.collection,
        input.rkey.as_deref(),
        input.record,
        input.swap_commit,
    )
    .await?;
    Ok(Json(json!({ "uri": uri, "cid": cid })))
}

/// Creates `value` in `collection` of `did`'s repo with its web session,
/// as `createRecord` does, at `rkey` if one is given, swapping the commit
/// `swap_commit` names, and keeps it in the index. Returns its URI and CID.
pub async fn create(
    app: &App,
    did: &str,
    collection: &str,
    rkey: Option<&str>,
    value: Value,
    swap_commit: Option<String>,
) -> Result<(String, String), Failure> {
    let value = record(app, collection, value)?;
    let body = with_repo(
        did,
        json!({
            "collection": collection,
            "rkey": rkey,
            "record": value,
            "swapCommit": swap_commit,
        }),
    );
    let nsid = "com.atproto.repo.createRecord";
    let out = call(app, did, nsid, Input::Json(&body)).await?;
    let (uri, cid) = written(did, collection, &out)?;
    keep(app, did, uri, cid, &value, rev_of(&out));
    Ok((uri.to_string(), cid.to_string()))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Put {
    collection: String,
    rkey: String,
    record: Value,
    swap_record: Option<String>,
    swap_commit: Option<String>,
}

/// `social.grain.repo.putRecord`.
pub async fn put_record(
    State(app): State<Arc<App>>,
    headers: HeaderMap,
    body: Bytes,
) -> Result<Json<Value>, Failure> {
    let did = writer(&app, &headers, "social.grain.repo.putRecord").await?;
    let input: Put = parse(&body)?;
    let swaps = [input.swap_record, input.swap_commit];
    let (uri, cid) = put(
        &app,
        &did,
        &input.collection,
        &input.rkey,
        input.record,
        swaps,
    )
    .await?;
    Ok(Json(json!({ "uri": uri, "cid": cid })))
}

/// Puts `value` at `rkey` in `collection` of `did`'s repo with its web
/// session, as `putRecord` does, swapping the record and commit `swaps`
/// name, and keeps it in the index. Returns its URI and CID.
pub async fn put(
    app: &App,
    did: &str,
    collection: &str,
    rkey: &str,
    value: Value,
    swaps: [Option<String>; 2],
) -> Result<(String, String), Failure> {
    let value = record(app, collection, value)?;
    let [swap_record, swap_commit] = swaps;
    let body = with_repo(
        did,
        json!({
            "collection": collection,
            "rkey": rkey,
            "record": value,
            "swapRecord": swap_record,
            "swapCommit": swap_commit,
        }),
    );
    let out = call(app, did, "com.atproto.repo.putRecord", Input::Json(&body)).await?;
    let (uri, cid) = written(did, collection, &out)?;
    keep(app, did, uri, cid, &value, rev_of(&out));
    Ok((uri.to_string(), cid.to_string()))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Delete {
    collection: String,
    rkey: String,
    swap_record: Option<String>,
    swap_commit: Option<String>,
}

/// `social.grain.repo.deleteRecord`.
pub async fn delete_record(
    State(app): State<Arc<App>>,
    headers: HeaderMap,
    body: Bytes,
) -> Result<Json<Value>, Failure> {
    let did = writer(&app, &headers, "social.grain.repo.deleteRecord").await?;
    let input: Delete = parse(&body)?;
    let uri = uri_of(&did, &input.collection, &input.rkey)?;
    let body = with_repo(
        &did,
        json!({
            "collection": input.collection,
            "rkey": input.rkey,
            "swapRecord": input.swap_record,
            "swapCommit": input.swap_commit,
        }),
    );
    let nsid = "com.atproto.repo.deleteRecord";
    let out = call(&app, &did, nsid, Input::Json(&body)).await?;
    forget(&app, &uri, rev_of(&out));
    Ok(Json(json!({})))
}

/// The URI of `rkey` in `collection` of `did`'s repo, a collection the
/// index keeps.
fn uri_of(did: &str, collection: &str, rkey: &str) -> Result<String, Failure> {
    if records::table_of(collection).is_none() {
        let why = format!("grain does not index {collection}");
        return Err(Failure::new(
            StatusCode::BAD_REQUEST,
            "UnknownCollection",
            why,
        ));
    }
    let uri = format!("at://{did}/{collection}/{rkey}");
    match record_uri(&uri) {
        Some((_, _, r)) if r == rkey => Ok(uri),
        _ => Err(Failure::invalid(format!("not a record key: {rkey}"))),
    }
}

/// Calls the procedure `nsid` at `did`'s PDS with its web session, as
/// the writes here do: refreshed once if refused, and the PDS's refusal
/// answered as theirs are.
pub async fn at_pds(app: &App, did: &str, nsid: &str, body: &Value) -> Result<Value, Failure> {
    call(app, did, nsid, Input::Json(body)).await
}

/// `input`, an object, naming `did`'s repo, without the fields it left out.
fn with_repo(did: &str, input: Value) -> Value {
    let mut input = present(input);
    input["repo"] = did.into();
    input
}

/// `input`, an object, without its fields that are null.
fn present(input: Value) -> Value {
    let fields = input.as_object().into_iter().flatten();
    let kept = fields.filter(|(_, v)| !v.is_null());
    Value::Object(kept.map(|(k, v)| (k.clone(), v.clone())).collect())
}

#[derive(Deserialize)]
struct Writes {
    writes: Vec<Value>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Write {
    #[serde(rename = "$type")]
    kind: String,
    collection: String,
    rkey: Option<String>,
    value: Option<Value>,
}

/// `social.grain.repo.applyWrites`: the writes made at once, as the PDS
/// makes them, each one's result in the place of its write. The PDS has
/// made them all by the time its answer is read, so a result that does not
/// hold answers 502 with the ones before it indexed and the rest left to
/// Jetstream. They are one commit, at one revision, so the index is told
/// only the last write to each record, as the commit leaves it: one before
/// it, at the same revision, would leave it stale.
pub async fn apply_writes(
    State(app): State<Arc<App>>,
    headers: HeaderMap,
    body: Bytes,
) -> Result<Json<Value>, Failure> {
    let did = writer(&app, &headers, APPLY).await?;
    let input: Writes = parse(&body)?;
    if input.writes.is_empty() || input.writes.len() > MOST_WRITES {
        let why = format!(
            "writes names 1 to {MOST_WRITES} writes, not {}",
            input.writes.len()
        );
        return Err(Failure::invalid(why));
    }
    // Each write's kind, collection and value: a create's or an update's
    // value to index, a delete's URI to unindex.
    let mut made: Vec<(&str, String, Result<Value, String>)> = Vec::new();
    let mut sent = Vec::new();
    for write in input.writes {
        let write: Write =
            serde_json::from_value(write).map_err(|e| Failure::invalid(format!("a write: {e}")))?;
        let kind = write.kind.strip_prefix(&format!("{APPLY}#"));
        let rkey = write.rkey.as_deref().unwrap_or_default();
        let (kind, value) = match (kind, write.value) {
            (Some("create"), Some(value)) => ("create", record(&app, &write.collection, value)?),
            (Some("update"), Some(value)) => {
                uri_of(&did, &write.collection, rkey)?;
                ("update", record(&app, &write.collection, value)?)
            }
            (Some("delete"), None) => ("delete", Value::Null),
            _ => {
                let why = format!(
                    "a write is {APPLY}#create or #update, with a value, or #delete, \
                     without one, not {}",
                    write.kind
                );
                return Err(Failure::invalid(why));
            }
        };
        sent.push(present(json!({
            "$type": format!("{PDS_APPLY}#{kind}"),
            "collection": write.collection,
            "rkey": write.rkey,
            "value": value,
        })));
        let kept = match kind {
            "delete" => Err(uri_of(&did, &write.collection, rkey)?),
            _ => Ok(value),
        };
        made.push((kind, write.collection, kept));
    }
    let body = json!({ "repo": did, "writes": sent });
    let out = call(&app, &did, PDS_APPLY, Input::Json(&body)).await?;
    let answered = out["results"].as_array().filter(|r| r.len() == made.len());
    let Some(answered) = answered else {
        let why = format!("the PDS answered {} writes with {out}", made.len());
        return Err(Failure::new(
            StatusCode::BAD_GATEWAY,
            "UpstreamFailure",
            why,
        ));
    };
    let rev = rev_of(&out);
    // Each record written, and its CID and value, none if deleted.
    let mut done: Vec<(&str, Option<(&str, &Value)>)> = Vec::new();
    let (mut results, mut failed) = (Vec::new(), None);
    for ((kind, collection, kept), out) in made.iter().zip(answered) {
        let result = match kept {
            Ok(value) => match written(&did, collection, out) {
                Ok((uri, cid)) => {
                    done.push((uri, Some((cid, value))));
                    json!({ "$type": format!("{APPLY}#{kind}Result"), "uri": uri, "cid": cid })
                }
                Err(e) => {
                    failed = Some(e);
                    break;
                }
            },
            Err(uri) => {
                done.push((uri.as_str(), None));
                json!({ "$type": format!("{APPLY}#deleteResult") })
            }
        };
        results.push(result);
    }
    for (i, (uri, write)) in done.iter().enumerate() {
        if done[i + 1..].iter().any(|(later, _)| later == uri) {
            continue;
        }
        match write {
            Some((cid, value)) => keep(&app, &did, uri, cid, value, rev),
            None => forget(&app, uri, rev),
        }
    }
    match failed {
        Some(e) => Err(e),
        None => Ok(Json(json!({ "results": results }))),
    }
}

/// `social.grain.repo.uploadBlob`: the body, of the type its
/// `Content-Type` names, uploaded to the PDS, which answers with the blob
/// a record references it by.
pub async fn upload_blob(
    State(app): State<Arc<App>>,
    headers: HeaderMap,
    body: Bytes,
) -> Result<Json<Value>, Failure> {
    let did = writer(&app, &headers, "social.grain.repo.uploadBlob").await?;
    let mime = headers
        .get(header::CONTENT_TYPE)
        .and_then(|v| v.to_str().ok())
        .ok_or_else(|| Failure::invalid("an upload names its Content-Type"))?;
    let nsid = "com.atproto.repo.uploadBlob";
    let out = call(&app, &did, nsid, Input::Bytes(&body, mime)).await?;
    if !out["blob"].is_object() {
        let why = format!("the PDS answered an upload with {out}");
        return Err(Failure::new(
            StatusCode::BAD_GATEWAY,
            "UpstreamFailure",
            why,
        ));
    }
    Ok(Json(json!({ "blob": out["blob"] })))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_pds_refusing_is_answered_by_name_or_not() {
        let x = |status, error: &str| {
            anyhow::Error::from(XrpcError {
                status,
                error: error.into(),
                message: "no".into(),
                reset: None,
            })
        };
        let cases = [
            (x(400, "InvalidSwap"), 400, "InvalidSwap"),
            (x(400, "SomethingElse"), 400, "InvalidRequest"),
            (x(429, "RateLimitExceeded"), 429, "RateLimitExceeded"),
            (x(401, "AuthMissing"), 502, "UpstreamFailure"),
            (x(500, "InternalServerError"), 502, "UpstreamFailure"),
            (
                anyhow::anyhow!("connection refused"),
                502,
                "UpstreamFailure",
            ),
        ];
        for (e, status, error) in cases {
            let failure = refused("com.atproto.repo.createRecord", e);
            assert_eq!((failure.status.as_u16(), failure.error), (status, error));
        }
    }

    #[test]
    fn an_index_failing_after_a_write_leaves_the_write_standing() {
        let index = crate::index::Index::memory().unwrap();
        index
            .read(|db| db.execute_batch("DROP TABLE follow; DROP TABLE repo"))
            .unwrap();
        let ctx = grain::env::Ctx::new(grain::env::Env::from_vars(|_| None));
        let app = App {
            index: Some(Arc::new(index)),
            ..App::bare(ctx)
        };
        let uri = "at://did:plc:a/social.grain.graph.follow/3l3";
        let record = json!({ "$type": "social.grain.graph.follow", "subject": "did:plc:b",
            "createdAt": "2026-10-31T12:00:00.000Z" });
        for rev in [None, Some("3l3qo2vuowo2a")] {
            keep(&app, "did:plc:a", uri, "bafy", &record, rev);
            forget(&app, uri, rev);
        }
        let answered = json!({ "uri": uri, "commit": { "cid": "bafy", "rev": "3l3qo2vuowo2a" } });
        assert_eq!(rev_of(&answered), Some("3l3qo2vuowo2a"));
        assert_eq!(rev_of(&json!({ "commit": { "rev": "now" } })), None);
        assert_eq!(rev_of(&json!({})), None);
    }

    #[test]
    fn a_pds_answers_only_for_its_own_repo() {
        let did = "did:plc:a";
        let c = "social.grain.favorite";
        let ok = json!({ "uri": "at://did:plc:a/social.grain.favorite/3l3", "cid": "bafy" });
        assert_eq!(
            written(did, c, &ok).unwrap(),
            ("at://did:plc:a/social.grain.favorite/3l3", "bafy")
        );
        for wrong in [
            json!({ "uri": "at://did:plc:b/social.grain.favorite/3l3", "cid": "bafy" }),
            json!({ "uri": "at://did:plc:a/social.grain.comment/3l3", "cid": "bafy" }),
            json!({ "uri": "at://did:plc:a/social.grain.favorite/3l3" }),
            json!({ "uri": "nonsense", "cid": "bafy" }),
            json!({}),
        ] {
            let failure = written(did, c, &wrong).unwrap_err();
            assert_eq!(failure.status, StatusCode::BAD_GATEWAY, "{wrong}");
        }
        assert!(uri_of(did, c, "3l3").is_ok());
        assert_eq!(uri_of(did, c, "a/b").unwrap_err().error, "InvalidRequest");
        assert_eq!(
            uri_of(did, "app.bsky.feed.like", "3l3").unwrap_err().error,
            "UnknownCollection"
        );
    }
}

//! Whether a PDS serves permissioned spaces, and so whether its accounts
//! can take part in groups:
//! `social.grain.server.getSpaceSupport`, and what a login asks
//! for ([`crate::login`]).
//!
//! `community.lexicon.service.describe` is asked first, and its list of
//! methods trusted when a PDS answers it. The reference PDS does not serve
//! it, so a PDS that does not is asked each method grain needs and, first,
//! one no server has ([`CONTROL`]): a method it serves is answered
//! otherwise than one it does not, refused for want of its parameters or
//! of auth, where one it does not serve is refused as the control is. A
//! PDS answering every method as it answers the control, as one with no
//! spaces does, has none of them; one that answers neither question has
//! none either.
//!
//! What is found is kept in the index by PDS: a yes for an hour, a no for
//! five minutes, as a no that has gone stale keeps an account from what
//! its PDS has started to serve and a yes that has only costs one failed
//! call. `force` asks again whatever is kept.

use crate::App;
use crate::xrpc::Failure;
use axum::Json;
use axum::extract::{Query, State};
use axum::http::{HeaderMap, StatusCode, header};
use grain::env::Ctx;
use serde::Serialize;
use serde_json::Value;
use std::collections::{HashMap, HashSet};
use std::sync::Arc;
use std::time::Duration;

pub const GET: &str = "social.grain.server.getSpaceSupport";

const DESCRIBE: &str = "community.lexicon.service.describe";

/// A method no server serves, grain's own, to learn how a PDS refuses one.
pub const CONTROL: &str = "social.grain.unspecced.methodThatDoesNotExist";

/// The space methods grain calls, each by the names a PDS may serve it
/// by: the reference PDS's `com.atproto.space` and `memberspace`, and
/// pds.js's and zds's `simplespace`. One name of each is enough; the first
/// names it when none is served.
pub const REQUIRED: &[&[&str]] = &[
    &[
        "com.atproto.simplespace.createSpace",
        "com.atproto.space.createSpace",
    ],
    &[
        "com.atproto.simplespace.addMember",
        "com.atproto.simplespace.putMember",
        "com.atproto.memberspace.putMember",
    ],
    &[
        "com.atproto.simplespace.listMembers",
        "com.atproto.memberspace.listMembers",
    ],
    &[
        "com.atproto.simplespace.getSpace",
        "com.atproto.space.getSpace",
    ],
    &["com.atproto.space.createRecord"],
    &["com.atproto.space.listRecords"],
    &["com.atproto.space.listRepos"],
    &["com.atproto.space.getDelegationToken"],
    &["com.atproto.space.getSpaceCredential"],
    &["com.atproto.space.getBlob"],
];

/// How long a PDS has to answer each question.
const TAKES: Duration = Duration::from_secs(5);

/// How long, in seconds, a yes is kept, and a no.
const YES_LASTS: i64 = 60 * 60;
const NO_LASTS: i64 = 5 * 60;

/// What was found of a PDS, as `getSpaceSupport` answers it.
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Support {
    /// It serves every method grain calls.
    pub supported: bool,
    pub pds: String,
    pub checked_at: String,
    /// The first name of each method it does not serve.
    pub missing: Vec<String>,
}

/// `nsid` asked of `pds` with nothing: the status and body it answers,
/// none if it does not.
async fn ask(ctx: &Ctx, pds: &str, nsid: &str) -> Option<(u16, Value)> {
    let url = format!("{}/xrpc/{nsid}", pds.trim_end_matches('/'));
    let req = ctx.guarded.get(&url).timeout(TAKES);
    let res = req.header(header::ACCEPT, "application/json").send().await;
    let res = res.ok()?;
    let status = res.status().as_u16();
    Some((status, res.json().await.unwrap_or(Value::Null)))
}

/// The methods `pds`'s describe names, none if it answers no describe.
async fn described(ctx: &Ctx, pds: &str) -> Option<HashSet<String>> {
    let (status, body) = ask(ctx, pds, DESCRIBE).await?;
    if !(200..300).contains(&status) {
        return None;
    }
    let methods = body["methods"].as_array()?;
    let names = methods.iter().filter_map(|m| m["value"].as_str());
    Some(names.map(str::to_string).collect())
}

/// How `pds` answers `nsid`, as one answer is told from another: its
/// status and its error's name.
async fn answer(ctx: &Ctx, pds: &str, nsid: &str) -> Option<String> {
    let (status, body) = ask(ctx, pds, nsid).await?;
    Some(format!("{status}:{}", body["error"].as_str().unwrap_or("")))
}

/// The names of [`REQUIRED`] `pds` answers otherwise than [`CONTROL`],
/// none if it does not answer the control.
async fn probed(ctx: &Ctx, pds: &str) -> Option<HashSet<String>> {
    let control = answer(ctx, pds, CONTROL).await?;
    let names: Vec<&str> = REQUIRED.iter().flat_map(|n| n.iter().copied()).collect();
    let answers = futures::future::join_all(names.iter().map(|n| answer(ctx, pds, n))).await;
    let served = names.into_iter().zip(answers);
    let served = served.filter(|(_, a)| a.as_ref().is_some_and(|a| *a != control));
    Some(served.map(|(n, _)| n.to_string()).collect())
}

/// What `pds` serves, asked now.
pub async fn probe(ctx: &Ctx, pds: &str) -> Support {
    let methods = match described(ctx, pds).await {
        Some(methods) => Some(methods),
        None => probed(ctx, pds).await,
    };
    let served = |names: &&[&str]| {
        let methods = methods.as_ref();
        methods.is_some_and(|m| names.iter().any(|n| m.contains(*n)))
    };
    let missing: Vec<String> = REQUIRED
        .iter()
        .filter(|names| !served(names))
        .map(|names| names[0].to_string())
        .collect();
    Support {
        supported: missing.is_empty(),
        pds: pds.to_string(),
        checked_at: grain::keys::now_iso(),
        missing,
    }
}

/// What `pds` serves: as last found, while that lasts and unless `force`,
/// or asked now and kept.
pub async fn support(app: &App, pds: &str, force: bool) -> Result<Support, Failure> {
    let index = index(app)?;
    if let Some((kept, age)) = index.space_support(pds)?.filter(|_| !force) {
        let lasts = if kept.supported { YES_LASTS } else { NO_LASTS };
        if age < lasts {
            return Ok(kept);
        }
    }
    let found = probe(&app.ctx, pds).await;
    index.keep_space_support(&found)?;
    Ok(found)
}

pub(crate) fn index(app: &App) -> Result<&crate::index::Index, Failure> {
    let why = "this server keeps no index";
    let none = || Failure::new(StatusCode::NOT_IMPLEMENTED, "MethodNotImplemented", why);
    app.index.as_deref().ok_or_else(none)
}

/// `social.grain.server.getSpaceSupport`: whether the caller's
/// PDS, as its DID document names it, serves spaces.
pub async fn get_space_support(
    State(app): State<Arc<App>>,
    headers: HeaderMap,
    Query(params): Query<HashMap<String, String>>,
) -> Result<Json<Support>, Failure> {
    let did = crate::viewer::viewer(&app, &headers, GET).await?;
    let did = did.ok_or_else(Failure::authentication_required)?;
    let force = match params.get("force").map(String::as_str) {
        None | Some("false") => false,
        Some("true") => true,
        Some(other) => {
            let why = format!("force is true or false, not {other}");
            return Err(Failure::invalid(why));
        }
    };
    let pds = grain::identity::resolve_pds(&app.ctx, &did).await;
    let pds = pds.map_err(|e| super::upstream(format!("finding {did}'s PDS: {e:#}")))?;
    Ok(Json(support(&app, &pds, force).await?))
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::http::Uri;
    use axum::response::IntoResponse;
    use serde_json::json;
    use std::sync::Mutex;

    /// A PDS answering each method `answers` names as it says, and every
    /// other as `otherwise`; and the methods it was asked, in turn.
    async fn pds(
        answers: Vec<(&'static str, u16, Value)>,
        otherwise: (u16, Value),
    ) -> (String, Arc<Mutex<Vec<String>>>) {
        let asked = Arc::new(Mutex::new(Vec::new()));
        let kept = asked.clone();
        let answer = move |uri: Uri| {
            let nsid = uri.path().trim_start_matches("/xrpc/").to_string();
            kept.lock().unwrap().push(nsid.clone());
            let found = answers.iter().find(|(n, _, _)| *n == nsid);
            let (status, body) = found.map_or(otherwise.clone(), |(_, s, b)| (*s, b.clone()));
            let status = StatusCode::from_u16(status).unwrap();
            async move { (status, Json(body)).into_response() }
        };
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let url = format!("http://{}", listener.local_addr().unwrap());
        let router = axum::Router::new().fallback(answer);
        tokio::spawn(async move { axum::serve(listener, router).await });
        (url, asked)
    }

    fn ctx() -> Ctx {
        let env = grain::env::Env::from_vars(|k| (k == "GRAIN_ALLOW_PRIVATE").then(|| "1".into()));
        Ctx::new(env)
    }

    fn error(name: &str) -> Value {
        json!({ "error": name, "message": "no" })
    }

    fn every_first_name() -> Vec<String> {
        REQUIRED.iter().map(|n| n[0].to_string()).collect()
    }

    #[tokio::test]
    async fn a_describe_is_taken_at_its_word() {
        let all: Vec<Value> = REQUIRED
            .iter()
            .map(|n| json!({ "value": n[n.len() - 1] }))
            .collect();
        let (url, asked) = pds(
            vec![(DESCRIBE, 200, json!({ "methods": all }))],
            (400, error("InvalidRequest")),
        )
        .await;
        let found = probe(&ctx(), &format!("{url}/")).await;
        assert!(found.supported && found.missing.is_empty(), "{found:?}");
        assert_eq!(found.pds, format!("{url}/"));
        assert_eq!(*asked.lock().unwrap(), [DESCRIBE]);
        let some = json!({ "methods": [{ "value": "com.atproto.space.getBlob" }, { "value": 1 }] });
        let (url, _) = pds(vec![(DESCRIBE, 200, some)], (400, error("InvalidRequest"))).await;
        let found = probe(&ctx(), &url).await;
        assert!(!found.supported);
        let mut missing = every_first_name();
        missing.retain(|n| n != "com.atproto.space.getBlob");
        assert_eq!(found.missing, missing);
    }

    #[tokio::test]
    async fn without_a_describe_each_method_is_told_from_one_no_server_has() {
        // As pds.js answers: what it does not serve is not implemented,
        // and what it does wants auth. This one has no getBlob.
        let no = (501, error("MethodNotImplemented"));
        let mut answers: Vec<(&'static str, u16, Value)> = REQUIRED
            .iter()
            .flat_map(|n| n.iter())
            .filter(|n| **n != "com.atproto.space.getBlob")
            .map(|n| (*n, 401, error("AuthRequired")))
            .collect();
        answers.push((DESCRIBE, 501, error("MethodNotImplemented")));
        let (url, asked) = pds(answers, no).await;
        let found = probe(&ctx(), &url).await;
        assert_eq!(found.missing, ["com.atproto.space.getBlob"]);
        assert!(!found.supported);
        let asked = asked.lock().unwrap().clone();
        assert_eq!(asked[..2], [DESCRIBE, CONTROL]);
        assert_eq!(
            asked.len(),
            2 + REQUIRED.iter().map(|n| n.len()).sum::<usize>()
        );
        // One name of each is enough.
        let answers = REQUIRED
            .iter()
            .map(|n| (n[n.len() - 1], 400, error("InvalidRequest")))
            .collect();
        let (url, _) = pds(answers, (401, error("AuthMissing"))).await;
        let found = probe(&ctx(), &url).await;
        assert!(found.supported, "{found:?}");
    }

    #[tokio::test]
    async fn a_pds_with_no_spaces_or_none_at_all_serves_none() {
        // As bsky.social answers: every method alike, so none is told apart.
        let (url, _) = pds(vec![], (401, error("AuthMissing"))).await;
        let found = probe(&ctx(), &url).await;
        assert!(!found.supported);
        assert_eq!(found.missing, every_first_name());
        let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
        let gone = format!("http://{}", listener.local_addr().unwrap());
        drop(listener);
        let found = probe(&ctx(), &gone).await;
        assert_eq!(found.missing, every_first_name());
    }

    #[tokio::test]
    async fn what_is_found_is_kept_a_while() {
        let (url, asked) = pds(vec![], (401, error("AuthMissing"))).await;
        let index = Arc::new(crate::index::Index::memory().unwrap());
        let app = App {
            index: Some(index.clone()),
            ..App::bare(ctx())
        };
        let found = support(&app, &url, false).await.unwrap();
        assert!(!found.supported);
        let count = || asked.lock().unwrap().len();
        let once = count();
        assert_eq!(support(&app, &url, false).await.unwrap(), found);
        assert_eq!(count(), once, "kept");
        support(&app, &url, true).await.unwrap();
        assert_eq!(count(), 2 * once, "forced");
        // A no is kept five minutes, a yes an hour.
        let aged = |supported, secs: u64| Support {
            supported,
            checked_at: grain::keys::iso(grain::keys::now_micros() - secs * 1_000_000),
            ..found.clone()
        };
        index.keep_space_support(&aged(false, 6 * 60)).unwrap();
        support(&app, &url, false).await.unwrap();
        assert_eq!(count(), 3 * once, "a no gone stale");
        index.keep_space_support(&aged(true, 30 * 60)).unwrap();
        assert!(support(&app, &url, false).await.unwrap().supported);
        assert_eq!(count(), 3 * once, "a yes still good");
        index.keep_space_support(&aged(true, 61 * 60)).unwrap();
        assert!(!support(&app, &url, false).await.unwrap().supported);
        assert_eq!(count(), 4 * once, "a yes gone stale");
        let none = App::bare(ctx());
        let failed = support(&none, &url, false).await.unwrap_err();
        assert_eq!(failed.status, StatusCode::NOT_IMPLEMENTED);
    }
}

//! Accounts that go, as knotless-serve takes them (its `accounts.rs` and
//! `web/account_data.rs`).
//!
//! **Deleted at its host.** Jetstream says an account was deleted; before
//! anything of it goes, the host its identity names now is asked whether
//! it still has it (`com.atproto.sync.getRepoStatus`): one that moved is
//! deleted from the host it left, and the host it moved to still answers
//! for it, so it stays ([`deletions`]). Only an answer that says so
//! counts as gone: the host has no such repo or says it was deleted, or the
//! identity is a tombstone or nothing at all ([`Asked::Gone`]). Where it
//! cannot be asked, PLC or the host down or answering oddly, it is asked
//! again later, and in the end kept ([`settle`]), since what grain keeps
//! for an account nothing would bring back. A deleted account loses what the
//! index holds from it, its records and what grain keeps for it
//! ([`Index::purge`]); what an admin holds of it stays, as do others'
//! records about it.
//!
//! **Deleting its grain data.** `social.grain.server.deleteAccount`, as
//! knotless's `dev.knotless.deleteAccountData` does. Asked by the web's
//! cookie, from a page of the site, grain-serve deletes the account's
//! records in every `social.grain.*` collection at its PDS itself, with
//! the session it keeps for it, up to `limit` a call, so the page can show
//! how far it has got and a run cut short carries on; once none is left,
//! it logs the browser out of the account, the session revoked at the PDS,
//! and forgets it: [`Index::purge`], and the account no longer tracked.
//! Asked with a service token, as the apps ask once they have deleted the
//! records at their own PDS, it deletes nothing, and forgets the account
//! only once its PDS lists no grain collection. The atproto account, and
//! other apps' records in it, a Bluesky cross-post among them, stay.

use crate::App;
use crate::index::Index;
use crate::login::upstream;
use crate::xrpc::Failure;
use axum::Json;
use axum::body::Bytes;
use axum::extract::State;
use axum::http::{HeaderMap, StatusCode, header};
use axum::response::{IntoResponse, Response};
use grain::env::Ctx;
use grain::xrpc::{Xrpc, XrpcError};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use std::sync::Arc;
use std::time::Duration;

/// The method, as a service token for it names it in `lxm`.
pub const DELETE_ACCOUNT: &str = "social.grain.server.deleteAccount";

/// What every grain collection's name starts with.
pub const PREFIX: &str = "social.grain.";

/// The records one `listRecords` reads, and one `applyWrites` deletes.
const PAGE: usize = 100;

/// The most records one call deletes unless it says, and the most it may.
const LIMIT: u64 = 400;
const MOST: u64 = 1000;

/// The order collections go in: what hangs off a gallery before the
/// gallery, and the profile last, so that what is left between calls
/// shows as little as it can. The rest go after, by name.
const ORDER: &[&str] = &[
    "social.grain.photo.exif",
    "social.grain.gallery.item",
    "social.grain.photo",
    "social.grain.gallery",
    "social.grain.story",
    "social.grain.favorite",
    "social.grain.comment",
    "social.grain.graph.follow",
    "social.grain.graph.block",
];
const LAST: &str = "social.grain.actor.profile";

/// Takes in that `did` was deleted at its host: its records go, with
/// what grain keeps for it, and it is said to be deleted.
pub fn deleted(index: &Index, did: &str) -> rusqlite::Result<()> {
    let purged = index.purge(did)?;
    index.set_host_status(did, Some("deleted"))?;
    tracing::info!(%did, purged, "an account was deleted");
    Ok(())
}

/// What the host `did`'s identity names now says of it.
#[derive(Debug, Clone, PartialEq)]
pub enum Asked {
    /// Gone: the host has no such repo (`RepoNotFound`) or says it was
    /// deleted (`active: false`, `status: deleted`), or the identity itself
    /// is gone (a PLC tombstone, `410`, or nothing there, `404`).
    Gone,
    /// The host has it: active, as it is where it moved to, or inactive in
    /// a way that can be undone (deactivated, suspended, taken down).
    Active,
    /// Nothing that says either: the identity or the host could not be
    /// read, or answered with what says neither. Why, for the log.
    Unknown(String),
}

/// Asks after `did`, which Jetstream says was deleted, where its identity
/// says it lives now ([`Asked`]).
pub async fn gone(ctx: &Ctx, did: &str) -> Asked {
    let doc = match grain::identity::document(ctx, did).await {
        Ok(doc) => doc,
        Err(e) if matches!(http_status(&e), Some(404 | 410)) => return Asked::Gone,
        Err(e) => return Asked::Unknown(format!("{e:#}")),
    };
    let pds = match grain::identity::pds(ctx, did, &doc) {
        Ok(pds) => pds,
        Err(e) => return Asked::Unknown(format!("{e:#}")),
    };
    let xrpc = Xrpc::new(ctx.guarded.clone(), &pds);
    let asked = [("did", did)];
    match xrpc
        .query::<Value>("com.atproto.sync.getRepoStatus", &asked, None)
        .await
    {
        Ok(status) => match (status["active"].as_bool(), status["status"].as_str()) {
            (Some(true), _) => Asked::Active,
            (Some(false), Some("deleted")) => Asked::Gone,
            // Deactivated, suspended or taken down, which can be undone:
            // the account is still there.
            (Some(false), why) => {
                tracing::info!(%did, status = why, "inactive at its host, not deleted");
                Asked::Active
            }
            (None, _) => Asked::Unknown(format!("{pds} answered {status}")),
        },
        Err(e) => match XrpcError::of(&e) {
            Some(refused) if refused.error == "RepoNotFound" => Asked::Gone,
            _ => Asked::Unknown(format!("{e:#}")),
        },
    }
}

/// The HTTP status a request in `e` was answered with, if it was.
fn http_status(e: &anyhow::Error) -> Option<u16> {
    let answered = e.chain().find_map(|c| c.downcast_ref::<reqwest::Error>());
    answered
        .and_then(reqwest::Error::status)
        .map(|s| s.as_u16())
}

/// How long to keep asking after an account no answer has settled.
#[derive(Debug, Clone, Copy)]
pub struct Patience {
    /// The wait before asking again, doubled each time.
    pub first: Duration,
    /// The longest wait.
    pub most: Duration,
    /// How many times to ask in all.
    pub tries: u32,
}

impl Default for Patience {
    /// Six asks over about half an hour, the last waits capped at ten
    /// minutes: long enough for PLC or a host to come back.
    fn default() -> Patience {
        Patience {
            first: Duration::from_secs(30),
            most: Duration::from_secs(600),
            tries: 6,
        }
    }
}

/// What came of an account Jetstream says was deleted.
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum Settled {
    /// Its host has it: it stays.
    Kept,
    /// Gone: it was forgotten ([`deleted`]).
    Purged,
    /// No answer said, however often asked: it stays, as nothing it
    /// leaves would come back.
    GaveUp,
}

/// Asks after `did` until an answer says, waiting longer each time, and
/// forgets it only if it is [`Asked::Gone`].
pub async fn settle(index: &Index, ctx: &Ctx, did: &str, patience: Patience) -> Settled {
    let mut wait = patience.first;
    for tried in 1..=patience.tries {
        match gone(ctx, did).await {
            Asked::Active => {
                tracing::info!(%did, "an account deleted where it was is active where it is now");
                return Settled::Kept;
            }
            Asked::Gone => {
                let _ =
                    deleted(index, did).inspect_err(|e| tracing::error!(%did, %e, "forgetting it"));
                return Settled::Purged;
            }
            Asked::Unknown(why) if tried < patience.tries => {
                tracing::warn!(%did, tried, %why, "asking after an account deleted, again later");
                tokio::time::sleep(wait).await;
                wait = (wait * 2).min(patience.most);
            }
            Asked::Unknown(why) => {
                tracing::error!(%did, tried, %why, "an account deleted, never settled: kept");
            }
        }
    }
    Settled::GaveUp
}

/// Each account Jetstream says was deleted, from `told`, asked after on
/// its own ([`settle`]) so that one waiting holds up none of the rest;
/// done once `told` closes and every one has settled.
pub async fn deletions(
    index: Arc<Index>,
    ctx: Ctx,
    mut told: tokio::sync::mpsc::UnboundedReceiver<String>,
    patience: Patience,
) {
    let mut asking = tokio::task::JoinSet::new();
    while let Some(did) = told.recv().await {
        let (index, ctx) = (index.clone(), ctx.clone());
        asking.spawn(async move { settle(&index, &ctx, &did, patience).await });
    }
    asking.join_all().await;
}

#[derive(Deserialize)]
struct Input {
    did: String,
    limit: Option<u64>,
}

/// What one call did.
#[derive(Serialize, Debug, Default, Clone, Copy, PartialEq)]
pub struct Step {
    /// The records it deleted.
    pub deleted: u64,
    /// Whether none is left: grain has then forgotten the account.
    pub done: bool,
}

/// The grain collections `did`'s repo at `pds` holds records in, in the
/// order they go.
async fn collections(pds: &Xrpc, did: &str) -> Result<Vec<String>, Failure> {
    #[derive(Deserialize)]
    struct Described {
        collections: Vec<String>,
    }
    let asked = [("repo", did)];
    let described: Described = pds
        .query("com.atproto.repo.describeRepo", &asked, None)
        .await
        .map_err(|e| upstream(e.context("com.atproto.repo.describeRepo")))?;
    let mut ours = described.collections;
    ours.retain(|c| c.starts_with(PREFIX));
    let at = |c: &str| ORDER.iter().position(|o| *o == c).unwrap_or(ORDER.len());
    let rank = |c: &str| (c == LAST, at(c));
    ours.sort_by(|a, b| rank(a).cmp(&rank(b)).then(a.cmp(b)));
    Ok(ours)
}

/// Whether `did`'s repo still holds a grain record, as its PDS says to
/// anyone.
async fn holds_any(ctx: &Ctx, did: &str) -> Result<bool, Failure> {
    let pds = grain::identity::resolve_pds(ctx, did)
        .await
        .map_err(|e| upstream(e.context("finding the account's PDS")))?;
    let pds = Xrpc::new(ctx.guarded.clone(), &pds);
    Ok(!collections(&pds, did).await?.is_empty())
}

/// Deletes up to `budget` of `did`'s grain records at its PDS, with
/// its web session, a collection at a time, a page at a time.
async fn delete_some(app: &App, did: &str, budget: u64) -> Result<Step, Failure> {
    let session = crate::login::session(app, did).await?;
    let pds = Xrpc::new(app.ctx.guarded.clone(), &session.service);
    let mut step = Step::default();
    for collection in collections(&pds, did).await? {
        loop {
            if step.deleted >= budget {
                return Ok(step);
            }
            #[derive(Deserialize)]
            struct Listed {
                records: Vec<Listing>,
            }
            #[derive(Deserialize)]
            struct Listing {
                uri: String,
            }
            let limit = (budget - step.deleted).min(PAGE as u64).to_string();
            let asked = [
                ("repo", did),
                ("collection", collection.as_str()),
                ("limit", limit.as_str()),
            ];
            let listed: Listed = pds
                .query("com.atproto.repo.listRecords", &asked, None)
                .await
                .map_err(|e| upstream(e.context("com.atproto.repo.listRecords")))?;
            if listed.records.is_empty() {
                break;
            }
            let writes: Vec<Value> = listed
                .records
                .iter()
                .filter_map(|r| r.uri.rsplit('/').next())
                .map(|rkey| {
                    json!({
                        "$type": "com.atproto.repo.applyWrites#delete",
                        "collection": collection,
                        "rkey": rkey,
                    })
                })
                .collect();
            let body = json!({ "repo": did, "writes": writes });
            crate::write::at_pds(app, did, "com.atproto.repo.applyWrites", &body).await?;
            step.deleted += writes.len() as u64;
        }
    }
    step.done = true;
    Ok(step)
}

/// Forgets `did`, whose grain records are gone: what the index holds of
/// it, and its web session, revoked at its PDS first.
async fn forget(app: &App, did: &str) -> Result<(), Failure> {
    let index = app.index.as_deref().expect("deleteAccount holds an index");
    crate::login::end_session(app, did).await?;
    let purged = index.purge(did)?;
    index.untrack(did)?;
    tracing::info!(%did, purged, "an account deleted its grain data");
    Ok(())
}

/// `social.grain.server.deleteAccount`.
pub async fn delete_account(
    State(app): State<Arc<App>>,
    headers: HeaderMap,
    body: Bytes,
) -> Result<Response, Failure> {
    if app.index.is_none() {
        let why = "this server keeps no index";
        let refused = Failure::new(StatusCode::NOT_IMPLEMENTED, "MethodNotImplemented", why);
        return Err(refused);
    }
    let did = crate::viewer::writer(&app, &headers, DELETE_ACCOUNT).await?;
    let input: Input = serde_json::from_slice(&body)
        .map_err(|e| Failure::invalid(format!("the input is not {{did, limit}}: {e}")))?;
    if input.did != did {
        let why = format!("{did} asks, but names {}", input.did);
        return Err(Failure::new(StatusCode::FORBIDDEN, "Forbidden", why));
    }
    if headers.contains_key(header::AUTHORIZATION) {
        if holds_any(&app.ctx, &did).await? {
            let why = format!("{did} still holds grain records: delete them first");
            return Err(Failure::new(StatusCode::BAD_REQUEST, "RecordsRemain", why));
        }
        forget(&app, &did).await?;
        let step = Step {
            deleted: 0,
            done: true,
        };
        return Ok(Json(step).into_response());
    }
    let limit = input.limit.unwrap_or(LIMIT);
    if !(1..=MOST).contains(&limit) {
        return Err(Failure::invalid(format!(
            "limit is 1 to {MOST}, not {limit}"
        )));
    }
    let step = delete_some(&app, &did, limit).await?;
    if !step.done {
        return Ok(Json(step).into_response());
    }
    // Logged out first, which revokes the session and sets the cookies to
    // the next account the browser holds, if any; then forgotten.
    let out = crate::login::logout(State(app.clone()), headers).await?;
    forget(&app, &did).await?;
    let (parts, _) = out.into_parts();
    Ok(Response::from_parts(
        parts,
        axum::body::Body::from(json!(step).to_string()),
    ))
}

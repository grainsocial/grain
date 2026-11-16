//! Muting: `social.grain.graph.muteActor` and `unmuteActor`, as Bluesky's
//! `app.bsky.graph.muteActor` and `unmuteActor` take them. A mute is
//! private to the account that made it, so it is no record: the index
//! keeps it ([`crate::index::graph`]), and the reads leave out what the
//! muted account says ([`crate::read::moderation::unmuted`]). Whom an
//! account muted, and blocked, it lists with `getMutes` and `getBlocks`
//! ([`crate::read::graph`]).
//!
//! The apps call them with a service token, the web with its cookie from a
//! page of the site ([`crate::viewer::writer`]).

use crate::App;
use crate::xrpc::Failure;
use axum::Json;
use axum::body::Bytes;
use axum::extract::State;
use axum::http::{HeaderMap, StatusCode};
use grain::lexicon;
use serde::Deserialize;
use serde_json::{Value, json};
use std::sync::Arc;

/// The methods, as a service token for each names it in `lxm`.
pub const MUTE: &str = "social.grain.graph.muteActor";
pub const UNMUTE: &str = "social.grain.graph.unmuteActor";

#[derive(Deserialize)]
struct Input {
    actor: String,
}

/// The account calling `lxm` and the account its input names, or why not.
async fn asked(
    app: &App,
    headers: &HeaderMap,
    body: &[u8],
    lxm: &str,
) -> Result<(String, String), Failure> {
    if app.index.is_none() {
        let why = "this server keeps no index";
        let refused = Failure::new(StatusCode::NOT_IMPLEMENTED, "MethodNotImplemented", why);
        return Err(refused);
    }
    let did = crate::viewer::writer(app, headers, lxm).await?;
    let input: Input = serde_json::from_slice(body)
        .map_err(|e| Failure::invalid(format!("the input is not {{actor}}: {e}")))?;
    if !lexicon::valid_did(&input.actor) {
        return Err(Failure::invalid("actor must be a valid did"));
    }
    Ok((did, input.actor))
}

/// `social.grain.graph.muteActor`: what `actor` says left out of the
/// caller's reads, from now on. Muting one already muted changes nothing;
/// an account cannot mute itself.
pub async fn mute_actor(
    State(app): State<Arc<App>>,
    headers: HeaderMap,
    body: Bytes,
) -> Result<Json<Value>, Failure> {
    let (did, actor) = asked(&app, &headers, &body, MUTE).await?;
    if actor == did {
        return Err(Failure::invalid("an account cannot mute itself"));
    }
    let index = app.index.as_ref().expect("asked holds an index");
    index.mute(&did, &actor, &grain::keys::now_iso())?;
    Ok(Json(json!({})))
}

/// `social.grain.graph.unmuteActor`: the mute taken back, if there was one.
pub async fn unmute_actor(
    State(app): State<Arc<App>>,
    headers: HeaderMap,
    body: Bytes,
) -> Result<Json<Value>, Failure> {
    let (did, actor) = asked(&app, &headers, &body, UNMUTE).await?;
    let index = app.index.as_ref().expect("asked holds an index");
    index.unmute(&did, &actor)?;
    Ok(Json(json!({})))
}

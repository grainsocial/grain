//! `social.grain.story.markViewed`: which stories the caller watched,
//! kept by the index ([`crate::index::stories`]) for the caller alone, so
//! that what was watched on the web is watched on the phone too. The
//! story views read it back as `viewer.viewed`, and `getAuthors` as each
//! author's `unviewedCount` ([`crate::read::story`]).
//!
//! The apps call it with a service token, the web with its cookie from a
//! page of the site ([`crate::viewer::writer`]).

use crate::App;
use crate::xrpc::Failure;
use axum::Json;
use axum::body::Bytes;
use axum::extract::State;
use axum::http::{HeaderMap, StatusCode};
use serde::Deserialize;
use serde_json::{Value, json};
use std::sync::Arc;

/// The method, as a service token for it names it in `lxm`.
pub const MARK_VIEWED: &str = "social.grain.story.markViewed";

/// The most stories one call marks, as the lexicon allows.
pub const MOST_STORIES: usize = 100;

#[derive(Deserialize)]
struct Input {
    stories: Vec<String>,
}

/// `social.grain.story.markViewed`: each of `stories` the index holds
/// marked watched by the caller. Marking one twice changes nothing, and
/// one the index does not hold, deleted since it was read, is passed over.
pub async fn mark_viewed(
    State(app): State<Arc<App>>,
    headers: HeaderMap,
    body: Bytes,
) -> Result<Json<Value>, Failure> {
    let Some(index) = &app.index else {
        let why = "this server keeps no index";
        let refused = Failure::new(StatusCode::NOT_IMPLEMENTED, "MethodNotImplemented", why);
        return Err(refused);
    };
    let did = crate::viewer::writer(&app, &headers, MARK_VIEWED).await?;
    let input: Input = serde_json::from_slice(&body)
        .map_err(|e| Failure::invalid(format!("the input is not {{stories}}: {e}")))?;
    let n = input.stories.len();
    if n == 0 || n > MOST_STORIES {
        let why = format!("stories names 1 to {MOST_STORIES} stories, not {n}");
        return Err(Failure::invalid(why));
    }
    if let Some(wrong) = input
        .stories
        .iter()
        .find(|u| !atproto::lexicon::is_at_uri(u))
    {
        return Err(Failure::invalid(format!("not an at-uri: {wrong}")));
    }
    let uris: Vec<&str> = input.stories.iter().map(String::as_str).collect();
    index.mark_viewed(&did, &uris, &grain::keys::now_iso())?;
    Ok(Json(json!({})))
}

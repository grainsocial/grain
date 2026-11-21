//! What an account has seen of its notifications:
//! `social.grain.notification.updateSeen`, as Bluesky's
//! `app.bsky.notification.updateSeen` takes it. The time is kept in
//! `notification_seen` ([`Index::set_seen`]), which the index cannot
//! rebuild from the network.
//!
//! [`Index::set_seen`]: crate::index::Index::set_seen

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
pub const UPDATE_SEEN: &str = "social.grain.notification.updateSeen";

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Seen {
    seen_at: String,
}

/// `social.grain.notification.updateSeen`: the caller's notifications
/// marked seen as of `seenAt`, which only an account may do.
pub async fn update_seen(
    State(app): State<Arc<App>>,
    headers: HeaderMap,
    body: Bytes,
) -> Result<Json<Value>, Failure> {
    let Some(index) = &app.index else {
        let why = "this server keeps no index";
        return Err(Failure::new(
            StatusCode::NOT_IMPLEMENTED,
            "MethodNotImplemented",
            why,
        ));
    };
    let did = crate::viewer::writer(&app, &headers, UPDATE_SEEN).await?;
    let input: Seen = serde_json::from_slice(&body)
        .map_err(|e| Failure::invalid(format!("the input is not {{seenAt}}: {e}")))?;
    // A datetime as atproto has one holds a year UTC writes in four digits,
    // so the index keeps any that passes.
    if !atproto::lexicon::is_datetime(&input.seen_at) {
        return Err(Failure::invalid("seenAt must be a valid datetime"));
    }
    index.set_seen(&did, &input.seen_at)?;
    Ok(Json(json!({})))
}

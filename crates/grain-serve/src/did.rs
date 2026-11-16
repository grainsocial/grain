//! grain-serve's DID document, at `/.well-known/did.json`: the `did:web`
//! of its public URL ([`crate::service_did`]), the one service tokens name
//! it by in `aud`, and the services it answers there.
//!
//! - [`APPVIEW`], `GrainAppView`: the queries and procedures, for a PDS to
//!   proxy an app's calls to, as an app names it in `atproto-proxy`
//!   (`did:web:grain.social#grain_appview`), as `#bsky_appview` is
//!   Bluesky's.
//! - [`LABELER`], `AtprotoLabeler`: the labels it gives out
//!   (`com.atproto.label.queryLabels`), as atproto finds a labeler's.
//! - [`MENTION_SEARCH`], `MentionSearchService`: Leaflet's mention search,
//!   `parts.page.mention.search`, which its editor asks for grain's
//!   accounts and galleries to mention. grain-serve does not answer it yet:
//!   until it does, the call is refused as any it does not serve.
//!
//! Each is at the address the document is read from: `did:web` resolves at
//! `https://<host>`, or the scheme `GRAIN_DID_WEB_SCHEME` names.
//!
//! Public, and read by pages on other sites, so any origin may read it.

use crate::App;
use axum::extract::State;
use axum::http::{StatusCode, header};
use axum::response::{IntoResponse, Response};
use serde_json::{Value, json};
use std::sync::Arc;

/// Where the document is.
pub const PATH: &str = "/.well-known/did.json";

/// The service PDSes proxy grain's calls to.
pub const APPVIEW: &str = "#grain_appview";

/// The service that gives out grain's labels.
pub const LABELER: &str = "#atproto_labeler";

/// The service Leaflet asks for grain's accounts and galleries to mention.
pub const MENTION_SEARCH: &str = "#mention_search";

/// The DID document of `did`, its services at `endpoint`.
pub fn document(did: &str, endpoint: &str) -> Value {
    let service =
        |id: &str, kind: &str| json!({"id": id, "type": kind, "serviceEndpoint": endpoint});
    json!({
        "@context": ["https://www.w3.org/ns/did/v1"],
        "id": did,
        "service": [
            service(APPVIEW, "GrainAppView"),
            service(LABELER, "AtprotoLabeler"),
            service(MENTION_SEARCH, "MentionSearchService"),
        ],
    })
}

/// `/.well-known/did.json`: the server's DID document, or 404 for a server
/// with no public URL, which has no DID.
pub async fn did_document(State(app): State<Arc<App>>) -> Response {
    let Some(did) = &app.did else {
        let why = "this server has no public URL, and so no DID";
        return (StatusCode::NOT_FOUND, why).into_response();
    };
    let host = did.trim_start_matches("did:web:").replace("%3A", ":");
    let endpoint = format!("{}://{host}", app.ctx.env.did_web_scheme);
    let headers = [
        (header::ACCESS_CONTROL_ALLOW_ORIGIN, "*"),
        (header::CACHE_CONTROL, "public, max-age=3600"),
    ];
    (headers, axum::Json(document(did, &endpoint))).into_response()
}

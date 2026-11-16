//! The web's pages: every request grain-serve does not answer itself,
//! handed to the SvelteKit app in `web/` that draws them, at `--web`
//! ([`crate::Settings::web`]), as knotless-serve hands its pages to its
//! app. The app reads back here for what to show, by `/xrpc`, with the
//! browser's cookie. With no app to hand to, what the server does not
//! answer is not found.
//!
//! A request is handed on whole, but for the headers about one hop of a
//! connection, with the host it was asked for as `x-forwarded-host` and,
//! where nothing in front said, `x-forwarded-proto` as `http`. The app's
//! answer comes back as it gave it, its redirects and cookies too, with
//! `x-content-type-options: nosniff` and `referrer-policy: same-origin`
//! where it set neither. An app that does not answer is a 502.

use axum::Router;
use axum::body::Body;
use axum::extract::Request;
use axum::http::{HeaderMap, HeaderValue, StatusCode, header};
use axum::response::{IntoResponse, Response};
use std::sync::{Arc, LazyLock};

/// The largest request body handed on: the pages take none to speak of.
pub const BODY_LIMIT: usize = 1 << 20;

/// Headers about one hop of a connection, which are not handed on.
const HOP: [header::HeaderName; 6] = [
    header::CONNECTION,
    header::HOST,
    header::TRANSFER_ENCODING,
    header::CONTENT_LENGTH,
    header::UPGRADE,
    header::TE,
];

static CLIENT: LazyLock<reqwest::Client> = LazyLock::new(|| {
    reqwest::Client::builder()
        .redirect(reqwest::redirect::Policy::none())
        .build()
        .expect("a client builds")
});

/// A router that hands every request to the app at `web`.
pub fn pages<S: Clone + Send + Sync + 'static>(web: &str) -> Router<S> {
    let web: Arc<str> = web.trim_end_matches('/').into();
    Router::new().fallback(move |req: Request| {
        let web = web.clone();
        async move { page(&web, req).await }
    })
}

async fn page(web: &str, req: Request) -> Response {
    match handed(web, req).await {
        Ok(res) => res,
        Err(e) => {
            tracing::warn!(error = %format!("{e:#}"), "the pages are not being drawn");
            let why = "The pages are not being drawn just now. Try again in a moment.";
            (StatusCode::BAD_GATEWAY, why).into_response()
        }
    }
}

/// `req`, as the app at `web` answers it.
async fn handed(web: &str, req: Request) -> anyhow::Result<Response> {
    let (parts, body) = req.into_parts();
    let at = parts.uri.path_and_query().map_or("/", |p| p.as_str());
    let mut headers = kept(&parts.headers);
    if let Some(host) = parts.headers.get(header::HOST) {
        headers.insert("x-forwarded-host", host.clone());
    }
    headers
        .entry("x-forwarded-proto")
        .or_insert(HeaderValue::from_static("http"));
    let body = axum::body::to_bytes(body, BODY_LIMIT).await?;
    let asked = CLIENT.request(parts.method, format!("{web}{at}"));
    let answer = grain::telemetry::send(asked.headers(headers).body(body), 0).await?;
    let mut res = Response::builder().status(answer.status());
    let mut headers = kept(answer.headers());
    for (name, value) in [
        (header::X_CONTENT_TYPE_OPTIONS, "nosniff"),
        (header::REFERRER_POLICY, "same-origin"),
    ] {
        headers
            .entry(name)
            .or_insert(HeaderValue::from_static(value));
    }
    *res.headers_mut().expect("a builder with a status") = headers;
    Ok(res.body(Body::from(answer.bytes().await?))?)
}

/// `headers`, but for those about one hop.
fn kept(headers: &HeaderMap) -> HeaderMap {
    let mut out = headers.clone();
    for name in HOP {
        out.remove(name);
    }
    out
}

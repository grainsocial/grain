//! The web's pages: what grain-serve does not answer itself, handed to a
//! stand-in for the web's app on loopback, and its answers handed back.

mod common;

use axum::body::Bytes;
use axum::extract::Request;
use axum::http::{HeaderMap, StatusCode, header};
use axum::response::{IntoResponse, Response};
use serde_json::{Value, json};

/// A stand-in for the web's app: it answers each request with what it was
/// asked, and `/away` with a redirect and two cookies.
async fn app() -> String {
    async fn answer(req: Request) -> Response {
        let (parts, body) = req.into_parts();
        if parts.uri.path() == "/away" {
            let mut res = (StatusCode::SEE_OTHER, "").into_response();
            let set = res.headers_mut();
            set.insert(header::LOCATION, "/elsewhere".parse().unwrap());
            set.append(header::SET_COOKIE, "a=1; Path=/".parse().unwrap());
            set.append(header::SET_COOKIE, "b=2; Path=/".parse().unwrap());
            set.insert(header::REFERRER_POLICY, "no-referrer".parse().unwrap());
            return res;
        }
        let body = axum::body::to_bytes(body, 1 << 20).await.unwrap();
        let named = |name: &str| {
            parts
                .headers
                .get(name)
                .map(|v| v.to_str().unwrap().to_string())
        };
        let asked = json!({
            "method": parts.method.as_str(),
            "at": parts.uri.to_string(),
            "host": named("host"),
            "forwardedHost": named("x-forwarded-host"),
            "forwardedProto": named("x-forwarded-proto"),
            "cookie": named("cookie"),
            "connection": named("connection"),
            "body": String::from_utf8_lossy(&body),
        });
        let mut res = axum::Json(asked).into_response();
        res.headers_mut()
            .insert("x-drawn-by", "the app".parse().unwrap());
        res
    }
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let url = format!("http://{}", listener.local_addr().unwrap());
    let router = axum::Router::new().fallback(answer);
    tokio::spawn(async move { axum::serve(listener, router).await });
    url
}

fn bare() -> grain_serve::App {
    grain_serve::App::bare(grain::env::Ctx::new(grain::env::Env::from_vars(|_| None)))
}

/// [`bare`], handing what it does not answer to the app at `web`.
fn handing(web: String) -> grain_serve::App {
    grain_serve::App {
        pages: Some(web),
        ..bare()
    }
}

/// What the stand-in was asked, and how grain-serve answered.
async fn asked(res: reqwest::Response) -> (u16, HeaderMap, Value) {
    let status = res.status().as_u16();
    let headers = res.headers().clone();
    let body: Bytes = res.bytes().await.unwrap();
    let body = serde_json::from_slice(&body).unwrap_or(Value::Null);
    (status, headers, body)
}

#[tokio::test]
async fn what_the_server_does_not_answer_the_app_draws() {
    let web = app().await;
    let served = common::served_app(handing(format!("{web}/"))).await;
    let http = reqwest::Client::builder()
        .redirect(reqwest::redirect::Policy::none())
        .build()
        .unwrap();

    let res = http
        .get(format!("{}/profile/alice.test?tab=stories", served.base))
        .header("cookie", "grain_session=x")
        .header("connection", "close")
        .send()
        .await
        .unwrap();
    let (status, headers, body) = asked(res).await;
    assert_eq!(status, 200, "{body}");
    assert_eq!(body["method"], "GET");
    assert_eq!(body["at"], "/profile/alice.test?tab=stories");
    let host = served.base.trim_start_matches("http://");
    assert_eq!(body["forwardedHost"], host);
    assert_eq!(body["forwardedProto"], "http");
    assert_eq!(body["cookie"], "grain_session=x");
    assert_eq!(body["connection"], Value::Null, "about one hop");
    assert_eq!(headers["x-drawn-by"], "the app");
    assert_eq!(headers["x-content-type-options"], "nosniff");
    assert_eq!(headers["referrer-policy"], "same-origin");

    // A form's body, and what said it came by https, are handed on.
    let res = http
        .post(format!("{}/settings", served.base))
        .header("x-forwarded-proto", "https")
        .body("theme=dark")
        .send()
        .await
        .unwrap();
    let (_, _, body) = asked(res).await;
    assert_eq!(
        (body["method"].as_str(), body["body"].as_str()),
        (Some("POST"), Some("theme=dark"))
    );
    assert_eq!(body["forwardedProto"], "https");

    // A redirect is the browser's to follow, with every cookie it sets.
    let res = http
        .get(format!("{}/away", served.base))
        .send()
        .await
        .unwrap();
    let (status, headers, _) = asked(res).await;
    assert_eq!(status, 303);
    assert_eq!(headers[header::LOCATION], "/elsewhere");
    let cookies: Vec<_> = headers.get_all(header::SET_COOKIE).iter().collect();
    assert_eq!(cookies, ["a=1; Path=/", "b=2; Path=/"]);
    assert_eq!(headers["referrer-policy"], "no-referrer");

    // What the server answers is its own: its health, and a method it
    // does not serve.
    let (status, body) = served.get("/xrpc/_health").await;
    assert_eq!(status, 200);
    assert!(body["version"].is_string());
    let (status, body) = served.get("/xrpc/social.grain.nothing.here").await;
    assert_eq!(
        (status, body["error"].as_str()),
        (501, Some("MethodNotImplemented"))
    );
}

#[tokio::test]
async fn an_app_that_does_not_answer_is_a_bad_gateway() {
    let gone = {
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        format!("http://{}", listener.local_addr().unwrap())
    };
    let served = common::served_app(handing(gone)).await;
    let res = reqwest::get(format!("{}/", served.base)).await.unwrap();
    assert_eq!(res.status().as_u16(), 502);
    let said = res.text().await.unwrap();
    assert!(said.starts_with("The pages are not being drawn"), "{said}");

    // With no app, what the server does not answer is not found.
    let served = common::served_app(bare()).await;
    let res = reqwest::get(format!("{}/profile/alice.test", served.base))
        .await
        .unwrap();
    assert_eq!(res.status().as_u16(), 404);
}

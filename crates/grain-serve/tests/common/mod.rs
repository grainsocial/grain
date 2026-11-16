//! grain-serve on a port of its own, and the XRPC calls the tests make to
//! it, each answer kept under `GRAIN_ANSWERS` when it is set, for
//! `harness/answers.mjs` to hold to its lexicon. Every test of what the
//! server answers asks through [`Served::get`] or [`Served::post`], so
//! nothing it answers goes unchecked.
#![allow(dead_code)]

use serde_json::{Value, json};

pub struct Served {
    pub base: String,
    http: reqwest::Client,
}

/// grain-serve with no index and no DID, serving on a free port until the
/// test's runtime ends.
pub async fn served() -> Served {
    let ctx = grain::env::Ctx::new(grain::env::Env::from_vars(|_| None));
    served_app(grain_serve::App::bare(ctx)).await
}

/// `app`, serving on a free port until the test's runtime ends.
pub async fn served_app(app: grain_serve::App) -> Served {
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    served_on(listener, app)
}

/// `app`, serving on `listener` until the test's runtime ends.
pub fn served_on(listener: tokio::net::TcpListener, app: grain_serve::App) -> Served {
    let base = format!("http://{}", listener.local_addr().unwrap());
    tokio::spawn(grain_serve::serve(listener, std::sync::Arc::new(app)));
    Served {
        base,
        http: reqwest::Client::new(),
    }
}

impl Served {
    /// A query: `path` is `/xrpc/<nsid>` and its parameters.
    pub async fn get(&self, path: &str) -> (u16, Value) {
        let res = self.http.get(format!("{}{path}", self.base));
        self.answer(path, res).await
    }

    /// A query sent with `authorization` as it stands, such as a service
    /// token's `Bearer <token>`.
    pub async fn get_with(&self, path: &str, authorization: &str) -> (u16, Value) {
        let res = self
            .http
            .get(format!("{}{path}", self.base))
            .header("authorization", authorization);
        self.answer(path, res).await
    }

    /// A procedure, with `body` as its JSON input.
    pub async fn post(&self, path: &str, body: &Value) -> (u16, Value) {
        let res = self.http.post(format!("{}{path}", self.base)).json(body);
        self.answer(path, res).await
    }

    /// A procedure called with `token`, a service token, as its bearer.
    pub async fn post_as(&self, path: &str, token: &str, body: &Value) -> (u16, Value) {
        let res = self
            .http
            .post(format!("{}{path}", self.base))
            .bearer_auth(token)
            .json(body);
        self.answer(path, res).await
    }

    /// A query sent with `headers`, such as a session cookie.
    pub async fn get_headed(&self, path: &str, headers: &[(&str, &str)]) -> (u16, Value) {
        let mut res = self.http.get(format!("{}{path}", self.base));
        for (k, v) in headers {
            res = res.header(*k, *v);
        }
        self.answer(path, res).await
    }

    /// A procedure sent with `headers`, such as a session cookie and the
    /// page's origin.
    pub async fn post_headed(
        &self,
        path: &str,
        headers: &[(&str, &str)],
        body: &Value,
    ) -> (u16, Value) {
        let mut res = self.http.post(format!("{}{path}", self.base)).json(body);
        for (k, v) in headers {
            res = res.header(*k, *v);
        }
        self.answer(path, res).await
    }

    /// A procedure called with `body` as it is, and `headers`.
    pub async fn post_bytes(
        &self,
        path: &str,
        headers: &[(&str, &str)],
        body: Vec<u8>,
    ) -> (u16, Value) {
        let mut res = self.http.post(format!("{}{path}", self.base)).body(body);
        for (k, v) in headers {
            res = res.header(*k, *v);
        }
        self.answer(path, res).await
    }

    /// A query sent with `headers`, and the headers it was answered with.
    pub async fn get_answered(
        &self,
        path: &str,
        headers: &[(&str, &str)],
    ) -> (u16, reqwest::header::HeaderMap, Value) {
        let mut res = self.http.get(format!("{}{path}", self.base));
        for (k, v) in headers {
            res = res.header(*k, *v);
        }
        self.answered(path, res).await
    }

    async fn answer(&self, path: &str, req: reqwest::RequestBuilder) -> (u16, Value) {
        let (status, _, body) = self.answered(path, req).await;
        (status, body)
    }

    async fn answered(
        &self,
        path: &str,
        req: reqwest::RequestBuilder,
    ) -> (u16, reqwest::header::HeaderMap, Value) {
        let res = req.send().await.unwrap();
        let status = res.status().as_u16();
        let headers = res.headers().clone();
        let json = res
            .headers()
            .get("content-type")
            .is_some_and(|v| v.as_bytes().starts_with(b"application/json"));
        let bytes = res.bytes().await.unwrap();
        let body = if json {
            serde_json::from_slice(&bytes).unwrap()
        } else {
            Value::Null
        };
        if let Some(dir) = std::env::var_os("GRAIN_ANSWERS") {
            // An answer that is not JSON is kept with no body.
            let mut kept = json!({ "path": path, "status": status });
            if json {
                kept["body"] = body.clone();
            }
            keep(&dir, &kept);
        }
        (status, headers, body)
    }
}

/// What `headers` say caches may do: their `vary`s, and `cache-control`.
pub fn caching(headers: &reqwest::header::HeaderMap) -> (Vec<&str>, Option<&str>) {
    let vary = headers.get_all("vary").iter();
    let vary = vary.map(|v| v.to_str().unwrap()).collect();
    let cache = headers.get("cache-control").map(|v| v.to_str().unwrap());
    (vary, cache)
}

/// Adds `answer` to this process's file of them under `dir`.
fn keep(dir: &std::ffi::OsStr, answer: &Value) {
    use std::io::Write;
    static FILE: std::sync::Mutex<()> = std::sync::Mutex::new(());
    let _held = FILE.lock().unwrap();
    std::fs::create_dir_all(dir).unwrap();
    let file = std::path::Path::new(dir).join(format!("serve-{}.jsonl", std::process::id()));
    let mut out = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(file)
        .unwrap();
    writeln!(out, "{answer}").unwrap();
}

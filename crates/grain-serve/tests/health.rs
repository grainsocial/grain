//! The server answers atproto's health check with its version, and its
//! DID document, and a method it does not serve as XRPC refuses one; and
//! it serves every method the web calls.

mod common;

use serde_json::json;

#[tokio::test]
async fn the_did_document_names_its_services_at_the_public_url() {
    let ctx = || grain::env::Ctx::new(grain::env::Env::from_vars(|_| None));
    let mut app = grain_serve::App::bare(ctx());
    app.did = Some("did:web:grain.test%3A8443".into());
    let s = common::served_app(app).await;
    let (status, doc) = s.get("/.well-known/did.json").await;
    assert_eq!(status, 200);
    let at = "https://grain.test:8443";
    assert_eq!(
        doc,
        json!({
            "@context": ["https://www.w3.org/ns/did/v1"],
            "id": "did:web:grain.test%3A8443",
            "service": [
                {"id": "#grain_appview", "type": "GrainAppView", "serviceEndpoint": at},
                {"id": "#atproto_labeler", "type": "AtprotoLabeler", "serviceEndpoint": at},
                {"id": "#mention_search", "type": "MentionSearchService", "serviceEndpoint": at},
            ],
        })
    );
    // A page on any site may read it.
    let res = reqwest::get(format!("{}/.well-known/did.json", s.base))
        .await
        .unwrap();
    assert_eq!(res.headers()["access-control-allow-origin"], "*");
    // A server with no public URL has no DID, and so no document.
    let (status, _) = common::served().await.get("/.well-known/did.json").await;
    assert_eq!(status, 404);
}

#[tokio::test]
async fn health_names_the_version() {
    let s = common::served().await;
    let (status, body) = s.get("/xrpc/_health").await;
    assert_eq!(status, 200);
    assert_eq!(body["version"], env!("CARGO_PKG_VERSION"));
}

#[tokio::test]
async fn queries_say_they_vary_by_who_asks_and_other_routes_do_not() {
    let s = common::served().await;
    let (_, answered, _) = s.get_answered("/xrpc/_health", &[]).await;
    let anyones = (vec!["authorization", "cookie"], None);
    assert_eq!(common::caching(&answered), anyones);
    let (_, answered, _) = s.get_answered("/oauth/session", &[]).await;
    assert_eq!(common::caching(&answered), (vec![], None));
}

#[tokio::test]
async fn a_method_not_served_is_not_implemented() {
    let s = common::served().await;
    for (status, body) in [
        s.get("/xrpc/social.grain.nothing").await,
        s.post("/xrpc/social.grain.nothing", &serde_json::json!({}))
            .await,
    ] {
        assert_eq!(status, 501);
        assert_eq!(body["error"], "MethodNotImplemented");
    }
}

/// The XRPC methods the web's sources under `web/src` call, by the NSID
/// each passes as the first argument of `$lib/xrpc`'s `query`, `call` or
/// `upload` (or a name it imports one as, such as `xrpcQuery`), each with
/// whether it is asked as a query. Its generated lexicons are left out.
fn methods_the_web_calls() -> Vec<(String, String, bool)> {
    let src = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("../../web/src");
    let mut files = vec![];
    let mut dirs = vec![src.clone()];
    while let Some(dir) = dirs.pop() {
        for entry in std::fs::read_dir(&dir).unwrap() {
            let path = entry.unwrap().path();
            if path.is_dir() {
                if path != src.join("lib/lexicons") {
                    dirs.push(path);
                }
            } else if path
                .extension()
                .is_some_and(|e| ["ts", "js", "svelte"].contains(&e.to_str().unwrap()))
            {
                files.push(path);
            }
        }
    }
    let ident = |c: char| c.is_ascii_alphanumeric() || c == '_' || c == '$';
    let mut methods = vec![];
    for file in files {
        let text = std::fs::read_to_string(&file).unwrap();
        let name = file.strip_prefix(&src).unwrap().display().to_string();
        for (at, _) in text.match_indices('(') {
            // The callee, and its type arguments, before the parenthesis.
            let mut head = text[..at].trim_end();
            if head.ends_with('>') {
                let mut depth = 0;
                let mut open = None;
                for (i, c) in head.char_indices().rev() {
                    match c {
                        '>' => depth += 1,
                        '<' => depth -= 1,
                        _ => {}
                    }
                    if depth == 0 {
                        open = Some(i);
                        break;
                    }
                }
                let Some(open) = open else { continue };
                head = &head[..open];
            }
            let start = head
                .char_indices()
                .rev()
                .find(|(_, c)| !ident(*c))
                .map_or(0, |(i, c)| i + c.len_utf8());
            if head[..start].ends_with('.') {
                continue;
            }
            let callee = head[start..].to_ascii_lowercase();
            let query = callee.ends_with("query");
            if !(query || callee.ends_with("call") || callee.ends_with("upload")) {
                continue;
            }
            // Its first argument, if that is a string naming a method.
            let arg = text[at + 1..].trim_start();
            let Some(quote) = arg.chars().next().filter(|c| "\"'`".contains(*c)) else {
                continue;
            };
            let Some(end) = arg[1..].find(quote) else {
                continue;
            };
            let nsid = &arg[1..1 + end];
            let segments = nsid.split('.').collect::<Vec<_>>();
            let nsid_shaped = segments.len() >= 3
                && segments
                    .iter()
                    .all(|s| !s.is_empty() && s.chars().all(|c| c.is_ascii_alphanumeric()));
            if nsid_shaped {
                methods.push((name.clone(), nsid.to_string(), query));
            }
        }
    }
    methods.sort();
    methods.dedup();
    methods
}

#[tokio::test]
async fn every_method_the_web_calls_is_served() {
    let methods = methods_the_web_calls();
    // The scan finds the web's calls, so that a scan that finds none
    // does not pass for one whose calls are all served.
    assert!(methods.len() > 40, "found only {methods:?}");
    // A server that keeps an index and has a DID and a public URL, as the
    // web's does: one without them answers 501 for the methods that need
    // them.
    let ctx = grain::env::Ctx::new(grain::env::Env::from_vars(|_| None));
    let mut app = grain_serve::App::bare(ctx);
    let index = std::sync::Arc::new(grain_serve::index::Index::memory().unwrap());
    let web = grain_serve::login::Web::new("https://grain.test", &index, "https://pds.test");
    app.web = Some(std::sync::Arc::new(web.unwrap()));
    app.index = Some(index);
    app.did = Some("did:web:grain.test".into());
    let s = common::served_app(app).await;
    let mut unserved = vec![];
    for (file, nsid, query) in &methods {
        let path = format!("/xrpc/{nsid}");
        let (status, _) = match query {
            true => s.get(&path).await,
            false => s.post(&path, &json!({})).await,
        };
        // 501 is a method the server does not serve at all, 405 one it
        // serves as the other kind.
        if status == 501 || status == 405 {
            let kind = if *query { "query" } else { "procedure" };
            unserved.push(format!("{file}: {nsid} as a {kind} ({status})"));
        }
    }
    assert!(
        unserved.is_empty(),
        "web/src calls methods grain-serve does not serve:\n{}",
        unserved.join("\n")
    );
}

//! The site as a browser reaches it, for the tests of what the web does
//! logged in: grain-serve behind `harness/tls-proxy.mjs`, at an https
//! public URL the PDS fetches its client metadata from, and
//! `harness/authorize.mjs` as the browser, stopping at the redirect back
//! so that the test comes back to the callback with the cookies its
//! browser holds.
#![allow(dead_code)]

use crate::{common, net};
use grain_serve::index::Index;
use grain_serve::login::Web;
use grain_serve::{App, service_did};
use reqwest::header::{COOKIE, ORIGIN, SET_COOKIE};
use serde_json::{Value, json};
use std::collections::HashMap;
use std::sync::Arc;

pub struct Site {
    pub app: Arc<App>,
    pub index: Arc<Index>,
    pub served: common::Served,
    /// The public URL, the proxy's.
    pub url: String,
    pub http: reqwest::Client,
    _proxy: net::TlsProxy,
    _dir: tempfile::TempDir,
}

/// grain-serve with an index and a web login, at an https public URL.
pub async fn site() -> Site {
    site_on(Index::memory().unwrap(), &net::net().pds).await
}

/// [`site`], on `index`, sending sign-ups to `sign_up_pds`.
pub async fn site_on(index: Index, sign_up_pds: &str) -> Site {
    site_with(index, sign_up_pds, None).await
}

/// [`site_on`], carrying the cookies browsers held before until `until`.
pub async fn site_with(index: Index, sign_up_pds: &str, until: Option<u64>) -> Site {
    site_of(index, sign_up_pds, until, None, false).await
}

/// [`site`], its DID `did:web:localhost%3A<port>` at the server itself,
/// over plain http, rather than the proxy's: a `did:web` with a port is
/// atproto's only for `localhost`, so a PDS takes an `rpc` scope naming
/// only that one, and resolves it over http.
pub async fn local_site() -> Site {
    site_of(Index::memory().unwrap(), &net::net().pds, None, None, true).await
}

/// [`site`], starting groups on the group host at `group_host`.
pub async fn site_starting_groups(group_host: &str) -> Site {
    let index = Index::memory().unwrap();
    site_of(index, &net::net().pds, None, Some(group_host), false).await
}

async fn site_of(
    index: Index,
    sign_up_pds: &str,
    until: Option<u64>,
    group_host: Option<&str>,
    local: bool,
) -> Site {
    let dir = tempfile::tempdir().unwrap();
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let port = listener.local_addr().unwrap().port();
    let proxy = net::tls_proxy(port);
    let index = Arc::new(index);
    let web = Web::new(&proxy.url, &index, sign_up_pds).unwrap();
    let web = web.carrying(&index, until).unwrap();
    let web = web.starting_groups(group_host);
    let (did, extra) = match local {
        true => (
            format!("did:web:localhost%3A{port}"),
            &[("GRAIN_DID_WEB_SCHEME", "http")][..],
        ),
        false => (service_did(&proxy.url).unwrap(), &[][..]),
    };
    let app = Arc::new(App {
        ctx: net::ctx(dir.path(), extra),
        index: Some(index.clone()),
        did: Some(did),
        cdn: Default::default(),
        bsky_appview: None,
        web: Some(Arc::new(web)),
        admins: Vec::new(),
        cards: Default::default(),
        pages: None,
        spaces: Default::default(),
    });
    let served = common::served_on(listener, shared(&app));
    let http = reqwest::Client::builder()
        .redirect(reqwest::redirect::Policy::none())
        .build()
        .unwrap();
    Site {
        app,
        index,
        served,
        url: proxy.url.clone(),
        http,
        _proxy: proxy,
        _dir: dir,
    }
}

/// The same server again, sharing `app`'s index and logins: what the
/// test calls directly and what it serves are one.
pub fn shared(app: &Arc<App>) -> App {
    App {
        ctx: app.ctx.clone(),
        index: app.index.clone(),
        did: app.did.clone(),
        cdn: Default::default(),
        bsky_appview: None,
        web: app.web.clone(),
        admins: Vec::new(),
        cards: Default::default(),
        pages: None,
        spaces: Default::default(),
    }
}

/// A browser's cookies for the site, by name.
#[derive(Default, Clone)]
pub struct Jar(pub HashMap<String, String>);

impl Jar {
    pub fn header(&self) -> String {
        let pairs = self.0.iter().map(|(k, v)| format!("{k}={v}"));
        pairs.collect::<Vec<_>>().join("; ")
    }

    /// Takes in what `res` sets, as a browser does: one cleared goes.
    pub fn keep(&mut self, res: &reqwest::Response) -> Vec<String> {
        let mut said = Vec::new();
        for set in res.headers().get_all(SET_COOKIE) {
            let set = set.to_str().unwrap().to_string();
            let (pair, _) = set.split_once(';').unwrap();
            let (name, value) = pair.split_once('=').unwrap();
            match set.contains("Max-Age=0") {
                true => self.0.remove(name),
                false => self.0.insert(name.into(), value.into()),
            };
            said.push(set);
        }
        said
    }

    pub fn get(&self, name: &str) -> Option<&str> {
        self.0.get(name).map(String::as_str)
    }
}

impl Site {
    /// Posts `body` to `path` as a page of `origin` would, with `jar`'s
    /// cookies, keeping what it sets.
    pub async fn post(
        &self,
        jar: &mut Jar,
        origin: Option<&str>,
        path: &str,
        body: Value,
    ) -> (u16, Value) {
        let mut req = self
            .http
            .post(format!("{}{path}", self.served.base))
            .json(&body);
        req = req.header(COOKIE, jar.header());
        if let Some(origin) = origin {
            req = req.header(ORIGIN, origin);
        }
        let res = req.send().await.unwrap();
        jar.keep(&res);
        let status = res.status().as_u16();
        (status, res.json().await.unwrap_or(Value::Null))
    }

    pub async fn get(&self, jar: &mut Jar, path: &str) -> reqwest::Response {
        let req = self.http.get(format!("{}{path}", self.served.base));
        let res = req.header(COOKIE, jar.header()).send().await.unwrap();
        jar.keep(&res);
        res
    }

    pub async fn whoami(&self, jar: &mut Jar) -> Value {
        self.get(jar, "/oauth/session").await.json().await.unwrap()
    }

    /// Logs `jar`'s browser in as `account`, approved at its PDS, going
    /// back to `/after`: the login, the approval and the way back.
    pub async fn log_in(&self, jar: &mut Jar, account: &net::Account) {
        let body = json!({ "handle": account.handle, "back": "/after" });
        let (status, started) = self.post(jar, Some(&self.url), "/oauth/login", body).await;
        assert_eq!(status, 200, "{started}");
        let back = approve(account, "", started["url"].as_str().unwrap()).await;
        let res = self.back(jar, &back).await;
        assert_eq!(res.status().as_u16(), 303);
        assert_eq!(res.headers()["location"], "/after");
    }

    /// Comes back to the callback the PDS sent the browser to, `back`,
    /// at this server.
    pub async fn back(&self, jar: &mut Jar, back: &str) -> reqwest::Response {
        let path = back.strip_prefix(&self.url).expect("back to this site");
        self.get(jar, path).await
    }
}

/// Approves the login at `url` as `account`, with `extra`, and answers
/// where the PDS sends the browser back to.
pub async fn approve(account: &net::Account, extra: &str, url: &str) -> String {
    let command = net::browser(account, &format!("--stop {extra}"));
    let mut words = command.split_whitespace();
    let out = tokio::process::Command::new(words.next().unwrap())
        .args(words)
        .arg(url)
        .output()
        .await
        .unwrap();
    assert!(
        out.status.success(),
        "{}",
        String::from_utf8_lossy(&out.stderr)
    );
    String::from_utf8(out.stdout).unwrap().trim().to_string()
}

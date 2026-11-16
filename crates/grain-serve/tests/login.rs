//! Logging in to the web against the reference PDS, through [`web`]'s
//! site and browser.

#[path = "../../grain/tests/common/mod.rs"]
mod net;

mod common;
mod web;

use grain::keys;
use grain_serve::index::Index;
use grain_serve::login::{self, Web, carryover};
use reqwest::header::ORIGIN;
use serde_json::{Value, json};
use web::{Jar, Site, approve, site, site_on, site_with};

#[tokio::test]
async fn the_client_says_who_it_is() {
    let site = site().await;
    let mut jar = Jar::default();
    let doc: Value = site
        .get(&mut jar, login::METADATA)
        .await
        .json()
        .await
        .unwrap();
    assert_eq!(doc["client_id"], format!("{}{}", site.url, login::METADATA));
    assert_eq!(
        doc["redirect_uris"],
        json!([format!("{}{}", site.url, login::CALLBACK)])
    );
    assert_eq!(doc["jwks_uri"], format!("{}{}", site.url, login::JWKS));
    assert_eq!(doc["scope"], login::REGISTERED);
    assert!(doc.get("jwks").is_none());
    let jwks: Value = site.get(&mut jar, login::JWKS).await.json().await.unwrap();
    assert_eq!(jwks["keys"][0]["kid"], "pds-client-auth-key");
    assert!(jwks["keys"][0].get("d").is_none(), "no secret in the JWKS");

    // The cookies' key is apart from it, and not published.
    let cookie_key = site
        .index
        .oauth_key(login::COOKIE_KID, String::new)
        .unwrap();
    let client_key = site
        .index
        .oauth_key("pds-client-auth-key", String::new)
        .unwrap();
    assert_ne!(cookie_key, client_key);
    let cookie_x = login::from_jwk(&cookie_key).unwrap().jwk()["x"].clone();
    assert!(
        jwks["keys"]
            .as_array()
            .unwrap()
            .iter()
            .all(|k| k["x"] != cookie_x)
    );

    // The key is the index's, kept: another server on it signs as this one.
    let again = Web::new(&site.url, &site.index, "https://pds.test").unwrap();
    assert_eq!(again.client.jwks(), jwks);
}

#[tokio::test]
async fn a_browser_logs_in_switches_and_logs_out() {
    let site = site().await;
    let (a, b) = (net::account().await, net::account().await);
    let mut jar = Jar::default();
    assert_eq!(
        site.whoami(&mut jar).await,
        json!({ "account": null, "accounts": [] })
    );

    // Only a page of the site starts a login.
    let body = json!({ "handle": a.handle });
    let (status, _) = site
        .post(&mut jar, None, "/oauth/login", body.clone())
        .await;
    assert_eq!(status, 403);
    let (status, _) = site
        .post(&mut jar, Some("https://evil.example"), "/oauth/login", body)
        .await;
    assert_eq!(status, 403);
    let (status, said) = site
        .post(
            &mut jar,
            Some(&site.url),
            "/oauth/login",
            json!({ "handle": "nobody.test" }),
        )
        .await;
    assert_eq!(
        (status, said["error"].as_str()),
        (400, Some("InvalidRequest"))
    );

    let body =
        json!({ "handle": format!("@{}", a.handle.to_uppercase()), "back": "//evil.example" });
    let req = site
        .http
        .post(format!("{}/oauth/login", site.served.base))
        .json(&body);
    let res = req.header(ORIGIN, &site.url).send().await.unwrap();
    let set = jar.keep(&res);
    assert!(set[0].starts_with("grain_login="), "{set:?}");
    for flag in ["HttpOnly", "SameSite=Lax", "Secure", "Path=/"] {
        assert!(set[0].contains(flag), "{flag}: {set:?}");
    }
    let started: Value = res.json().await.unwrap();
    let back = approve(&a, "", started["url"].as_str().unwrap()).await;

    // Come back in another browser, it is not this one's.
    let res = site.back(&mut Jar::default(), &back).await;
    assert_eq!(res.status().as_u16(), 400);
    let res = site.back(&mut jar, &back).await;
    assert_eq!(res.status().as_u16(), 303);
    assert_eq!(
        res.headers()["location"],
        "/",
        "going back stays on the site"
    );
    assert!(
        jar.get(login::STARTED).is_none(),
        "the login's cookie is spent"
    );
    let cookie = jar.get(login::COOKIE).unwrap().to_string();
    // Once only.
    assert_eq!(
        site.back(&mut jar.clone(), &back).await.status().as_u16(),
        400
    );
    let me = site.whoami(&mut jar).await;
    assert_eq!(me["account"], json!({ "did": a.did, "handle": a.handle }));

    // A token like the cookie's, signed by the client's key, names no one.
    let client_key = site
        .index
        .oauth_key("pds-client-auth-key", String::new)
        .unwrap();
    let claims = json!({ "kind": "web", "did": a.did, "iat": keys::now_micros(),
        "exp": keys::now_secs() + 3600 });
    let forged = login::from_jwk(&client_key)
        .unwrap()
        .sign_jwt(&json!({ "typ": "JWT" }), &claims);
    let mut by_client = Jar::default();
    by_client.0.insert(login::COOKIE.into(), forged);
    let me = site.whoami(&mut by_client).await;
    assert_eq!(me["account"], Value::Null, "{me}");

    // The cookie says who reads, and writes from a page of the site.
    let session = [("cookie", format!("{}={cookie}", login::COOKIE))];
    let headers: Vec<(&str, &str)> = session.iter().map(|(k, v)| (*k, v.as_str())).collect();
    let unread = "/xrpc/social.grain.notification.getUnreadCount";
    let (status, answered, _) = site.served.get_answered(unread, &headers).await;
    assert_eq!(status, 200);
    let theirs = (vec!["authorization", "cookie"], Some("private, no-cache"));
    assert_eq!(common::caching(&answered), theirs);
    let (status, _) = site
        .served
        .get("/xrpc/social.grain.notification.getUnreadCount")
        .await;
    assert_eq!(status, 401);
    let seen = json!({ "seenAt": "2026-10-31T12:00:00.000Z" });
    let path = "/xrpc/social.grain.notification.updateSeen";
    let (status, said) = site.served.post_headed(path, &headers, &seen).await;
    assert_eq!((status, said["error"].as_str()), (403, Some("Forbidden")));
    let from_site = [headers[0], ("origin", site.url.as_str())];
    let (status, _) = site.served.post_headed(path, &from_site, &seen).await;
    assert_eq!(status, 200);

    // A second account, in the same browser, keeps the first beside it.
    site.log_in(&mut jar, &b).await;
    let me = site.whoami(&mut jar).await;
    assert_eq!(me["account"]["did"], b.did);
    assert_eq!(
        me["accounts"],
        json!([{ "did": a.did, "handle": a.handle }])
    );
    // A token among them that no longer holds is passed over.
    let mut stale = jar.clone();
    let kept = stale.get(login::OTHERS).unwrap().to_string();
    stale
        .0
        .insert(login::OTHERS.into(), format!("junk~{kept}~{kept}"));
    assert_eq!(site.whoami(&mut stale).await["accounts"], me["accounts"]);
    let (status, _) = site
        .post(
            &mut jar,
            Some(&site.url),
            "/oauth/switch",
            json!({ "did": "did:plc:nobody" }),
        )
        .await;
    assert_eq!(status, 400);
    let (status, _) = site
        .post(&mut jar, None, "/oauth/switch", json!({ "did": a.did }))
        .await;
    assert_eq!(status, 403);
    let (status, _) = site
        .post(
            &mut jar,
            Some(&site.url),
            "/oauth/switch",
            json!({ "did": a.did }),
        )
        .await;
    assert_eq!(status, 200);
    let me = site.whoami(&mut jar).await;
    assert_eq!(me["account"]["did"], a.did);
    assert_eq!(me["accounts"][0]["did"], b.did);

    // Logging out goes on as the other, and ends every cookie for it.
    let (status, _) = site.post(&mut jar, None, "/oauth/logout", json!({})).await;
    assert_eq!(status, 403);
    let (status, _) = site
        .post(&mut jar, Some(&site.url), "/oauth/logout", json!({}))
        .await;
    assert_eq!(status, 200);
    assert!(site.index.web_session(&a.did).unwrap().is_none());
    let me = site.whoami(&mut jar).await;
    assert_eq!(
        (me["account"]["did"].as_str(), &me["accounts"]),
        (Some(b.did.as_str()), &json!([]))
    );
    let mut old = Jar::default();
    old.0.insert(login::COOKIE.into(), cookie.clone());
    assert_eq!(site.whoami(&mut old).await["account"], Value::Null);
    // Logged in again, the cookie from before still names no one.
    let mut fresh = Jar::default();
    site.log_in(&mut fresh, &a).await;
    assert_eq!(site.whoami(&mut old).await["account"], Value::Null);
    assert_eq!(site.whoami(&mut fresh).await["account"]["did"], a.did);

    // The last one out leaves the browser logged in as no one.
    let (status, _) = site
        .post(&mut jar, Some(&site.url), "/oauth/logout", json!({}))
        .await;
    assert_eq!(status, 200);
    assert!(jar.get(login::COOKIE).is_none() && jar.get(login::OTHERS).is_none());
    let (status, _) = site
        .post(&mut jar, Some(&site.url), "/oauth/logout", json!({}))
        .await;
    assert_eq!(status, 200, "logging out as no one");

    // Taken down, an account neither logs in nor stays logged in.
    site.index.take_down(&a.did).unwrap();
    assert_eq!(site.whoami(&mut fresh).await["account"], Value::Null);
    let (status, said) = site
        .post(
            &mut Jar::default(),
            Some(&site.url),
            "/oauth/login",
            json!({ "handle": a.handle }),
        )
        .await;
    assert_eq!(
        (status, said["error"].as_str()),
        (403, Some("AccountTakedown"))
    );
}

#[tokio::test]
async fn a_refused_login_goes_back_as_before() {
    let site = site().await;
    let a = net::account().await;
    let mut jar = Jar::default();
    let (_, started) = site
        .post(
            &mut jar,
            Some(&site.url),
            "/oauth/login",
            json!({ "handle": a.handle }),
        )
        .await;
    let back = approve(&a, "--reject", started["url"].as_str().unwrap()).await;
    let res = site.back(&mut jar, &back).await;
    assert_eq!(res.status().as_u16(), 303);
    assert!(jar.get(login::COOKIE).is_none());
    assert!(site.index.web_session(&a.did).unwrap().is_none());
}

#[tokio::test]
async fn someone_new_makes_an_account_on_the_way() {
    let site = site().await;
    let handle = net::fresh_handle();
    let newcomer = net::Account {
        password: format!("{handle}-password"),
        handle,
        did: String::new(),
    };
    let mut jar = Jar::default();
    let (status, started) = site
        .post(
            &mut jar,
            Some(&site.url),
            "/oauth/login",
            json!({ "create": true }),
        )
        .await;
    assert_eq!(status, 200, "{started}");
    let back = approve(&newcomer, "--create", started["url"].as_str().unwrap()).await;
    assert_eq!(site.back(&mut jar, &back).await.status().as_u16(), 303);
    let me = site.whoami(&mut jar).await;
    assert_eq!(me["account"]["handle"], newcomer.handle);
}

#[tokio::test]
async fn sessions_refresh_one_at_a_time_and_end_when_refused() {
    let site = site().await;
    let a = net::account().await;
    let mut jar = Jar::default();
    site.log_in(&mut jar, &a).await;
    let kept = site.index.web_session(&a.did).unwrap().unwrap();
    // Lasting, it is the session kept.
    let lasting = login::session(&site.app, &a.did).await.unwrap();
    assert_eq!(lasting, kept.session);

    // About to expire, it is refreshed once, however many ask at once.
    let mut expiring = kept.session.clone();
    expiring.oauth.as_mut().unwrap().expires_at = 0;
    site.index
        .keep_web_session(&expiring, keys::now_micros())
        .unwrap();
    let (one, two) = tokio::join!(
        login::session(&site.app, &a.did),
        login::session(&site.app, &a.did)
    );
    let (one, two) = (one.unwrap(), two.unwrap());
    assert_eq!(one, two);
    assert_ne!(one.refresh_jwt, kept.session.refresh_jwt);
    assert!(!one.expiring());
    let now = site.index.web_session(&a.did).unwrap().unwrap();
    assert_eq!((now.session, now.since), (one.clone(), kept.since));
    // Refreshed, it works at the PDS.
    let named = grain::oauth::named(&site.app.ctx, one.clone())
        .await
        .unwrap();
    assert_eq!(named.handle, a.handle);
    assert_eq!(site.whoami(&mut jar).await["account"]["did"], a.did);

    // A refresh token already spent is refused, which ends the session.
    let spent = grain::session::Session {
        access_jwt: "x".into(),
        ..expiring
    };
    site.index
        .keep_web_session(&spent, keys::now_micros())
        .unwrap();
    let failure = login::session(&site.app, &a.did).await.unwrap_err();
    assert_eq!(
        (failure.status.as_u16(), failure.error),
        (401, "AuthenticationRequired")
    );
    assert!(site.index.web_session(&a.did).unwrap().is_none());
    assert_eq!(site.whoami(&mut jar).await["account"], Value::Null);
    assert!(login::session(&site.app, &a.did).await.is_err());

    // One by app password has nothing to refresh with: it ends too.
    let password = grain::session::Session {
        oauth: None,
        ..spent.clone()
    };
    site.index
        .keep_web_session(&password, keys::now_micros())
        .unwrap();
    let failure = login::session(&site.app, &a.did).await.unwrap_err();
    assert_eq!(failure.status.as_u16(), 401);
    assert!(site.index.web_session(&a.did).unwrap().is_none());

    // A refresh that fails on the way keeps the session, to try again.
    let mut unreachable = spent;
    unreachable.oauth.as_mut().unwrap().token_endpoint = "http://127.0.0.1:9/token".into();
    site.index
        .keep_web_session(&unreachable, keys::now_micros())
        .unwrap();
    let failure = login::session(&site.app, &a.did).await.unwrap_err();
    assert_eq!(
        (failure.status.as_u16(), failure.error),
        (502, "UpstreamFailure")
    );
    assert!(site.index.web_session(&a.did).unwrap().is_some());
}

#[tokio::test]
async fn a_login_its_server_fails_says_so() {
    let site = site_on(Index::memory().unwrap(), "http://127.0.0.1:9").await;
    let (status, said) = site
        .post(
            &mut Jar::default(),
            Some(&site.url),
            "/oauth/login",
            json!({ "create": true }),
        )
        .await;
    assert_eq!(
        (status, said["error"].as_str()),
        (502, Some("UpstreamFailure"))
    );
}

#[tokio::test]
async fn the_apps_client_is_a_native_public_one() {
    let site = site().await;
    let mut jar = Jar::default();
    let doc: Value = site
        .get(&mut jar, login::APP_METADATA)
        .await
        .json()
        .await
        .unwrap();
    let did = site.app.did.clone().unwrap();
    let scheme = login::app_scheme(&site.url);
    assert_eq!(
        doc["client_id"],
        format!("{}{}", site.url, login::APP_METADATA)
    );
    assert_eq!(doc["application_type"], "native");
    assert_eq!(doc["token_endpoint_auth_method"], "none");
    assert_eq!(doc["dpop_bound_access_tokens"], true);
    assert!(doc.get("jwks").is_none() && doc.get("jwks_uri").is_none());
    assert_eq!(
        doc["redirect_uris"],
        json!([format!("{scheme}:{}", login::APP_CALLBACK)])
    );
    let registered: Vec<&str> = doc["scope"].as_str().unwrap().split(' ').collect();
    for scope in login::app_scope(&did).split(' ') {
        assert!(registered.contains(&scope), "{scope}");
    }
}

/// An app's login, as the apps make one: at the account's own PDS, as the
/// public client [`login::APP_METADATA`] names, coming back under the
/// app's scheme; then a write to that PDS, and this server told of it and
/// asked for the account's preferences, each through the PDS's
/// `atproto-proxy`, as the account. The server is `did:web:localhost`
/// with its port ([`web::local_site`]), which the PDS proxies to.
#[tokio::test]
async fn an_app_logs_in_at_its_pds_and_calls_through_it() {
    let site = web::local_site().await;
    let account = net::account().await;
    let did = site.app.did.clone().unwrap();
    let ctx = &site.app.ctx;
    let client = grain::oauth::Client::public(&format!("{}{}", site.url, login::APP_METADATA));
    let redirect = format!("{}:{}", login::app_scheme(&site.url), login::APP_CALLBACK);
    let id = grain::identity::resolve(ctx, &account.handle)
        .await
        .unwrap();
    let scope = login::app_scope(&did);
    let request = grain::oauth::authorize(ctx, &client, id, &account.handle, &redirect, &scope)
        .await
        .unwrap();
    let back = approve(&account, "", &request.url).await;
    let back = reqwest::Url::parse(&back).unwrap();
    assert_eq!(
        format!("{}:{}", back.scheme(), back.path()),
        redirect,
        "{back}"
    );
    let params = back.query_pairs().into_owned().collect();
    let me = request.redeem(ctx, &client, &params).await.unwrap();
    assert_eq!(me.did, account.did);

    let mut proxied = reqwest::header::HeaderMap::new();
    let appview = format!("{did}{}", grain_serve::did::APPVIEW);
    proxied.insert("atproto-proxy", appview.parse().unwrap());
    let http = reqwest::Client::builder()
        .default_headers(proxied)
        .build()
        .unwrap();
    let pds = grain::xrpc::Xrpc::new(ctx.http.clone(), &me.service);
    let through = grain::xrpc::Xrpc::new(http, &me.service);
    let auth = me.auth();

    let follow = json!({
        "$type": "social.grain.graph.follow",
        "subject": "did:plc:bob",
        "createdAt": "2026-10-31T12:00:00.000Z",
    });
    let input =
        json!({"repo": me.did, "collection": "social.grain.graph.follow", "record": follow});
    let wrote: Value = pds
        .procedure("com.atproto.repo.createRecord", Some(&input), Some(&auth))
        .await
        .unwrap();
    let uri = wrote["uri"].as_str().unwrap();
    let told: Value = through
        .procedure(
            "social.grain.sync.indexRecords",
            Some(&json!({ "uris": [uri] })),
            Some(&auth),
        )
        .await
        .unwrap();
    assert_eq!(told, json!({"indexed": [uri], "notFound": []}));

    let prefs: Value = through
        .query("social.grain.actor.getPreferences", &[], Some(&auth))
        .await
        .unwrap();
    assert!(prefs.is_object(), "{prefs}");
}

#[tokio::test]
async fn a_server_with_no_login_says_so() {
    let served = common::served().await;
    let http = reqwest::Client::new();
    for path in [
        login::METADATA,
        login::JWKS,
        login::APP_METADATA,
        "/oauth/session",
    ] {
        let res = http
            .get(format!("{}{path}", served.base))
            .send()
            .await
            .unwrap();
        assert_eq!(res.status().as_u16(), 501, "{path}");
    }
    let ctx = grain::env::Ctx::new(grain::env::Env::from_vars(|_| None));
    let app = grain_serve::App::bare(ctx);
    assert!(login::session(&app, "did:plc:a").await.is_err());
}

/// A site carrying the cookies sealed under [`KEY`] until `until`.
async fn carrying(until: u64) -> Site {
    let index = Index::memory().unwrap();
    let insert = "INSERT INTO carried_cookie_key VALUES (?1)";
    index.read(|db| db.execute(insert, [&KEY[..]])).unwrap();
    site_with(index, &net::net().pds, Some(until)).await
}

const KEY: [u8; 32] = [9; 32];

/// A browser holding only the cookies sealed before, naming `did` and,
/// beside it, `others`, under `key`.
fn sealed(key: &[u8; 32], did: &str, others: &[&str]) -> Jar {
    let now = keys::now_secs();
    let mut jar = Jar::default();
    let session = carryover::seal(key, &json!({ "did": did, "handle": "x.test", "ts": now }));
    jar.0.insert(carryover::SESSION.into(), session);
    if !others.is_empty() {
        // Oldest first, the one in use last, as they were kept.
        let accounts: Vec<Value> = others
            .iter()
            .rev()
            .chain([&did])
            .map(|d| json!({ "did": d }))
            .collect();
        let sealed = carryover::seal(key, &json!({ "accounts": accounts, "ts": now }));
        jar.0.insert(carryover::ACCOUNTS.into(), sealed);
    }
    jar
}

#[tokio::test]
async fn a_browser_logged_in_before_stays_logged_in() {
    let site = carrying(keys::now_secs() + 3600).await;
    let (a, b) = (net::account().await, net::account().await);
    // Their sessions, as the import carries them.
    let mut elsewhere = Jar::default();
    site.log_in(&mut elsewhere, &b).await;
    site.log_in(&mut elsewhere, &a).await;

    let mut jar = sealed(&KEY, &a.did, &[&b.did]);
    let res = site.get(&mut jar, "/oauth/session").await;
    let me: Value = res.json().await.unwrap();
    assert_eq!(me["account"]["did"], a.did, "{me}");
    assert_eq!(me["accounts"][0]["did"], b.did, "{me}");
    assert!(
        jar.get(carryover::SESSION).is_none(),
        "the old cookies are cleared"
    );
    assert!(jar.get(carryover::ACCOUNTS).is_none());
    assert!(jar.get(login::COOKIE).is_some() && jar.get(login::OTHERS).is_some());
    // And from then on, by this server's own.
    assert_eq!(site.whoami(&mut jar).await, me);

    // A write on the request that carries it is the account's too.
    let jar = sealed(&KEY, &a.did, &[]);
    let headers = [("cookie", jar.header()), ("origin", site.url.clone())];
    let headers: Vec<(&str, &str)> = headers.iter().map(|(k, v)| (*k, v.as_str())).collect();
    let seen = json!({ "seenAt": "2026-10-31T12:00:00.000Z" });
    let path = "/xrpc/social.grain.notification.updateSeen";
    let (status, said) = site.served.post_headed(path, &headers, &seen).await;
    assert_eq!(status, 200, "{said}");

    // A browser already logged in here keeps its own.
    let mut both = jar.clone();
    both.0.insert(
        login::COOKIE.into(),
        elsewhere.get(login::COOKIE).unwrap().into(),
    );
    let me = site.whoami(&mut both).await;
    assert_eq!(me["account"]["did"], a.did);
}

#[tokio::test]
async fn a_cookie_that_does_not_hold_carries_no_one() {
    let carried = carrying(keys::now_secs() + 3600).await;
    let (a, never) = (net::account().await, net::account().await);
    carried.log_in(&mut Jar::default(), &a).await;
    let nobody = |me: Value| assert_eq!(me["account"], Value::Null, "{me}");

    nobody(carried.whoami(&mut sealed(&[7; 32], &a.did, &[])).await);
    let mut tampered = sealed(&KEY, &a.did, &[]);
    let value = tampered.0.get_mut(carryover::SESSION).unwrap();
    value.insert(
        1,
        if value.as_bytes()[1] == b'A' {
            'B'
        } else {
            'A'
        },
    );
    nobody(carried.whoami(&mut tampered).await);
    // An account with no session carried here.
    nobody(carried.whoami(&mut sealed(&KEY, &never.did, &[])).await);
    carried.index.take_down(&a.did).unwrap();
    nobody(carried.whoami(&mut sealed(&KEY, &a.did, &[])).await);
    carried.index.reverse_takedown(&a.did).unwrap();
    // Its others carry only beside it, and only those with a session.
    let mut jar = sealed(&KEY, &a.did, &[&never.did]);
    let me = carried.whoami(&mut jar).await;
    assert_eq!(
        (me["account"]["did"].as_str(), &me["accounts"]),
        (Some(a.did.as_str()), &json!([]))
    );

    // Past its end, nothing carries.
    let over = carrying(keys::now_secs() - 1).await;
    over.log_in(&mut Jar::default(), &a).await;
    nobody(over.whoami(&mut sealed(&KEY, &a.did, &[])).await);
    // A server not set to carry carries nothing.
    let off = site().await;
    nobody(off.whoami(&mut sealed(&KEY, &a.did, &[])).await);
}

/// One pixel, as a PNG.
const PNG: &str = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

/// Writes straight to `a`'s PDS with its password, as another app would:
/// `nsid` with `body`, its answer.
async fn at_pds(a: &net::Account, nsid: &str, body: reqwest::Body, kind: &str) -> Value {
    let pds = &net::net().pds;
    let http = reqwest::Client::new();
    let session: Value = http
        .post(format!("{pds}/xrpc/com.atproto.server.createSession"))
        .json(&json!({ "identifier": a.did, "password": a.password }))
        .send()
        .await
        .unwrap()
        .json()
        .await
        .unwrap();
    let res = http
        .post(format!("{pds}/xrpc/{nsid}"))
        .bearer_auth(session["accessJwt"].as_str().unwrap())
        .header("content-type", kind)
        .body(body)
        .send()
        .await
        .unwrap();
    assert!(res.status().is_success(), "{nsid}: {}", res.status());
    res.json().await.unwrap()
}

/// Makes `record` at `collection`/self in `a`'s repo, at its PDS.
async fn made(a: &net::Account, collection: &str, record: Value) {
    let body = json!({ "repo": a.did, "collection": collection, "rkey": "self", "record": record });
    let body = reqwest::Body::from(body.to_string());
    at_pds(a, "com.atproto.repo.createRecord", body, "application/json").await;
}

/// `a`'s grain profile as its PDS has it.
async fn grain_profile(a: &net::Account) -> Option<Value> {
    let res = reqwest::Client::new()
        .get(format!(
            "{}/xrpc/com.atproto.repo.getRecord",
            net::net().pds
        ))
        .query(&[
            ("repo", a.did.as_str()),
            ("collection", "social.grain.actor.profile"),
            ("rkey", "self"),
        ])
        .send()
        .await
        .unwrap();
    match res.status().as_u16() {
        200 => Some(res.json::<Value>().await.unwrap()["value"].clone()),
        _ => None,
    }
}

/// `did`'s grain profile in the index, once the login's seeding has put
/// it there.
async fn indexed_profile(site: &web::Site, did: &str) -> grain_serve::index::records::Profile {
    let uri = format!("at://{did}/social.grain.actor.profile/self");
    for _ in 0..200 {
        let held = site
            .index
            .get::<grain_serve::index::records::Profile>(&uri)
            .unwrap();
        if let Some(row) = held.filter(|r| r.record.display_name.is_some()) {
            return row.record;
        }
        tokio::time::sleep(std::time::Duration::from_millis(50)).await;
    }
    panic!("no profile was seeded for {did}");
}

#[tokio::test]
async fn a_login_seeds_a_grain_profile_from_bluesky() {
    use base64::Engine;
    use grain_serve::login::profile::{Seeded, seeded};
    let site = site().await;

    // No grain profile: one is made from the Bluesky profile.
    let a = net::account().await;
    let png = base64::engine::general_purpose::STANDARD
        .decode(PNG)
        .unwrap();
    let blob = at_pds(&a, "com.atproto.repo.uploadBlob", png.into(), "image/png").await;
    let avatar = blob["blob"].clone();
    let bsky = json!({ "$type": "app.bsky.actor.profile", "displayName": "Alice B",
        "description": "Fog, mostly", "avatar": avatar });
    made(&a, "app.bsky.actor.profile", bsky).await;
    let mut jar = Jar::default();
    site.log_in(&mut jar, &a).await;
    let held = indexed_profile(&site, &a.did).await;
    assert_eq!(held.display_name.as_deref(), Some("Alice B"));
    assert_eq!(held.description.as_deref(), Some("Fog, mostly"));
    assert_eq!(held.avatar.unwrap().0["ref"], avatar["ref"]);
    let at = grain_profile(&a).await.unwrap();
    assert_eq!(at["displayName"], "Alice B");
    let created = at["createdAt"].as_str().unwrap();
    assert!(grain::lexicon::valid_datetime(created), "{created}");
    // Named now, it is left as it is.
    assert_eq!(seeded(&site.app, &a.did).await.unwrap(), Seeded::Named);

    // A grain profile with no name, which the index has not seen, is put
    // over, and keeps when it was made.
    let b = net::account().await;
    let unnamed = json!({ "$type": "social.grain.actor.profile",
        "description": "old", "createdAt": "2025-01-01T00:00:00.000Z" });
    made(&b, "social.grain.actor.profile", unnamed).await;
    made(
        &b,
        "app.bsky.actor.profile",
        json!({ "$type": "app.bsky.actor.profile", "displayName": "Bob" }),
    )
    .await;
    let mut jar = Jar::default();
    site.log_in(&mut jar, &b).await;
    let held = indexed_profile(&site, &b.did).await;
    assert_eq!(held.display_name.as_deref(), Some("Bob"));
    assert_eq!(held.created_at.as_deref(), Some("2025-01-01T00:00:00.000Z"));
    let at = grain_profile(&b).await.unwrap();
    assert_eq!(at["createdAt"], "2025-01-01T00:00:00.000Z");
    assert!(at.get("description").is_none(), "{at}");

    // A grain profile with a name is left as it is; with no Bluesky
    // profile and no grain profile, a bare one is made, and then left.
    let c = net::account().await;
    let named = json!({ "$type": "social.grain.actor.profile", "displayName": "Carol" });
    made(&c, "social.grain.actor.profile", named).await;
    made(
        &c,
        "app.bsky.actor.profile",
        json!({ "$type": "app.bsky.actor.profile", "displayName": "Other" }),
    )
    .await;
    let d = net::account().await;
    let mut jar = Jar::default();
    site.log_in(&mut jar, &c).await;
    site.log_in(&mut jar, &d).await;
    assert_eq!(seeded(&site.app, &c.did).await.unwrap(), Seeded::Named);
    assert_eq!(grain_profile(&c).await.unwrap()["displayName"], "Carol");
    let bare = format!("at://{}/social.grain.actor.profile/self", d.did);
    for _ in 0..200 {
        let held = site
            .index
            .get::<grain_serve::index::records::Profile>(&bare);
        if held.unwrap().is_some() {
            break;
        }
        tokio::time::sleep(std::time::Duration::from_millis(50)).await;
    }
    assert!(site.index.tracks(&d.did));
    let at = grain_profile(&d).await.unwrap();
    assert_eq!(at.as_object().unwrap().len(), 2, "{at}");
    assert!(grain::lexicon::valid_datetime(
        at["createdAt"].as_str().unwrap()
    ));
    assert_eq!(seeded(&site.app, &d.did).await.unwrap(), Seeded::NoBluesky);
    assert_eq!(grain_profile(&d).await.unwrap(), at);

    // An account with no web session is not seeded, and says why.
    let none = seeded(&site.app, "did:plc:nobody").await.unwrap_err();
    assert!(
        none.to_string().contains("AuthenticationRequired"),
        "{none}"
    );
    grain_serve::login::profile::seed(&site.app, "did:plc:nobody")
        .await
        .unwrap();
}

#[tokio::test]
async fn a_login_names_its_account_by_handle_at_once() {
    let site = site().await;
    let a = net::account().await;
    // An account the index had under a's handle has it no longer once a
    // logs in: a handle names one account.
    let stale = "did:plc:stalehandleholder";
    site.index.track(stale).unwrap();
    site.index.set_handle(stale, &a.handle).unwrap();

    let mut jar = Jar::default();
    site.log_in(&mut jar, &a).await;
    // Before backfill reads the account.
    assert!(site.index.tracks(&a.did));
    let (handle, state) = site.index.repo(&a.did).unwrap().unwrap();
    assert_eq!(handle.as_deref(), Some(a.handle.as_str()));
    assert_eq!(state, "pending", "backfill has not read it");
    assert_eq!(site.index.repo(stale).unwrap().unwrap().0, None);

    // Its profile is found by handle once seeded, as by DID.
    indexed_or_bare(&site, &a.did).await;
    let by_handle = format!("/xrpc/social.grain.actor.getProfile?actor={}", a.handle);
    let res = site.get(&mut Jar::default(), &by_handle).await;
    assert_eq!(res.status().as_u16(), 200);
    let body: Value = res.json().await.unwrap();
    assert_eq!(body["did"], a.did.as_str());
    assert_eq!(body["handle"], a.handle.as_str());
}

/// Waits for `did`'s grain profile, named or bare, to be in the index.
async fn indexed_or_bare(site: &web::Site, did: &str) {
    let uri = format!("at://{did}/social.grain.actor.profile/self");
    for _ in 0..200 {
        let held = site
            .index
            .get::<grain_serve::index::records::Profile>(&uri)
            .unwrap();
        if held.is_some() {
            return;
        }
        tokio::time::sleep(std::time::Duration::from_millis(50)).await;
    }
    panic!("no profile was seeded for {did}");
}

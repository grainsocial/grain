//! The web's writes against the reference PDS: a browser logged in
//! through [`web`]'s site writes with its cookie, from a page of the
//! site, and reads what it wrote from the index straight after. A stand-in
//! PDS, which answers whatever the test sets, takes the place of the
//! account's for the answers the reference PDS does not give.

#[path = "../../grain/tests/common/mod.rs"]
mod net;

mod common;
mod web;

use axum::http::StatusCode;
use base64::Engine;
use serde_json::{Value, json};
use std::sync::{Arc, Mutex};
use web::{Jar, Site, site};

/// One pixel, as a PNG.
const PNG: &str = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

/// A browser logged in to `site` as a new account.
async fn logged_in(site: &Site) -> (net::Account, Vec<(String, String)>) {
    let account = net::account().await;
    let mut jar = Jar::default();
    site.log_in(&mut jar, &account).await;
    let headers = vec![
        ("cookie".to_string(), jar.header()),
        ("origin".to_string(), site.url.clone()),
    ];
    (account, headers)
}

fn refs(headers: &[(String, String)]) -> Vec<(&str, &str)> {
    headers
        .iter()
        .map(|(k, v)| (k.as_str(), v.as_str()))
        .collect()
}

async fn call(
    site: &Site,
    headers: &[(String, String)],
    method: &str,
    body: Value,
) -> (u16, Value) {
    let path = format!("/xrpc/social.grain.repo.{method}");
    site.served.post_headed(&path, &refs(headers), &body).await
}

/// The record at `uri` as `did`'s PDS has it; none if it has none.
async fn at_pds(uri: &str) -> Option<Value> {
    let (_, rest) = uri.split_once("at://").unwrap();
    let mut parts = rest.split('/');
    let (repo, collection, rkey) = (
        parts.next().unwrap(),
        parts.next().unwrap(),
        parts.next().unwrap(),
    );
    let res = reqwest::Client::new()
        .get(format!(
            "{}/xrpc/com.atproto.repo.getRecord",
            net::net().pds
        ))
        .query(&[("repo", repo), ("collection", collection), ("rkey", rkey)])
        .send()
        .await
        .unwrap();
    match res.status().as_u16() {
        200 => Some(res.json::<Value>().await.unwrap()["value"].clone()),
        _ => None,
    }
}

fn indexed(site: &Site, table: &str, uri: &str) -> Option<String> {
    let sql = format!("SELECT cid FROM {table} WHERE uri = ?1");
    site.index
        .read(|db| db.query_row(&sql, [uri], |r| r.get(0)).ok())
}

#[tokio::test]
async fn a_browser_writes_through_its_session_and_reads_it_back() {
    let site = site().await;
    let (a, headers) = logged_in(&site).await;
    let other = net::account().await;
    // What the writes put new in the index is said, for push.
    let (to, mut arrived) = tokio::sync::mpsc::channel(8);
    assert!(site.index.push_to(to));

    // A follow with no $type is given its collection's.
    let follow = json!({ "subject": other.did, "createdAt": "2026-10-31T12:00:00.000Z" });
    let body = json!({ "collection": "social.grain.graph.follow", "record": follow });
    let (status, made) = call(&site, &headers, "createRecord", body).await;
    assert_eq!(status, 200, "{made}");
    let uri = made["uri"].as_str().unwrap().to_string();
    assert!(uri.starts_with(&format!("at://{}/social.grain.graph.follow/", a.did)));
    let at = at_pds(&uri).await.unwrap();
    assert_eq!(at["$type"], "social.grain.graph.follow");
    assert_eq!(
        indexed(&site, "follow", &uri).as_deref(),
        made["cid"].as_str()
    );
    let rkey = uri.rsplit('/').next().unwrap().to_string();
    assert_eq!(arrived.try_recv().ok(), Some(uri.clone()));

    // Put over it: the index has the new one.
    let again = json!({ "subject": other.did, "createdAt": "2026-10-31T13:00:00.000Z" });
    let body = json!({
        "collection": "social.grain.graph.follow",
        "rkey": rkey,
        "record": again,
        "swapRecord": made["cid"],
    });
    let (status, put) = call(&site, &headers, "putRecord", body).await;
    assert_eq!(status, 200, "{put}");
    assert_eq!(put["uri"], uri.as_str());
    assert_ne!(put["cid"], made["cid"]);
    assert_eq!(
        indexed(&site, "follow", &uri).as_deref(),
        put["cid"].as_str()
    );
    // Not new, so not said.
    assert!(arrived.try_recv().is_err());

    // A swap that no longer holds is the PDS's refusal, by its name.
    let other_time = json!({ "subject": other.did, "createdAt": "2026-10-31T14:00:00.000Z" });
    let body = json!({
        "collection": "social.grain.graph.follow",
        "rkey": rkey,
        "record": other_time,
        "swapRecord": made["cid"],
    });
    let (status, said) = call(&site, &headers, "putRecord", body).await;
    assert_eq!((status, said["error"].as_str()), (400, Some("InvalidSwap")));

    // Several at once, each result in its place.
    let gallery = format!("at://{}/social.grain.gallery/3l3qo2vuowo2a", other.did);
    let apply = "social.grain.repo.applyWrites";
    let body = json!({ "writes": [
        {
            "$type": format!("{apply}#create"),
            "collection": "social.grain.favorite",
            "value": { "subject": gallery, "createdAt": "2026-10-31T12:00:00.000Z" },
        },
        {
            "$type": format!("{apply}#update"),
            "collection": "social.grain.graph.follow",
            "rkey": rkey,
            "value": follow,
        },
        { "$type": format!("{apply}#delete"), "collection": "social.grain.graph.follow", "rkey": rkey },
    ]});
    let (status, applied) = call(&site, &headers, "applyWrites", body).await;
    assert_eq!(status, 200, "{applied}");
    let results = applied["results"].as_array().unwrap();
    let kinds: Vec<_> = results
        .iter()
        .map(|r| r["$type"].as_str().unwrap())
        .collect();
    assert_eq!(
        kinds,
        [
            format!("{apply}#createResult"),
            format!("{apply}#updateResult"),
            format!("{apply}#deleteResult"),
        ]
    );
    let favorite = results[0]["uri"].as_str().unwrap();
    assert_eq!(
        indexed(&site, "favorite", favorite).as_deref(),
        results[0]["cid"].as_str()
    );
    assert_eq!(
        indexed(&site, "follow", &uri),
        None,
        "deleted after it was updated"
    );
    assert!(at_pds(&uri).await.is_none());

    // A delete, of the favorite.
    let rkey = favorite.rsplit('/').next().unwrap();
    let body = json!({ "collection": "social.grain.favorite", "rkey": rkey });
    let (status, said) = call(&site, &headers, "deleteRecord", body).await;
    assert_eq!((status, said), (200, json!({})));
    assert_eq!(indexed(&site, "favorite", favorite), None);
    assert!(at_pds(favorite).await.is_none());

    // A picture, for a record to reference.
    let png = base64::engine::general_purpose::STANDARD
        .decode(PNG)
        .unwrap();
    let mut with_type = refs(&headers);
    with_type.push(("content-type", "image/png"));
    let path = "/xrpc/social.grain.repo.uploadBlob";
    let (status, uploaded) = site.served.post_bytes(path, &with_type, png.clone()).await;
    assert_eq!(status, 200, "{uploaded}");
    assert_eq!(uploaded["blob"]["mimeType"], "image/png");
    assert_eq!(uploaded["blob"]["size"], png.len());
    let (status, said) = site.served.post_bytes(path, &refs(&headers), png).await;
    assert_eq!(
        (status, said["error"].as_str()),
        (400, Some("InvalidRequest"))
    );
}

#[tokio::test]
async fn a_write_grain_would_not_index_is_refused_before_it_is_made() {
    let site = site().await;
    let (a, headers) = logged_in(&site).await;
    let record = json!({ "subject": a.did, "createdAt": "2026-10-31T12:00:00.000Z" });
    let follow = "social.grain.graph.follow";
    let cases = [
        (
            "createRecord",
            json!({ "collection": "app.bsky.feed.like", "record": record }),
            "UnknownCollection",
        ),
        (
            "createRecord",
            json!({ "collection": follow, "record": { "createdAt": "2026-10-31T12:00:00.000Z" } }),
            "InvalidRecord",
        ),
        (
            "createRecord",
            json!({ "collection": follow, "record": { "$type": "social.grain.favorite" } }),
            "InvalidRecord",
        ),
        (
            "createRecord",
            json!({ "collection": follow, "record": "a string" }),
            "InvalidRequest",
        ),
        (
            "createRecord",
            json!({ "record": record }),
            "InvalidRequest",
        ),
        (
            "deleteRecord",
            json!({ "collection": "app.bsky.feed.like", "rkey": "3l3" }),
            "UnknownCollection",
        ),
        (
            "deleteRecord",
            json!({ "collection": follow, "rkey": "a/b" }),
            "InvalidRequest",
        ),
        ("applyWrites", json!({ "writes": [] }), "InvalidRequest"),
        (
            "applyWrites",
            json!({ "writes": [{ "$type": "com.atproto.repo.applyWrites#create", "collection": follow, "value": record }] }),
            "InvalidRequest",
        ),
        (
            "applyWrites",
            json!({ "writes": [{ "$type": "social.grain.repo.applyWrites#delete", "collection": follow, "rkey": "3l3", "value": record }] }),
            "InvalidRequest",
        ),
        (
            "applyWrites",
            json!({ "writes": [{ "$type": "social.grain.repo.applyWrites#update", "collection": follow, "value": record }] }),
            "InvalidRequest",
        ),
        (
            "applyWrites",
            json!({ "writes": [{ "collection": follow }] }),
            "InvalidRequest",
        ),
    ];
    for (method, body, error) in cases {
        let (status, said) = call(&site, &headers, method, body.clone()).await;
        assert_eq!(
            (status, said["error"].as_str()),
            (400, Some(error)),
            "{method} {body}"
        );
    }
    let many = vec![json!({}); grain_serve::write::MOST_WRITES + 1];
    let (status, _) = call(&site, &headers, "applyWrites", json!({ "writes": many })).await;
    assert_eq!(status, 400);
    let path = "/xrpc/social.grain.repo.createRecord";
    let (status, _) = site
        .served
        .post_bytes(path, &refs(&headers), b"{".to_vec())
        .await;
    assert_eq!(status, 400);

    // Only the web writes here, and only from a page of the site.
    let body = json!({ "collection": follow, "record": record });
    let (status, said) = call(&site, &headers[..1], "createRecord", body.clone()).await;
    assert_eq!((status, said["error"].as_str()), (403, Some("Forbidden")));
    let mut bearer = headers.clone();
    bearer.push(("authorization".into(), "Bearer a.b.c".into()));
    let (status, said) = call(&site, &bearer, "createRecord", body.clone()).await;
    assert_eq!((status, said["error"].as_str()), (403, Some("Forbidden")));
    let (status, said) = site
        .served
        .post("/xrpc/social.grain.repo.createRecord", &body)
        .await;
    assert_eq!(
        (status, said["error"].as_str()),
        (401, Some("AuthenticationRequired"))
    );
}

/// A stand-in PDS: every call is answered with what the test last set.
struct Stub {
    url: String,
    answer: Arc<Mutex<(u16, Value)>>,
}

async fn stub() -> Stub {
    let answer = Arc::new(Mutex::new((200, json!({}))));
    let held = answer.clone();
    let app = axum::Router::new().fallback(move || {
        let (status, body) = held.lock().unwrap().clone();
        async move { (StatusCode::from_u16(status).unwrap(), axum::Json(body)) }
    });
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let url = format!("http://{}", listener.local_addr().unwrap());
    tokio::spawn(async move { axum::serve(listener, app).await });
    Stub { url, answer }
}

impl Stub {
    fn answers(&self, status: u16, body: Value) {
        *self.answer.lock().unwrap() = (status, body);
    }
}

#[tokio::test]
async fn what_a_pds_answers_is_taken_only_as_far_as_it_holds() {
    let site = site().await;
    let (a, headers) = logged_in(&site).await;
    let record = json!({ "subject": a.did, "createdAt": "2026-10-31T12:00:00.000Z" });
    let follow = "social.grain.graph.follow";
    let create = json!({ "collection": follow, "record": record });

    // An access token the PDS refuses is refreshed, and the call made again.
    let mut kept = site.index.web_session(&a.did).unwrap().unwrap().session;
    let refresh = kept.refresh_jwt.clone();
    kept.access_jwt = "refused".into();
    site.index.keep_web_session(&kept, 1).unwrap();
    let (status, made) = call(&site, &headers, "createRecord", create.clone()).await;
    assert_eq!(status, 200, "{made}");
    let now = site.index.web_session(&a.did).unwrap().unwrap().session;
    assert_ne!(now.refresh_jwt, refresh, "refreshed");

    // From here, a PDS that answers as the test says.
    let pds = stub().await;
    let mut kept = now.clone();
    kept.service = pds.url.clone();
    site.index.keep_web_session(&kept, 1).unwrap();
    let elsewhere = format!("at://did:plc:someone/{follow}/3l3");
    let cases = [
        (
            json!({ "uri": elsewhere, "cid": "bafy" }),
            502,
            "UpstreamFailure",
        ),
        (json!({}), 502, "UpstreamFailure"),
    ];
    for (answer, status, error) in cases {
        pds.answers(200, answer.clone());
        let (got, said) = call(&site, &headers, "createRecord", create.clone()).await;
        assert_eq!(
            (got, said["error"].as_str()),
            (status, Some(error)),
            "{answer}"
        );
    }
    assert_eq!(indexed(&site, "follow", &elsewhere), None, "nothing taken");
    pds.answers(
        500,
        json!({ "error": "InternalServerError", "message": "down" }),
    );
    let (status, _) = call(&site, &headers, "createRecord", create.clone()).await;
    assert_eq!(status, 502);
    pds.answers(
        429,
        json!({ "error": "RateLimitExceeded", "message": "slow down" }),
    );
    let (status, said) = call(&site, &headers, "createRecord", create.clone()).await;
    assert_eq!(
        (status, said["error"].as_str()),
        (429, Some("RateLimitExceeded"))
    );
    let apply = json!({ "writes": [{
        "$type": "social.grain.repo.applyWrites#create", "collection": follow, "value": record,
    }]});
    pds.answers(200, json!({ "results": [] }));
    let (status, _) = call(&site, &headers, "applyWrites", apply).await;
    assert_eq!(status, 502);
    pds.answers(200, json!({}));
    let mut with_type = refs(&headers);
    with_type.push(("content-type", "image/png"));
    let path = "/xrpc/social.grain.repo.uploadBlob";
    let (status, _) = site.served.post_bytes(path, &with_type, vec![1]).await;
    assert_eq!(status, 502);

    // Refused for want of scope: by a session asked for all of it, the
    // call is refused; by one asked for less, the session ends.
    let scope = json!({ "error": "ScopeMissingError", "message": "missing repo:..." });
    pds.answers(403, scope.clone());
    let (status, said) = call(&site, &headers, "createRecord", create.clone()).await;
    assert_eq!(
        (status, said["error"].as_str()),
        (403, Some("ScopeMissingError"))
    );
    assert!(site.index.web_session(&a.did).unwrap().is_some());
    // One asked for the space scopes is not behind a PDS found to serve no
    // spaces, as a probe that failed to reach it finds.
    let mut more = kept.clone();
    more.oauth.as_mut().unwrap().scope = Some(grain::oauth::scope(true));
    site.index.keep_web_session(&more, 1).unwrap();
    let (status, _) = call(&site, &headers, "createRecord", create.clone()).await;
    assert_eq!(status, 403);
    assert!(site.index.web_session(&a.did).unwrap().is_some());
    let mut less = kept.clone();
    less.oauth.as_mut().unwrap().scope = Some("atproto".into());
    site.index.keep_web_session(&less, 1).unwrap();
    let (status, said) = call(&site, &headers, "createRecord", create.clone()).await;
    assert_eq!(
        (status, said["error"].as_str()),
        (401, Some("AuthenticationRequired"))
    );
    assert!(site.index.web_session(&a.did).unwrap().is_none());

    // A PDS that refuses even a fresh token ends the session.
    let (b, headers) = logged_in(&site).await;
    let mut kept = site.index.web_session(&b.did).unwrap().unwrap().session;
    kept.service = pds.url.clone();
    site.index.keep_web_session(&kept, 1).unwrap();
    pds.answers(401, json!({ "error": "InvalidToken", "message": "no" }));
    let create = json!({ "collection": follow, "record": record });
    let (status, said) = call(&site, &headers, "createRecord", create).await;
    assert_eq!(
        (status, said["error"].as_str()),
        (401, Some("AuthenticationRequired"))
    );
    assert!(site.index.web_session(&b.did).unwrap().is_none());
}

#[tokio::test]
async fn a_pool_waits_for_a_pds_that_serves_spaces() {
    let site = site().await;
    let (_, headers) = logged_in(&site).await;
    let group = net::account().await;
    let g = &group.did;
    let path = "/xrpc/social.grain.server.getSpaceSupport";
    let (status, found) = site.served.get_headed(path, &refs(&headers)).await;
    assert_eq!(
        (status, &found["supported"]),
        (200, &json!(false)),
        "{found}"
    );
    let body = json!({ "group": g, "rkey": "3lpool", "title": "Only us" });
    let path = "/xrpc/social.grain.group.createGallery";
    let refused = site.served.post_headed(path, &refs(&headers), &body).await;
    assert_eq!(
        (refused.0, refused.1["error"].as_str()),
        (400, Some("SpacesUnsupported")),
        "{}",
        refused.1
    );
    // A reader on such a PDS cannot ask for a credential to read one.
    let path = format!("/xrpc/social.grain.group.getGallery?group={g}&did={g}&rkey=3lpool");
    let refused = site.served.get_headed(&path, &refs(&headers)).await;
    assert_eq!(
        (refused.0, refused.1["error"].as_str()),
        (400, Some("SpacesUnsupported")),
        "{}",
        refused.1
    );
}

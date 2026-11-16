//! Permissioned spaces through grain-serve, against the reference PDS on
//! the spaces alpha: what a login asks for there, whether an account's
//! PDS is found to serve them, and groups, joined and left through a
//! stand-in group host, started on another ([`host`]), and their pools,
//! read by their members and by no one else.

#[path = "../../grain/tests/common/mod.rs"]
mod net;

mod common;
mod host;
mod web;

use base64::Engine;
use grain::oauth;
use reqwest::header::COOKIE;
use serde_json::{Value, json};
use web::{Jar, Site, site, site_starting_groups};

const SUPPORT: &str = "/xrpc/social.grain.server.getSpaceSupport";

#[tokio::test]
async fn a_login_on_a_pds_that_serves_spaces_asks_for_them() {
    if !net::spaces() {
        return;
    }
    let site = site().await;
    let account = net::account().await;
    let mut jar = Jar::default();
    site.log_in(&mut jar, &account).await;
    let kept = site.index.web_session(&account.did).unwrap().unwrap();
    let asked = kept.session.oauth.as_ref().unwrap().scope.clone();
    assert_eq!(asked.as_deref(), Some(oauth::scope(true).as_str()));
    assert!(!oauth::behind(&kept.session, &oauth::scope(true)));

    let cookie = jar.header();
    let headers = [(COOKIE.as_str(), cookie.as_str())];
    let (status, found) = site.served.get_headed(SUPPORT, &headers).await;
    assert_eq!(status, 200, "{found}");
    assert_eq!(found["supported"], true, "{found}");
    assert_eq!(found["pds"], net::net().pds.trim_end_matches('/'));
    assert_eq!(found["missing"], serde_json::json!([]));
    let path = format!("{SUPPORT}?force=true");
    let (status, again) = site.served.get_headed(&path, &headers).await;
    assert_eq!(status, 200, "{again}");
    assert_ne!(again["checkedAt"], found["checkedAt"], "asked again");
    let path = format!("{SUPPORT}?force=yes");
    let (status, refused) = site.served.get_headed(&path, &headers).await;
    assert_eq!(
        (status, refused["error"].as_str()),
        (400, Some("InvalidRequest"))
    );
    let (status, refused) = site.served.get(SUPPORT).await;
    assert_eq!(status, 401, "{refused}");
}

const PNG: &str = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

/// An account logged in to `site`, and the headers a page of it sends.
struct Browser {
    account: net::Account,
    cookie: String,
    origin: String,
}

impl Browser {
    async fn new(site: &Site) -> Browser {
        let account = net::account().await;
        let mut jar = Jar::default();
        site.log_in(&mut jar, &account).await;
        Browser {
            account,
            cookie: jar.header(),
            origin: site.url.clone(),
        }
    }

    fn headers(&self) -> Vec<(&str, &str)> {
        vec![("cookie", &self.cookie), ("origin", &self.origin)]
    }
}

fn said(answer: &(u16, Value)) -> (u16, Option<&str>) {
    (answer.0, answer.1["error"].as_str())
}

fn query(space: &str) -> String {
    format!("space={}", urlencode(space))
}

fn urlencode(s: &str) -> String {
    s.bytes()
        .map(|b| match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'.' | b'_' | b'~' => {
                (b as char).to_string()
            }
            _ => format!("%{b:02X}"),
        })
        .collect()
}

/// The picture `cid` in `repo`'s repo in `space`, asked with `headers`.
async fn picture(
    site: &Site,
    space: &str,
    repo: &str,
    cid: &str,
    headers: &[(&str, &str)],
) -> reqwest::Response {
    let url = format!(
        "{}/space-blob?{}&repo={repo}&cid={cid}",
        site.served.base,
        query(space)
    );
    let mut req = reqwest::Client::new().get(url);
    for (k, v) in headers {
        req = req.header(*k, *v);
    }
    req.send().await.unwrap()
}

const CID: &str = "bafyreie5737gdxlw5i64vzichcalba3z2v5n6icifvx5xytvske7mr3hpm";
const NOW: &str = "2026-10-31T12:00:00.000Z";

impl Browser {
    async fn group(&self, site: &Site, method: &str, body: Value) -> (u16, Value) {
        let path = format!("/xrpc/social.grain.group.{method}");
        site.served.post_headed(&path, &self.headers(), &body).await
    }

    async fn group_get(&self, site: &Site, method: &str, query: &str) -> (u16, Value) {
        let path = format!("/xrpc/social.grain.group.{method}?{query}");
        site.served.get_headed(&path, &self.headers()).await
    }
}

/// Puts `record` in the index at `uri`.
fn indexed(site: &Site, uri: &str, record: Value) {
    site.index.put(uri, CID, &record).unwrap();
}

#[tokio::test]
async fn a_group_is_joined_read_and_left_through_its_host() {
    if !net::spaces() {
        return;
    }
    let site = site().await;
    let dir = tempfile::tempdir().unwrap();
    let group = host::Group::new(&site.app.ctx, dir.path()).await;
    let g = group.did.clone();
    indexed(
        &site,
        &format!("at://{g}/fyi.opensocial.declaration/self"),
        json!({
            "$type": "fyi.opensocial.declaration",
            "meta": format!("at://{g}/space/fyi.opensocial.meta/self"),
            "createdAt": NOW,
        }),
    );
    let member = Browser::new(&site).await;
    let stranger = Browser::new(&site).await;
    let m = member.account.did.clone();

    // Anyone sees it, as its host lists it.
    let (status, view) = site
        .served
        .get(&format!("/xrpc/social.grain.group.getGroup?actor={g}"))
        .await;
    assert_eq!(status, 200, "{view}");
    assert_eq!(view["displayName"], "Film club");
    assert_eq!(view["description"], "We shoot film.");
    assert_eq!(view["url"], "https://film.example");
    assert_eq!(view["joinPolicy"], "open");
    assert_eq!(view["poolCount"], 0);
    assert!(
        view["avatar"]
            .as_str()
            .unwrap()
            .starts_with(&format!("{}/img/{g}/avatar?v=", group.host))
    );
    assert_eq!(view["rules"].as_array().unwrap().len(), 1, "{view}");
    assert_eq!(view["rules"][0]["text"], "Always.");
    assert_eq!(
        view["rules"][0]["uri"],
        format!("at://{g}/fyi.opensocial.rule/1")
    );
    assert!(view["viewer"].is_null());
    let (status, _) = site
        .served
        .get(&format!("/xrpc/social.grain.group.getGroup?actor={m}"))
        .await;
    assert_eq!(status, 400, "not a group");

    // Its member joins, and is in it; a stranger is not.
    let (status, joined) = member
        .group(&site, "joinGroup", json!({ "group": g }))
        .await;
    assert_eq!((status, joined), (200, json!({ "status": "admitted" })));
    assert_eq!(
        *group.asked.lock().unwrap(),
        [("requestJoin".to_string(), m.clone())]
    );
    let (status, view) = member
        .group_get(&site, "getGroup", &format!("actor={g}"))
        .await;
    assert_eq!(status, 200, "{view}");
    assert_eq!(view["viewer"]["member"], true, "{view}");
    let (_, view) = stranger
        .group_get(&site, "getGroup", &format!("actor={g}"))
        .await;
    assert!(view["viewer"].is_null(), "{view}");
    let (status, listed) = member.group_get(&site, "listGroups", "").await;
    assert_eq!(status, 200, "{listed}");
    let found = listed["groups"]
        .as_array()
        .unwrap()
        .iter()
        .find(|v| v["did"] == g)
        .cloned();
    assert_eq!(found.unwrap()["viewer"]["member"], true, "{listed}");

    // One the host keeps waiting is not in it.
    *group.open.lock().unwrap() = false;
    let (status, joined) = stranger
        .group(&site, "joinGroup", json!({ "group": g, "message": "hi" }))
        .await;
    assert_eq!((status, joined), (200, json!({ "status": "pending" })));
    let (_, view) = stranger
        .group_get(&site, "getGroup", &format!("actor={g}"))
        .await;
    assert!(view["viewer"].is_null(), "{view}");
    // Let in later, they find it on its page, which writes their
    // acceptance, so it is among their groups from then on.
    let admin = grain::space::Admin {
        ctx: &site.app.ctx,
        session: &group.session,
    };
    let members = grain::space::members(&g);
    admin
        .put_member(&members, &stranger.account.did, false)
        .await
        .unwrap();
    let (_, view) = stranger
        .group_get(&site, "getGroup", &format!("actor={g}"))
        .await;
    assert_eq!(view["viewer"]["member"], true, "{view}");
    let (_, listed) = stranger.group_get(&site, "listGroups", "").await;
    let found = listed["groups"]
        .as_array()
        .unwrap()
        .iter()
        .find(|v| v["did"] == g)
        .cloned();
    assert_eq!(found.unwrap()["viewer"]["member"], true, "{listed}");

    // Galleries offered to it: one pooled, one waiting, one declined.
    let gallery = |n: u8| format!("at://{m}/social.grain.gallery/3lg{n}");
    let submission = |n: u8| format!("at://{m}/social.grain.group.submission/3ls{n}");
    for n in 1..=3 {
        let record = json!({ "$type": "social.grain.gallery", "title": format!("roll {n}"), "createdAt": NOW });
        indexed(&site, &gallery(n), record);
        let record = json!({
            "$type": "social.grain.group.submission",
            "group": g,
            "gallery": gallery(n),
            "createdAt": NOW,
        });
        indexed(&site, &submission(n), record);
    }
    let item = format!("at://{g}/social.grain.group.item/3li1");
    let record = json!({
        "$type": "social.grain.group.item",
        "gallery": gallery(1),
        "submission": submission(1),
        "createdAt": NOW,
    });
    indexed(&site, &item, record);
    let record = json!({
        "$type": "social.grain.group.decline",
        "gallery": gallery(3),
        "submission": submission(3),
        "createdAt": NOW,
    });
    indexed(
        &site,
        &format!("at://{g}/social.grain.group.decline/3ld3"),
        record,
    );

    let (status, queue) = site
        .served
        .get(&format!(
            "/xrpc/social.grain.group.getSubmissions?group={g}"
        ))
        .await;
    assert_eq!(status, 200, "{queue}");
    let queued = queue["submissions"].as_array().unwrap();
    assert_eq!(queued.len(), 1, "{queue}");
    assert_eq!(queued[0]["uri"], submission(2));
    assert_eq!(queued[0]["gallery"]["uri"], gallery(2));
    let (status, _) = site
        .served
        .get("/xrpc/social.grain.group.getSubmissions?group=nobody")
        .await;
    assert_eq!(status, 400);
    for (n, status) in [(1, "accepted"), (2, "pending"), (3, "declined")] {
        let query = format!("gallery={}", urlencode(&gallery(n)));
        let (_, listed) = member.group_get(&site, "listGroups", &query).await;
        let view = listed["groups"]
            .as_array()
            .unwrap()
            .iter()
            .find(|v| v["did"] == g)
            .cloned()
            .unwrap();
        assert_eq!(view["viewer"]["submission"]["status"], status, "{view}");
        assert_eq!(view["viewer"]["submission"]["uri"], submission(n));
        assert_eq!(view["poolCount"], 1);
    }
    let (status, _) = member.group_get(&site, "listGroups", "gallery=nope").await;
    assert_eq!(status, 400);
    // A gallery never offered has no standing; no one asking, no viewer.
    let query = format!("gallery={}", urlencode(&gallery(4)));
    let (_, listed) = member.group_get(&site, "listGroups", &query).await;
    let view = listed["groups"]
        .as_array()
        .unwrap()
        .iter()
        .find(|v| v["did"] == g);
    assert!(view.unwrap()["viewer"]["submission"].is_null(), "{listed}");
    let (status, listed) = site.served.get("/xrpc/social.grain.group.listGroups").await;
    assert_eq!(status, 200, "{listed}");
    let view = listed["groups"]
        .as_array()
        .unwrap()
        .iter()
        .find(|v| v["did"] == g);
    assert!(view.unwrap()["viewer"].is_null(), "{listed}");

    // Whoever acts as the group sees what waits for it: called by a
    // service token, for the same server under a DID the alpha takes as
    // an audience, which one with a port is not.
    let aud = "did:web:grain.test";
    let as_group = common::served_app(grain_serve::App {
        did: Some(aud.into()),
        ..web::shared(&site.app)
    })
    .await;
    let token = group
        .token(&site.app.ctx, aud, "social.grain.group.getGroup")
        .await;
    let path = format!("/xrpc/social.grain.group.getGroup?actor={g}");
    let (status, view) = as_group.get_with(&path, &format!("Bearer {token}")).await;
    assert_eq!(status, 200, "{view}");
    assert_eq!(view["viewer"]["acting"], true, "{view}");
    assert_eq!(view["pendingCount"], 1);
    let token = group
        .token(&site.app.ctx, aud, "social.grain.group.listGroups")
        .await;
    let (status, listed) = as_group
        .get_with(
            "/xrpc/social.grain.group.listGroups",
            &format!("Bearer {token}"),
        )
        .await;
    assert_eq!(status, 200, "{listed}");
    let found = listed["groups"]
        .as_array()
        .unwrap()
        .iter()
        .find(|v| v["did"] == g);
    assert_eq!(found.unwrap()["viewer"]["acting"], true, "{listed}");
    // Its own pool is its feed, read with a web session it has none of.
    let token = group
        .token(&site.app.ctx, aud, "social.grain.group.listFeed")
        .await;
    let (status, feed) = as_group
        .get_with(
            "/xrpc/social.grain.group.listFeed",
            &format!("Bearer {token}"),
        )
        .await;
    assert_eq!(status, 401, "{feed}");

    // The member leaves, and is not in it; leaving again is the host's no.
    let (status, left) = member
        .group(&site, "leaveGroup", json!({ "group": g }))
        .await;
    assert_eq!((status, left), (200, json!({})));
    let (_, view) = member
        .group_get(&site, "getGroup", &format!("actor={g}"))
        .await;
    assert!(view["viewer"].is_null(), "{view}");
    let (_, listed) = member.group_get(&site, "listGroups", "").await;
    let found = listed["groups"]
        .as_array()
        .unwrap()
        .iter()
        .find(|v| v["did"] == g)
        .cloned();
    assert!(found.unwrap()["viewer"].is_null(), "{listed}");
    let again = member
        .group(&site, "leaveGroup", json!({ "group": g }))
        .await;
    assert_eq!(said(&again), (400, Some("InvalidRequest")));
    // Nothing is asked of a host for what is not a group.
    for group in [m.as_str(), "nobody"] {
        for method in ["joinGroup", "leaveGroup"] {
            let refused = member.group(&site, method, json!({ "group": group })).await;
            assert_eq!(
                said(&refused),
                (400, Some("InvalidRequest")),
                "{method} {group}"
            );
        }
    }
    // A group whose host cannot be found is the network failing.
    let lost = "did:plc:aaaaaaaaaaaaaaaaaaaaaaaa";
    let record = json!({
        "$type": "fyi.opensocial.declaration",
        "meta": format!("at://{lost}/space/fyi.opensocial.meta/self"),
        "createdAt": NOW,
    });
    indexed(
        &site,
        &format!("at://{lost}/fyi.opensocial.declaration/self"),
        record,
    );
    let nowhere = member
        .group(&site, "joinGroup", json!({ "group": lost }))
        .await;
    assert_eq!(
        said(&nowhere),
        (502, Some("UpstreamFailure")),
        "{}",
        nowhere.1
    );
}

impl Browser {
    async fn pool(&self, site: &Site, method: &str, body: Value) -> (u16, Value) {
        let path = format!("/xrpc/social.grain.group.{method}");
        site.served.post_headed(&path, &self.headers(), &body).await
    }

    async fn pool_get(&self, site: &Site, method: &str, query: &str) -> (u16, Value) {
        let path = format!("/xrpc/social.grain.group.{method}?{query}");
        site.served.get_headed(&path, &self.headers()).await
    }
}

#[tokio::test]
async fn a_group_is_started_on_the_group_host() {
    if !net::spaces() {
        return;
    }
    // A server with no group host starts none.
    let plain = site().await;
    let host_query = "/xrpc/social.grain.group.getGroupHost";
    assert_eq!(plain.served.get(host_query).await, (200, json!({})));

    // Nor does one whose group host does not answer.
    let unanswered = site_starting_groups("http://127.0.0.1:9").await;
    assert_eq!(unanswered.served.get(host_query).await, (200, json!({})));
    let founder = Browser::new(&unanswered).await;
    let ask = json!({ "name": "film", "displayName": "Film club" });
    let answer = founder.group(&unanswered, "createGroup", ask).await;
    assert_eq!(said(&answer), (400, Some("NotSupported")), "{}", answer.1);

    let (listener, url) = host::Starter::bind().await;
    let site = site_starting_groups(&url).await;
    let starter = host::Starter::serve(listener, &site.app.ctx, site.index.clone());
    let founder = Browser::new(&site).await;
    let f = founder.account.did.clone();
    let answer = site.served.get(host_query).await;
    assert_eq!(
        answer,
        (200, json!({ "url": url, "handleDomain": ".test" }))
    );

    let create = |name: &str| json!({ "name": name, "displayName": "Film club", "description": "We shoot film." });
    let answer = founder.group(&site, "createGroup", create("-film")).await;
    assert_eq!(said(&answer), (400, Some("InvalidName")), "{}", answer.1);
    let tag = net::fresh_handle().trim_end_matches(".test").to_string();
    let answer = founder
        .group(&site, "createGroup", create(&format!("taken{tag}")))
        .await;
    assert_eq!(
        said(&answer),
        (400, Some("HandleUnavailable")),
        "{}",
        answer.1
    );
    // A host is believed only of the accounts it logs in.
    let answer = founder
        .group(&site, "createGroup", create(&format!("stolen{tag}")))
        .await;
    assert_eq!(said(&answer), (400, Some("CreateFailed")), "{}", answer.1);
    assert!(site.index.web_session(&f).unwrap().is_some());

    // Started, it is the founder's, with its profile and its pool.
    let name = format!("Film{tag}");
    let (status, started) = founder.group(&site, "createGroup", create(&name)).await;
    assert_eq!(status, 200, "{started}");
    let g = started["did"].as_str().unwrap().to_string();
    assert_eq!(started["handle"], format!("{}.test", name.to_lowercase()));
    let sent = starter.sent.lock().unwrap().clone();
    assert_eq!(sent["handle"], started["handle"]);
    assert_eq!(sent["displayName"], "Film club");
    assert_eq!(sent["client_id"], site.app.web.as_ref().unwrap().client.id);
    assert!(sent["client_assertion"].is_string(), "{sent}");
    assert!(
        sent["scope"]
            .as_str()
            .unwrap()
            .contains("repo:social.grain.group.item"),
        "{sent}"
    );
    let asked = starter.asked.lock().unwrap().clone();
    assert!(
        asked.contains(&("createSpace".to_string(), f.clone())),
        "{asked:?}"
    );
    assert!(asked.iter().all(|(_, who)| *who == f), "{asked:?}");
    let kept = site.index.web_session(&g).unwrap().unwrap().session;
    assert_eq!(kept.service, url);
    let (status, view) = founder
        .group_get(&site, "getGroup", &format!("actor={g}"))
        .await;
    assert_eq!(status, 200, "{view}");
    assert_eq!(view["displayName"], "Film club");
    assert_eq!(view["description"], "We shoot film.");
    assert_eq!(view["viewer"]["member"], true, "{view}");
    let (status, pool) = founder
        .pool_get(&site, "listGalleries", &format!("group={g}"))
        .await;
    assert_eq!(status, 200, "{pool}");

    // A pool its host will not open leaves the group started without one.
    let answer = founder
        .group(&site, "createGroup", create(&format!("nopool{tag}")))
        .await;
    assert_eq!(said(&answer), (400, Some("PoolFailed")), "{}", answer.1);
}

#[tokio::test]
async fn a_pool_is_read_and_written_by_its_groups_members_alone() {
    if !net::spaces() {
        return;
    }
    let site = site().await;
    let dir = tempfile::tempdir().unwrap();
    let group = host::Group::new(&site.app.ctx, dir.path()).await;
    let g = group.did.clone();
    indexed(
        &site,
        &format!("at://{g}/fyi.opensocial.declaration/self"),
        json!({
            "$type": "fyi.opensocial.declaration",
            "meta": format!("at://{g}/space/fyi.opensocial.meta/self"),
            "createdAt": NOW,
        }),
    );
    let author = Browser::new(&site).await;
    let fan = Browser::new(&site).await;
    let outsider = Browser::new(&site).await;
    let roster_only = Browser::new(&site).await;
    for joining in [&author, &fan] {
        let (status, joined) = joining
            .group(&site, "joinGroup", json!({ "group": g }))
            .await;
        assert_eq!((status, joined), (200, json!({ "status": "admitted" })));
    }
    let a = author.account.did.clone();
    let f = fan.account.did.clone();
    let pool = grain::space::pool(&g);

    let png = base64::engine::general_purpose::STANDARD
        .decode(PNG)
        .unwrap();
    let mut with_type = author.headers();
    with_type.push(("content-type", "image/png"));
    let path = "/xrpc/social.grain.repo.uploadBlob";
    let (status, uploaded) = site.served.post_bytes(path, &with_type, png.clone()).await;
    assert_eq!(status, 200, "{uploaded}");
    let blob = uploaded["blob"].clone();
    let cid = blob["ref"]["$link"].as_str().unwrap().to_string();
    let photo =
        json!({ "photo": blob, "alt": "a pixel", "aspectRatio": { "width": 1, "height": 1 } });
    for (who, name) in [(&a, "The author"), (&f, "A fan")] {
        let profile = json!({ "$type": "social.grain.actor.profile", "displayName": name });
        indexed(
            &site,
            &format!("at://{who}/social.grain.actor.profile/self"),
            profile,
        );
    }

    // A member puts a gallery in; the input is held to its shape first.
    let made = json!({
        "group": g,
        "rkey": "3lpool",
        "title": "Roll one",
        "description": "a walk",
        "photos": [photo, photo],
    });
    for bad in [
        json!({ "group": "nobody", "rkey": "3lpool", "title": "x" }),
        json!({ "group": g, "rkey": "no/slash", "title": "x" }),
        json!({ "group": g, "rkey": "3lpool", "title": "x", "photos": vec![photo.clone(); 101] }),
        json!({ "group": g, "rkey": "3lpool" }),
    ] {
        let refused = author.pool(&site, "createGallery", bad).await;
        assert_eq!(
            said(&refused),
            (400, Some("InvalidRequest")),
            "{}",
            refused.1
        );
    }
    let long = json!({ "group": g, "rkey": "3lpool", "title": "x".repeat(1000) });
    let refused = author.pool(&site, "createGallery", long).await;
    assert_eq!(said(&refused), (400, Some("InvalidRecord")));
    let (status, created) = author.pool(&site, "createGallery", made.clone()).await;
    assert_eq!(status, 200, "{created}");
    assert_eq!(created["space"], pool);
    let gallery = format!("at://{a}/social.grain.gallery/3lpool");
    assert_eq!(created["uri"], gallery);

    // Not a member, an account writes nothing into it and reads nothing.
    let theirs = json!({ "group": g, "rkey": "3lmine", "title": "Mine" });
    let refused = outsider.pool(&site, "createGallery", theirs).await;
    assert_eq!(
        said(&refused),
        (400, Some("NotAuthorized")),
        "{}",
        refused.1
    );
    let at = format!("group={g}");
    let refused = outsider.pool_get(&site, "listGalleries", &at).await;
    assert_eq!(
        said(&refused),
        (400, Some("NotAuthorized")),
        "{}",
        refused.1
    );
    let one = format!("group={g}&did={a}&rkey=3lpool");
    let refused = outsider.pool_get(&site, "getGallery", &one).await;
    assert_eq!(
        said(&refused),
        (400, Some("NotAuthorized")),
        "{}",
        refused.1
    );
    let (status, feed) = outsider.pool_get(&site, "listFeed", "").await;
    assert_eq!(
        (status, feed),
        (200, json!({ "galleries": [], "groups": [] }))
    );
    let favorite = json!({ "group": g, "gallery": gallery, "on": true });
    let refused = outsider.pool(&site, "putFavorite", favorite.clone()).await;
    assert_eq!(
        said(&refused),
        (400, Some("NotAuthorized")),
        "{}",
        refused.1
    );
    let response = picture(&site, &pool, &a, &cid, &outsider.headers()).await;
    assert_eq!(response.status(), 404);
    let words = json!({ "group": g, "gallery": gallery, "text": "hi" });
    let refused = outsider.pool(&site, "createComment", words).await;
    assert_eq!(
        said(&refused),
        (400, Some("NotAuthorized")),
        "{}",
        refused.1
    );
    let (status, _) = site
        .served
        .get(&format!("/xrpc/social.grain.group.listGalleries?{at}"))
        .await;
    assert_eq!(status, 401);

    // Nor does one on the group's roster that its pool does not take.
    let admin = grain::space::Admin {
        ctx: &site.app.ctx,
        session: &group.session,
    };
    let members = grain::space::members(&g);
    let r = roster_only.account.did.clone();
    admin.put_member(&members, &r, false).await.unwrap();
    let (_, view) = roster_only
        .group_get(&site, "getGroup", &format!("actor={g}"))
        .await;
    assert_eq!(view["viewer"]["member"], true, "{view}");
    let refused = roster_only.pool_get(&site, "listFeed", "").await;
    assert_eq!(
        said(&refused),
        (400, Some("NotAuthorized")),
        "{}",
        refused.1
    );

    // Another member sees it, favorites it once however often asked, and
    // comments on it.
    let (status, listed) = fan.pool_get(&site, "listGalleries", &at).await;
    assert_eq!(status, 200, "{listed}");
    assert_eq!(listed["space"], pool);
    let card = &listed["galleries"][0];
    assert_eq!(listed["galleries"].as_array().unwrap().len(), 1, "{listed}");
    assert_eq!(card["did"], *a);
    assert_eq!(card["displayName"], "The author");
    assert_eq!(card["title"], "Roll one");
    assert_eq!(card["description"], "a walk");
    assert_eq!(card["photoCount"], 2);
    assert_eq!(card["cover"]["cid"], cid);
    assert_eq!(card["cover"]["alt"], "a pixel");
    assert_eq!(card["cover"]["position"], 0);
    assert_eq!(card["favCount"], 0);
    let (status, faved) = fan.pool(&site, "putFavorite", favorite.clone()).await;
    assert_eq!(status, 200, "{faved}");
    assert_eq!(faved["on"], true);
    let (_, again) = fan.pool(&site, "putFavorite", favorite.clone()).await;
    assert_eq!(again, faved, "asked twice, one favorite");
    let refused = fan
        .pool(
            &site,
            "putFavorite",
            json!({ "group": g, "gallery": "nope", "on": true }),
        )
        .await;
    assert_eq!(said(&refused), (400, Some("InvalidRecord")));
    let comment = |text: &str| json!({ "group": g, "gallery": gallery, "text": text });
    let refused = fan.pool(&site, "createComment", comment("  ")).await;
    assert_eq!(said(&refused), (400, Some("InvalidRequest")));
    let (status, commented) = fan.pool(&site, "createComment", comment(" lovely ")).await;
    assert_eq!(status, 200, "{commented}");
    let rkey = commented["rkey"].as_str().unwrap().to_string();
    assert_eq!(
        commented["uri"],
        format!("at://{f}/social.grain.comment/{rkey}")
    );
    let mut reply = comment("thanks");
    reply["replyTo"] = commented["uri"].clone();
    let (status, _) = author.pool(&site, "createComment", reply).await;
    assert_eq!(status, 200);

    // The gallery read whole, by its author and by the fan.
    let (status, read) = author.pool_get(&site, "getGallery", &one).await;
    assert_eq!(status, 200, "{read}");
    assert_eq!(read["space"], pool);
    assert_eq!(read["did"], *a);
    assert_eq!(read["displayName"], "The author");
    assert_eq!(read["viewerIsAuthor"], true);
    assert_eq!(read["gallery"]["uri"], gallery);
    assert_eq!(read["gallery"]["title"], "Roll one");
    assert_eq!(read["gallery"]["description"], "a walk");
    assert_eq!(read["favCount"], 1);
    assert!(read["viewerFav"].is_null(), "{read}");
    assert_eq!(read["commentCount"], 2);
    assert_eq!(read["comments"][0]["text"], "lovely");
    assert_eq!(read["comments"][0]["author"]["did"], *f);
    assert_eq!(read["comments"][0]["author"]["displayName"], "A fan");
    assert_eq!(read["comments"][1]["replyTo"], commented["uri"]);
    assert_eq!(read["comments"][1]["author"]["did"], *a);
    let items = read["items"].as_array().unwrap();
    assert_eq!(items.len(), 2, "{read}");
    assert_eq!(items[1]["position"], 1);
    assert_eq!(
        items[1]["uri"],
        format!("at://{a}/social.grain.photo/3lpool-1")
    );
    let (_, read) = fan.pool_get(&site, "getGallery", &one).await;
    assert_eq!(read["viewerIsAuthor"], false);
    assert_eq!(read["viewerFav"], faved["rkey"], "{read}");
    let missing = format!("group={g}&did={a}&rkey=3lnone");
    let (status, read) = fan.pool_get(&site, "getGallery", &missing).await;
    assert_eq!(status, 200, "{read}");
    assert!(read["gallery"].is_null());
    assert_eq!(
        (read["favCount"].clone(), read["items"].clone()),
        (json!(0), json!([]))
    );
    let bad = format!("group={g}&did=nobody&rkey=3lpool");
    let (status, _) = fan.pool_get(&site, "getGallery", &bad).await;
    assert_eq!(status, 400);

    // Its pictures are read through the space by members, and never kept
    // past their reader.
    let response = picture(&site, &pool, &a, &cid, &fan.headers()).await;
    assert_eq!(response.status(), 200);
    assert_eq!(response.headers()["content-type"], "image/png");
    assert_eq!(response.headers()["cache-control"], "private, no-store");
    let vary: Vec<&str> = response
        .headers()
        .get_all("vary")
        .iter()
        .map(|v| v.to_str().unwrap())
        .collect();
    assert_eq!(
        vary,
        ["atproto-space-delegation", "cookie", "authorization"]
    );
    assert_eq!(response.headers()["x-content-type-options"], "nosniff");
    assert_eq!(response.bytes().await.unwrap().as_ref(), png.as_slice());
    let response = picture(&site, "not-a-space", &a, &cid, &fan.headers()).await;
    assert_eq!(response.status(), 404);
    let none = "bafkreigh2akiscaildcqabsyg3dfr6chu3fgpregiymsck7e7aqa4s52zy";
    let response = picture(&site, &pool, &a, none, &fan.headers()).await;
    assert_eq!(response.status(), 404, "no such picture");
    // A query's answer is for its reader alone too.
    let url = format!(
        "{}/xrpc/social.grain.group.getGallery?{one}",
        site.served.base
    );
    let mut req = reqwest::Client::new().get(url);
    for (k, v) in fan.headers() {
        req = req.header(k, v);
    }
    let response = req.send().await.unwrap();
    assert_eq!(response.status(), 200);
    assert_eq!(response.headers()["cache-control"], "private, no-store");
    let vary: Vec<&str> = response
        .headers()
        .get_all("vary")
        .iter()
        .map(|v| v.to_str().unwrap())
        .collect();
    assert!(
        vary.contains(&"atproto-space-delegation") && vary.contains(&"cookie"),
        "{vary:?}"
    );
    // Logging out forgets what its account read with, and only that.
    let passerby = Browser::new(&site).await;
    let (status, _) = site
        .served
        .post_headed("/oauth/logout", &passerby.headers(), &json!({}))
        .await;
    assert_eq!(status, 200);
    let (status, _) = fan.pool_get(&site, "getGallery", &one).await;
    assert_eq!(status, 200);

    // The fan's feed is every pool they are in, with the groups.
    let (status, feed) = fan.pool_get(&site, "listFeed", "limit=5").await;
    assert_eq!(status, 200, "{feed}");
    let card = &feed["galleries"][0];
    assert_eq!(card["group"], g);
    assert_eq!(card["uri"], gallery);
    assert_eq!(card["viewerFav"], faved["rkey"]);
    assert_eq!(card["commentCount"], 2);
    assert_eq!(card["items"].as_array().unwrap().len(), 2);
    assert_eq!(feed["groups"][0]["did"], g, "{feed}");
    assert_eq!(feed["groups"][0]["viewer"]["member"], true, "{feed}");

    // Taken back: the comment, the favorite (twice over), the gallery.
    let gone = json!({ "group": g, "rkey": rkey });
    let (status, deleted) = fan.pool(&site, "deleteComment", gone).await;
    assert_eq!((status, deleted), (200, json!({ "deleted": true })));
    let mut off = favorite.clone();
    off["on"] = false.into();
    for _ in 0..2 {
        let (status, unfaved) = fan.pool(&site, "putFavorite", off.clone()).await;
        assert_eq!((status, unfaved), (200, json!({ "on": false })));
    }
    let (_, read) = author.pool_get(&site, "getGallery", &one).await;
    assert_eq!(
        (read["favCount"].clone(), read["commentCount"].clone()),
        (json!(0), json!(1))
    );
    // A pool of more photos than a page holds is read to its end.
    for (rkey, n) in [("3lbig", 60), ("3lbigger", 50)] {
        let made =
            json!({ "group": g, "rkey": rkey, "title": rkey, "photos": vec![photo.clone(); n] });
        let (status, created) = author.pool(&site, "createGallery", made).await;
        assert_eq!(status, 200, "{created}");
    }
    let (_, listed) = fan.pool_get(&site, "listGalleries", &at).await;
    let counts: Vec<(&str, i64)> = listed["galleries"]
        .as_array()
        .unwrap()
        .iter()
        .map(|g| {
            (
                g["rkey"].as_str().unwrap(),
                g["photoCount"].as_i64().unwrap(),
            )
        })
        .collect();
    assert_eq!(
        counts,
        [("3lbigger", 50), ("3lbig", 60), ("3lpool", 2)],
        "{listed}"
    );
    for rkey in ["3lbig", "3lbigger"] {
        let withdraw = json!({ "group": g, "rkey": rkey });
        let (status, _) = author.pool(&site, "deleteGallery", withdraw).await;
        assert_eq!(status, 200);
    }
    let withdraw = json!({ "group": g, "rkey": "3lpool" });
    let (status, deleted) = author.pool(&site, "deleteGallery", withdraw).await;
    assert_eq!((status, deleted), (200, json!({ "deleted": 5 })));
    let (_, listed) = fan.pool_get(&site, "listGalleries", &at).await;
    assert_eq!(listed["galleries"], json!([]), "{listed}");

    // A member who leaves takes back what they gave, though the pool no
    // longer takes their writes.
    let (status, _) = fan.pool(&site, "putFavorite", favorite.clone()).await;
    assert_eq!(status, 200);
    let (status, commented) = fan.pool(&site, "createComment", comment("bye")).await;
    assert_eq!(status, 200, "{commented}");
    let (status, left) = fan.group(&site, "leaveGroup", json!({ "group": g })).await;
    assert_eq!((status, left), (200, json!({})));
    let refused = fan.pool(&site, "putFavorite", favorite.clone()).await;
    assert_eq!(
        said(&refused),
        (400, Some("NotAuthorized")),
        "{}",
        refused.1
    );
    let (status, unfaved) = fan.pool(&site, "putFavorite", off.clone()).await;
    assert_eq!((status, unfaved), (200, json!({ "on": false })));
    let gone = json!({ "group": g, "rkey": commented["rkey"] });
    let (status, deleted) = fan.pool(&site, "deleteComment", gone).await;
    assert_eq!((status, deleted), (200, json!({ "deleted": true })));
    for (method, body) in [
        ("deleteGallery", json!({ "group": "nobody", "rkey": "x" })),
        ("deleteComment", json!({ "group": "nobody", "rkey": "x" })),
        (
            "createComment",
            json!({ "group": "nobody", "gallery": gallery, "text": "x" }),
        ),
        (
            "putFavorite",
            json!({ "group": "nobody", "gallery": gallery, "on": true }),
        ),
    ] {
        let refused = fan.pool(&site, method, body).await;
        assert_eq!(said(&refused), (400, Some("InvalidRequest")), "{method}");
    }
}

#[tokio::test]
async fn an_app_reads_a_pools_pictures_with_its_readers_delegation() {
    if !net::spaces() {
        return;
    }
    let site = site().await;
    let dir = tempfile::tempdir().unwrap();
    let group = host::Group::new(&site.app.ctx, dir.path()).await;
    let g = group.did.clone();
    indexed(
        &site,
        &format!("at://{g}/fyi.opensocial.declaration/self"),
        json!({
            "$type": "fyi.opensocial.declaration",
            "meta": format!("at://{g}/space/fyi.opensocial.meta/self"),
            "createdAt": NOW,
        }),
    );
    let author = Browser::new(&site).await;
    let member = Browser::new(&site).await;
    let outsider = Browser::new(&site).await;
    for joining in [&author, &member] {
        let (status, joined) = joining
            .group(&site, "joinGroup", json!({ "group": g }))
            .await;
        assert_eq!((status, joined), (200, json!({ "status": "admitted" })));
    }
    let png = base64::engine::general_purpose::STANDARD
        .decode(PNG)
        .unwrap();
    let mut with_type = author.headers();
    with_type.push(("content-type", "image/png"));
    let path = "/xrpc/social.grain.repo.uploadBlob";
    let (status, uploaded) = site.served.post_bytes(path, &with_type, png.clone()).await;
    assert_eq!(status, 200, "{uploaded}");
    let blob = uploaded["blob"].clone();
    let cid = blob["ref"]["$link"].as_str().unwrap().to_string();
    let photo = json!({ "photo": blob, "aspectRatio": { "width": 1, "height": 1 } });
    let made = json!({ "group": g, "rkey": "3lapp", "title": "For the app", "photos": [photo] });
    let (status, created) = author.pool(&site, "createGallery", made).await;
    assert_eq!(status, 200, "{created}");
    let pool = grain::space::pool(&g);
    let a = author.account.did.clone();

    // The token a reader's PDS signs for the space, as an app asks it.
    let session = site
        .index
        .web_session(&member.account.did)
        .unwrap()
        .unwrap()
        .session;
    let ctx = &site.app.ctx;
    let token = grain::space::delegation(ctx, &session, &pool)
        .await
        .unwrap();
    let headed = |token: &str| vec![(grain::space::DELEGATION_HEADER, token.to_string())];
    let send = |headers: Vec<(&'static str, String)>| {
        let (site, pool, a, cid) = (&site, &pool, &a, &cid);
        async move {
            let headers: Vec<(&str, &str)> =
                headers.iter().map(|(k, v)| (*k, v.as_str())).collect();
            picture(site, pool, a, cid, &headers)
                .await
                .status()
                .as_u16()
        }
    };
    assert_eq!(send(headed(&token)).await, 200);
    // Each is spent once.
    assert_eq!(send(headed(&token)).await, 401);
    assert_eq!(send(headed("nonsense")).await, 401);
    let unreadable = reqwest::header::HeaderValue::from_bytes(b"\xfftoken").unwrap();
    let url = format!(
        "{}/space-blob?{}&repo={a}&cid={cid}",
        site.served.base,
        query(&pool)
    );
    let res = reqwest::Client::new()
        .get(url)
        .header(grain::space::DELEGATION_HEADER, unreadable)
        .send()
        .await
        .unwrap();
    assert_eq!(res.status(), 401, "not a token");
    let other = grain::space::uri(&g, grain::space::POOL, "other");
    let elsewhere = grain::space::delegation(ctx, &session, &other)
        .await
        .unwrap();
    assert_eq!(send(headed(&elsewhere)).await, 401);
    // And for its reader alone.
    let fresh = grain::space::delegation(ctx, &session, &pool)
        .await
        .unwrap();
    let mut theirs = headed(&fresh);
    theirs.push(("cookie", outsider.cookie.clone()));
    assert_eq!(send(theirs).await, 401);
    // Another of its reader's is read with the credential got before.
    let again = grain::space::delegation(ctx, &session, &pool)
        .await
        .unwrap();
    assert_eq!(send(headed(&again)).await, 200);
    // A reader the host does not admit is refused at the exchange, as if
    // there were no such picture.
    let session = site
        .index
        .web_session(&outsider.account.did)
        .unwrap()
        .unwrap()
        .session;
    let token = grain::space::delegation(ctx, &session, &pool)
        .await
        .unwrap();
    assert_eq!(send(headed(&token)).await, 404);
}

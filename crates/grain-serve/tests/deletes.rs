//! A gallery deleted with what hangs off it, and an account deleting its
//! grain data, against the reference PDS: a browser logged in through
//! [`web`]'s site, an app with a service token, and the stream saying an
//! account was deleted.

#[path = "../../grain/tests/common/mod.rs"]
mod net;

mod common;
mod web;

use base64::Engine;
use grain::session;
use grain::xrpc::Xrpc;
use grain_serve::App;
use grain_serve::index::Index;
use serde_json::{Value, json};
use std::sync::Arc;
use web::{Jar, Site, site};

/// One pixel, as a PNG.
const PNG: &str = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
const NOW: &str = "2026-10-31T12:00:00.000Z";
const DELETE_GALLERY: &str = "/xrpc/social.grain.gallery.deleteGallery";
const DELETE_ACCOUNT: &str = "/xrpc/social.grain.server.deleteAccount";

/// A browser logged in to `site` as `account`, from a page of the site.
struct Browser<'a> {
    site: &'a Site,
    cookie: String,
}

impl Browser<'_> {
    async fn new<'a>(site: &'a Site, account: &net::Account) -> Browser<'a> {
        let mut jar = Jar::default();
        site.log_in(&mut jar, account).await;
        Browser {
            site,
            cookie: jar.header(),
        }
    }

    fn headers(&self) -> [(&str, &str); 2] {
        [
            ("cookie", self.cookie.as_str()),
            ("origin", self.site.url.as_str()),
        ]
    }

    async fn post(&self, path: &str, body: Value) -> (u16, Value) {
        self.site
            .served
            .post_headed(path, &self.headers(), &body)
            .await
    }

    /// A record made at `collection`; its URI.
    async fn make(&self, collection: &str, record: Value) -> String {
        let body = json!({ "collection": collection, "record": record });
        let (status, made) = self
            .post("/xrpc/social.grain.repo.createRecord", body)
            .await;
        assert_eq!(status, 200, "{made}");
        made["uri"].as_str().unwrap().to_string()
    }

    async fn photo(&self) -> String {
        let png = base64::engine::general_purpose::STANDARD
            .decode(PNG)
            .unwrap();
        let [cookie, origin] = self.headers();
        let headers = [cookie, origin, ("content-type", "image/png")];
        let path = "/xrpc/social.grain.repo.uploadBlob";
        let (status, up) = self.site.served.post_bytes(path, &headers, png).await;
        assert_eq!(status, 200, "{up}");
        let photo = json!({ "photo": up["blob"], "alt": "", "aspectRatio": { "width": 1, "height": 1 }, "createdAt": NOW });
        self.make("social.grain.photo", photo).await
    }

    async fn item(&self, gallery: &str, photo: &str) -> String {
        let item = json!({ "gallery": gallery, "item": photo, "position": 0, "createdAt": NOW });
        self.make("social.grain.gallery.item", item).await
    }
}

fn rkey(uri: &str) -> &str {
    uri.rsplit('/').next().unwrap()
}

/// Whether the reference PDS holds the record at `uri`.
async fn at_pds(uri: &str) -> bool {
    let mut parts = uri.trim_start_matches("at://").split('/');
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
    res.status().is_success()
}

/// The grain collections the reference PDS lists for `did`.
async fn grain_collections(did: &str) -> Vec<String> {
    let described: Value = reqwest::Client::new()
        .get(format!(
            "{}/xrpc/com.atproto.repo.describeRepo",
            net::net().pds
        ))
        .query(&[("repo", did)])
        .send()
        .await
        .unwrap()
        .json()
        .await
        .unwrap();
    let all = described["collections"].as_array().unwrap();
    all.iter()
        .filter_map(Value::as_str)
        .filter(|c| c.starts_with("social.grain."))
        .map(str::to_string)
        .collect()
}

fn indexed(site: &Site, uri: &str) -> bool {
    let (_, collection, _) = grain_serve::index::record_uri(uri).unwrap();
    let table = grain_serve::index::records::table_of(collection).unwrap();
    let sql = format!("SELECT count(*) FROM {table} WHERE uri = ?1");
    site.index
        .read(|db| db.query_row(&sql, [uri], |r| r.get::<_, i64>(0)).unwrap())
        > 0
}

#[tokio::test]
async fn a_gallery_goes_with_what_hangs_off_it() {
    let site = site().await;
    let account = net::account().await;
    let other = net::account().await;
    let me = Browser::new(&site, &account).await;
    let them = Browser::new(&site, &other).await;

    let gallery = me
        .make(
            "social.grain.gallery",
            json!({ "title": "fog", "createdAt": NOW }),
        )
        .await;
    let kept_gallery = me
        .make(
            "social.grain.gallery",
            json!({ "title": "kept", "createdAt": NOW }),
        )
        .await;
    let only_here = me.photo().await;
    let shared = me.photo().await;
    let items = [
        me.item(&gallery, &only_here).await,
        me.item(&gallery, &shared).await,
    ];
    let kept_item = me.item(&kept_gallery, &shared).await;
    let exif = me
        .make(
            "social.grain.photo.exif",
            json!({ "photo": only_here, "createdAt": NOW, "iso": 100000000 }),
        )
        .await;
    let fav = me
        .make(
            "social.grain.favorite",
            json!({ "subject": gallery, "createdAt": NOW }),
        )
        .await;
    let comment = me
        .make(
            "social.grain.comment",
            json!({ "text": "mine", "subject": gallery, "createdAt": NOW }),
        )
        .await;
    let theirs = them
        .make(
            "social.grain.comment",
            json!({ "text": "theirs", "subject": gallery, "createdAt": NOW }),
        )
        .await;

    let (status, said) = me
        .post(DELETE_GALLERY, json!({ "rkey": rkey(&gallery) }))
        .await;
    assert_eq!((status, said), (200, json!({})));
    let gone = [
        &gallery, &only_here, &items[0], &items[1], &exif, &fav, &comment,
    ];
    for uri in gone {
        assert!(!at_pds(uri).await, "{uri} at the PDS");
        assert!(!indexed(&site, uri), "{uri} in the index");
    }
    for uri in [&kept_gallery, &shared, &kept_item, &theirs] {
        assert!(at_pds(uri).await, "{uri} kept");
        assert!(indexed(&site, uri), "{uri} kept in the index");
    }

    // Not twice, not another's, not by a service token, not from elsewhere.
    let (status, said) = me
        .post(DELETE_GALLERY, json!({ "rkey": rkey(&gallery) }))
        .await;
    assert_eq!((status, said["error"].as_str()), (400, Some("NotFound")));
    let (status, said) = them
        .post(DELETE_GALLERY, json!({ "rkey": rkey(&kept_gallery) }))
        .await;
    assert_eq!((status, said["error"].as_str()), (400, Some("NotFound")));
    assert!(at_pds(&kept_gallery).await);
    let (status, said) = me.post(DELETE_GALLERY, json!({ "rkey": "a/b" })).await;
    assert_eq!(
        (status, said["error"].as_str()),
        (400, Some("InvalidRequest"))
    );
    let [cookie, origin] = me.headers();
    let bearer = [cookie, origin, ("authorization", "Bearer a.b.c")];
    let body = json!({ "rkey": rkey(&kept_gallery) });
    let (status, said) = site
        .served
        .post_headed(DELETE_GALLERY, &bearer, &body)
        .await;
    assert_eq!((status, said["error"].as_str()), (403, Some("Forbidden")));
    let (status, said) = site
        .served
        .post_headed(DELETE_GALLERY, &[cookie], &body)
        .await;
    assert_eq!((status, said["error"].as_str()), (403, Some("Forbidden")));
    let (status, _) = site.served.post(DELETE_GALLERY, &body).await;
    assert_eq!(status, 401);
}

#[tokio::test]
async fn the_web_deletes_an_accounts_grain_data_a_part_at_a_time() {
    let site = site().await;
    let account = net::account().await;
    let me = Browser::new(&site, &account).await;
    let did = account.did.clone();
    let profile = json!({ "displayName": "me", "createdAt": NOW });
    let body =
        json!({ "collection": "social.grain.actor.profile", "rkey": "self", "record": profile });
    let (status, _) = me.post("/xrpc/social.grain.repo.putRecord", body).await;
    assert_eq!(status, 200);
    let gallery = me
        .make(
            "social.grain.gallery",
            json!({ "title": "fog", "createdAt": NOW }),
        )
        .await;
    let photo = me.photo().await;
    me.item(&gallery, &photo).await;
    me.item(&gallery, &photo).await;
    let follow = json!({ "subject": "did:plc:someone", "createdAt": NOW });
    me.make("social.grain.graph.follow", follow).await;
    // What grain keeps for it.
    let (status, _) = me
        .post(
            "/xrpc/social.grain.graph.muteActor",
            json!({ "actor": "did:plc:someone" }),
        )
        .await;
    assert_eq!(status, 200);
    // Not another account's.
    let (status, said) = me
        .post(DELETE_ACCOUNT, json!({ "did": "did:plc:someone" }))
        .await;
    assert_eq!((status, said["error"].as_str()), (403, Some("Forbidden")));
    let (status, said) = me
        .post(DELETE_ACCOUNT, json!({ "did": did, "limit": 0 }))
        .await;
    assert_eq!(
        (status, said["error"].as_str()),
        (400, Some("InvalidRequest"))
    );

    // One at a time, though the collection holds two: one of the items,
    // then the rest.
    let (status, step) = me
        .post(DELETE_ACCOUNT, json!({ "did": did, "limit": 1 }))
        .await;
    assert_eq!(status, 200, "{step}");
    assert_eq!(step, json!({ "deleted": 1, "done": false }));
    assert!(site.index.tracks(&did));
    let headers = me.headers();
    let res = reqwest::Client::new()
        .post(format!("{}{DELETE_ACCOUNT}", site.served.base))
        .header(headers[0].0, headers[0].1)
        .header(headers[1].0, headers[1].1)
        .json(&json!({ "did": did }))
        .send()
        .await
        .unwrap();
    assert_eq!(res.status().as_u16(), 200);
    let cleared: Vec<String> = res
        .headers()
        .get_all("set-cookie")
        .iter()
        .map(|v| v.to_str().unwrap().to_string())
        .collect();
    assert!(
        cleared.iter().any(|c| c.contains("Max-Age=0")),
        "logged out: {cleared:?}"
    );
    let step: Value = res.json().await.unwrap();
    assert_eq!(step["done"], true);
    assert_eq!(step["deleted"], 5);
    assert_eq!(grain_collections(&did).await, Vec::<String>::new());
    assert!(!site.index.tracks(&did));
    assert!(site.index.web_session(&did).unwrap().is_none());
    let mutes: i64 = site.index.read(|db| {
        db.query_row("SELECT count(*) FROM mute WHERE did = ?1", [&did], |r| {
            r.get(0)
        })
        .unwrap()
    });
    assert_eq!(mutes, 0);
    assert!(!indexed(&site, &gallery));
    // The session gone, the cookie names no one.
    let (status, _) = me.post(DELETE_ACCOUNT, json!({ "did": did })).await;
    assert_eq!(status, 401);
}

#[tokio::test]
async fn an_app_asks_to_be_forgotten_once_its_records_are_gone() {
    // The apps' grain-serve, named by a DID a PDS signs a token for.
    let aud = "did:web:grain.test";
    let index = Arc::new(Index::memory().unwrap());
    let dir = tempfile::tempdir().unwrap();
    let served = common::served_app(App {
        index: Some(index.clone()),
        did: Some(aud.into()),
        ..App::bare(net::ctx(dir.path(), &[]))
    })
    .await;
    let account = net::account().await;
    let ctx = net::ctx(dir.path(), &[]);
    let me = session::create(&ctx, &account.did, &account.password)
        .await
        .unwrap();
    let pds = Xrpc::new(ctx.http.clone(), &net::net().pds);
    let made: Value = pds
        .procedure(
            "com.atproto.repo.createRecord",
            Some(&json!({
                "repo": me.did,
                "collection": "social.grain.graph.follow",
                "record": { "subject": "did:plc:someone", "createdAt": NOW },
            })),
            Some(&me.auth()),
        )
        .await
        .unwrap();
    index.track(&me.did).unwrap();
    index
        .read(|db| {
            db.execute(
                "INSERT INTO preference VALUES (?1, 'theme', '\"dark\"', '')",
                [&me.did],
            )
        })
        .unwrap();
    let token = grain::auth::service_token(&ctx, &me, aud, "social.grain.server.deleteAccount")
        .await
        .unwrap();
    let body = json!({ "did": me.did });
    let (status, said) = served.post_as(DELETE_ACCOUNT, &token, &body).await;
    assert_eq!(
        (status, said["error"].as_str()),
        (400, Some("RecordsRemain"))
    );
    assert!(index.tracks(&me.did));

    let _: Value = pds
        .procedure(
            "com.atproto.repo.deleteRecord",
            Some(&json!({
                "repo": me.did,
                "collection": "social.grain.graph.follow",
                "rkey": rkey(made["uri"].as_str().unwrap()),
            })),
            Some(&me.auth()),
        )
        .await
        .unwrap();
    let (status, said) = served.post_as(DELETE_ACCOUNT, &token, &body).await;
    assert_eq!((status, said), (200, json!({ "deleted": 0, "done": true })));
    assert!(!index.tracks(&me.did));
    let prefs: i64 = index.read(|db| {
        db.query_row(
            "SELECT count(*) FROM preference WHERE did = ?1",
            [&me.did],
            |r| r.get(0),
        )
        .unwrap()
    });
    assert_eq!(prefs, 0);
}

#[tokio::test]
async fn an_account_deleted_where_it_was_stays_if_its_host_has_it() {
    let site = site().await;
    let account = net::account().await;
    let ctx = &site.app.ctx;
    let nowhere = "did:plc:aaaaaaaaaaaaaaaaaaaaaaaa";
    use grain_serve::accounts::Asked;
    assert_eq!(
        grain_serve::accounts::gone(ctx, &account.did).await,
        Asked::Active
    );
    assert_eq!(grain_serve::accounts::gone(ctx, nowhere).await, Asked::Gone);

    // As the stream tells them: the one its host still has stays.
    let gallery = json!({ "$type": "social.grain.gallery", "title": "fog", "createdAt": NOW });
    for did in [account.did.as_str(), nowhere] {
        site.index.track(did).unwrap();
        let uri = format!("at://{did}/social.grain.gallery/3l3qo2vuowo2a");
        let cid = grain::drisl::cid_text(&grain::drisl::cid(uri.as_bytes()));
        site.index.put(&uri, &cid, &gallery).unwrap();
    }
    let (to, told) = tokio::sync::mpsc::unbounded_channel();
    let watching = tokio::spawn(grain_serve::accounts::deletions(
        site.index.clone(),
        ctx.clone(),
        told,
        Default::default(),
    ));
    to.send(account.did.clone()).unwrap();
    to.send(nowhere.to_string()).unwrap();
    drop(to);
    watching.await.unwrap();
    let held = |did: &str| {
        indexed(
            &site,
            &format!("at://{did}/social.grain.gallery/3l3qo2vuowo2a"),
        )
    };
    assert!(held(&account.did));
    assert_eq!(site.index.host_status(&account.did).unwrap(), None);
    assert!(!held(nowhere));
    assert_eq!(
        site.index.host_status(nowhere).unwrap().as_deref(),
        Some("deleted")
    );
}

#[tokio::test]
async fn a_server_with_no_index_deletes_nothing() {
    let ctx = grain::env::Ctx::new(grain::env::Env::from_vars(|_| None));
    let served = common::served_app(App::bare(ctx)).await;
    for (method, body) in [
        (DELETE_ACCOUNT, json!({ "did": "did:plc:someone" })),
        (
            "/xrpc/social.grain.gallery.deleteGallery",
            json!({ "rkey": "3l3qo2vuowo2a" }),
        ),
    ] {
        let (status, said) = served.post(method, &body).await;
        assert_eq!(
            (status, said["error"].as_str()),
            (501, Some("MethodNotImplemented")),
            "{method}"
        );
    }
}

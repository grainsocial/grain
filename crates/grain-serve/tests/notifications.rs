//! The viewer's notifications, called as the apps call them: with no
//! token, and with a service token from the viewer's own PDS, the
//! reference PDS. Every answer goes through `common`, so
//! `harness/answers.mjs` holds it to its lexicon.

#[path = "../../grain/tests/common/mod.rs"]
mod net;

mod common;

use grain::env::Ctx;
use grain::session::{self, Session};
use grain_serve::App;
use grain_serve::cdn::Cdn;
use grain_serve::index::{Index, Label};
use grain_serve::read::notification;
use serde_json::{Value, json};
use std::sync::Arc;

const AUD: &str = "did:web:grain.test";
const UPDATE_SEEN: &str = "/xrpc/social.grain.notification.updateSeen";
const LIST: &str = "/xrpc/social.grain.notification.listNotifications";
const UNREAD: &str = "/xrpc/social.grain.notification.getUnreadCount";
const BLOB: &str = "bafkreigh2akiscaildcqabsyg3dfr6chu3fgpregiymsck7e7aqa4s52zy";
const BOB: &str = "did:plc:bob";
const CAROL: &str = "did:plc:carol";
/// No profile.
const ERIN: &str = "did:plc:erin";

struct World {
    ctx: Ctx,
    me: Session,
    /// The viewer: the account on the reference PDS.
    did: String,
    index: Arc<Index>,
    served: common::Served,
    _dir: tempfile::TempDir,
}

async fn world() -> World {
    let dir = tempfile::tempdir().unwrap();
    let ctx = net::ctx(dir.path(), &[]);
    let index = Arc::new(Index::memory().unwrap());
    let served = common::served_app(App {
        ctx: net::ctx(&dir.path().join("serve"), &[]),
        index: Some(index.clone()),
        did: Some(AUD.into()),
        cdn: Cdn::default(),
        bsky_appview: None,
        web: None,
        admins: Vec::new(),
        cards: Default::default(),
        rankings: Default::default(),
        pages: None,
        spaces: Default::default(),
    })
    .await;
    let account = net::account().await;
    let me = session::create(&ctx, &account.did, &account.password)
        .await
        .unwrap();
    for (did, handle) in [
        (BOB, "bob.test"),
        (CAROL, "carol.test"),
        (ERIN, "erin.test"),
    ] {
        index.track(did).unwrap();
        index.set_handle(did, handle).unwrap();
    }
    World {
        ctx,
        did: me.did.clone(),
        me,
        index,
        served,
        _dir: dir,
    }
}

/// The `n`th of June, 2026, as records write times.
fn day(n: u32) -> String {
    format!("2026-06-{n:02}T00:00:00.000Z")
}

fn cid(of: &str) -> String {
    atproto::Cid::of_cbor(of.as_bytes()).to_string()
}

/// A blob's CID, of the raw codec blobs have.
fn blob_cid(of: &str) -> String {
    atproto::Cid::of_raw(of.as_bytes()).to_string()
}

fn blob(cid: &str) -> Value {
    json!({"$type": "blob", "ref": {"$link": cid}, "mimeType": "image/jpeg", "size": 1000})
}

/// Facets mentioning `did`.
fn mentioning(did: &str) -> Value {
    json!([{
        "index": {"byteStart": 0, "byteEnd": 3},
        "features": [{"$type": "app.bsky.richtext.facet#mention", "did": did}],
    }])
}

/// What the fixture holds, by name.
struct Fixture {
    gallery: String,
    story: String,
    bobs: String,
    mentioning: String,
    first_photo: String,
}

impl World {
    /// Puts `record` of `collection` at `did`'s `rkey`, made and indexed
    /// at `at`, unless it says when it was made; its URI.
    fn put(&self, did: &str, collection: &str, rkey: &str, mut record: Value, at: &str) -> String {
        let uri = format!("at://{did}/{collection}/{rkey}");
        record["$type"] = collection.into();
        if record.get("createdAt").is_none() {
            record["createdAt"] = at.into();
        }
        self.index
            .put_at(&uri, &cid(&record.to_string()), &record, at)
            .unwrap();
        uri
    }

    fn follow(&self, did: &str, subject: &str, rkey: &str, at: &str) -> String {
        self.put(
            did,
            "social.grain.graph.follow",
            rkey,
            json!({"subject": subject}),
            at,
        )
    }

    fn favorite(&self, did: &str, subject: &str, rkey: &str, at: &str) -> String {
        self.put(
            did,
            "social.grain.favorite",
            rkey,
            json!({"subject": subject}),
            at,
        )
    }

    fn comment(&self, did: &str, rkey: &str, mut record: Value, at: &str) -> String {
        record["text"] = record.get("text").cloned().unwrap_or("hi".into());
        self.put(did, "social.grain.comment", rkey, record, at)
    }

    fn sql(&self, sql: &str, params: &[&str]) {
        self.index
            .read(|db| db.execute(sql, rusqlite::params_from_iter(params)))
            .unwrap();
    }

    /// One record of each way of notifying the viewer, a day apart, and
    /// some that notify no one.
    fn fixture(&self) -> Fixture {
        let me = self.did.as_str();
        for (did, name) in [(BOB, "Bob Ross"), (CAROL, "Carol C")] {
            let profile = json!({"displayName": name});
            self.put(did, "social.grain.actor.profile", "self", profile, &day(1));
        }
        let gallery = self.put(
            me,
            "social.grain.gallery",
            "ga",
            json!({"title": "Mine"}),
            &day(1),
        );
        // The cover is the photo at position 0, put second.
        let mut first_photo = String::new();
        for (rkey, position) in [("second", 1), ("first", 0)] {
            first_photo = blob_cid(rkey);
            let photo =
                json!({"photo": blob(&first_photo), "aspectRatio": {"width": 3, "height": 2}});
            let photo = self.put(me, "social.grain.photo", rkey, photo, &day(1));
            let item = json!({"gallery": gallery, "item": photo, "position": position});
            self.put(me, "social.grain.gallery.item", rkey, item, &day(1));
        }
        let story = json!({"media": blob(BLOB), "aspectRatio": {"width": 9, "height": 16}});
        let story = self.put(me, "social.grain.story", "sa", story, &day(1));
        let bobs = self.put(
            BOB,
            "social.grain.gallery",
            "gb",
            json!({"title": "Bob's"}),
            &day(1),
        );
        let record =
            json!({"title": "Bob's other", "description": "@me look", "facets": mentioning(me)});
        let mentioning_me = self.put(BOB, "social.grain.gallery", "gm", record, &day(2));
        let mine = self.comment(
            me,
            "ca",
            json!({"subject": bobs, "text": "my comment"}),
            &day(2),
        );
        let carols = self.comment(CAROL, "cc", json!({"subject": bobs}), &day(3));

        self.follow(BOB, me, "fol", &day(4));
        self.favorite(BOB, &gallery, "f-ga", &day(5));
        let nice = json!({"subject": gallery, "text": "nice gallery"});
        let c1 = self.comment(BOB, "c1", nice, &day(6));
        let reply = json!({"subject": bobs, "replyTo": mine, "text": "replying to you"});
        self.comment(BOB, "c2", reply, &day(7));
        self.favorite(BOB, &story, "f-sa", &day(8));
        self.comment(
            BOB,
            "c4",
            json!({"subject": story, "text": "nice story"}),
            &day(9),
        );
        self.favorite(BOB, &mine, "f-ca", &day(10));
        // A mention in a reply to someone else's comment.
        let record = json!({"subject": bobs, "replyTo": carols, "facets": mentioning(me)});
        self.comment(BOB, "c3", record, &day(11));
        let record = json!({"subject": bobs, "facets": mentioning(me), "text": "top level"});
        self.comment(BOB, "c6", record, &day(12));
        // A comment on the viewer's gallery that mentions them too.
        let record = json!({"subject": gallery, "facets": mentioning(me), "text": "yours"});
        self.comment(BOB, "c5", record, &day(13));
        // A comment on the viewer's story that mentions them: one
        // notification, not two.
        let record = json!({"subject": story, "facets": mentioning(me), "text": "story too"});
        self.comment(BOB, "c7", record, &day(14));
        // A reply on the viewer's gallery to someone else's comment,
        // mentioning the viewer.
        let record =
            json!({"subject": gallery, "replyTo": c1, "facets": mentioning(me), "text": "cc"});
        self.comment(CAROL, "c8", record, &day(15));
        self.follow(ERIN, me, "fol", &day(16));
        // The viewer's own doing notifies no one.
        self.favorite(me, &gallery, "self", &day(17));
        self.comment(
            me,
            "c9",
            json!({"subject": gallery, "replyTo": mine}),
            &day(17),
        );
        Fixture {
            gallery,
            story,
            bobs,
            mentioning: mentioning_me,
            first_photo,
        }
    }

    /// A service token for the method `path` calls.
    async fn token(&self, path: &str) -> String {
        let nsid = path["/xrpc/".len()..].split('?').next().unwrap();
        grain::auth::service_token(&self.ctx, &self.me, AUD, nsid)
            .await
            .unwrap()
    }

    /// `path`, a procedure, called with a service token for its method.
    async fn post_as(&self, path: &str, body: &Value) -> (u16, Value) {
        let token = self.token(path).await;
        self.served.post_as(path, &token, body).await
    }

    /// `path`, a query, called with a service token for its method.
    async fn get_as(&self, path: &str) -> (u16, Value) {
        let token = self.token(path).await;
        self.served.get_with(path, &format!("Bearer {token}")).await
    }

    /// The viewer's notifications, `query` their parameters, as
    /// `(reason, author)` each.
    async fn listed(&self, query: &str) -> Vec<(String, String)> {
        let (status, body) = self.get_as(&format!("{LIST}{query}")).await;
        assert_eq!(status, 200, "{body}");
        reasons(&body)
    }

    async fn unread(&self) -> i64 {
        let (status, body) = self.get_as(UNREAD).await;
        assert_eq!(status, 200, "{body}");
        body["count"].as_i64().unwrap()
    }

    /// When the index has `did` last seeing its notifications.
    fn seen(&self, did: &str) -> Option<String> {
        self.index.read(|db| {
            let sql = "SELECT seen_at FROM notification_seen WHERE did = ?1";
            let mut stmt = db.prepare(sql).unwrap();
            let mut rows = stmt.query_map([did], |r| r.get(0)).unwrap();
            rows.next().map(Result::unwrap)
        })
    }
}

fn reasons(body: &Value) -> Vec<(String, String)> {
    body["notifications"]
        .as_array()
        .unwrap()
        .iter()
        .map(|n| {
            let reason = n["reason"].as_str().unwrap().to_string();
            (reason, n["author"]["did"].as_str().unwrap().to_string())
        })
        .collect()
}

fn pairs(of: &[(&str, &str)]) -> Vec<(String, String)> {
    of.iter()
        .map(|(a, b)| (a.to_string(), b.to_string()))
        .collect()
}

/// The fixture's notifications, the latest first.
const ALL: [(&str, &str); 14] = [
    ("follow", ERIN),
    ("gallery-comment-mention", CAROL),
    ("story-comment", BOB),
    ("gallery-comment-mention", BOB),
    ("gallery-comment-mention", BOB),
    ("gallery-comment-mention", BOB),
    ("comment-favorite", BOB),
    ("story-comment", BOB),
    ("story-favorite", BOB),
    ("reply", BOB),
    ("gallery-comment", BOB),
    ("gallery-favorite", BOB),
    ("follow", BOB),
    ("gallery-mention", BOB),
];

#[tokio::test]
async fn every_way_of_notifying_the_viewer_is_listed_the_latest_first() {
    let w = world().await;
    let f = w.fixture();
    let (status, body) = w.get_as(&format!("{LIST}?limit=50")).await;
    assert_eq!(status, 200, "{body}");
    assert_eq!(reasons(&body), pairs(&ALL));
    assert!(body.get("cursor").is_none() && body.get("seenAt").is_none());
    let items = body["notifications"].as_array().unwrap();
    let by = |uri: &str| items.iter().find(|n| n["uri"] == uri).unwrap().clone();
    let me = w.did.as_str();

    let favorite = by(&format!("at://{BOB}/social.grain.favorite/f-ga"));
    assert_eq!(favorite["galleryUri"], f.gallery.as_str());
    assert_eq!(favorite["galleryTitle"], "Mine");
    let cover = format!(
        "https://cdn.bsky.app/img/avatar/plain/{me}/{}@jpeg",
        f.first_photo
    );
    assert_eq!(favorite["galleryThumb"], cover);
    assert_eq!(
        (&favorite["createdAt"], &favorite["indexedAt"]),
        (&json!(day(5)), &json!(day(5)))
    );
    assert_eq!(favorite["isRead"], false);
    assert_eq!(favorite["author"]["handle"], "bob.test");
    assert_eq!(favorite["author"]["displayName"], "Bob Ross");
    assert!(favorite.get("commentText").is_none());

    let comment = by(&format!("at://{BOB}/social.grain.comment/c1"));
    assert_eq!(comment["commentText"], "nice gallery");
    assert_eq!(comment["galleryUri"], f.gallery.as_str());

    let reply = by(&format!("at://{BOB}/social.grain.comment/c2"));
    assert_eq!(reply["commentText"], "replying to you");
    assert_eq!(reply["replyToText"], "my comment");
    assert_eq!(reply["galleryUri"], f.bobs.as_str());

    let story_thumb = format!("https://cdn.bsky.app/img/avatar/plain/{me}/{BLOB}@jpeg");
    for rkey in ["social.grain.favorite/f-sa", "social.grain.comment/c4"] {
        let on_story = by(&format!("at://{BOB}/{rkey}"));
        assert_eq!(on_story["storyUri"], f.story.as_str());
        assert_eq!(on_story["storyThumb"], story_thumb);
        assert!(on_story.get("galleryUri").is_none());
    }

    // A favorite of the viewer's comment is of the gallery it is on.
    let liked = by(&format!("at://{BOB}/social.grain.favorite/f-ca"));
    assert_eq!(liked["commentText"], "my comment");
    assert_eq!(liked["galleryUri"], f.bobs.as_str());
    assert_eq!(liked["galleryTitle"], "Bob's");

    let mention = by(&f.mentioning);
    assert_eq!(mention["reason"], "gallery-mention");
    assert_eq!(mention["galleryUri"], f.mentioning.as_str());
    assert_eq!(mention["commentText"], "@me look");
    let top = by(&format!("at://{BOB}/social.grain.comment/c6"));
    assert_eq!(top["commentText"], "top level");
    let yours = by(&format!("at://{BOB}/social.grain.comment/c5"));
    assert_eq!(yours["galleryUri"], f.gallery.as_str());

    // An account with no profile is its handle.
    let erin = &items[0]["author"];
    assert_eq!(erin["handle"], "erin.test");
    assert!(erin.get("displayName").is_none());
    assert!(items.iter().all(|n| n["author"]["did"] != me));
}

#[tokio::test]
async fn what_is_unread_is_what_came_since_the_viewer_last_looked() {
    let w = world().await;
    w.fixture();
    assert_eq!(w.unread().await, 14, "all of it, before they ever look");
    let seen = json!({"seenAt": day(10)});
    assert_eq!(w.post_as(UPDATE_SEEN, &seen).await.0, 200);
    assert_eq!(w.unread().await, 6);
    let (_, body) = w.get_as(&format!("{LIST}?limit=50")).await;
    assert_eq!(body["seenAt"], day(10));
    let read: Vec<bool> = body["notifications"]
        .as_array()
        .unwrap()
        .iter()
        .map(|n| n["isRead"].as_bool().unwrap())
        .collect();
    let mut expected = vec![false; 6];
    expected.extend([true; 8]);
    assert_eq!(read, expected, "read once seen, the one seen at too");
    let unread = notification::unread_count;
    assert_eq!(w.index.read(|db| unread(db, &w.did)).unwrap(), 6);
}

#[tokio::test]
async fn a_record_dated_ahead_sorts_by_when_the_index_had_it() {
    let w = world().await;
    let me = w.did.clone();
    let gallery = w.put(
        &me,
        "social.grain.gallery",
        "ga",
        json!({"title": "Mine"}),
        &day(1),
    );
    w.favorite(BOB, &gallery, "early", &day(3));
    let ahead = json!({"subject": gallery, "createdAt": "2030-01-01T00:00:00+02:00"});
    w.put(CAROL, "social.grain.favorite", "ahead", ahead, &day(2));
    let (_, body) = w.get_as(LIST).await;
    let items = body["notifications"].as_array().unwrap();
    assert_eq!(items[0]["author"]["did"], BOB);
    assert_eq!(items[1]["indexedAt"], day(2));
    assert_eq!(items[1]["createdAt"], "2030-01-01T00:00:00+02:00");
    // And by when it was made, in UTC, where that is earlier.
    let behind = json!({"subject": gallery, "createdAt": "2026-05-31T23:00:00-02:00"});
    w.put(ERIN, "social.grain.favorite", "behind", behind, &day(9));
    let (_, body) = w.get_as(LIST).await;
    let last = body["notifications"]
        .as_array()
        .unwrap()
        .last()
        .unwrap()
        .clone();
    assert_eq!(last["indexedAt"], "2026-06-01T01:00:00.000Z");
}

#[tokio::test]
async fn what_reads_leave_out_notifications_leave_out() {
    let w = world().await;
    w.fixture();
    let me = w.did.clone();
    // A label that hides the record.
    let c1 = format!("at://{BOB}/social.grain.comment/c1");
    let label = Label {
        src: AUD.into(),
        uri: c1.clone(),
        val: "!hide".into(),
        neg: false,
        cts: day(20),
        exp: None,
    };
    w.index.label(&label).unwrap();
    let listed = w.listed("?limit=50").await;
    assert_eq!(listed.len(), 13);
    assert!(!listed.contains(&("gallery-comment".into(), BOB.into())));
    // An account taken down.
    w.index.take_down(CAROL).unwrap();
    // One the viewer muted.
    w.sql(
        "INSERT INTO mute VALUES (?1, ?2, ?3)",
        &[&me, ERIN, &day(20)],
    );
    let listed = w.listed("?limit=50").await;
    assert_eq!(listed.len(), 11);
    assert!(listed.iter().all(|(_, did)| did == BOB));
    assert_eq!(w.unread().await, 11);
    // One the viewer blocks, and one blocking them.
    let block = json!({"subject": BOB});
    let blocking = w.put(&me, "social.grain.graph.block", "b", block, &day(20));
    assert_eq!(w.listed("").await, []);
    assert_eq!(w.unread().await, 0);
    w.index.delete(&blocking).unwrap();
    w.put(
        BOB,
        "social.grain.graph.block",
        "b",
        json!({"subject": me}),
        &day(20),
    );
    assert_eq!(w.listed("").await, []);
}

#[tokio::test]
async fn preferences_turn_a_kind_off_or_keep_it_to_follows() {
    let w = world().await;
    w.fixture();
    let me = w.did.clone();
    let pref = |kind: &str, push: &str, in_app: &str, from_follows: &str| {
        w.sql(
            "INSERT OR REPLACE INTO notification_pref VALUES (?1, ?2, ?3, ?4, ?5)",
            &[&me, kind, push, in_app, from_follows],
        );
    };
    pref("favorites", "1", "0", "0");
    let listed = w.listed("?limit=50").await;
    assert!(
        listed
            .iter()
            .all(|(reason, _)| !reason.ends_with("favorite")),
        "{listed:?}"
    );
    assert_eq!(listed.len(), 11);
    assert_eq!(w.unread().await, 11);
    // Off for pushes alone, it is listed.
    pref("favorites", "0", "1", "0");
    assert_eq!(w.listed("?limit=50").await.len(), 14);
    // From follows alone, of whom the viewer follows none.
    pref("follows", "1", "1", "1");
    let follows = |listed: Vec<(String, String)>| -> Vec<String> {
        listed
            .into_iter()
            .filter(|(reason, _)| reason == "follow")
            .map(|(_, did)| did)
            .collect()
    };
    assert_eq!(follows(w.listed("?limit=50").await), Vec::<String>::new());
    w.follow(&me, BOB, "bob", &day(1));
    assert_eq!(follows(w.listed("?limit=50").await), [BOB]);
}

#[tokio::test]
async fn preferences_put_are_the_ones_notifications_follow() {
    let w = world().await;
    w.fixture();
    let get = "/xrpc/social.grain.actor.getPreferences";
    let put = "/xrpc/social.grain.actor.putPreferences";
    assert_eq!(w.get_as(get).await, (200, json!({ "preferences": [] })));
    // An account's preferences are for no cache to keep.
    let bearer = format!("Bearer {}", w.token(get).await);
    let (_, answered, _) = w
        .served
        .get_answered(get, &[("authorization", bearer.as_str())])
        .await;
    let unshared = (vec!["authorization", "cookie"], Some("private, no-store"));
    assert_eq!(common::caching(&answered), unshared);
    let defs = "social.grain.actor.defs";
    let preferences = json!([
        {
            "$type": format!("{defs}#pinnedFeedsPref"),
            "items": [{ "id": "recent", "label": "Recent", "type": "feed", "path": "/" }],
        },
        { "$type": format!("{defs}#photoMetadataPref"), "includeExif": false, "includeLocation": true },
        { "$type": format!("{defs}#themePref"), "theme": "dark" },
        {
            "$type": format!("{defs}#notificationsPref"),
            "favorites": { "push": true, "inApp": false, "from": "all" },
        },
    ]);
    let (status, said) = w.post_as(put, &json!({ "preferences": preferences })).await;
    assert_eq!((status, said), (200, json!({})));
    assert_eq!(
        w.get_as(get).await,
        (200, json!({ "preferences": preferences }))
    );
    let listed = w.listed("?limit=50").await;
    assert!(
        listed
            .iter()
            .all(|(reason, _)| !reason.ends_with("favorite")),
        "{listed:?}"
    );
    // The whole set at once: what is left out is unset.
    let (status, _) = w.post_as(put, &json!({ "preferences": [] })).await;
    assert_eq!(status, 200);
    assert_eq!(w.get_as(get).await, (200, json!({ "preferences": [] })));
    assert_eq!(w.listed("?limit=50").await.len(), 14);

    for wrong in [
        json!({}),
        json!({ "preferences": [{ "$type": "app.bsky.actor.defs#adultContentPref" }] }),
        json!({ "preferences": [
            { "$type": format!("{defs}#themePref"), "theme": "dark" },
            { "$type": format!("{defs}#themePref"), "theme": "light" },
        ] }),
    ] {
        let (status, said) = w.post_as(put, &wrong).await;
        assert_eq!(
            (status, said["error"].as_str()),
            (400, Some("InvalidRequest")),
            "{wrong}"
        );
    }
    let (status, said) = w.served.get(get).await;
    assert_eq!(
        (status, said["error"].as_str()),
        (401, Some("AuthenticationRequired"))
    );
    let (status, said) = w.served.post(put, &json!({ "preferences": [] })).await;
    assert_eq!(
        (status, said["error"].as_str()),
        (401, Some("AuthenticationRequired"))
    );
    // A server with no index keeps none.
    let bare = common::served().await;
    assert_eq!(bare.get(get).await.0, 501);
    assert_eq!(bare.post(put, &json!({ "preferences": [] })).await.0, 501);
}

#[tokio::test]
async fn a_preference_set_alone_leaves_the_others() {
    let w = world().await;
    w.fixture();
    let get = "/xrpc/social.grain.actor.getPreferences";
    let put = "/xrpc/social.grain.actor.putPreferences";
    let set = "/xrpc/social.grain.actor.setPreference";
    let defs = "social.grain.actor.defs";
    let feeds = json!({
        "$type": format!("{defs}#pinnedFeedsPref"),
        "items": [{ "id": "recent", "label": "Recent", "type": "feed", "path": "/" }],
    });
    let metadata = json!({ "$type": format!("{defs}#photoMetadataPref"), "includeExif": false });
    let dark = json!({ "$type": format!("{defs}#themePref"), "theme": "dark" });
    let favorites = json!({
        "$type": format!("{defs}#notificationsPref"),
        "favorites": { "push": true, "inApp": false, "from": "all" },
    });
    let all = json!([feeds, metadata, dark, favorites]);
    let (status, _) = w.post_as(put, &json!({ "preferences": all })).await;
    assert_eq!(status, 200);

    // One kind replaced: the others stay, and the whole set is answered.
    let light = json!({ "$type": format!("{defs}#themePref"), "theme": "light" });
    let (status, said) = w.post_as(set, &json!({ "preference": light })).await;
    let after = json!({ "preferences": [feeds, metadata, light, favorites] });
    assert_eq!((status, said), (200, after.clone()));
    assert_eq!(w.get_as(get).await, (200, after));
    // Photo metadata replaced whole: what it leaves out is unset.
    let location = json!({ "$type": format!("{defs}#photoMetadataPref"), "includeLocation": true });
    let (status, said) = w.post_as(set, &json!({ "preference": location })).await;
    let after = json!({ "preferences": [feeds, location, light, favorites] });
    assert_eq!((status, said), (200, after));
    // Notifications replaced, as listing them follows.
    let follows = json!({
        "$type": format!("{defs}#notificationsPref"),
        "follows": { "push": true, "inApp": true, "from": "follows" },
    });
    let (status, said) = w.post_as(set, &json!({ "preference": follows })).await;
    let after = json!({ "preferences": [feeds, location, light, follows] });
    assert_eq!((status, said), (200, after));
    let listed = w.listed("?limit=50").await;
    assert!(
        listed
            .iter()
            .any(|(reason, _)| reason.ends_with("favorite"))
    );
    assert!(listed.iter().all(|(reason, _)| reason != "follow"));

    // A kind the viewer has none of is added.
    let (status, _) = w.post_as(put, &json!({ "preferences": [dark] })).await;
    assert_eq!(status, 200);
    let (status, said) = w.post_as(set, &json!({ "preference": feeds })).await;
    assert_eq!(
        (status, said),
        (200, json!({ "preferences": [feeds, dark] }))
    );

    for wrong in [
        json!({}),
        json!({ "preference": { "$type": "app.bsky.actor.defs#adultContentPref" } }),
        json!({ "preference": { "$type": format!("{defs}#themePref") } }),
        json!({ "preference": {
            "$type": format!("{defs}#notificationsPref"),
            "likes": { "push": true, "inApp": true, "from": "all" },
        } }),
    ] {
        let (status, said) = w.post_as(set, &wrong).await;
        assert_eq!(
            (status, said["error"].as_str()),
            (400, Some("InvalidRequest")),
            "{wrong}"
        );
        assert!(said["message"].is_string(), "{said}");
    }
    assert_eq!(
        w.get_as(get).await,
        (200, json!({ "preferences": [feeds, dark] }))
    );
    let (status, said) = w.served.post(set, &json!({ "preference": light })).await;
    assert_eq!(
        (status, said["error"].as_str()),
        (401, Some("AuthenticationRequired"))
    );
    let bare = common::served().await;
    assert_eq!(bare.post(set, &json!({ "preference": light })).await.0, 501);
}

#[tokio::test]
async fn pages_run_on_from_the_cursor() {
    let w = world().await;
    w.fixture();
    let mut seen = Vec::new();
    let mut cursor: Option<String> = None;
    loop {
        let after = cursor
            .map(|c| format!("&cursor={}", c.replace(':', "%3A")))
            .unwrap_or_default();
        let (status, body) = w.get_as(&format!("{LIST}?limit=4{after}")).await;
        assert_eq!(status, 200, "{body}");
        seen.extend(reasons(&body));
        cursor = body["cursor"].as_str().map(String::from);
        if cursor.is_none() {
            break;
        }
    }
    assert_eq!(seen, pairs(&ALL));
    for wrong in ["?limit=0", "?limit=101", "?cursor=nowhere"] {
        let (status, body) = w.get_as(&format!("{LIST}{wrong}")).await;
        assert_eq!(
            (status, body["error"].as_str()),
            (400, Some("InvalidRequest")),
            "{wrong}"
        );
    }
}

#[tokio::test]
async fn only_an_account_has_notifications() {
    let w = world().await;
    for path in [LIST, UNREAD] {
        let (status, body) = w.served.get(path).await;
        assert_eq!(
            (status, body["error"].as_str()),
            (401, Some("AuthenticationRequired")),
            "{path}"
        );
    }
}

#[tokio::test]
async fn a_record_says_whom_it_would_push_to() {
    let w = world().await;
    w.fixture();
    let me = w.did.clone();
    let arising = |uri: String| w.index.read(|db| notification::arising(db, &uri)).unwrap();
    // Ordered by recipient, whose DIDs sort as they happen to.
    let to = |of: &[(&str, &str)]| {
        let mut to = pairs(of);
        to.sort();
        to
    };
    assert_eq!(
        arising(format!("at://{BOB}/social.grain.favorite/f-ga")),
        to(&[(&me, "gallery-favorite")])
    );
    assert_eq!(
        arising(format!("at://{BOB}/social.grain.comment/c7")),
        to(&[(&me, "story-comment")])
    );
    // Carol's reply to Bob on the viewer's gallery, mentioning them.
    let c8 = format!("at://{CAROL}/social.grain.comment/c8");
    assert_eq!(
        arising(c8.clone()),
        to(&[(BOB, "reply"), (&me, "gallery-comment-mention")])
    );
    // The push preference, not the in-app one.
    w.sql(
        "INSERT INTO notification_pref VALUES (?1, 'mentions', 0, 1, 0)",
        &[&me],
    );
    assert_eq!(arising(c8), to(&[(BOB, "reply")]));
    assert_eq!(
        arising(format!("at://{}/social.grain.favorite/self", me)),
        []
    );
}

#[tokio::test]
async fn mentions_follow_their_records() {
    let w = world().await;
    w.fixture();
    let me = w.did.clone();
    let mentions = |w: &World| -> i64 {
        w.index.read(|db| {
            db.query_row("SELECT count(*) FROM mention WHERE did = ?1", [&me], |r| {
                r.get(0)
            })
            .unwrap()
        })
    };
    assert_eq!(mentions(&w), 6);
    // An edit that drops the mention drops the notification.
    w.put(
        BOB,
        "social.grain.gallery",
        "gm",
        json!({"title": "Bob's other"}),
        &day(2),
    );
    assert_eq!(mentions(&w), 5);
    assert!(
        !w.listed("?limit=50")
            .await
            .contains(&("gallery-mention".into(), BOB.into()))
    );
    // As does deleting it.
    w.index
        .delete(&format!("at://{BOB}/social.grain.comment/c6"))
        .unwrap();
    assert_eq!(mentions(&w), 4);
    assert_eq!(w.listed("?limit=50").await.len(), 12);
}

#[tokio::test]
async fn update_seen_keeps_when_the_viewer_last_looked() {
    let w = world().await;
    assert_eq!(w.seen(&w.did), None);
    let seen = json!({"seenAt": "2026-10-31T17:30:00+05:30"});
    let (status, body) = w.post_as(UPDATE_SEEN, &seen).await;
    assert_eq!((status, body), (200, json!({})));
    // In UTC, as records keep their times.
    assert_eq!(w.seen(&w.did).as_deref(), Some("2026-10-31T12:00:00.000Z"));
    // A later call replaces it, as Bluesky's does, earlier or not.
    let earlier = json!({"seenAt": "2026-10-30T00:00:00.123456Z"});
    assert_eq!(w.post_as(UPDATE_SEEN, &earlier).await.0, 200);
    assert_eq!(w.seen(&w.did).as_deref(), Some("2026-10-30T00:00:00.123Z"));
}

#[tokio::test]
async fn update_seen_takes_a_time_from_an_account() {
    let w = world().await;
    let seen = json!({"seenAt": "2026-10-31T12:00:00.000Z"});
    let (status, body) = w.served.post(UPDATE_SEEN, &seen).await;
    assert_eq!(
        (status, body["error"].as_str()),
        (401, Some("AuthenticationRequired"))
    );
    for wrong in [
        json!({}),
        json!({"seenAt": 12}),
        json!({"seenAt": "yesterday"}),
        json!({"seenAt": "2026-10-31"}),
        // Times UTC has no four-digit year for.
        json!({"seenAt": "0000-01-01T00:00:00+01:00"}),
        json!({"seenAt": "9999-12-31T23:59:59-01:00"}),
    ] {
        let (status, body) = w.post_as(UPDATE_SEEN, &wrong).await;
        assert_eq!(
            (status, body["error"].as_str()),
            (400, Some("InvalidRequest")),
            "{wrong}"
        );
    }
    assert_eq!(w.seen(&w.did), None);
    // A server with no index keeps nothing.
    let bare = common::served().await;
    let (status, body) = bare.post(UPDATE_SEEN, &seen).await;
    assert_eq!(
        (status, body["error"].as_str()),
        (501, Some("MethodNotImplemented"))
    );
}

//! The queries that answer from the index, called as the apps call them:
//! with no token, and with a service token from the viewer's own PDS, the
//! reference PDS. The records are put in the index directly, by accounts
//! that need no PDS; the viewer is an account on it, to sign tokens.
//! Every answer goes through `common`, so `harness/answers.mjs` holds it
//! to its lexicon.

#[path = "../../grain/tests/common/mod.rs"]
mod net;

mod common;

use grain::env::Ctx;
use grain::session::{self, Session};
use grain_serve::App;
use grain_serve::cdn::Cdn;
use grain_serve::index::{Index, Label};
use serde_json::{Value, json};
use std::sync::Arc;

const AUD: &str = "did:web:grain.test";
const NOW: &str = "2026-10-31T12:00:00.000Z";
const BLOB: &str = "bafkreigh2akiscaildcqabsyg3dfr6chu3fgpregiymsck7e7aqa4s52zy";
const ALICE: &str = "did:plc:alice";
const BOB: &str = "did:plc:bob";
const CAROL: &str = "did:plc:carol";
const DAVE: &str = "did:plc:dave";
const ERIN: &str = "did:plc:erin";
const GROUP: &str = "did:plc:group";
const LABELER: &str = "did:plc:labeler";

struct World {
    ctx: Ctx,
    me: Session,
    /// The viewer: the account on the reference PDS.
    did: String,
    index: Arc<Index>,
    served: common::Served,
    _dir: tempfile::TempDir,
}

/// An index of its own, served with `cdn`, and a viewer.
async fn world_with(cdn: Cdn) -> World {
    world_of(cdn, None).await
}

/// [`world_with`], its typeahead asking `bsky_appview` too.
async fn world_of(cdn: Cdn, bsky_appview: Option<String>) -> World {
    let dir = tempfile::tempdir().unwrap();
    let ctx = net::ctx(dir.path(), &[]);
    let index = Arc::new(Index::memory().unwrap());
    let served = common::served_app(App {
        ctx: net::ctx(&dir.path().join("serve"), &[]),
        index: Some(index.clone()),
        did: Some(AUD.into()),
        cdn,
        bsky_appview,
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
        (ALICE, "alice.test"),
        (BOB, "bob.test"),
        (CAROL, "carol.test"),
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

async fn world() -> World {
    world_with(Cdn::default()).await
}

fn cid(uri: &str) -> String {
    atproto::Cid::of_cbor(uri.as_bytes()).to_string()
}

fn blob() -> Value {
    json!({"$type": "blob", "ref": {"$link": BLOB}, "mimeType": "image/jpeg", "size": 1000})
}

/// `n` seconds into the minute after [`NOW`].
fn at(n: u32) -> String {
    format!("2026-10-31T12:01:{n:02}.000Z")
}

/// `secs` ago.
fn ago(secs: u64) -> String {
    grain::keys::iso(grain::keys::now_micros() - secs * 1_000_000)
}

impl World {
    /// Puts `record` of `collection` at `did`'s `rkey`; its URI.
    fn put(&self, did: &str, collection: &str, rkey: &str, mut record: Value) -> String {
        let uri = format!("at://{did}/{collection}/{rkey}");
        record["$type"] = collection.into();
        self.index.put_at(&uri, &cid(&uri), &record, NOW).unwrap();
        uri
    }

    fn label(&self, uri: &str, val: &str, neg: bool, cts: &str) {
        let label = Label {
            src: LABELER.into(),
            uri: uri.into(),
            val: val.into(),
            neg,
            cts: cts.into(),
            exp: None,
        };
        self.index.label(&label).unwrap();
    }

    fn sql(&self, sql: &str, params: &[&str]) {
        self.index
            .read(|db| db.execute(sql, rusqlite::params_from_iter(params)))
            .unwrap();
    }

    fn follow(&self, did: &str, subject: &str, rkey: &str) -> String {
        let record = json!({"subject": subject, "createdAt": NOW});
        self.put(did, "social.grain.graph.follow", rkey, record)
    }

    fn profile(&self, did: &str, name: &str) -> String {
        let record =
            json!({"displayName": name, "description": "hi", "avatar": blob(), "createdAt": NOW});
        self.put(did, "social.grain.actor.profile", "self", record)
    }

    /// A gallery by `did` with one photo, and its EXIF; the gallery's URI.
    fn gallery(&self, did: &str, rkey: &str, title: &str) -> String {
        let record = json!({"title": title, "createdAt": NOW});
        let gallery = self.put(did, "social.grain.gallery", rkey, record);
        self.item(did, &gallery, rkey);
        gallery
    }

    /// A photo by `did` in `gallery`; the photo's URI.
    fn item(&self, did: &str, gallery: &str, rkey: &str) -> String {
        let photo = json!({"photo": blob(), "alt": "fog", "aspectRatio": {"width": 3, "height": 2}, "createdAt": NOW});
        let photo = self.put(did, "social.grain.photo", rkey, photo);
        let item = json!({"gallery": gallery, "item": photo, "position": 0, "createdAt": NOW});
        self.put(did, "social.grain.gallery.item", rkey, item);
        photo
    }

    async fn get(&self, path: &str) -> (u16, Value) {
        self.served.get(path).await
    }

    /// `path`, called with a service token for its method.
    async fn get_as(&self, path: &str) -> (u16, Value) {
        let nsid = path["/xrpc/".len()..].split('?').next().unwrap();
        let token = grain::auth::service_token(&self.ctx, &self.me, AUD, nsid)
            .await
            .unwrap();
        self.served.get_with(path, &format!("Bearer {token}")).await
    }
}

fn dids(items: &Value) -> Vec<&str> {
    items
        .as_array()
        .unwrap()
        .iter()
        .map(|i| i["did"].as_str().unwrap())
        .collect()
}

#[tokio::test]
async fn a_profile_says_how_the_viewer_stands() {
    let w = world().await;
    let me = w.did.clone();
    let profile = w.profile(ALICE, "Alice");
    w.gallery(ALICE, "g1", "Fog");
    // A gallery with no photos is not counted.
    w.put(
        ALICE,
        "social.grain.gallery",
        "g2",
        json!({"title": "Empty", "createdAt": NOW}),
    );
    w.follow(BOB, ALICE, "f1");
    w.follow(BOB, ALICE, "f2");
    w.follow(&me, ALICE, "f3");
    w.follow(ALICE, &me, "f4");
    w.put(
        ALICE,
        "com.germnetwork.declaration",
        "self",
        json!({
            "version": "1.0.0", "currentKey": {"$bytes": "AQID"},
            "messageMe": {"showButtonTo": "everyone", "messageMeUrl": "https://germ.test/m"},
        }),
    );
    w.label(ALICE, "rude", false, NOW);
    w.label(&profile, "spam", false, NOW);
    w.label(&profile, "spam", true, &at(1));

    let (status, body) = w
        .get("/xrpc/social.grain.actor.getProfile?actor=%40Alice.test")
        .await;
    assert_eq!(status, 200, "{body}");
    assert_eq!(body["did"], ALICE);
    assert_eq!(body["handle"], "alice.test");
    assert_eq!(body["displayName"], "Alice");
    assert_eq!(body["cid"], cid(&profile));
    let avatar = format!("https://cdn.bsky.app/img/avatar/plain/{ALICE}/{BLOB}@jpeg");
    assert_eq!(body["avatar"], avatar);
    assert_eq!(
        (
            body["galleryCount"].as_i64(),
            body["followersCount"].as_i64(),
            body["followsCount"].as_i64()
        ),
        (Some(1), Some(2), Some(1))
    );
    assert_eq!(body["messageMe"]["showButtonTo"], "everyone");
    // The account's label stands; the profile's was negated.
    let labels: Vec<&str> = body["labels"]
        .as_array()
        .unwrap()
        .iter()
        .map(|l| l["val"].as_str().unwrap())
        .collect();
    assert_eq!(labels, ["rude"]);
    assert!(body.get("viewer").is_none());

    let (_, body) = w
        .get_as(&format!(
            "/xrpc/social.grain.actor.getProfile?actor={ALICE}"
        ))
        .await;
    assert_eq!(
        body["viewer"]["following"],
        format!("at://{me}/social.grain.graph.follow/f3")
    );
    assert_eq!(
        body["viewer"]["followedBy"],
        format!("at://{ALICE}/social.grain.graph.follow/f4")
    );
    assert!(body["viewer"].get("muted").is_none());

    // Muted, and blocked: the follows go unsaid.
    w.sql(
        "INSERT INTO mute VALUES (?1, ?2, ?3)",
        &[me.as_str(), ALICE, NOW],
    );
    w.put(
        ALICE,
        "social.grain.graph.block",
        "b1",
        json!({"subject": me, "createdAt": NOW}),
    );
    let (_, body) = w
        .get_as(&format!(
            "/xrpc/social.grain.actor.getProfile?actor={ALICE}"
        ))
        .await;
    assert_eq!(body["viewer"], json!({"blockedBy": true, "muted": true}));
    let block = w.put(
        &me,
        "social.grain.graph.block",
        "b2",
        json!({"subject": ALICE, "createdAt": NOW}),
    );
    let (_, body) = w
        .get_as(&format!(
            "/xrpc/social.grain.actor.getProfile?actor={ALICE}"
        ))
        .await;
    assert_eq!(body["viewer"]["blocking"], block);

    // Asking of oneself says nothing of how one stands.
    let (_, body) = w
        .get_as(&format!("/xrpc/social.grain.actor.getProfile?actor={me}"))
        .await;
    assert!(body.get("viewer").is_none(), "{body}");
    assert_eq!(body["followsCount"], 1);
    // An account with no profile has no CID, and a handle it is not
    // known by is none.
    let (status, body) = w
        .get(&format!("/xrpc/social.grain.actor.getProfile?actor={DAVE}"))
        .await;
    assert_eq!(status, 200);
    assert_eq!(body["handle"], "handle.invalid");
    assert!(body.get("cid").is_none());
}

#[tokio::test]
async fn a_profile_not_shown_says_why() {
    let w = world().await;
    let path = |did: &str| format!("/xrpc/social.grain.actor.getProfile?actor={did}");
    for (status, error) in [
        (Some("deactivated"), "AccountDeactivated"),
        (Some("deleted"), "InvalidRequest"),
        (Some("suspended"), "AccountTakedown"),
    ] {
        w.index.set_host_status(BOB, status).unwrap();
        let (code, body) = w.get(&path(BOB)).await;
        assert_eq!(
            (code, body["error"].as_str()),
            (400, Some(error)),
            "{status:?}"
        );
    }
    w.index.take_down(CAROL).unwrap();
    let (code, body) = w.get(&path(CAROL)).await;
    assert_eq!(
        (code, body["error"].as_str()),
        (400, Some("AccountTakedown"))
    );

    for (query, message) in [
        ("actor=nobody.test", "Profile not found"),
        (
            "actor=not%20a%20handle",
            "actor must be a valid did or a handle",
        ),
        ("", "Params must have the property \"actor\""),
    ] {
        let (code, body) = w
            .get(&format!("/xrpc/social.grain.actor.getProfile?{query}"))
            .await;
        assert_eq!(
            (code, body["message"].as_str()),
            (400, Some(message)),
            "{query}"
        );
    }
}

#[tokio::test]
async fn a_gallery_is_hydrated_whole() {
    let cdn = Cdn::new(
        Some("https://cdn.grain.test"),
        Some("736563726574"),
        Some("68656c6c6f"),
    )
    .unwrap();
    let w = world_with(cdn).await;
    let me = w.did.clone();
    w.profile(ALICE, "Alice");
    w.profile(GROUP, "The Group");
    w.index.track(GROUP).unwrap();
    w.index.set_handle(GROUP, "group.test").unwrap();
    let record = json!({
        "title": "Fog", "description": "#fog", "createdAt": NOW,
        "labels": {"$type": "com.atproto.label.defs#selfLabels", "values": [{"val": "nudity"}]},
        "location": {"value": "8a28a98a4c67fff", "name": "Ocean Beach, SF"},
        "address": {"locality": "San Francisco", "region": "California", "country": "US"},
    });
    let gallery = w.put(ALICE, "social.grain.gallery", "g1", record);
    let photo = w.item(ALICE, &gallery, "p1");
    let second = w.item(ALICE, &gallery, "p2");
    w.put(
        ALICE,
        "social.grain.photo.exif",
        "p1",
        json!({
            "photo": photo, "createdAt": NOW, "dateTimeOriginal": "2026-10-01T10:00:00.000Z",
            "exposureTime": 4000, "fNumber": 2_800_000, "focalLengthIn35mmFormat": 28_000_000,
            "iSO": 400_000_000, "make": "RICOH", "model": "GR III", "flash": "",
        }),
    );
    w.put(
        ALICE,
        "social.grain.photo.exif",
        "p2",
        json!({"photo": second, "createdAt": NOW, "exposureTime": 2_500_000}),
    );
    w.label(&gallery, "gore", false, NOW);
    // Who favorited it: the viewer, whom the facepile leaves out, an
    // account they follow, twice, and one they do not.
    w.follow(&me, CAROL, "f1");
    let mine = w.put(
        &me,
        "social.grain.favorite",
        "v1",
        json!({"subject": gallery, "createdAt": NOW}),
    );
    for rkey in ["c1", "c2"] {
        w.put(
            CAROL,
            "social.grain.favorite",
            rkey,
            json!({"subject": gallery, "createdAt": NOW}),
        );
    }
    w.put(
        BOB,
        "social.grain.favorite",
        "b1",
        json!({"subject": gallery, "createdAt": NOW}),
    );
    w.put(
        BOB,
        "social.grain.comment",
        "k1",
        json!({"subject": gallery, "text": "lovely", "createdAt": NOW}),
    );
    let pool = w.put(
        GROUP,
        "social.grain.group.item",
        "i1",
        json!({"gallery": gallery, "createdAt": NOW}),
    );
    w.put(
        ALICE,
        "app.bsky.feed.post",
        "post1",
        json!({
            "text": "new https://grain.social/profile/alice.test/gallery/g1", "createdAt": NOW,
        }),
    );

    let (status, body) = w
        .get_as(
            "/xrpc/social.grain.gallery.getGallery?gallery=at://alice.test/social.grain.gallery/g1",
        )
        .await;
    assert_eq!(status, 200, "{body}");
    let g = &body["gallery"];
    assert_eq!(g["uri"], gallery);
    assert_eq!(g["record"]["title"], "Fog");
    assert_eq!(g["creator"]["handle"], "alice.test");
    assert!(
        g["creator"]["avatar"]
            .as_str()
            .unwrap()
            .starts_with("https://cdn.grain.test/")
    );
    assert_eq!(
        (g["favCount"].as_i64(), g["commentCount"].as_i64()),
        (Some(3), Some(1))
    );
    assert_eq!(g["viewer"]["fav"], mine);
    assert_eq!(dids(&g["favedByFollowing"]), [CAROL]);
    assert_eq!(
        g["locationDisplay"],
        "Ocean Beach, San Francisco, California, US"
    );
    assert_eq!(g["location"]["name"], "Ocean Beach, SF");
    assert_eq!(g["address"]["country"], "US");
    assert_eq!(
        g["group"],
        json!({"did": GROUP, "handle": "group.test", "displayName": "The Group", "item": pool})
    );
    assert_eq!(
        g["crossPost"]["url"],
        format!("https://bsky.app/profile/{ALICE}/post/post1")
    );
    let mut labels: Vec<&str> = g["labels"]
        .as_array()
        .unwrap()
        .iter()
        .map(|l| l["val"].as_str().unwrap())
        .collect();
    labels.sort();
    assert_eq!(labels, ["gore", "nudity"]);
    let items = g["items"].as_array().unwrap();
    assert_eq!(items.len(), 2);
    let first = &items[0];
    assert_eq!(first["$type"], "social.grain.photo.defs#photoView");
    assert!(
        first["thumb"]
            .as_str()
            .unwrap()
            .ends_with(&format!("/feed_thumbnail/plain/{ALICE}/{BLOB}"))
    );
    let exif = &first["exif"];
    assert_eq!(
        (
            &exif["exposureTime"],
            &exif["fNumber"],
            &exif["focalLengthIn35mmFormat"],
            &exif["iSO"]
        ),
        (
            &json!("1/250s"),
            &json!("f/2.8"),
            &json!("28mm"),
            &json!(400)
        )
    );
    assert!(exif.get("flash").is_none());
    assert_eq!(items[1]["exif"]["exposureTime"], "2.5s");
    assert_eq!(
        first["gallery"]["item"],
        format!("at://{ALICE}/social.grain.gallery.item/p1")
    );

    // No one is said to have favorited it, to no one.
    let (_, body) = w
        .get(&format!(
            "/xrpc/social.grain.gallery.getGallery?gallery={gallery}"
        ))
        .await;
    assert!(
        body["gallery"].get("viewer").is_none()
            && body["gallery"].get("favedByFollowing").is_none()
    );

    w.index.take_down(ALICE).unwrap();
    let (status, body) = w
        .get(&format!(
            "/xrpc/social.grain.gallery.getGallery?gallery={gallery}"
        ))
        .await;
    assert_eq!((status, body["error"].as_str()), (400, Some("NotFound")));
}

#[tokio::test]
async fn a_gallery_titled_past_its_lexicon_is_shown_cut() {
    let w = world().await;
    w.profile(ALICE, "Alice");
    // A grapheme of two characters, sixty times over, then seventy more.
    let title = format!("{}{}", "e\u{301}".repeat(60), "x".repeat(70));
    let description = "d".repeat(1200);
    let record = json!({"title": title, "description": description, "createdAt": NOW});
    let gallery = w.put(ALICE, "social.grain.gallery", "g1", record);
    w.item(ALICE, &gallery, "g1");
    let (status, body) = w
        .get(&format!(
            "/xrpc/social.grain.gallery.getGallery?gallery={gallery}"
        ))
        .await;
    assert_eq!(status, 200, "{body}");
    let g = &body["gallery"];
    let shown = format!("{}{}", "e\u{301}".repeat(60), "x".repeat(40));
    assert_eq!(g["title"], shown);
    assert_eq!(g["description"], "d".repeat(1000));
    assert_eq!(g["record"]["title"], title);
    assert_eq!(g["record"]["description"], description);
}

#[tokio::test]
async fn who_favorited_a_gallery_is_paged() {
    let w = world().await;
    let me = w.did.clone();
    let gallery = w.gallery(ALICE, "g1", "Fog");
    for (n, did) in [BOB, CAROL, DAVE, ERIN].iter().enumerate() {
        let record = json!({"subject": gallery, "createdAt": at(n as u32)});
        w.put(did, "social.grain.favorite", "f1", record);
    }
    w.profile(ERIN, "Erin");
    w.index.take_down(DAVE).unwrap();
    let follow = w.follow(&me, ERIN, "f1");
    w.put(
        CAROL,
        "social.grain.graph.block",
        "b1",
        json!({"subject": me, "createdAt": NOW}),
    );

    let path = format!("/xrpc/social.grain.gallery.getFavorites?gallery={gallery}&limit=1");
    let (_, body) = w.get(&path).await;
    assert_eq!(body["totalCount"], 3);
    assert_eq!(dids(&body["items"]), [ERIN]);
    let cursor = body["cursor"].as_str().unwrap().to_string();
    let (_, body) = w.get(&format!("{path}&cursor={cursor}")).await;
    assert_eq!(dids(&body["items"]), [CAROL]);
    let (_, body) = w
        .get(&format!(
            "/xrpc/social.grain.gallery.getFavorites?gallery={gallery}"
        ))
        .await;
    assert_eq!(dids(&body["items"]), [ERIN, CAROL, BOB]);
    assert!(body.get("cursor").is_none());
    assert!(body["items"][0].get("viewer").is_none());
    assert_eq!(body["items"][0]["displayName"], "Erin");

    // Carol blocks the viewer: neither sees the other.
    let (_, body) = w
        .get_as(&format!(
            "/xrpc/social.grain.gallery.getFavorites?gallery={gallery}"
        ))
        .await;
    assert_eq!(body["totalCount"], 2);
    assert_eq!(dids(&body["items"]), [ERIN, BOB]);
    assert_eq!(body["items"][0]["viewer"]["following"], follow);
    assert_eq!(body["items"][1]["viewer"], json!({}));

    let (status, body) = w
        .get(&format!(
            "/xrpc/social.grain.gallery.getFavorites?gallery={gallery}&limit=101"
        ))
        .await;
    assert_eq!(
        (status, body["message"].as_str()),
        (400, Some("limit can not be greater than 100"))
    );
}

#[tokio::test]
async fn an_accounts_favorites_are_its_own() {
    let w = world().await;
    let me = w.did.clone();
    let shown = w.gallery(ALICE, "g1", "Fog");
    let older = w.gallery(BOB, "g2", "Rain");
    let hidden = w.gallery(CAROL, "g3", "Spam");
    w.label(&hidden, "spam", false, NOW);
    for (n, subject) in [&older, &shown, &shown, &hidden].iter().enumerate() {
        let record = json!({"subject": subject, "createdAt": at(n as u32)});
        w.put(&me, "social.grain.favorite", &format!("f{n}"), record);
    }
    let path = format!("/xrpc/social.grain.actor.getFavorites?actor={me}&limit=1");
    let (status, body) = w.get(&path).await;
    assert_eq!(
        (status, body["error"].as_str()),
        (401, Some("AuthenticationRequired"))
    );
    let (status, _) = w
        .get_as(&format!(
            "/xrpc/social.grain.actor.getFavorites?actor={ALICE}"
        ))
        .await;
    assert_eq!(status, 400);
    let (status, body) = w.get_as(&path).await;
    assert_eq!(status, 200, "{body}");
    let uris = |body: &Value| -> Vec<String> {
        body["items"]
            .as_array()
            .unwrap()
            .iter()
            .map(|g| g["uri"].as_str().unwrap().to_string())
            .collect()
    };
    assert_eq!(uris(&body), [shown]);
    let cursor = body["cursor"].as_str().unwrap().to_string();
    let (_, body) = w.get_as(&format!("{path}&cursor={cursor}")).await;
    assert_eq!(uris(&body), [older]);
    assert!(body.get("cursor").is_none());
}

#[tokio::test]
async fn a_thread_reads_oldest_first() {
    let w = world().await;
    let me = w.did.clone();
    let gallery = w.gallery(ALICE, "g1", "Fog");
    let photo = format!("at://{ALICE}/social.grain.photo/g1");
    let comment = |did: &str, rkey: &str, n: u32, extra: Value| {
        let mut record = json!({"subject": gallery, "text": rkey, "createdAt": at(n)});
        record
            .as_object_mut()
            .unwrap()
            .extend(extra.as_object().unwrap().clone());
        w.put(did, "social.grain.comment", rkey, record)
    };
    let first = comment(BOB, "first", 0, json!({"focus": photo}));
    comment(CAROL, "reply", 1, json!({"replyTo": first}));
    comment(
        CAROL,
        "orphan",
        2,
        json!({"replyTo": format!("at://{BOB}/social.grain.comment/gone")}),
    );
    comment(DAVE, "takendown", 3, json!({}));
    comment(ERIN, "blocked", 4, json!({}));
    comment(ALICE, "muted", 5, json!({}));
    w.index.take_down(DAVE).unwrap();
    w.put(
        &me,
        "social.grain.graph.block",
        "b1",
        json!({"subject": ERIN, "createdAt": NOW}),
    );
    w.sql(
        "INSERT INTO mute VALUES (?1, ?2, ?3)",
        &[me.as_str(), ALICE, NOW],
    );
    let fav = w.put(
        &me,
        "social.grain.favorite",
        "f1",
        json!({"subject": first, "createdAt": NOW}),
    );

    let texts = |body: &Value| -> Vec<String> {
        body["comments"]
            .as_array()
            .unwrap()
            .iter()
            .map(|c| c["text"].as_str().unwrap().to_string())
            .collect()
    };
    let path = format!("/xrpc/social.grain.comment.getThread?subject={gallery}");
    let (_, body) = w.get(&path).await;
    assert_eq!(texts(&body), ["first", "reply", "blocked", "muted"]);
    assert_eq!(body["totalCount"], 4);
    assert!(body["comments"][3].get("muted").is_none());

    let (_, body) = w.get_as(&format!("{path}&limit=2")).await;
    assert_eq!(texts(&body), ["first", "reply"]);
    assert_eq!(body["totalCount"], 3);
    let c = &body["comments"][0];
    assert_eq!(c["author"]["handle"], "bob.test");
    assert_eq!(c["focus"]["uri"], photo);
    assert_eq!(
        (c["favCount"].as_i64(), &c["viewer"]["fav"]),
        (Some(1), &json!(fav))
    );
    assert_eq!(body["comments"][1]["replyTo"], first);
    let cursor = body["cursor"].as_str().unwrap().to_string();
    let (_, body) = w.get_as(&format!("{path}&limit=2&cursor={cursor}")).await;
    assert_eq!(texts(&body), ["muted"]);
    assert_eq!(body["comments"][0]["muted"], true);
}

#[tokio::test]
async fn follows_are_listed_either_way() {
    let w = world().await;
    let me = w.did.clone();
    w.profile(BOB, "Bob");
    let follow_at = |did: &str, rkey: &str, n: u32| {
        let record = json!({"subject": ALICE, "createdAt": at(n)});
        w.put(did, "social.grain.graph.follow", rkey, record);
    };
    for (n, did) in [BOB, CAROL, DAVE, ERIN].iter().enumerate() {
        follow_at(did, &format!("a{n}"), n as u32);
        w.follow(ALICE, did, &format!("b{n}"));
    }
    // Bob follows twice; he is listed once a page.
    follow_at(BOB, "a9", 4);
    w.index.take_down(DAVE).unwrap();
    w.put(
        ERIN,
        "social.grain.graph.block",
        "b1",
        json!({"subject": me, "createdAt": NOW}),
    );
    let mine = w.follow(&me, BOB, "m1");
    w.follow(&me, CAROL, "m2");

    let (_, body) = w
        .get("/xrpc/social.grain.graph.getFollowers?actor=alice.test")
        .await;
    assert_eq!(body["totalCount"], 3);
    assert_eq!(dids(&body["items"]), [BOB, ERIN, CAROL]);
    let (_, body) = w
        .get_as(&format!(
            "/xrpc/social.grain.graph.getFollowers?actor={ALICE}&limit=1"
        ))
        .await;
    assert_eq!(body["totalCount"], 2);
    assert_eq!(dids(&body["items"]), [BOB]);
    assert_eq!(body["items"][0]["viewer"]["following"], mine);
    assert_eq!(body["items"][0]["displayName"], "Bob");
    let cursor = body["cursor"].as_str().unwrap().to_string();
    let (_, body) = w
        .get_as(&format!(
            "/xrpc/social.grain.graph.getFollowers?actor={ALICE}&limit=1&cursor={cursor}"
        ))
        .await;
    assert_eq!(dids(&body["items"]), [CAROL]);

    let (_, body) = w
        .get_as(&format!(
            "/xrpc/social.grain.graph.getFollowing?actor={ALICE}"
        ))
        .await;
    assert_eq!(body["totalCount"], 2);
    assert_eq!(dids(&body["items"]), [CAROL, BOB]);

    let known = format!("/xrpc/social.grain.graph.getKnownFollowers?actor={ALICE}");
    let (status, _) = w.get(&known).await;
    assert_eq!(status, 401);
    let (_, body) = w.get_as(&known).await;
    assert_eq!(dids(&body["items"]), [BOB, CAROL]);
    assert!(body["items"][0].get("viewer").is_none());
    let (_, body) = w
        .get_as(&format!(
            "/xrpc/social.grain.graph.getKnownFollowers?actor={me}"
        ))
        .await;
    assert_eq!(body["items"], json!([]));
    let (status, _) = w.get_as(&format!("{known}&limit=51")).await;
    assert_eq!(status, 400);
    let (status, body) = w
        .get("/xrpc/social.grain.graph.getFollowing?actor=nobody.test")
        .await;
    assert_eq!(
        (status, body["message"].as_str()),
        (400, Some("Profile not found"))
    );
}

#[tokio::test]
async fn stories_stand_a_day() {
    let w = world().await;
    let me = w.did.clone();
    let story = |did: &str, rkey: &str, created: &str, extra: Value| {
        let mut record = json!({"media": blob(), "aspectRatio": {"width": 9, "height": 16}, "createdAt": created});
        record
            .as_object_mut()
            .unwrap()
            .extend(extra.as_object().unwrap().clone());
        w.put(did, "social.grain.story", rkey, record)
    };
    let old = story(ALICE, "s0", &ago(25 * 3600), json!({}));
    let first = story(
        ALICE,
        "s1",
        &ago(120),
        json!({
            "location": {"value": "8a28a98a4c67fff", "name": "Athens"}, "address": {"country": "GR"},
        }),
    );
    let second = story(ALICE, "s2", &ago(60), json!({}));
    let labelled = story(ALICE, "s3", &ago(30), json!({}));
    w.label(&labelled, "spam", false, NOW);
    story(
        ALICE,
        "s4",
        &ago(20),
        json!({
            "labels": {"$type": "com.atproto.label.defs#selfLabels", "values": [{"val": "spam"}]},
        }),
    );
    story(BOB, "s5", &ago(10), json!({}));
    story(CAROL, "s6", &ago(5), json!({}));
    story(DAVE, "s7", &ago(10), json!({}));
    w.index.take_down(DAVE).unwrap();
    w.sql(
        "INSERT INTO mute VALUES (?1, ?2, ?3)",
        &[me.as_str(), CAROL, NOW],
    );
    w.sql(
        "INSERT INTO story_view VALUES (?1, ?2, ?3)",
        &[me.as_str(), first.as_str(), NOW],
    );
    let fav = w.put(
        &me,
        "social.grain.favorite",
        "f1",
        json!({"subject": second, "createdAt": NOW}),
    );
    w.put(
        ALICE,
        "app.bsky.feed.post",
        "p1",
        json!({
            "text": format!("https://grain.social/profile/{ALICE}/story/s1"), "createdAt": NOW,
        }),
    );

    let (_, body) = w
        .get_as("/xrpc/social.grain.story.getStories?actor=alice.test")
        .await;
    let stories = body["stories"].as_array().unwrap();
    let uris: Vec<&str> = stories.iter().map(|s| s["uri"].as_str().unwrap()).collect();
    assert_eq!(uris, [first.as_str(), second.as_str()]);
    assert_eq!(stories[0]["viewer"], json!({"viewed": true}));
    assert_eq!(stories[0]["locationDisplay"], "Athens, GR");
    assert_eq!(
        stories[0]["crossPost"]["url"],
        format!("https://bsky.app/profile/{ALICE}/post/p1")
    );
    assert_eq!(stories[1]["viewer"], json!({"fav": fav}));
    assert_eq!(stories[1]["expired"], false);
    assert_eq!(stories[1]["creator"]["did"], ALICE);

    // One asked for by its URI answers, expired or labelled.
    let (_, body) = w
        .get(&format!("/xrpc/social.grain.story.getStory?story={old}"))
        .await;
    assert_eq!(body["story"]["expired"], true);
    let (_, body) = w
        .get(&format!(
            "/xrpc/social.grain.story.getStory?story={labelled}"
        ))
        .await;
    assert_eq!(body["story"]["labels"][0]["val"], "spam");
    let (status, body) = w
        .get(&format!(
            "/xrpc/social.grain.story.getStory?story=at://{DAVE}/social.grain.story/s7"
        ))
        .await;
    assert_eq!((status, body), (200, json!({})));

    let authors = |body: &Value| -> Vec<String> {
        body["authors"]
            .as_array()
            .unwrap()
            .iter()
            .map(|a| a["profile"]["did"].as_str().unwrap().to_string())
            .collect()
    };
    let (_, body) = w.get("/xrpc/social.grain.story.getAuthors").await;
    assert_eq!(authors(&body), [CAROL, BOB, ALICE]);
    let alice = &body["authors"][2];
    assert_eq!(
        (alice["storyCount"].as_i64(), alice.get("unviewedCount")),
        (Some(2), None)
    );
    let (_, body) = w.get_as("/xrpc/social.grain.story.getAuthors").await;
    assert_eq!(authors(&body), [BOB, ALICE]);
    let alice = &body["authors"][1];
    assert_eq!(alice["unviewedCount"], 1);
    assert!(alice["lastViewedAt"].is_string());
    assert!(body["authors"][0].get("lastViewedAt").is_none());
}

#[tokio::test]
async fn the_viewer_is_who_their_token_says() {
    let w = world().await;
    let path = format!("/xrpc/social.grain.actor.getProfile?actor={ALICE}");
    // Every answer varies by who asks; one with an asker is theirs alone
    // to cache, and one asked by no one, or by a token that does not
    // hold, is anyone's.
    let token = grain::auth::service_token(&w.ctx, &w.me, AUD, "social.grain.actor.getProfile");
    let bearer = format!("Bearer {}", token.await.unwrap());
    for (headers, cache) in [
        (
            vec![("authorization", bearer.as_str())],
            Some("private, no-cache"),
        ),
        (vec![], None),
        (vec![("authorization", "Bearer not.a.token")], None),
    ] {
        let (_, answered, _) = w.served.get_answered(&path, &headers).await;
        assert_eq!(
            common::caching(&answered),
            (vec!["authorization", "cookie"], cache),
            "{headers:?}"
        );
    }
    for authorization in ["Basic YWxpY2U6c2VjcmV0", "Bearer not.a.token"] {
        let (status, body) = w.served.get_with(&path, authorization).await;
        assert_eq!(
            (status, body["error"].as_str()),
            (401, Some("InvalidToken")),
            "{authorization}"
        );
    }
    // A server with no DID takes no token, and one with no index answers
    // no query.
    let dir = tempfile::tempdir().unwrap();
    let ctx = net::ctx(dir.path(), &[]);
    let index = Arc::new(Index::memory().unwrap());
    let undid = common::served_app(App {
        ctx: ctx.clone(),
        index: Some(index),
        did: None,
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
    let (status, body) = undid.get_with(&path, "Bearer x").await;
    assert_eq!(
        (status, body["error"].as_str()),
        (401, Some("InvalidToken"))
    );
    let (status, body) = common::served().await.get(&path).await;
    assert_eq!(
        (status, body["error"].as_str()),
        (501, Some("MethodNotImplemented"))
    );
}

/// `name`'s URI, as `describeFeeds` lists it.
fn feed_uri(name: &str) -> String {
    format!("at://{AUD}/social.grain.feed.generator/{name}")
}

/// `n` seconds into the hour before [`NOW`].
fn before(n: u32) -> String {
    format!("2026-10-31T11:00:{n:02}.000Z")
}

/// That `body`'s galleries are `want`, in order.
fn has(body: &Value, want: &[&str]) {
    assert_eq!(uris(body), want, "{body}");
}

fn uris(body: &Value) -> Vec<String> {
    body["items"]
        .as_array()
        .unwrap_or_else(|| panic!("{body}"))
        .iter()
        .map(|g| g["uri"].as_str().unwrap().to_string())
        .collect()
}

impl World {
    /// A gallery by `did` posted at `created`, with `extra` in its
    /// record and one photo; its URI.
    fn posted(&self, did: &str, rkey: &str, created: &str, extra: Value) -> String {
        let mut record = json!({"title": rkey, "createdAt": created});
        record
            .as_object_mut()
            .unwrap()
            .extend(extra.as_object().unwrap().clone());
        let gallery = self.put(did, "social.grain.gallery", rkey, record);
        self.item(did, &gallery, rkey);
        gallery
    }

    /// A page of the feed `name`, with `query` its filters.
    async fn feed(&self, name: &str, query: &str) -> Value {
        let path = format!(
            "/xrpc/social.grain.feed.getFeed?feed={}&{query}",
            feed_uri(name)
        );
        let (status, body) = self.get(&path).await;
        assert_eq!(status, 200, "{path}: {body}");
        body
    }

    /// [`World::feed`], with a token.
    async fn feed_as(&self, name: &str, query: &str) -> Value {
        let path = format!(
            "/xrpc/social.grain.feed.getFeed?feed={}&{query}",
            feed_uri(name)
        );
        let (status, body) = self.get_as(&path).await;
        assert_eq!(status, 200, "{path}: {body}");
        body
    }
}

#[tokio::test]
async fn the_feeds_are_named_by_uri() {
    let w = world().await;
    let (status, body) = w.get("/xrpc/social.grain.feed.describeFeeds").await;
    assert_eq!(status, 200, "{body}");
    assert_eq!(body["did"], AUD);
    let feeds = body["feeds"].as_array().unwrap();
    let names: Vec<&str> = feeds.iter().map(|f| f["name"].as_str().unwrap()).collect();
    assert_eq!(
        names,
        [
            "actor",
            "camera",
            "following",
            "foryou",
            "group",
            "groups",
            "hashtag",
            "location",
            "recent"
        ]
    );
    assert_eq!(feeds[8]["uri"], feed_uri("recent"));
    assert_eq!(feeds[8]["label"], "Recent Galleries");

    for feed in [
        feed_uri("nope"),
        format!("at://{ALICE}/social.grain.feed.generator/recent"),
    ] {
        let (status, body) = w
            .get(&format!("/xrpc/social.grain.feed.getFeed?feed={feed}"))
            .await;
        assert_eq!(
            (status, body["error"].as_str()),
            (400, Some("UnknownFeed")),
            "{feed}"
        );
    }
    let (status, body) = w.get("/xrpc/social.grain.feed.getFeed?feed=recent").await;
    assert_eq!(
        (status, body["message"].as_str()),
        (400, Some("feed must be a valid at-uri"))
    );

    // A server with no DID names no feeds.
    let dir = tempfile::tempdir().unwrap();
    let undid = common::served_app(App {
        ctx: net::ctx(dir.path(), &[]),
        index: Some(Arc::new(Index::memory().unwrap())),
        did: None,
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
    for path in [
        "/xrpc/social.grain.feed.describeFeeds".to_string(),
        format!(
            "/xrpc/social.grain.feed.getFeed?feed={}",
            feed_uri("recent")
        ),
    ] {
        let (status, body) = undid.get(&path).await;
        assert_eq!(
            (status, body["error"].as_str()),
            (501, Some("MethodNotImplemented"))
        );
    }
}

#[tokio::test]
async fn recent_galleries_are_what_the_viewer_may_see() {
    let w = world().await;
    let me = w.did.clone();
    let first = w.posted(ALICE, "g1", &before(1), json!({}));
    let second = w.posted(ALICE, "g2", &before(2), json!({}));
    // Dated past when the index first held it, it sorts as then.
    let future = w.posted(BOB, "g3", "2027-01-01T00:00:00.000Z", json!({}));
    let carol = w.posted(CAROL, "g4", &before(4), json!({}));
    let dave = w.posted(DAVE, "g5", &before(5), json!({}));
    let erin = w.posted(ERIN, "g6", &before(6), json!({}));
    w.put(
        ALICE,
        "social.grain.gallery",
        "empty",
        json!({"title": "Empty", "createdAt": before(7)}),
    );
    let labelled = w.posted(ALICE, "g8", &before(8), json!({}));
    w.label(&labelled, "spam", false, NOW);
    w.posted(
        ALICE,
        "g9",
        &before(9),
        json!({"labels": {"$type": "com.atproto.label.defs#selfLabels", "values": [{"val": "gore"}]}}),
    );
    let negated = w.posted(ALICE, "g10", &before(10), json!({}));
    w.label(&negated, "spam", false, NOW);
    w.label(&negated, "spam", true, &at(1));
    w.index.take_down(DAVE).unwrap();
    // The viewer blocks Carol, and mutes Erin.
    w.put(
        &me,
        "social.grain.graph.block",
        "b1",
        json!({"subject": CAROL, "createdAt": NOW}),
    );
    w.sql(
        "INSERT INTO mute VALUES (?1, ?2, ?3)",
        &[me.as_str(), ERIN, NOW],
    );

    let body = w.feed("recent", "").await;
    has(&body, &[&future, &negated, &erin, &carol, &second, &first]);
    assert!(!uris(&body).contains(&dave));
    assert_eq!(body["items"][0]["creator"]["did"], BOB);
    assert!(body.get("cursor").is_none());

    let body = w.feed_as("recent", "limit=2").await;
    has(&body, &[&future, &negated]);
    let cursor = body["cursor"].as_str().unwrap().to_string();
    let body = w
        .feed_as("recent", &format!("limit=2&cursor={cursor}"))
        .await;
    has(&body, &[&second, &first]);
    assert!(body.get("cursor").is_none());

    let (status, body) = w
        .get(&format!(
            "/xrpc/social.grain.feed.getFeed?feed={}&cursor=nope",
            feed_uri("recent")
        ))
        .await;
    assert_eq!(
        (status, body["message"].as_str()),
        (400, Some("malformed cursor"))
    );
}

#[tokio::test]
async fn following_is_the_viewers_follows() {
    let w = world().await;
    let me = w.did.clone();
    let alice = w.posted(ALICE, "g1", &before(1), json!({}));
    w.posted(BOB, "g2", &before(2), json!({}));
    w.follow(&me, ALICE, "f1");
    // Bob follows Carol, which is nothing to the viewer.
    let carol = w.posted(CAROL, "g3", &before(3), json!({}));
    w.follow(BOB, CAROL, "f2");

    let path = format!(
        "/xrpc/social.grain.feed.getFeed?feed={}",
        feed_uri("following")
    );
    let (status, body) = w.get(&path).await;
    assert_eq!(
        (status, body["error"].as_str()),
        (401, Some("AuthenticationRequired"))
    );
    let body = w.feed_as("following", "").await;
    has(&body, &[&alice]);
    assert!(!uris(&body).contains(&carol));
}

#[tokio::test]
async fn an_actors_galleries_are_theirs_by_when_they_say() {
    let w = world().await;
    let me = w.did.clone();
    let old = w.posted(ALICE, "g1", &before(1), json!({}));
    let future = w.posted(ALICE, "g2", "2027-01-01T00:00:00.000Z", json!({}));
    w.posted(BOB, "g3", &before(3), json!({}));
    // Alice blocks the viewer: her galleries are still hers to list.
    w.put(
        ALICE,
        "social.grain.graph.block",
        "b1",
        json!({"subject": me, "createdAt": NOW}),
    );

    let body = w.feed_as("actor", &format!("actor={ALICE}")).await;
    has(&body, &[&future, &old]);
    let body = w.feed("actor", "actor=did:plc:nobody").await;
    assert_eq!(body, json!({"items": []}));
    assert_eq!(w.feed("actor", "").await, json!({"items": []}));
    w.index.take_down(ALICE).unwrap();
    assert_eq!(
        w.feed("actor", &format!("actor={ALICE}")).await["items"],
        json!([])
    );
}

#[tokio::test]
async fn a_camera_finds_its_galleries_by_either_name() {
    let w = world().await;
    let ricoh = w.posted(ALICE, "g1", &before(1), json!({}));
    let photo = format!("at://{ALICE}/social.grain.photo/g1");
    let exif = |rkey: &str, photo: &str, make: &str, model: &str| {
        let record = json!({"photo": photo, "createdAt": NOW, "make": make, "model": model});
        w.put(ALICE, "social.grain.photo.exif", rkey, record);
    };
    exif("e1", &photo, "RICOH IMAGING COMPANY, LTD.", "RICOH GR III");
    let sony = w.posted(BOB, "g2", &before(2), json!({}));
    exif(
        "e2",
        &format!("at://{BOB}/social.grain.photo/g2"),
        "SONY",
        "ILCE-7M3",
    );
    let also = w.posted(CAROL, "g3", &before(3), json!({}));
    exif(
        "e3",
        &format!("at://{CAROL}/social.grain.photo/g3"),
        "Ricoh",
        "GR III",
    );

    for camera in [
        "Ricoh%20GR%20III",
        "RICOH%20IMAGING%20COMPANY%2C%20LTD.%20RICOH%20GR%20III",
    ] {
        let body = w.feed("camera", &format!("camera={camera}")).await;
        has(&body, &[&also, &ricoh]);
    }
    has(&w.feed("camera", "camera=Sony%20ILCE-7M3").await, &[&sony]);
    assert_eq!(w.feed("camera", "camera=Leica").await, json!({"items": []}));
    assert_eq!(w.feed("camera", "").await, json!({"items": []}));
}

#[tokio::test]
async fn a_hashtag_finds_galleries_and_their_comments() {
    let w = world().await;
    let described = w.posted(
        ALICE,
        "g1",
        &before(1),
        json!({"description": "a #Fog morning"}),
    );
    let commented = w.posted(BOB, "g2", &before(2), json!({}));
    w.put(
        CAROL,
        "social.grain.comment",
        "c1",
        json!({"subject": commented, "text": "so much #fog", "createdAt": NOW}),
    );
    w.posted(CAROL, "g3", &before(3), json!({"description": "clear"}));

    let body = w.feed("hashtag", "tag=fog").await;
    has(&body, &[&commented, &described]);
    assert_eq!(w.feed("hashtag", "").await, json!({"items": []}));
}

/// Ocean Beach, a resolution 10 cell, and the resolution 5 cell of San
/// Francisco it is in.
const VENUE: &str = "8a2830959c2ffff";
const CITY: &str = "85283097fffffff";

#[tokio::test]
async fn a_place_is_found_by_its_label_or_its_cell() {
    let w = world().await;
    let address = json!({"locality": "San Francisco", "region": "California", "country": "USA"});
    let beach = w.posted(
        ALICE,
        "g1",
        &before(1),
        json!({"location": {"value": VENUE, "name": "Ocean Beach"}, "address": address}),
    );
    let city = w.posted(
        BOB,
        "g2",
        &before(2),
        json!({"location": {"value": CITY, "name": "San Francisco"}, "address": {"locality": "San Francisco", "country": "US"}}),
    );
    let named = w.posted(
        CAROL,
        "g3",
        &before(3),
        json!({"location": {"value": "8a2a1072b59ffff", "name": "My Garden"}}),
    );
    let elsewhere = w.posted(
        ERIN,
        "g4",
        &before(4),
        json!({"location": {"value": "8a2a1072b59ffff", "name": "Brooklyn"}, "address": {"locality": "Brooklyn", "region": "New York", "country": "US"}}),
    );

    has(
        &w.feed("location", &format!("location={CITY}")).await,
        &[&city, &beach],
    );
    has(
        &w.feed("location", &format!("location={VENUE}")).await,
        &[&beach],
    );
    has(
        &w.feed(
            "location",
            "name=San%20Francisco%2C%20California%2C%20United%20States",
        )
        .await,
        &[&beach],
    );
    has(
        &w.feed("location", "name=San%20Francisco%2C%20US").await,
        &[&city, &beach],
    );
    has(&w.feed("location", "name=My%20Garden").await, &[&named]);
    has(
        &w.feed("location", "name=New%20York%2C%20US").await,
        &[&elsewhere],
    );
    // A label that finds nothing gives way to the cell, where there is one.
    has(
        &w.feed("location", &format!("name=Atlantis&location={VENUE}"))
            .await,
        &[&beach],
    );
    assert_eq!(
        w.feed("location", "name=Atlantis").await,
        json!({"items": []})
    );
    assert_eq!(w.feed("location", "").await, json!({"items": []}));
}

#[tokio::test]
async fn a_groups_pool_is_what_it_pooled_last_first() {
    let w = world().await;
    let me = w.did.clone();
    let one = w.posted(ALICE, "g1", &before(1), json!({}));
    let two = w.posted(BOB, "g2", &before(2), json!({}));
    let other = w.posted(CAROL, "g3", &before(3), json!({}));
    let pool = |group: &str, rkey: &str, gallery: &str, n: u32| {
        let record = json!({"gallery": gallery, "createdAt": at(n)});
        w.put(group, "social.grain.group.item", rkey, record);
    };
    pool(GROUP, "i1", &two, 1);
    pool(GROUP, "i2", &one, 2);
    pool(ERIN, "i3", &other, 3);
    w.put(
        &me,
        "social.grain.graph.block",
        "b1",
        json!({"subject": CAROL, "createdAt": NOW}),
    );

    let body = w.feed("group", &format!("group={GROUP}&limit=1")).await;
    has(&body, &[&one]);
    let cursor = body["cursor"].as_str().unwrap().to_string();
    let body = w
        .feed("group", &format!("group={GROUP}&limit=1&cursor={cursor}"))
        .await;
    has(&body, &[&two]);
    assert_eq!(w.feed("group", "").await, json!({"items": []}));

    has(&w.feed("groups", "").await, &[&other, &one, &two]);
    has(&w.feed_as("groups", "").await, &[&one, &two]);
}

impl World {
    /// A gallery by `did` with a photo, posted and first held `secs` ago.
    fn lately(&self, did: &str, rkey: &str, secs: u64) -> String {
        let uri = format!("at://{did}/social.grain.gallery/{rkey}");
        let record =
            json!({"$type": "social.grain.gallery", "title": rkey, "createdAt": ago(secs)});
        self.index
            .put_at(&uri, &cid(&uri), &record, &ago(secs))
            .unwrap();
        self.item(did, &uri, rkey);
        uri
    }

    fn favorite(&self, did: &str, rkey: &str, subject: &str, created: &str) {
        let record = json!({"subject": subject, "createdAt": created});
        self.put(did, "social.grain.favorite", rkey, record);
    }
}

#[tokio::test]
async fn for_you_follows_who_favorited_what_the_viewer_did() {
    let w = world().await;
    let me = w.did.clone();
    let seed = w.lately(ALICE, "g1", 3600);
    let one_path = w.lately(ALICE, "g2", 3600);
    let two_paths = w.lately(ALICE, "g3", 3600);
    let own = w.lately(&me, "g4", 3600);
    let late = w.lately(ALICE, "g5", 3600);
    w.favorite(&me, "f1", &seed, &before(30));
    // Bob and Carol got to the seed first; Erin, two days after.
    w.favorite(BOB, "f1", &seed, &before(10));
    w.favorite(BOB, "f2", &one_path, &before(11));
    w.favorite(BOB, "f3", &two_paths, &before(12));
    w.favorite(BOB, "f4", &own, &before(13));
    w.favorite(CAROL, "f1", &seed, &before(20));
    w.favorite(CAROL, "f2", &two_paths, &before(21));
    w.favorite(ERIN, "f1", &seed, "2026-11-02T12:00:00.000Z");
    w.favorite(ERIN, "f2", &late, NOW);

    let path = format!(
        "/xrpc/social.grain.feed.getFeed?feed={}",
        feed_uri("foryou")
    );
    let (status, _) = w.get(&path).await;
    assert_eq!(status, 401);
    let body = w.feed_as("foryou", "").await;
    has(&body, &[&two_paths, &one_path]);
    let body = w.feed_as("foryou", "limit=1").await;
    has(&body, &[&two_paths]);
    assert_eq!(body["cursor"], "1");
    let body = w.feed_as("foryou", "limit=1&cursor=1").await;
    has(&body, &[&one_path]);
    assert!(body.get("cursor").is_none());
    let (status, body) = w.get_as(&format!("{path}&cursor=x")).await;
    assert_eq!(
        (status, body["message"].as_str()),
        (400, Some("malformed cursor"))
    );
}

#[tokio::test]
async fn for_you_starts_cold_from_the_months_favorites() {
    let w = world().await;
    let me = w.did.clone();
    let liked = w.lately(ALICE, "g1", 3600);
    let newer = w.lately(BOB, "g2", 60);
    let older = w.lately(BOB, "g3", 7200);
    w.lately(&me, "g4", 60);
    // Older than a month.
    w.lately(CAROL, "g5", 40 * 24 * 3600);
    w.favorite(BOB, "f1", &liked, NOW);
    w.favorite(CAROL, "f1", &liked, NOW);
    // The viewer's favorite is of what no one else favorited.
    w.favorite(&me, "f1", &newer, NOW);

    let body = w.feed_as("foryou", "").await;
    has(&body, &[&liked, &newer, &older]);
    let body = w.feed_as("foryou", "limit=2").await;
    assert_eq!(body["cursor"], "2");
    let body = w.feed_as("foryou", "limit=2&cursor=2").await;
    has(&body, &[&older]);
    assert!(body.get("cursor").is_none());
}

#[tokio::test]
async fn for_you_keeps_its_ranking_a_minute_but_not_past_a_block() {
    let w = world().await;
    let me = w.did.clone();
    let seed = w.lately(ALICE, "g1", 3600);
    let alices = w.lately(ALICE, "g2", 3600);
    let carols = w.lately(CAROL, "g3", 7200);
    w.favorite(&me, "f1", &seed, &before(30));
    w.favorite(BOB, "f1", &seed, &before(10));
    w.favorite(BOB, "f2", &alices, &before(11));
    w.favorite(BOB, "f3", &carols, &before(12));
    has(&w.feed_as("foryou", "").await, &[&alices, &carols]);

    // A path made since waits for the ranking to be made again.
    let newest = w.lately(ERIN, "g4", 60);
    w.favorite(BOB, "f4", &newest, &before(13));
    has(&w.feed_as("foryou", "").await, &[&alices, &carols]);

    // A block stands at once.
    w.put(
        &me,
        "social.grain.graph.block",
        "b1",
        json!({"subject": ALICE, "createdAt": NOW}),
    );
    let body = w.feed_as("foryou", "").await;
    has(&body, &[&carols]);
    assert!(body.get("cursor").is_none());
}

impl World {
    /// `did`'s profile, named `name` and described as `description`; its URI.
    fn described(&self, did: &str, name: &str, description: &str) -> String {
        let record = json!({"displayName": name, "description": description, "avatar": blob(), "createdAt": NOW});
        self.put(did, "social.grain.actor.profile", "self", record)
    }

    /// Puts `record` over what `did`'s `rkey` of `collection` holds, as
    /// an edit does, with a CID of its own.
    fn edit(&self, did: &str, collection: &str, rkey: &str, mut record: Value) {
        let uri = format!("at://{did}/{collection}/{rkey}");
        record["$type"] = collection.into();
        let cid = cid(&format!("{uri}#{record}"));
        self.index.put_at(&uri, &cid, &record, NOW).unwrap();
    }

    /// The answer to `method` asked with `query`, which must be 200.
    async fn ok(&self, method: &str, query: &str) -> Value {
        let path = format!("/xrpc/{method}?{query}");
        let (status, body) = self.get(&path).await;
        assert_eq!(status, 200, "{path}: {body}");
        body
    }
}

/// The DIDs of `body`'s `key`, in order.
fn found(body: &Value, key: &str) -> Vec<String> {
    body[key]
        .as_array()
        .unwrap_or_else(|| panic!("{body}"))
        .iter()
        .map(|i| i["did"].as_str().unwrap().to_string())
        .collect()
}

const SEARCH_ACTORS: &str = "social.grain.actor.searchActors";

#[tokio::test]
async fn accounts_are_found_by_their_words() {
    let w = world().await;
    w.described(ALICE, "Alice Liddell", "Foggy mornings by the sea");
    w.described(BOB, "Bob", "Street photography");
    let carol = w.described(CAROL, "Carol", "Birds");
    w.described(DAVE, "Dave", "Mornings too");
    w.index.take_down(DAVE).unwrap();
    let w = &w;
    let search = |q: &'static str| async move { found(&w.ok(SEARCH_ACTORS, q).await, "items") };

    // Stemmed, so "morning" finds "mornings"; the taken down are left out.
    let body = w.ok(SEARCH_ACTORS, "q=morning").await;
    assert_eq!(found(&body, "items"), [ALICE]);
    assert_eq!(body["items"][0]["handle"], "alice.test");
    assert_eq!(body["items"][0]["displayName"], "Alice Liddell");
    assert_eq!(body["items"][0]["description"], "Foggy mornings by the sea");
    assert!(body["items"][0]["avatar"].as_str().is_some());
    assert!(body.get("cursor").is_none());
    // Stop words are dropped, unless they are all there is.
    assert_eq!(search("q=the%20street").await, [BOB]);
    assert_eq!(search("q=the").await, [ALICE]);
    assert_eq!(search("q=bob.test").await, [BOB]);
    assert_eq!(search("q=STREET").await, [BOB]);
    assert_eq!(search("q=%22street").await, [BOB]);
    assert_eq!(search("q=...").await, Vec::<String>::new());

    // Every handle says "test": paged by an offset.
    let body = w.ok(SEARCH_ACTORS, "q=test&limit=2").await;
    let mut all = found(&body, "items");
    assert_eq!(all.len(), 2);
    assert_eq!(body["cursor"], "2");
    let body = w.ok(SEARCH_ACTORS, "q=test&limit=2&cursor=2").await;
    all.extend(found(&body, "items"));
    assert!(body.get("cursor").is_none());
    all.sort();
    assert_eq!(all, [ALICE, BOB, CAROL]);

    // The index's words follow a new handle, an edit and a delete.
    w.index.set_handle(BOB, "robert.test").unwrap();
    assert_eq!(search("q=robert").await, [BOB]);
    assert_eq!(search("q=bob.test").await, Vec::<String>::new());
    w.edit(
        ALICE,
        "social.grain.actor.profile",
        "self",
        json!({"displayName": "Alice Liddell", "description": "Lighthouses", "createdAt": NOW}),
    );
    assert_eq!(search("q=morning").await, Vec::<String>::new());
    assert_eq!(search("q=lighthouse").await, [ALICE]);
    w.index.delete(&carol).unwrap();
    assert_eq!(search("q=birds").await, Vec::<String>::new());
    // A handle the index learns after the profile is found too.
    w.index.track(ERIN).unwrap();
    w.described(ERIN, "Erin", "Rivers");
    w.index.set_handle(ERIN, "erin.test").unwrap();
    assert_eq!(search("q=erin.test").await, [ERIN]);

    for (query, message) in [
        ("q=test&cursor=nope", "malformed cursor"),
        ("", "Params must have the property \"q\""),
    ] {
        let (status, body) = w.get(&format!("/xrpc/{SEARCH_ACTORS}?{query}")).await;
        assert_eq!(
            (status, body["message"].as_str()),
            (400, Some(message)),
            "{query}"
        );
    }
}

const SEARCH_GALLERIES: &str = "social.grain.gallery.searchGalleries";

#[tokio::test]
async fn galleries_are_found_by_their_words_and_their_place() {
    let w = world().await;
    let pier = w.posted(
        ALICE,
        "g1",
        &before(1),
        json!({"title": "Foggy pier", "description": "Early lights",
               "location": {"value": VENUE, "name": "Ocean Beach"},
               "address": {"locality": "San Francisco", "region": "California", "country": "US"}}),
    );
    let street = w.posted(
        BOB,
        "g2",
        &before(2),
        json!({"title": "Market street", "description": "Café corner",
               "address": {"locality": "Brooklyn", "region": "New York", "country": "US"}}),
    );
    let labelled = w.posted(CAROL, "g3", &before(3), json!({"title": "Pier at night"}));
    w.label(&labelled, "spam", false, NOW);
    w.put(
        ALICE,
        "social.grain.gallery",
        "empty",
        json!({"title": "Pier plans", "createdAt": NOW}),
    );
    w.posted(DAVE, "g4", &before(4), json!({"title": "Pier again"}));
    w.index.take_down(DAVE).unwrap();
    let w = &w;
    let search = |q: &'static str| async move { uris(&w.ok(SEARCH_GALLERIES, q).await) };

    let body = w.ok(SEARCH_GALLERIES, "q=pier").await;
    has(&body, &[&pier]);
    assert_eq!(body["items"][0]["title"], "Foggy pier");
    assert_eq!(search("q=ocean%20beach").await, [pier.as_str()]);
    assert_eq!(search("q=francisco").await, [pier.as_str()]);
    assert_eq!(search("q=light").await, [pier.as_str()]);
    assert_eq!(search("q=alice.test").await, [pier.as_str()]);
    assert_eq!(search("q=york").await, [street.as_str()]);
    // Accents fold away.
    assert_eq!(search("q=cafe").await, [street.as_str()]);
    assert_eq!(search("q=lighthouse").await, Vec::<String>::new());

    let body = w.ok(SEARCH_GALLERIES, "q=test&limit=1").await;
    let mut all = uris(&body);
    assert_eq!(body["cursor"], "1");
    let body = w.ok(SEARCH_GALLERIES, "q=test&limit=1&cursor=1").await;
    all.extend(uris(&body));
    assert!(body.get("cursor").is_none());
    all.sort();
    assert_eq!(all, [pier.as_str(), street.as_str()]);

    // An edit is found by its new words, and not its old.
    w.edit(
        BOB,
        "social.grain.gallery",
        "g2",
        json!({"title": "Canal street", "createdAt": before(2)}),
    );
    assert_eq!(search("q=market").await, Vec::<String>::new());
    assert_eq!(search("q=canal").await, [street.as_str()]);
    w.index.delete(&street).unwrap();
    assert_eq!(search("q=canal").await, Vec::<String>::new());
}

const TYPEAHEAD: &str = "social.grain.actor.searchActorsTypeahead";

/// A stand-in for Bluesky's appview, answering typeahead with `actors`;
/// its URL, and the queries it was asked.
async fn bluesky(actors: Value) -> (String, Arc<std::sync::Mutex<Vec<String>>>) {
    let asked = Arc::new(std::sync::Mutex::new(Vec::new()));
    let log = asked.clone();
    let app = axum::Router::new().route(
        "/xrpc/app.bsky.actor.searchActorsTypeahead",
        axum::routing::get(move |uri: axum::http::Uri| {
            log.lock()
                .unwrap()
                .push(uri.query().unwrap_or_default().to_string());
            let actors = actors.clone();
            async move { axum::Json(json!({ "actors": actors })) }
        }),
    );
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let url = format!("http://{}", listener.local_addr().unwrap());
    tokio::spawn(async move { axum::serve(listener, app).await.unwrap() });
    (url, asked)
}

#[tokio::test]
async fn typeahead_fills_out_grains_accounts_with_bluesky_s() {
    let (url, asked) = bluesky(json!([
        {"did": ALICE, "handle": "alice.bsky.social"},
        {"did": "did:plc:zed", "handle": "zed.bsky.social", "displayName": "Zed",
         "avatar": "https://cdn.bsky.app/img/avatar/plain/did:plc:zed/x@jpeg", "labels": []},
        {"handle": "nodid.bsky.social"},
        {"did": "did:plc:yan", "handle": "yan.bsky.social"}
    ]))
    .await;
    let w = world_of(Cdn::default(), Some(url)).await;
    w.described(ALICE, "Alice Liddell", "Fog");
    w.described(BOB, "Bob", "Streets");

    // What is still being typed is a word's start.
    let body = w.ok(TYPEAHEAD, "q=ali").await;
    assert_eq!(
        found(&body, "actors"),
        [ALICE, "did:plc:zed", "did:plc:yan"]
    );
    assert_eq!(body["actors"][0]["handle"], "alice.test");
    assert_eq!(body["actors"][0]["displayName"], "Alice Liddell");
    assert!(body["actors"][0].get("description").is_none());
    assert_eq!(body["actors"][1]["displayName"], "Zed");
    assert!(body["actors"][1].get("labels").is_none());
    assert_eq!(asked.lock().unwrap().as_slice(), ["q=ali&limit=5"]);
    let body = w.ok(TYPEAHEAD, "q=ali&limit=2").await;
    assert_eq!(found(&body, "actors"), [ALICE, "did:plc:zed"]);
    let body = w.ok(TYPEAHEAD, "q=alice%20lid").await;
    assert_eq!(found(&body, "actors")[0], ALICE);
    let (status, _) = w.get(&format!("/xrpc/{TYPEAHEAD}")).await;
    assert_eq!(status, 400);
    let (status, _) = w.get(&format!("/xrpc/{TYPEAHEAD}?q=a&limit=11")).await;
    assert_eq!(status, 400);

    // Without an appview to ask, or one that does not answer, grain's own.
    for appview in [None, Some("http://127.0.0.1:1".to_string())] {
        let w = world_of(Cdn::default(), appview).await;
        w.described(ALICE, "Alice Liddell", "Fog");
        let body = w.ok(TYPEAHEAD, "q=ali").await;
        assert_eq!(found(&body, "actors"), [ALICE]);
    }
}

const SUGGESTED: &str = "social.grain.actor.getSuggestedFollows";

#[tokio::test]
async fn suggestions_are_bluesky_follows_then_the_most_followed() {
    let w = world().await;
    for (did, handle) in [(ERIN, "erin.test"), (GROUP, "group.test")] {
        w.index.track(did).unwrap();
        w.index.set_handle(did, handle).unwrap();
    }
    for did in [ALICE, BOB, CAROL, ERIN, GROUP] {
        w.described(did, did, "Photos");
    }
    // Alice follows these on Bluesky; Dave has no grain profile.
    for (rkey, subject) in [
        ("b0", ALICE),
        ("b1", BOB),
        ("b2", CAROL),
        ("b3", DAVE),
        ("b4", ERIN),
    ] {
        let record = json!({"subject": subject, "createdAt": NOW});
        w.put(ALICE, "app.bsky.graph.follow", rkey, record);
    }
    // She follows Carol on grain already, and Erin blocks her.
    w.follow(ALICE, CAROL, "f1");
    w.put(
        ERIN,
        "social.grain.graph.block",
        "k1",
        json!({"subject": ALICE, "createdAt": NOW}),
    );
    w.follow(BOB, GROUP, "f1");
    w.follow(CAROL, GROUP, "f1");
    w.follow(ERIN, BOB, "f1");

    let body = w.ok(SUGGESTED, &format!("actor={ALICE}")).await;
    assert_eq!(found(&body, "items"), [BOB, GROUP]);
    assert_eq!(body["items"][0]["handle"], "bob.test");
    assert_eq!(body["items"][0]["displayName"], BOB);
    assert_eq!(body["items"][0]["description"], "Photos");
    assert_eq!(body["items"][0]["followersCount"], 1);
    assert_eq!(body["items"][1]["followersCount"], 2);
    let body = w.ok(SUGGESTED, &format!("actor={ALICE}&limit=1")).await;
    assert_eq!(found(&body, "items"), [BOB]);
    // With no Bluesky follows, the most followed.
    let body = w.ok(SUGGESTED, &format!("actor={DAVE}")).await;
    assert_eq!(found(&body, "items"), [GROUP, BOB, CAROL]);

    for query in ["", "actor=did:plc:alice&limit=21"] {
        let (status, _) = w.get(&format!("/xrpc/{SUGGESTED}?{query}")).await;
        assert_eq!(status, 400, "{query}");
    }
}

#[tokio::test]
async fn cameras_are_counted_by_the_name_a_card_gives_them() {
    let w = world().await;
    let exif = |did: &str, rkey: &str, make: &str, model: &str| {
        w.posted(did, rkey, &before(1), json!({}));
        let photo = format!("at://{did}/social.grain.photo/{rkey}");
        let record = json!({"photo": photo, "createdAt": NOW, "make": make, "model": model});
        w.put(did, "social.grain.photo.exif", rkey, record);
    };
    exif(ALICE, "g1", "RICOH IMAGING COMPANY, LTD.", "RICOH GR III");
    exif(CAROL, "g2", "Ricoh", "GR III");
    exif(BOB, "g3", "SONY", "ILCE-7M3");
    exif(BOB, "g4", " ", " ");

    let body = w.ok("social.grain.gallery.getCameras", "").await;
    let cameras = body["cameras"].as_array().unwrap();
    let names: Vec<(&str, i64)> = cameras
        .iter()
        .map(|c| {
            (
                c["camera"].as_str().unwrap(),
                c["photoCount"].as_i64().unwrap(),
            )
        })
        .collect();
    assert_eq!(names, [("Ricoh GR III", 2), ("Sony ILCE-7M3", 1)]);
    assert_eq!(cameras[0]["thumbs"].as_array().unwrap().len(), 2);
    assert_eq!(
        cameras[1]["thumbs"][0],
        format!("https://cdn.bsky.app/img/feed_thumbnail/plain/{BOB}/{BLOB}@jpeg")
    );
}

#[tokio::test]
async fn places_are_counted_and_named_as_their_galleries_say() {
    let w = world().await;
    let at = |did: &str, rkey: &str, n: u32, location: Value, address: Value| {
        let mut extra = json!({"location": location});
        if !address.is_null() {
            extra["address"] = address;
        }
        w.posted(did, rkey, &before(n), extra)
    };
    let sf = json!({"locality": "San Francisco", "region": "California", "country": "USA"});
    at(
        ALICE,
        "g1",
        1,
        json!({"value": VENUE, "name": "Ocean Beach"}),
        sf.clone(),
    );
    at(
        CAROL,
        "g2",
        2,
        json!({"value": VENUE, "name": "Ocean Beach"}),
        sf,
    );
    // Another geocoder's San Francisco, of no region.
    at(
        BOB,
        "g3",
        3,
        json!({"value": CITY, "name": "San Francisco"}),
        json!({"locality": "San Francisco", "country": "US"}),
    );
    at(
        ERIN,
        "g4",
        4,
        json!({"value": "851eaa13fffffff", "name": "Athens"}),
        json!({"country": "Greece"}),
    );
    at(
        ERIN,
        "g5",
        5,
        json!({"value": "8a392010a2a7fff", "name": "Lisbon"}),
        json!({"locality": "Lisbon", "country": "PT"}),
    );
    at(
        GROUP,
        "g6",
        6,
        json!({"value": "8a2a1072b59ffff", "name": "My Garden"}),
        Value::Null,
    );
    // Neither a cell nor a name to go by.
    at(GROUP, "g7", 7, json!({"value": "nonsense"}), Value::Null);
    let labelled = at(
        GROUP,
        "g8",
        8,
        json!({"value": VENUE}),
        json!({"country": "US"}),
    );
    w.label(&labelled, "spam", false, NOW);
    w.posted(GROUP, "g9", &before(9), json!({}));

    let body = w.ok("social.grain.gallery.getLocations", "").await;
    let places = body["locations"].as_array().unwrap();
    let names: Vec<(&str, i64)> = places
        .iter()
        .map(|p| {
            (
                p["name"].as_str().unwrap(),
                p["galleryCount"].as_i64().unwrap(),
            )
        })
        .collect();
    assert_eq!(
        names,
        [
            ("San Francisco, California, US", 3),
            ("Greece", 1),
            ("Lisbon, PT", 1),
            ("My Garden", 1)
        ]
    );
    assert_eq!(places[0]["h3Index"], VENUE);
    assert_eq!(places[0]["h3Cells"], json!([VENUE, CITY]));
    assert_eq!(places[0]["thumbs"].as_array().unwrap().len(), 3);
    assert_eq!(places[3]["h3Index"], "8a2a1072b59ffff");

    let body = w.ok("social.grain.gallery.getLocations", "pins=true").await;
    assert_eq!(
        body["locations"][0],
        json!({"name": "San Francisco, California, US", "h3Index": VENUE, "galleryCount": 3})
    );
    assert_eq!(body["locations"].as_array().unwrap().len(), 4);
    let body = w
        .ok("social.grain.gallery.getLocations", "pins=false")
        .await;
    assert_eq!(body["locations"].as_array().unwrap().len(), 4);
    let (status, body) = w
        .get("/xrpc/social.grain.gallery.getLocations?pins=nope")
        .await;
    assert_eq!(
        (status, body["message"].as_str()),
        (400, Some("pins must be a boolean"))
    );
}

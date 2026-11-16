//! The sitemap's pages, as the web asks for them to draw `/sitemap.xml`.
//! Every answer goes through `common`, so `harness/answers.mjs` holds it to
//! its lexicon.

mod common;

use grain_serve::App;
use grain_serve::index::{Index, Label};
use serde_json::{Value, json};
use std::sync::Arc;

const NOW: &str = "2026-10-31T12:00:00.000Z";
const BLOB: &str = "bafkreigh2akiscaildcqabsyg3dfr6chu3fgpregiymsck7e7aqa4s52zy";
const ALICE: &str = "did:plc:alice";
const BOB: &str = "did:plc:bob";
const CAROL: &str = "did:plc:carol";
const DAVE: &str = "did:plc:dave";
const SITEMAP: &str = "/xrpc/social.grain.server.getSitemap";

fn cid(uri: &str) -> String {
    grain::drisl::cid_text(&grain::drisl::cid(uri.as_bytes()))
}

fn put(index: &Index, did: &str, collection: &str, rkey: &str, mut record: Value) -> String {
    let uri = format!("at://{did}/{collection}/{rkey}");
    record["$type"] = collection.into();
    index.put_at(&uri, &cid(&uri), &record, NOW).unwrap();
    uri
}

fn blob() -> Value {
    json!({"$type": "blob", "ref": {"$link": BLOB}, "mimeType": "image/jpeg", "size": 1000})
}

/// A gallery by `did`, made at `at`, with a photo if `photo`.
fn gallery(index: &Index, did: &str, rkey: &str, at: &str, extra: Value) -> String {
    let mut record = json!({"title": "fog", "createdAt": at});
    record
        .as_object_mut()
        .unwrap()
        .extend(extra.as_object().unwrap().clone());
    let uri = put(index, did, "social.grain.gallery", rkey, record);
    let photo = json!({"photo": blob(), "aspectRatio": {"width": 3, "height": 2}, "createdAt": at});
    let photo = put(index, did, "social.grain.photo", rkey, photo);
    let item = json!({"gallery": uri, "item": photo, "position": 0, "createdAt": at});
    put(index, did, "social.grain.gallery.item", rkey, item);
    uri
}

fn label(index: &Index, uri: &str) {
    let label = Label {
        src: "did:plc:labeler".into(),
        uri: uri.into(),
        val: "porn".into(),
        neg: false,
        cts: NOW.into(),
        exp: None,
    };
    index.label(&label).unwrap();
}

fn paths(body: &Value) -> Vec<&str> {
    let entries = body["entries"].as_array().unwrap();
    entries
        .iter()
        .map(|e| e["path"].as_str().unwrap())
        .collect()
}

#[tokio::test]
async fn the_sitemap_names_only_what_a_search_engine_may_show() {
    let index = Arc::new(Index::memory().unwrap());
    let ctx = grain::env::Ctx::new(grain::env::Env::from_vars(|_| None));
    let served = common::served_app(App {
        index: Some(index.clone()),
        ..App::bare(ctx)
    })
    .await;
    for (did, handle) in [
        (ALICE, "alice.test"),
        (BOB, "bob.test"),
        (CAROL, "carol.test"),
    ] {
        index.track(did).unwrap();
        index.set_handle(did, handle).unwrap();
    }
    let profile = json!({"displayName": "A", "createdAt": NOW});
    for did in [ALICE, BOB, CAROL, DAVE] {
        put(
            &index,
            did,
            "social.grain.actor.profile",
            "self",
            profile.clone(),
        );
    }
    gallery(&index, ALICE, "a1", "2026-10-30T12:00:00.000Z", json!({}));
    let edited = json!({"updatedAt": "2026-10-31T09:00:00+02:00"});
    gallery(&index, ALICE, "a2", "2026-10-31T12:00:00.000Z", edited);
    // No photo: a thin page.
    put(
        &index,
        ALICE,
        "social.grain.gallery",
        "a3",
        json!({"title": "empty", "createdAt": NOW}),
    );
    // Labelled by grain, or by its author.
    let labelled = gallery(&index, ALICE, "a4", NOW, json!({}));
    label(&index, &labelled);
    let own = json!({"labels": {"$type": "com.atproto.label.defs#selfLabels", "values": [{"val": "nudity"}]}});
    gallery(&index, ALICE, "a5", NOW, own);
    // Its author labelled, or taken down, or only with labelled galleries.
    gallery(&index, BOB, "b1", NOW, json!({}));
    label(&index, BOB);
    gallery(&index, CAROL, "c1", NOW, json!({}));
    index.take_down(CAROL).unwrap();
    // No handle the index knows: named by DID.
    gallery(&index, DAVE, "d1", "2026-10-29T12:00:00.000Z", json!({}));

    let (status, body) = served.get(&format!("{SITEMAP}?kind=galleries")).await;
    assert_eq!(status, 200, "{body}");
    assert_eq!(
        paths(&body),
        [
            "/profile/alice.test/gallery/a2",
            "/profile/alice.test/gallery/a1",
            format!("/profile/{DAVE}/gallery/d1").as_str(),
        ]
    );
    assert_eq!(body["pageCount"], 1);
    assert_eq!(body["entries"][0]["lastmod"], "2026-10-31T07:00:00.000Z");
    assert_eq!(body["entries"][1]["lastmod"], "2026-10-30T12:00:00.000Z");

    let (_, body) = served.get(&format!("{SITEMAP}?kind=profiles&page=0")).await;
    let mut listed = paths(&body);
    listed.sort();
    assert_eq!(listed, ["/profile/alice.test", &format!("/profile/{DAVE}")]);
    let alice = body["entries"]
        .as_array()
        .unwrap()
        .iter()
        .find(|e| e["path"] == "/profile/alice.test")
        .unwrap();
    // Its latest gallery, as that gallery's own lastmod says, in UTC.
    assert_eq!(alice["lastmod"], "2026-10-31T07:00:00.000Z");

    // A profile labelled is left out, its galleries not.
    label(
        &index,
        &format!("at://{DAVE}/social.grain.actor.profile/self"),
    );
    let (_, body) = served.get(&format!("{SITEMAP}?kind=profiles")).await;
    assert_eq!(paths(&body), ["/profile/alice.test"]);

    // Past the last page there is nothing.
    let (_, body) = served
        .get(&format!("{SITEMAP}?kind=galleries&page=1"))
        .await;
    assert_eq!(body, json!({ "entries": [], "pageCount": 1 }));

    for wrong in [
        "",
        "?kind=stories",
        "?kind=galleries&page=-1",
        "?kind=galleries&page=x",
    ] {
        let (status, said) = served.get(&format!("{SITEMAP}{wrong}")).await;
        assert_eq!(
            (status, said["error"].as_str()),
            (400, Some("InvalidRequest")),
            "{wrong}"
        );
    }
}

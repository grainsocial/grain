//! The OpenGraph cards, asked for as a link unfurler asks: drawn from the
//! index, with their images from a CDN of the test's own, which draws
//! every photo red and every avatar blue, and has no image for a blob
//! [`MISSING`].

use axum::extract::Path;
use axum::http::header;
use grain::env::{Ctx, Env};
use grain_serve::App;
use grain_serve::cdn::Cdn;
use grain_serve::index::{Index, Label};
use serde_json::{Value, json};
use std::sync::Arc;

const NOW: &str = "2026-10-31T12:00:00.000Z";
const ALICE: &str = "did:plc:alice";
const BOB: &str = "did:plc:bob";
const RED: [u8; 3] = [255, 0, 0];
const BLUE: [u8; 3] = [0, 0, 255];
const WHITE: [u8; 3] = [255, 255, 255];

// Blobs' CIDs, each the raw CID of its name: real ones, as the index
// takes a blob only with a CID in its $link.
const ONE: &str = "bafkreidwslb22nkaxoadyaqlhlxgntmiq4jdenhkbrxhcq6avxlt75br5u";
const TWO: &str = "bafkreib7ytgp45cyodrmbwm7ohzq74dfnsg63va4yhl5hu3wwdn6nbpc6m";
const MISSING: &str = "bafkreih7uy2yhx5gobvypuuexbvq22j2cypeqqfk2lc46225e7b3syq7pu";
const AVATAR: &str = "bafkreiehxpuhtr5f6v4eu4byjo2j7kkrhjvd7psmfu4imnpdzb3bdqb7vy";
const STORY: &str = "bafkreigepa3b42djv4szobuculctsz5nxsfen2kct364ms4wguop2uxbh4";
const BLACK: [u8; 3] = [0, 0, 0];

/// A PNG `w` by `h` of one color.
fn png(w: u32, h: u32, rgb: [u8; 3]) -> Vec<u8> {
    let mut out = Vec::new();
    let mut encoder = png::Encoder::new(&mut out, w, h);
    encoder.set_color(png::ColorType::Rgb);
    let mut writer = encoder.write_header().unwrap();
    let data: Vec<u8> = (0..w * h).flat_map(|_| rgb).collect();
    writer.write_image_data(&data).unwrap();
    writer.finish().unwrap();
    out
}

/// A CDN serving each image as imgproxy's presets name them.
async fn cdn() -> String {
    let app = axum::Router::new().route(
        "/{sig}/{preset}/plain/{did}/{cid}",
        axum::routing::get(
            |Path((_, preset, _, cid)): Path<(String, String, String, String)>| async move {
                let rgb = if preset == "avatar" { BLUE } else { RED };
                match cid.as_str() {
                    MISSING => Err(axum::http::StatusCode::NOT_FOUND),
                    _ => Ok(([(header::CONTENT_TYPE, "image/png")], png(40, 30, rgb))),
                }
            },
        ),
    );
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let url = format!("http://{}", listener.local_addr().unwrap());
    tokio::spawn(async move { axum::serve(listener, app).await });
    url
}

struct World {
    index: Arc<Index>,
    base: String,
    http: reqwest::Client,
}

async fn world() -> World {
    let index = Arc::new(Index::memory().unwrap());
    let url = cdn().await;
    let app = App {
        cdn: Cdn::new(Some(&url), Some("00"), Some("00")).unwrap(),
        index: Some(index.clone()),
        ..App::bare(Ctx::new(Env::from_vars(|_| None)))
    };
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let base = format!("http://{}", listener.local_addr().unwrap());
    tokio::spawn(grain_serve::serve(listener, Arc::new(app)));
    for (did, handle) in [(ALICE, "alice.test"), (BOB, "bob.test")] {
        index.track(did).unwrap();
        index.set_handle(did, handle).unwrap();
    }
    World {
        index,
        base,
        http: reqwest::Client::new(),
    }
}

fn blob(cid: &str) -> Value {
    json!({"$type": "blob", "ref": {"$link": cid}, "mimeType": "image/png", "size": 1000})
}

/// The colors of a card's pixels.
struct Drawn {
    rgb: Vec<u8>,
}

impl Drawn {
    fn at(&self, x: usize, y: usize) -> [u8; 3] {
        let i = (y * 1200 + x) * 3;
        [self.rgb[i], self.rgb[i + 1], self.rgb[i + 2]]
    }

    /// How many pixels are `rgb`.
    fn count(&self, rgb: [u8; 3]) -> usize {
        self.rgb
            .as_chunks::<3>()
            .0
            .iter()
            .filter(|p| **p == rgb)
            .count()
    }
}

impl World {
    fn put(&self, did: &str, collection: &str, rkey: &str, mut record: Value) -> String {
        let uri = format!("at://{did}/{collection}/{rkey}");
        record["$type"] = collection.into();
        let cid = atproto::Cid::of_cbor(uri.as_bytes()).to_string();
        self.index.put_at(&uri, &cid, &record, NOW).unwrap();
        uri
    }

    fn profile(&self, did: &str, name: &str) {
        let record = json!({"displayName": name, "avatar": blob(AVATAR), "createdAt": NOW});
        self.put(did, "social.grain.actor.profile", "self", record);
    }

    /// A gallery of `did`'s with a photo for each of `cids`, made at
    /// `created`.
    fn gallery(&self, did: &str, rkey: &str, cids: &[&str], extra: Value) -> String {
        let mut record = json!({"title": "Fog", "createdAt": NOW});
        for (k, v) in extra.as_object().unwrap() {
            record[k] = v.clone();
        }
        let gallery = self.put(did, "social.grain.gallery", rkey, record);
        for (i, cid) in cids.iter().enumerate() {
            let rkey = format!("{rkey}p{i}");
            let photo = json!({"photo": blob(cid), "aspectRatio": {"width": 3, "height": 2}, "createdAt": NOW});
            let photo = self.put(did, "social.grain.photo", &rkey, photo);
            let item = json!({"gallery": gallery, "item": photo, "position": i, "createdAt": NOW});
            self.put(did, "social.grain.gallery.item", &rkey, item);
        }
        gallery
    }

    fn story(&self, did: &str, rkey: &str, extra: Value) -> String {
        let mut record = json!({"media": blob(STORY), "aspectRatio": {"width": 4, "height": 3}, "createdAt": NOW});
        for (k, v) in extra.as_object().unwrap() {
            record[k] = v.clone();
        }
        self.put(did, "social.grain.story", rkey, record)
    }

    fn label(&self, uri: &str, val: &str) {
        let label = Label {
            src: "did:plc:labeler".into(),
            uri: uri.into(),
            val: val.into(),
            neg: false,
            cts: NOW.into(),
            exp: None,
        };
        self.index.label(&label).unwrap();
    }

    /// The card at `path`, which is a PNG, cacheable for five minutes.
    async fn card(&self, path: &str) -> Drawn {
        let res = self
            .http
            .get(format!("{}{path}", self.base))
            .send()
            .await
            .unwrap();
        assert_eq!(res.status(), 200, "{path}");
        let headers = res.headers().clone();
        assert_eq!(headers[header::CONTENT_TYPE], "image/png");
        assert_eq!(headers[header::CACHE_CONTROL], "public, max-age=300");
        assert_eq!(headers[header::ACCESS_CONTROL_ALLOW_ORIGIN], "*");
        let bytes = res.bytes().await.unwrap();
        let decoder = png::Decoder::new(std::io::Cursor::new(bytes));
        let mut reader = decoder.read_info().unwrap();
        let mut rgb = vec![0; reader.output_buffer_size().unwrap()];
        let info = reader.next_frame(&mut rgb).unwrap();
        assert_eq!((info.width, info.height), (1200, 630));
        assert_eq!(info.color_type, png::ColorType::Rgb);
        Drawn { rgb }
    }

    async fn status(&self, path: &str) -> u16 {
        let res = self.http.get(format!("{}{path}", self.base)).send().await;
        res.unwrap().status().as_u16()
    }
}

/// Whether `card` says only what is missing: white, but for a line of
/// dark text in the middle.
fn missing(card: &Drawn) -> bool {
    let dark = card
        .rgb
        .as_chunks::<3>()
        .0
        .iter()
        .enumerate()
        .filter(|(_, p)| p[0] < 128);
    let rows: Vec<usize> = dark.map(|(i, _)| i / 1200).collect();
    !rows.is_empty() && rows.iter().all(|y| (300..330).contains(y)) && card.count(RED) == 0
}

#[tokio::test]
async fn a_gallery_shows_its_photos_and_its_author() {
    let w = world().await;
    w.profile(ALICE, "Alice");
    w.gallery(ALICE, "g1", &[ONE], json!({}));
    // A photo on its own fills the frame as far as its shape lets it.
    let card = w.card("/og/profile/alice.test/gallery/g1").await;
    assert_eq!(card.at(600, 265), RED);
    assert_eq!(card.at(52, 574), BLUE, "the avatar");
    assert_eq!(card.at(10, 10), WHITE);
    // By DID too, and with some photos the CDN has no image for.
    w.gallery(ALICE, "g2", &[ONE, MISSING, TWO], json!({}));
    let card = w.card(&format!("/og/profile/{ALICE}/gallery/g2")).await;
    assert!(card.count(RED) > 10_000);
    // Asked again, the card is the one drawn, though the gallery changed.
    w.label(&format!("at://{ALICE}/social.grain.gallery/g2"), "nudity");
    let again = w.card(&format!("/og/profile/{ALICE}/gallery/g2")).await;
    assert_eq!(again.rgb, card.rgb);
}

#[tokio::test]
async fn a_label_leaves_the_photos_out() {
    let w = world().await;
    w.profile(ALICE, "Alice");
    let labeled = w.gallery(ALICE, "g1", &[ONE], json!({}));
    w.label(&labeled, "nudity");
    let card = w.card("/og/profile/alice.test/gallery/g1").await;
    assert_eq!(card.count(RED), 0);
    assert_eq!(card.at(52, 574), BLUE, "the author is not labeled");
    // Its author's label, as a self-label.
    let self_labels = json!({"labels": {"$type": "com.atproto.label.defs#selfLabels", "values": [{"val": "nudity"}]}});
    w.gallery(ALICE, "g2", &[ONE], self_labels);
    let card = w.card("/og/profile/alice.test/gallery/g2").await;
    assert_eq!(card.count(RED), 0);
    // A photo with a label of its own is left out of the rest.
    let photo = format!("at://{ALICE}/social.grain.photo/g3p0");
    w.gallery(ALICE, "g3", &[ONE], json!({}));
    w.label(&photo, "porn");
    let card = w.card("/og/profile/alice.test/gallery/g3").await;
    assert_eq!(card.count(RED), 0);
    // A label on the account leaves out its photos and its avatar.
    w.profile(BOB, "Bob");
    w.gallery(BOB, "g1", &[ONE], json!({}));
    w.label(BOB, "spam");
    let card = w.card("/og/profile/bob.test/gallery/g1").await;
    assert_eq!(card.count(RED) + card.count(BLUE), 0);
}

#[tokio::test]
async fn what_is_not_shown_is_not_found() {
    let w = world().await;
    w.profile(ALICE, "Alice");
    let hidden = w.gallery(ALICE, "g1", &[ONE], json!({}));
    w.label(&hidden, "!hide");
    w.gallery(BOB, "g1", &[ONE], json!({}));
    w.story(BOB, "s1", json!({}));
    w.index.take_down(BOB).unwrap();
    for path in [
        "/og/profile/alice.test/gallery/g1",
        "/og/profile/alice.test/gallery/nope",
        "/og/profile/nobody.test/gallery/g1",
        "/og/profile/bob.test/gallery/g1",
        "/og/profile/bob.test",
        "/og/profile/nobody.test",
        "/og/profile/bob.test/story/s1",
        "/og/profile/alice.test/story/nope",
        "/og/profile/nobody.test/story/s1",
    ] {
        assert!(missing(&w.card(path).await), "{path}");
    }
}

#[tokio::test]
async fn a_profile_shows_a_photo_of_each_of_its_latest_galleries() {
    let w = world().await;
    w.profile(ALICE, "Alice");
    w.gallery(ALICE, "g1", &[ONE, TWO], json!({}));
    let labeled = w.gallery(ALICE, "g2", &[ONE], json!({}));
    w.label(&labeled, "nudity");
    let self_labels = json!({"labels": {"$type": "com.atproto.label.defs#selfLabels", "values": [{"val": "nudity"}]}});
    w.gallery(ALICE, "g3", &[ONE], self_labels);
    // The one gallery left fills the frame with its first photo.
    let card = w.card("/og/profile/alice.test").await;
    assert_eq!(card.at(600, 265), RED);
    assert_eq!(card.at(52, 574), BLUE);
    // An account labeled shows neither.
    w.label(
        &format!("at://{ALICE}/social.grain.actor.profile/self"),
        "spam",
    );
    let card = w.card(&format!("/og/profile/{ALICE}")).await;
    assert_eq!(card.count(RED) + card.count(BLUE), 0);
    // An account with no profile, and no handle that is one, is named by
    // its DID.
    w.index.track("did:plc:carol").unwrap();
    let card = w.card("/og/profile/did:plc:carol").await;
    assert!(!missing(&card));
    assert_eq!(card.count(BLUE), 0);
}

#[tokio::test]
async fn a_story_shows_its_photo_on_black() {
    let w = world().await;
    w.profile(ALICE, "Alice");
    w.story(ALICE, "s1", json!({}));
    let card = w.card("/og/profile/alice.test/story/s1").await;
    assert_eq!(card.at(600, 300), RED);
    assert_eq!(card.at(10, 300), BLACK, "contained, not cut");
    assert_eq!(card.at(46, 592), BLUE, "the avatar");
    // With a label, the story's author along the foot is all it shows.
    let self_labels = json!({"labels": {"$type": "com.atproto.label.defs#selfLabels", "values": [{"val": "nudity"}]}});
    w.story(ALICE, "s2", self_labels);
    let card = w.card("/og/profile/alice.test/story/s2").await;
    assert_eq!(card.count(RED), 0);
    assert_eq!(card.at(600, 300), BLACK);
    // An author with no profile is named by their handle.
    w.story(BOB, "s1", json!({}));
    let card = w.card("/og/profile/bob.test/story/s1").await;
    assert_eq!(card.count(BLUE), 0);
    assert_eq!(card.at(600, 300), RED);
}

#[tokio::test]
async fn a_card_needs_an_index_that_reads() {
    let ctx = Ctx::new(Env::from_vars(|_| None));
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let base = format!("http://{}", listener.local_addr().unwrap());
    tokio::spawn(grain_serve::serve(listener, Arc::new(App::bare(ctx))));
    let res = reqwest::get(format!("{base}/og/profile/alice.test"))
        .await
        .unwrap();
    assert_eq!(res.status(), 404);

    let w = world().await;
    w.index
        .read(|db| db.execute_batch("DROP TABLE label"))
        .unwrap();
    assert_eq!(w.status("/og/profile/alice.test/gallery/g1").await, 500);
}

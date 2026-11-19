//! The Bluesky cross-post, against the reference PDS: a browser logged in
//! through [`web`]'s site asks `social.grain.gallery.getCrossPost` for the
//! post sharing a gallery or a story, writes it as an `app.bsky.feed.post`
//! through `social.grain.repo.*`, as the web and the apps do, and the
//! gallery it links to says so straight after.

#[path = "../../grain/tests/common/mod.rs"]
mod net;

mod common;
mod web;

use base64::Engine;
use serde_json::{Value, json};
use web::{Jar, Site, site};

/// One pixel, as a PNG.
const PNG: &str = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

const POST: &str = "app.bsky.feed.post";
const NOW: &str = "2026-10-31T12:00:00.000Z";

/// An account logged in on the site, by its cookie.
struct Browser {
    site: Site,
    account: net::Account,
    cookie: String,
}

impl Browser {
    async fn new() -> Browser {
        let site = site().await;
        let account = net::account().await;
        let mut jar = Jar::default();
        site.log_in(&mut jar, &account).await;
        let cookie = jar.header();
        Browser {
            site,
            account,
            cookie,
        }
    }

    fn headers(&self) -> [(&str, &str); 2] {
        [
            ("cookie", self.cookie.as_str()),
            ("origin", self.site.url.as_str()),
        ]
    }

    /// `social.grain.repo.<method>`'s answer to `body`.
    async fn write(&self, method: &str, body: Value) -> (u16, Value) {
        let path = format!("/xrpc/social.grain.repo.{method}");
        self.site
            .served
            .post_headed(&path, &self.headers(), &body)
            .await
    }

    /// The URI of `record`, made in `collection`.
    async fn create(&self, collection: &str, record: Value) -> String {
        let body = json!({ "collection": collection, "record": record });
        let (status, made) = self.write("createRecord", body).await;
        assert_eq!(status, 200, "{made}");
        made["uri"].as_str().unwrap().to_string()
    }

    /// The blob of `bytes`, uploaded.
    async fn upload(&self, bytes: Vec<u8>, media_type: &str) -> Value {
        let [cookie, origin] = self.headers();
        let headers = [cookie, origin, ("content-type", media_type)];
        let path = "/xrpc/social.grain.repo.uploadBlob";
        let (status, uploaded) = self.site.served.post_bytes(path, &headers, bytes).await;
        assert_eq!(status, 200, "{uploaded}");
        uploaded["blob"].clone()
    }

    /// A gallery titled `title` of `photos` photos of `blob`, with `extra`.
    async fn gallery(&self, title: &str, photos: usize, blob: &Value, extra: Value) -> String {
        let mut record = json!({ "title": title, "createdAt": NOW });
        record
            .as_object_mut()
            .unwrap()
            .extend(extra.as_object().unwrap().clone());
        let gallery = self.create("social.grain.gallery", record).await;
        for position in 0..photos {
            let photo = json!({
                "photo": blob, "alt": format!("hill {position}"),
                "aspectRatio": { "width": 4, "height": 3 }, "createdAt": NOW,
            });
            let photo = self.create("social.grain.photo", photo).await;
            let item = json!({ "gallery": gallery, "item": photo, "position": position, "createdAt": NOW });
            self.create("social.grain.gallery.item", item).await;
        }
        gallery
    }

    /// `getCrossPost`'s answer for `subject`.
    async fn cross_post(&self, subject: &str) -> (u16, Value) {
        let path = format!("/xrpc/social.grain.gallery.getCrossPost?subject={subject}");
        self.site.served.get(&path).await
    }

    /// The post written, and its URI.
    async fn post(&self, post: &Value) -> String {
        self.create(POST, post.clone()).await
    }
}

fn rkey(uri: &str) -> &str {
    uri.rsplit('/').next().unwrap()
}

/// The text of `post` each of its facets spans, and what it says.
fn faceted(post: &Value) -> Vec<(String, Value)> {
    let text = post["text"].as_str().unwrap().as_bytes();
    let facets = post["facets"].as_array().unwrap();
    facets
        .iter()
        .map(|f| {
            let start = f["index"]["byteStart"].as_u64().unwrap() as usize;
            let end = f["index"]["byteEnd"].as_u64().unwrap() as usize;
            let span = String::from_utf8(text[start..end].to_vec()).unwrap();
            (span, f["features"][0].clone())
        })
        .collect()
}

#[tokio::test]
async fn a_gallery_is_shared_with_its_photos_and_linked_from_it() {
    let b = Browser::new().await;
    let png = base64::engine::general_purpose::STANDARD
        .decode(PNG)
        .unwrap();
    let blob = b.upload(png, "image/png").await;
    let labels = json!({
        "$type": "com.atproto.label.defs#selfLabels",
        "values": [{ "val": "nudity" }],
    });
    let description = json!({
        "description": "left out",
        "labels": labels,
        "location": { "value": "8a2a1072b59ffff", "name": "Fushimi Inari Taisha" },
        "address": { "locality": "Kyoto", "country": "JP" },
    });
    // A mention of an account the index knows is linked; one it does not, not.
    let title = format!("fog #mist @{} @nobody.invalid", b.account.handle);
    let gallery = b.gallery(&title, 2, &blob, description).await;

    let (status, said) = b.cross_post(&gallery).await;
    assert_eq!(status, 200, "{said}");
    let post = &said["post"];
    // The title, the place, then the tag and the link; the description left out.
    let text = post["text"].as_str().unwrap();
    let (head, link) = text.split_once("\n\n#GrainSocial ").unwrap();
    let place = "📍 Fushimi Inari Taisha, Kyoto, JP";
    assert_eq!(head, format!("{title}\n\n{place}"));
    assert!(
        link.starts_with(&format!("{}/profile/", b.site.url)),
        "{link}"
    );
    assert!(
        link.ends_with(&format!("/gallery/{}", rkey(&gallery))),
        "{link}"
    );
    assert_eq!(
        faceted(post),
        [
            (
                "#mist".to_string(),
                json!({ "$type": "app.bsky.richtext.facet#tag", "tag": "mist" })
            ),
            (
                format!("@{}", b.account.handle),
                json!({ "$type": "app.bsky.richtext.facet#mention", "did": b.account.did })
            ),
            (
                "#GrainSocial".to_string(),
                json!({ "$type": "app.bsky.richtext.facet#tag", "tag": "GrainSocial" })
            ),
            (
                link.to_string(),
                json!({ "$type": "app.bsky.richtext.facet#link", "uri": link })
            ),
        ]
    );
    // Its photos, in order, by the blobs they hold; its labels its own.
    assert_eq!(post["embed"]["$type"], "app.bsky.embed.images");
    let images = post["embed"]["images"].as_array().unwrap();
    assert_eq!(images.len(), 2);
    assert_eq!(images[0]["image"], blob);
    assert_eq!(images[0]["alt"], "hill 0");
    assert_eq!(images[1]["alt"], "hill 1");
    assert_eq!(images[0]["aspectRatio"], json!({ "width": 4, "height": 3 }));
    assert_eq!(post["labels"], labels);
    assert_eq!(post["tags"], json!(["grainsocial"]));

    // Written as it is, it fits Bluesky's lexicon, and the PDS takes it.
    let uri = b.post(post).await;
    assert!(uri.starts_with(&format!("at://{}/{POST}/", b.account.did)));
    let at_pds = reqwest::Client::new()
        .get(format!(
            "{}/xrpc/com.atproto.repo.getRecord",
            net::net().pds
        ))
        .query(&[
            ("repo", b.account.did.as_str()),
            ("collection", POST),
            ("rkey", rkey(&uri)),
        ])
        .send()
        .await
        .unwrap()
        .json::<Value>()
        .await
        .unwrap();
    assert_eq!(at_pds["value"]["text"], text);
    assert_eq!(at_pds["value"]["embed"]["images"][0]["image"], blob);

    // The gallery links to it straight after, as the index holds it.
    let read = format!("/xrpc/social.grain.gallery.getGallery?gallery={gallery}");
    let (status, view) = b.site.served.get(&read).await;
    assert_eq!(status, 200, "{view}");
    assert_eq!(
        view["gallery"]["crossPost"]["url"],
        format!(
            "https://bsky.app/profile/{}/post/{}",
            b.account.did,
            rkey(&uri)
        )
    );

    // Put again at its key, as a publish resumed puts it, it is replaced.
    let mut again = at_pds["value"].clone();
    again["createdAt"] = "2026-10-31T12:00:02.000Z".into();
    let body = json!({ "collection": POST, "rkey": rkey(&uri), "record": again });
    let (status, put) = b.write("putRecord", body).await;
    assert_eq!(status, 200, "{put}");
    assert_eq!(put["uri"], uri);

    // One that does not fit Bluesky's lexicon is refused before it is made.
    let long = json!({ "text": "x".repeat(3001), "createdAt": NOW });
    let (status, said) = b
        .write(
            "createRecord",
            json!({ "collection": POST, "record": long }),
        )
        .await;
    assert_eq!(
        (status, said["error"].as_str()),
        (400, Some("InvalidRecord"))
    );
}

#[tokio::test]
async fn more_than_four_photos_are_a_bluesky_gallery_and_a_story_is_its_photo() {
    let b = Browser::new().await;
    let png = base64::engine::general_purpose::STANDARD
        .decode(PNG)
        .unwrap();
    let blob = b.upload(png, "image/png").await;
    let gallery = b.gallery("hills", 11, &blob, json!({})).await;

    // The first ten of its eleven, as many as Bluesky has clients post.
    let (status, said) = b.cross_post(&gallery).await;
    assert_eq!(status, 200, "{said}");
    let post = &said["post"];
    assert_eq!(post["embed"]["$type"], "app.bsky.embed.gallery");
    let items = post["embed"]["items"].as_array().unwrap();
    assert_eq!(items.len(), 10);
    assert_eq!(
        items[9],
        json!({
            "$type": "app.bsky.embed.gallery#image",
            "image": blob,
            "alt": "hill 9",
            "aspectRatio": { "width": 4, "height": 3 },
        })
    );
    // Written as it is, Bluesky's lexicon and the PDS take it.
    b.post(post).await;

    // A story is the tag, the link and its photo.
    let story =
        json!({ "media": blob, "aspectRatio": { "width": 1, "height": 1 }, "createdAt": NOW });
    let story = b.create("social.grain.story", story).await;
    let (status, said) = b.cross_post(&story).await;
    assert_eq!(status, 200, "{said}");
    let text = said["post"]["text"].as_str().unwrap();
    let link = text.strip_prefix("#GrainSocial ").unwrap();
    assert!(
        link.ends_with(&format!("/story/{}", rkey(&story))),
        "{link}"
    );
    assert_eq!(said["post"]["embed"]["images"][0]["image"], blob);
    b.post(&said["post"]).await;

    // Nothing to share where there is no gallery or story, or no record
    // at all, or no account the index knows.
    let did = &b.account.did;
    for subject in [
        format!("at://{did}/social.grain.gallery/3zzzzzzzzzzzz"),
        format!("at://{did}/social.grain.photo/3zzzzzzzzzzzz"),
        format!("at://{did}"),
        "at://did:plc:aaaaaaaaaaaaaaaaaaaaaaaa/social.grain.gallery/3zzzzzzzzzzzz".to_string(),
    ] {
        let (status, said) = b.cross_post(&subject).await;
        assert_eq!((status, said["error"].as_str()), (400, Some("NotFound")));
    }
    // A server with no public URL to link to does not serve it.
    let path = format!("/xrpc/social.grain.gallery.getCrossPost?subject={gallery}");
    let (status, said) = common::served().await.get(&path).await;
    assert_eq!(
        (status, said["error"].as_str()),
        (501, Some("MethodNotImplemented"))
    );
}

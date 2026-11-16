//! The Bluesky cross-post, against the reference PDS: a browser logged in
//! through [`web`]'s site posts an `app.bsky.feed.post` with its pictures,
//! as the web's create, edit and story flows do, through
//! `social.grain.repo.*`, and the gallery it links to says so straight
//! after.

#[path = "../../grain/tests/common/mod.rs"]
mod net;

mod common;
mod web;

use base64::Engine;
use serde_json::{Value, json};
use web::{Jar, site};

/// One pixel, as a PNG.
const PNG: &str = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

const POST: &str = "app.bsky.feed.post";

#[tokio::test]
async fn a_cross_post_is_written_with_its_pictures_and_linked_from_its_gallery() {
    let site = site().await;
    let account = net::account().await;
    let mut jar = Jar::default();
    site.log_in(&mut jar, &account).await;
    let cookie = jar.header();
    let headers = [("cookie", cookie.as_str()), ("origin", site.url.as_str())];
    let call = |method: &str, body: Value| {
        let path = format!("/xrpc/social.grain.repo.{method}");
        let served = &site.served;
        async move { served.post_headed(&path, &headers, &body).await }
    };

    // The gallery, written as the web writes one.
    let gallery = json!({ "title": "fog", "createdAt": "2026-10-31T12:00:00.000Z" });
    let body = json!({ "collection": "social.grain.gallery", "record": gallery });
    let (status, made) = call("createRecord", body).await;
    assert_eq!(status, 200, "{made}");
    let rkey = made["uri"].as_str().unwrap().rsplit('/').next().unwrap();

    // Its picture, uploaded for the post to embed.
    let png = base64::engine::general_purpose::STANDARD
        .decode(PNG)
        .unwrap();
    let path = "/xrpc/social.grain.repo.uploadBlob";
    let with_type = [headers[0], headers[1], ("content-type", "image/png")];
    let (status, uploaded) = site.served.post_bytes(path, &with_type, png).await;
    assert_eq!(status, 200, "{uploaded}");

    // The post, as `web/src/lib/utils/bsky-post.ts` makes it.
    let link = format!(
        "https://grain.social/profile/{}/gallery/{rkey}",
        account.did
    );
    let text = format!("fog\n\n#GrainSocial {link}");
    let start = text.find('#').unwrap();
    let tag_end = start + "#GrainSocial".len();
    let post = json!({
        "text": text,
        "facets": [
            {
                "index": { "byteStart": start, "byteEnd": tag_end },
                "features": [{ "$type": "app.bsky.richtext.facet#tag", "tag": "GrainSocial" }],
            },
            {
                "index": { "byteStart": tag_end + 1, "byteEnd": text.len() },
                "features": [{ "$type": "app.bsky.richtext.facet#link", "uri": link }],
            },
        ],
        "embed": {
            "$type": "app.bsky.embed.images",
            "images": [{ "image": uploaded["blob"], "alt": "", "aspectRatio": { "width": 1, "height": 1 } }],
        },
        "tags": ["grainsocial"],
        "createdAt": "2026-10-31T12:00:01.000Z",
    });
    let (status, posted) = call(
        "createRecord",
        json!({ "collection": POST, "record": post }),
    )
    .await;
    assert_eq!(status, 200, "{posted}");
    let uri = posted["uri"].as_str().unwrap();
    assert!(uri.starts_with(&format!("at://{}/{POST}/", account.did)));
    let at_pds = reqwest::Client::new()
        .get(format!(
            "{}/xrpc/com.atproto.repo.getRecord",
            net::net().pds
        ))
        .query(&[
            ("repo", account.did.as_str()),
            ("collection", POST),
            ("rkey", uri.rsplit('/').next().unwrap()),
        ])
        .send()
        .await
        .unwrap()
        .json::<Value>()
        .await
        .unwrap();
    assert_eq!(at_pds["value"]["text"], text.as_str());
    assert_eq!(at_pds["value"]["embed"]["$type"], "app.bsky.embed.images");

    // The gallery links to it straight after, as the index holds it.
    let read = format!(
        "/xrpc/social.grain.gallery.getGallery?gallery=at://{}/social.grain.gallery/{rkey}",
        account.did
    );
    let (status, view) = site.served.get(&read).await;
    assert_eq!(status, 200, "{view}");
    let post_rkey = uri.rsplit('/').next().unwrap();
    assert_eq!(
        view["gallery"]["crossPost"]["url"],
        format!("https://bsky.app/profile/{}/post/{post_rkey}", account.did)
    );

    // Put again at its key, as a publish resumed puts it, it is replaced.
    let mut again = at_pds["value"].clone();
    again["createdAt"] = "2026-10-31T12:00:02.000Z".into();
    let body = json!({ "collection": POST, "rkey": post_rkey, "record": again });
    let (status, put) = call("putRecord", body).await;
    assert_eq!(status, 200, "{put}");
    assert_eq!(put["uri"], uri);

    // One that does not fit Bluesky's lexicon is refused before it is made.
    let long = json!({ "text": "x".repeat(3001), "createdAt": "2026-10-31T12:00:03.000Z" });
    let (status, said) = call(
        "createRecord",
        json!({ "collection": POST, "record": long }),
    )
    .await;
    assert_eq!(
        (status, said["error"].as_str()),
        (400, Some("InvalidRecord"))
    );
}

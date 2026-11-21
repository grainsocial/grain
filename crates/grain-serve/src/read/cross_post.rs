//! `social.grain.gallery.getCrossPost`: the Bluesky post that shares a
//! gallery or a story, which its author writes to their own repo, so the
//! web and the apps post alike and only here says how.
//!
//! The text is the title, if there is one, then where it was, as its view
//! shows the place, then `#GrainSocial` and the link, the title cut with
//! `…` to fit Bluesky's 300 graphemes and 3000 bytes; tags, links and
//! mentions of accounts the index knows are its facets. The photos are
//! embedded by the blobs their records hold, already in the author's
//! repo: up to four as `app.bsky.embed.images`,
//! which every Bluesky client shows, and more as `app.bsky.embed.gallery`,
//! its first ten, as many as Bluesky has clients post. The post carries
//! the subject's self-labels.
//!
//! The link stays in the text: [`super::views`] finds a cross-post by it.

use super::gallery::gallery_sql;
use super::story::story_sql;
use super::views::{gallery_title, put};
use super::{Params, Reader, params};
use crate::App;
use crate::index::records::{self, Gallery, Photo, Story};
use crate::xrpc::Failure;
use axum::Json;
use axum::extract::State;
use axum::http::{StatusCode, Uri};
use serde_json::{Value, json};
use std::sync::Arc;
use unicode_segmentation::UnicodeSegmentation;

pub const NSID: &str = "social.grain.gallery.getCrossPost";

/// The most photos `app.bsky.embed.images` holds.
const MAX_IMAGES: usize = 4;

/// The most photos Bluesky has clients put in `app.bsky.embed.gallery`,
/// short of the twenty its lexicon allows.
const MAX_GALLERY: usize = 10;

/// `app.bsky.feed.post`'s bounds on its text.
const MAX_GRAPHEMES: usize = 300;
const MAX_BYTES: usize = 3000;

/// The most of a place a post shows, so the title keeps some room.
const MAX_PLACE: usize = 100;

/// The photos of the gallery `?1`, in order.
const PHOTOS_SQL: &str = "SELECT p.* FROM gallery_item i JOIN photo p ON p.uri = i.item
                          WHERE i.gallery = ?1 ORDER BY i.position, i.uri";

/// `social.grain.gallery.getCrossPost`, on a server with a public URL to
/// link to.
pub async fn get_cross_post(State(app): State<Arc<App>>, uri: Uri) -> Result<Json<Value>, Failure> {
    let (Some(index), Some(web)) = (&app.index, &app.web) else {
        let why = "this server has no index or no public URL";
        return Err(Failure::new(
            StatusCode::NOT_IMPLEMENTED,
            "MethodNotImplemented",
            why,
        ));
    };
    let params = params(&uri);
    index.read(|db| {
        let reader = Reader {
            db,
            cdn: &app.cdn,
            rankings: &app.rankings,
            viewer: None,
            service: app.did.as_deref(),
        };
        cross_post(&reader, &params, &web.public_url).map(Json)
    })
}

fn not_found() -> Failure {
    Failure::new(
        StatusCode::BAD_REQUEST,
        "NotFound",
        "Nothing to share there",
    )
}

/// The post sharing the `subject`, linked to on `site`.
fn cross_post(r: &Reader, p: &Params, site: &str) -> Result<Value, Failure> {
    let uri = r.record_uri(p, "subject")?;
    let mut parts = uri["at://".len()..].splitn(3, '/');
    let (Some(did), Some(collection), Some(rkey)) = (parts.next(), parts.next(), parts.next())
    else {
        return Err(not_found());
    };
    // Linked to by handle, as the pages are, where it has a good one.
    let handles: Vec<(Option<String>,)> = r.all("SELECT handle FROM repo WHERE did = ?1", [did])?;
    let actor = match handles.into_iter().next().and_then(|(h,)| h) {
        Some(h) if h != "handle.invalid" => h,
        _ => did.to_string(),
    };
    let (text, photos, labels) = match collection {
        "social.grain.gallery" => {
            let gallery = r.rows::<Gallery>(&gallery_sql(), [&uri])?.pop();
            let gallery = gallery.ok_or_else(not_found)?;
            let photos = r.rows::<Photo>(PHOTOS_SQL, [&uri])?.into_iter().map(|p| {
                let alt = p.record.alt.unwrap_or_default();
                image(p.record.photo.0, alt, p.record.aspect_ratio.0)
            });
            let url = format!("{site}/profile/{actor}/gallery/{rkey}");
            let place = place(
                gallery.record.location.as_ref(),
                gallery.record.address.as_ref(),
            );
            let text = text(&url, &gallery_title(&gallery.record), &place);
            (text, photos.collect(), gallery.record.labels)
        }
        "social.grain.story" => {
            let story = r.rows::<Story>(&story_sql(), [&uri])?.pop();
            let story = story.ok_or_else(not_found)?;
            let url = format!("{site}/profile/{actor}/story/{rkey}");
            let place = place(
                story.record.location.as_ref(),
                story.record.address.as_ref(),
            );
            let media = story.record.media.0;
            let photo = image(media, String::new(), story.record.aspect_ratio.0);
            (text(&url, "", &place), vec![photo], story.record.labels)
        }
        _ => return Err(not_found()),
    };
    let facets = facets(r, &text)?;
    let mut post = json!({
        "$type": "app.bsky.feed.post",
        "text": text,
        "tags": ["grainsocial"],
        "createdAt": grain::keys::now_iso(),
    });
    put(&mut post, "facets", (!facets.is_empty()).then_some(facets));
    put(&mut post, "embed", embed(photos));
    put(&mut post, "labels", labels.map(|l| l.0));
    Ok(json!({ "post": post }))
}

/// One photo, as both embeds hold it.
fn image(blob: Value, alt: String, aspect_ratio: Value) -> Value {
    json!({ "image": blob, "alt": alt, "aspectRatio": aspect_ratio })
}

/// The embed of `photos`: [`MAX_IMAGES`] or fewer as
/// `app.bsky.embed.images`, more as `app.bsky.embed.gallery`, its first
/// [`MAX_GALLERY`]; none where there are none.
fn embed(photos: Vec<Value>) -> Option<Value> {
    match photos.len() {
        0 => None,
        1..=MAX_IMAGES => Some(json!({ "$type": "app.bsky.embed.images", "images": photos })),
        _ => {
            let items: Vec<Value> = photos
                .into_iter()
                .take(MAX_GALLERY)
                .map(|mut photo| {
                    photo["$type"] = "app.bsky.embed.gallery#image".into();
                    photo
                })
                .collect();
            Some(json!({ "$type": "app.bsky.embed.gallery", "items": items }))
        }
    }
}

/// Where a gallery or story was, as its view shows it; nothing where it
/// does not say.
fn place(location: Option<&records::Json>, address: Option<&records::Json>) -> String {
    let address = address.map_or(&Value::Null, |a| &a.0);
    location.map_or_else(String::new, |l| super::place::display(&l.0, address))
}

/// The post's text: `title`, cut to leave room, then `place` and
/// `#GrainSocial` and the `url`, each a paragraph; those alone where there
/// is no title, and no place where it is empty.
fn text(url: &str, title: &str, place: &str) -> String {
    let mut suffix = format!("#GrainSocial {url}");
    let place = grain::lexicon::cut(place.trim(), MAX_PLACE);
    if !place.is_empty() {
        suffix = format!("📍 {place}\n\n{suffix}");
    }
    let title = title.trim();
    // The two newlines between them count as well.
    let room = MAX_GRAPHEMES.saturating_sub(suffix.graphemes(true).count() + 2);
    let bytes = MAX_BYTES.saturating_sub(suffix.len() + 2);
    if title.is_empty() || room < 2 {
        return suffix;
    }
    let mut cut: Vec<&str> = title.graphemes(true).collect();
    if cut.len() > room {
        cut.truncate(room - 1);
        cut.push("…");
    }
    while cut.concat().len() > bytes && cut.len() > 1 {
        cut.truncate(cut.len() - 2);
        cut.push("…");
    }
    format!("{}\n\n{suffix}", cut.concat())
}

/// The facets of `text`: each word a link, a tag, or a mention of an
/// account the index knows, its punctuation after it left out.
fn facets(r: &Reader, text: &str) -> Result<Vec<Value>, Failure> {
    let mut facets = vec![];
    for word in text.split_whitespace() {
        let word = word.trim_end_matches(|c: char| ".,;:!?\"')…".contains(c));
        let feature = if word.starts_with("https://") || word.starts_with("http://") {
            Some(json!({ "$type": "app.bsky.richtext.facet#link", "uri": word }))
        } else if let Some(tag) = word.strip_prefix('#').filter(|t| is_tag(t)) {
            Some(json!({ "$type": "app.bsky.richtext.facet#tag", "tag": tag }))
        } else if let Some(handle) = word.strip_prefix('@').filter(|h| h.contains('.')) {
            let did = r.resolve(handle)?;
            did.map(|did| json!({ "$type": "app.bsky.richtext.facet#mention", "did": did }))
        } else {
            None
        };
        if let Some(feature) = feature {
            // Where the word is in `text`, which it is a slice of.
            let start = word.as_ptr() as usize - text.as_ptr() as usize;
            facets.push(json!({
                "index": { "byteStart": start, "byteEnd": start + word.len() },
                "features": [feature],
            }));
        }
    }
    Ok(facets)
}

/// Whether `tag` reads as a hashtag: a letter, then letters, digits and
/// underscores, no longer than Bluesky's 64 graphemes.
fn is_tag(tag: &str) -> bool {
    tag.chars().next().is_some_and(char::is_alphabetic)
        && tag.chars().all(|c| c.is_alphanumeric() || c == '_')
        && tag.graphemes(true).count() <= 64
}

#[cfg(test)]
mod tests {
    use super::*;

    const URL: &str = "https://grain.social/profile/alice.test/gallery/3aaaaaaaaaaaa";

    #[test]
    fn the_text_is_the_title_the_place_then_the_tag_and_the_link() {
        let said = text(URL, " fog ", "Fushimi Inari, Kyoto, JP");
        let place = "📍 Fushimi Inari, Kyoto, JP";
        assert_eq!(said, format!("fog\n\n{place}\n\n#GrainSocial {URL}"));
        assert_eq!(
            text(URL, " fog ", " "),
            format!("fog\n\n#GrainSocial {URL}")
        );
        assert_eq!(text(URL, "  ", ""), format!("#GrainSocial {URL}"));
        let story = text(URL, "", "Kyoto, JP");
        assert_eq!(story, format!("📍 Kyoto, JP\n\n#GrainSocial {URL}"));
    }

    #[test]
    fn a_long_title_is_cut_to_fit_the_graphemes_and_a_long_place_to_leave_it_room() {
        let said = text(URL, &"🌫️".repeat(400), "");
        assert_eq!(said.graphemes(true).count(), MAX_GRAPHEMES);
        assert!(said.ends_with(&format!("…\n\n#GrainSocial {URL}")));
        let said = text(URL, "fog", &"x".repeat(400));
        let place = format!("📍 {}\n\n", "x".repeat(MAX_PLACE));
        assert_eq!(said, format!("fog\n\n{place}#GrainSocial {URL}"));
    }

    #[test]
    fn a_title_of_wide_graphemes_is_cut_to_fit_the_bytes() {
        // A family is one grapheme of 25 bytes: the bytes run out first.
        let said = text(URL, &"👨‍👩‍👧‍👦".repeat(300), "Kyoto");
        assert!(said.len() <= MAX_BYTES, "{}", said.len());
        assert!(said.ends_with(&format!("…\n\n📍 Kyoto\n\n#GrainSocial {URL}")));
    }

    #[test]
    fn a_place_is_as_its_view_shows_it() {
        let location = records::Json(
            json!({ "value": "8a2a1072b59ffff", "name": "Fushimi Inari Taisha, Kyoto" }),
        );
        let address = records::Json(json!({ "locality": "Kyoto", "country": "Japan" }));
        assert_eq!(
            place(Some(&location), Some(&address)),
            "Fushimi Inari Taisha, Kyoto, JP"
        );
        assert_eq!(place(Some(&location), None), "Fushimi Inari Taisha, Kyoto");
        assert_eq!(place(None, Some(&address)), "");
    }

    #[test]
    fn a_tag_is_a_letter_then_word_characters() {
        assert!(is_tag("GrainSocial") && is_tag("東京") && is_tag("film_35"));
        assert!(!is_tag("") && !is_tag("35mm") && !is_tag("a-b"));
    }

    #[test]
    fn four_photos_are_images_and_more_a_gallery_of_ten() {
        let photos = |n: usize| -> Vec<Value> {
            (0..n)
                .map(|i| image(json!(i), String::new(), json!({})))
                .collect()
        };
        assert_eq!(embed(vec![]), None);
        let four = embed(photos(4)).unwrap();
        assert_eq!(four["$type"], "app.bsky.embed.images");
        assert_eq!(four["images"].as_array().unwrap().len(), 4);
        let twelve = embed(photos(12)).unwrap();
        assert_eq!(twelve["$type"], "app.bsky.embed.gallery");
        let items = twelve["items"].as_array().unwrap();
        assert_eq!(items.len(), MAX_GALLERY);
        assert_eq!(items[0]["$type"], "app.bsky.embed.gallery#image");
        assert_eq!(
            (items[0]["image"].clone(), items[9]["image"].clone()),
            (json!(0), json!(9))
        );
    }
}

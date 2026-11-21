//! OpenGraph cards: the picture a link to a profile, a gallery or a story
//! unfurls into, at `/og/profile/<actor>`, `/og/profile/<actor>/gallery/<rkey>`
//! and `/og/profile/<actor>/story/<rkey>`, the actor a handle or a DID, as
//! the web's pages name them in `og:image`.
//!
//! A profile's card scatters the first photo of each of its ten latest
//! galleries over the frame ([`collage`]), a gallery's up to six of its
//! photos, each above a bar of the avatar, the name and handle, and
//! grain's name; a story's is the story's photo, whole on black, its
//! author along the foot. The images are the CDN's ([`crate::cdn`]),
//! fetched as the card is drawn.
//!
//! A card goes wherever the link does, and cannot blur or warn, so what a
//! label touches is left out of it: an account taken down, or gone from
//! its host, or a gallery or story with a label that hides, has a card
//! that says it is not found; a gallery or story with any label standing,
//! from grain's labeler or its author, shows no photos, and an account
//! with a label shows neither its photos nor its avatar.
//!
//! Each card is drawn once in five minutes at most: kept here by its path
//! for that long, and sent with `Cache-Control: public, max-age=300`.

pub mod collage;
pub mod draw;

use crate::App;
use crate::cdn::{AVATAR, FULLSIZE, THUMBNAIL};
use crate::index::Row;
use crate::index::records::{Gallery, Photo, Story};
use crate::read::Reader;
use crate::read::moderation::{shown, unhidden, unhidden_by_author, unlabeled};
use axum::Router;
use axum::extract::{Path, State};
use axum::http::{StatusCode, Uri, header};
use axum::response::{IntoResponse, Response};
use axum::routing::get;
use base64::Engine;
use base64::engine::general_purpose::STANDARD;
use draw::{Font, Style, Svg, fit};
use std::collections::{HashMap, VecDeque};
use std::sync::{Arc, LazyLock, Mutex};
use std::time::{Duration, Instant};

/// How long a card is kept, and may be cached.
pub const KEPT: Duration = Duration::from_secs(300);
/// How many cards are kept at once.
const KEEP: usize = 200;

const INK: &str = "#171717";
const MUTED: &str = "#525252";
const WHITE: &str = "#ffffff";

/// `router` with the cards' routes.
pub fn routes(router: Router<Arc<App>>) -> Router<Arc<App>> {
    router
        .route("/og/profile/{actor}", get(profile))
        .route("/og/profile/{actor}/gallery/{rkey}", get(gallery))
        .route("/og/profile/{actor}/story/{rkey}", get(story))
}

/// What a card shows, read from the index; its images by URL.
#[derive(Debug, Clone, PartialEq)]
pub enum Card {
    /// A line of text on white: what was asked for is not there to show.
    Missing(&'static str),
    /// Photos scattered over white, above a bar.
    Collage {
        title: String,
        handle: String,
        avatar: Option<String>,
        /// Each photo's URL and its width over its height.
        photos: Vec<(String, f64)>,
    },
    /// A story's photo on black, its author along the foot.
    Story {
        name: String,
        avatar: Option<String>,
        photo: Option<String>,
    },
}

impl Card {
    /// The URLs of the images it shows.
    fn urls(&self) -> Vec<&str> {
        match self {
            Card::Missing(_) => vec![],
            Card::Collage { avatar, photos, .. } => {
                let photos = photos.iter().map(|(url, _)| url.as_str());
                avatar.iter().map(String::as_str).chain(photos).collect()
            }
            Card::Story { avatar, photo, .. } => avatar
                .iter()
                .chain(photo.iter())
                .map(String::as_str)
                .collect(),
        }
    }
}

/// An image fetched: its media type, as its server named it, and bytes.
#[derive(Debug, Clone)]
pub struct Fetched {
    pub media_type: String,
    pub bytes: Arc<Vec<u8>>,
}

impl Fetched {
    /// The image as a `data:` URL, which a collage's seed is made of.
    fn data_url(&self) -> String {
        format!(
            "data:{};base64,{}",
            self.media_type,
            STANDARD.encode(&*self.bytes)
        )
    }
}

/// The account `actor` names, and how it reads on a card: its title, its
/// handle, its avatar's URL unless a label stands on it, and whether one
/// does.
struct Author {
    did: String,
    display_name: Option<String>,
    handle: String,
    avatar: Option<String>,
    labeled: bool,
}

impl Reader<'_> {
    /// The account `did`, as a card names it.
    fn author(&self, did: &str) -> rusqlite::Result<Author> {
        let mut actors = self.actors(&[did])?;
        let actor = actors.remove(did).expect("each account asked for");
        let profile_uri = format!("at://{did}/social.grain.actor.profile/self");
        let labeled = !self.labels(&[did, &profile_uri])?.is_empty();
        let handle = match actor.handle.as_str() {
            "handle.invalid" => did.chars().take(24).collect(),
            handle => handle.to_string(),
        };
        let profile = actor.profile.map(|p| p.record);
        let avatar = profile.as_ref().and_then(|p| p.avatar.as_ref());
        let avatar = avatar.filter(|_| !labeled);
        let avatar = avatar.and_then(|a| self.cdn.url(did, &a.0, AVATAR));
        Ok(Author {
            did: did.to_string(),
            display_name: profile
                .and_then(|p| p.display_name)
                .filter(|n| !n.is_empty()),
            handle,
            avatar,
            labeled,
        })
    }

    /// Whether a label stands on the record `uri`, from grain's labeler or
    /// its author.
    fn labeled(&self, uri: &str) -> rusqlite::Result<bool> {
        let given = !self.labels(&[uri])?.is_empty();
        let sql = "SELECT 1 FROM self_label WHERE uri = ?1";
        Ok(given || !self.all::<(i64,)>(sql, [uri])?.is_empty())
    }

    /// Each photo of `rows`, at its URL in `preset`: the CDN's whole one
    /// for a photo on its own, its thumbnail for more.
    fn photo_urls(&self, rows: Vec<Row<Photo>>) -> Vec<(String, f64)> {
        let preset = if rows.len() == 1 { FULLSIZE } else { THUMBNAIL };
        rows.into_iter()
            .filter_map(|p| {
                let url = self.cdn.url(&p.did, &p.record.photo.0, preset)?;
                // As the lexicon has it: two integers of at least one.
                let ratio = &p.record.aspect_ratio.0;
                let (w, h) = (ratio["width"].as_f64(), ratio["height"].as_f64());
                Some((url, w.unwrap_or(4.0) / h.unwrap_or(3.0)))
            })
            .collect()
    }

    /// The card of the account `actor`.
    pub fn profile_card(&self, actor: &str) -> rusqlite::Result<Card> {
        const MISSING: Card = Card::Missing("Profile not found");
        let Some(did) = self.resolve(actor)? else {
            return Ok(MISSING);
        };
        let sql = format!("SELECT 1 WHERE {}", shown("?1"));
        if self.all::<(i64,)>(&sql, [&did])?.is_empty() {
            return Ok(MISSING);
        }
        let author = self.author(&did)?;
        let photos = match author.labeled {
            true => vec![],
            false => self.rows::<Photo>(&profile_photos_sql(), [&did])?,
        };
        Ok(Card::Collage {
            title: author.display_name.unwrap_or_else(|| author.handle.clone()),
            handle: author.handle,
            avatar: author.avatar,
            photos: self.photo_urls(photos),
        })
    }

    /// The card of `actor`'s gallery `rkey`.
    pub fn gallery_card(&self, actor: &str, rkey: &str) -> rusqlite::Result<Card> {
        const MISSING: Card = Card::Missing("Gallery not found");
        let Some(did) = self.resolve(actor)? else {
            return Ok(MISSING);
        };
        let uri = format!("at://{did}/social.grain.gallery/{rkey}");
        let Some(gallery) = self.rows::<Gallery>(&gallery_sql(), [&uri])?.pop() else {
            return Ok(MISSING);
        };
        let author = self.author(&did)?;
        let photos = match author.labeled || self.labeled(&uri)? {
            true => vec![],
            false => self.rows::<Photo>(&gallery_photos_sql(), [&uri])?,
        };
        Ok(Card::Collage {
            title: crate::read::views::gallery_title(&gallery.record),
            handle: author.handle,
            avatar: author.avatar,
            photos: self.photo_urls(photos),
        })
    }

    /// The card of `actor`'s story `rkey`.
    pub fn story_card(&self, actor: &str, rkey: &str) -> rusqlite::Result<Card> {
        const MISSING: Card = Card::Missing("Story not found");
        let Some(did) = self.resolve(actor)? else {
            return Ok(MISSING);
        };
        let uri = format!("at://{did}/social.grain.story/{rkey}");
        let Some(story) = self.rows::<Story>(&story_sql(), [&uri])?.pop() else {
            return Ok(MISSING);
        };
        let author = self.author(&story.did)?;
        let photo = match author.labeled || self.labeled(&uri)? {
            true => None,
            false => self.cdn.url(&author.did, &story.record.media.0, FULLSIZE),
        };
        Ok(Card::Story {
            name: (author.display_name).unwrap_or_else(|| format!("@{}", author.handle)),
            avatar: author.avatar,
            photo,
        })
    }
}

/// The gallery `?1`, of an account shown, with no label that hides.
fn gallery_sql() -> String {
    format!(
        "SELECT * FROM gallery g WHERE g.uri = ?1 AND {} AND {} AND {}",
        shown("g.did"),
        unhidden("g.uri"),
        unhidden_by_author("g.uri")
    )
}

/// The story `?1`, of an account shown, with no label that hides.
fn story_sql() -> String {
    format!(
        "SELECT * FROM story s WHERE s.uri = ?1 AND {} AND {} AND {}",
        shown("s.did"),
        unhidden("s.uri"),
        unhidden_by_author("s.uri")
    )
}

/// The first six photos of the gallery `?1` that carry no label.
fn gallery_photos_sql() -> String {
    format!(
        "SELECT p.* FROM gallery_item i JOIN photo p ON p.uri = i.item
         WHERE i.gallery = ?1 AND {} ORDER BY i.position, i.uri LIMIT 6",
        unlabeled("p.uri")
    )
}

/// The first photo of each of `?1`'s ten latest galleries that carry no
/// label, theirs or their author's.
fn profile_photos_sql() -> String {
    format!(
        "SELECT p.* FROM gallery g
           JOIN gallery_item i ON i.gallery = g.uri AND i.position = 0
           JOIN photo p ON p.uri = i.item
         WHERE g.did = ?1 AND {} AND {}
           AND NOT EXISTS (SELECT 1 FROM self_label s WHERE s.uri = g.uri)
         ORDER BY g.created_at DESC, g.uri LIMIT 10",
        unlabeled("g.uri"),
        unlabeled("p.uri")
    )
}

/// The SVG of `card`, and the images it names, each fetched one of
/// `images` by its URL; one not fetched is left out.
pub fn svg(card: &Card, images: &HashMap<String, Fetched>) -> Svg {
    let image = |url: &Option<String>| url.as_ref().and_then(|u| images.get(u));
    match card {
        Card::Missing(what) => {
            let mut svg = Svg::new(WHITE);
            let style = Style::new(Font::Inter, 16.0, INK);
            let (ascent, height) = style.line();
            let y = draw::HEIGHT as f32 / 2.0 - height / 2.0 + ascent;
            svg.text(what, style, (draw::WIDTH as f32 / 2.0, y), 0.5);
            svg
        }
        Card::Collage {
            title,
            handle,
            avatar,
            photos,
        } => {
            let mut svg = Svg::new(WHITE);
            collage(&mut svg, photos, images);
            bar(&mut svg, title, handle, image(avatar));
            svg
        }
        Card::Story {
            name,
            avatar,
            photo,
        } => {
            let mut svg = Svg::new("#000000");
            let (w, h) = (draw::WIDTH as f32, draw::HEIGHT as f32);
            if let Some(photo) = image(photo) {
                svg.image(photo.bytes.clone(), (0.0, 0.0, w, h), false);
            }
            foot(&mut svg, name, image(avatar));
            svg
        }
    }
}

/// The frame photos are scattered in: the card less the bar, inset.
const PAD: f32 = 24.0;
const BAR: f32 = 100.0;

/// `photos`, those fetched, scattered over the frame above the bar.
fn collage(svg: &mut Svg, photos: &[(String, f64)], images: &HashMap<String, Fetched>) {
    let fetched: Vec<(&Fetched, f64)> = photos
        .iter()
        .filter_map(|(url, ratio)| Some((images.get(url)?, *ratio)))
        .collect();
    let items: Vec<collage::Item> = fetched
        .iter()
        .map(|(image, ratio)| collage::Item {
            key: image.data_url(),
            aspect_ratio: *ratio,
        })
        .collect();
    let width = draw::WIDTH as f32 - PAD * 2.0;
    let height = draw::HEIGHT as f32 - BAR - PAD * 2.0;
    for p in collage::layout(&items, width as f64, height as f64, 12.0) {
        let (x, y) = (p.x as f32 + PAD, p.y as f32 + PAD);
        let bytes = fetched[p.item].0.bytes.clone();
        svg.image(bytes, (x, y, p.width as f32, p.height as f32), true);
    }
}

/// The bar along a collage's foot: the avatar, the title and handle, and
/// grain's name at the right, centered on one another, 20 above the edge.
fn bar(svg: &mut Svg, title: &str, handle: &str, avatar: Option<&Fetched>) {
    const AVATAR: f32 = 56.0;
    const GAP: f32 = 16.0;
    let title_style = Style::new(Font::Inter, 36.0, INK);
    let handle_style = Style::new(Font::Inter, 20.0, MUTED);
    let brand = Style {
        spacing: -0.02 * 32.0,
        ..Style::new(Font::Syne, 32.0, INK)
    };
    let (title_ascent, title_height) = title_style.line();
    let (handle_ascent, handle_height) = handle_style.line();
    let (brand_ascent, brand_height) = brand.line();
    let text_height = title_height + 4.0 + handle_height;
    let row = AVATAR.max(text_height).max(brand_height);
    let middle = draw::HEIGHT as f32 - 20.0 - row / 2.0;

    let mut x = PAD;
    if let Some(avatar) = avatar {
        svg.round(
            avatar.bytes.clone(),
            (x + AVATAR / 2.0, middle, AVATAR / 2.0),
        );
        x += AVATAR + GAP;
    }
    let right = draw::WIDTH as f32 - PAD;
    let room = right - brand.measure("grain") - GAP - x;
    let top = middle - text_height / 2.0;
    let title = fit(title, Font::Inter, title_style.size, room);
    svg.text(&title, title_style, (x, top + title_ascent), 0.0);
    let handle = fit(&format!("@{handle}"), Font::Inter, handle_style.size, room);
    let below = top + title_height + 4.0 + handle_ascent;
    svg.text(&handle, handle_style, (x, below), 0.0);
    let y = middle - brand_height / 2.0 + brand_ascent;
    svg.text("grain", brand, (right, y), 1.0);
}

/// A story's foot: a shade, and over it the avatar, then the name above
/// grain's, their bottoms 16 above the edge.
fn foot(svg: &mut Svg, name: &str, avatar: Option<&Fetched>) {
    const AVATAR: f32 = 44.0;
    let (w, h) = (draw::WIDTH as f32, draw::HEIGHT as f32);
    svg.raw(&format!(
        r##"<linearGradient id="shade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.7"/></linearGradient><rect y="{}" width="{w}" height="80" fill="url(#shade)"/>"##,
        h - 80.0
    ));
    let bottom = h - 16.0;
    let mut x = PAD;
    if let Some(avatar) = avatar {
        let r = AVATAR / 2.0;
        svg.round(avatar.bytes.clone(), (x + r, bottom - r, r));
        x += AVATAR + 12.0;
    }
    let name_style = Style::new(Font::Inter, 24.0, WHITE);
    let brand = Style {
        spacing: -0.02 * 16.0,
        ..Style::new(Font::Syne, 16.0, "rgba(255,255,255,0.7)")
    };
    let (name_ascent, name_height) = name_style.line();
    let (brand_ascent, brand_height) = brand.line();
    let top = bottom - brand_height - 2.0 - name_height;
    let name = fit(name, Font::Inter, name_style.size, w - PAD - x);
    svg.text(&name, name_style, (x, top + name_ascent), 0.0);
    let y = top + name_height + 2.0 + brand_ascent;
    svg.text("grain", brand, (x, y), 0.0);
}

/// Cards drawn, by path, until they are [`KEPT`] too long; the oldest
/// dropped past [`KEEP`].
#[derive(Default)]
pub struct Cards {
    kept: Mutex<Kept>,
}

#[derive(Default)]
struct Kept {
    by_path: HashMap<String, (Instant, Arc<[u8]>)>,
    order: VecDeque<String>,
}

impl Cards {
    fn get(&self, path: &str, now: Instant) -> Option<Arc<[u8]>> {
        let kept = self.kept.lock().unwrap();
        let (at, png) = kept.by_path.get(path)?;
        (now.duration_since(*at) < KEPT).then(|| png.clone())
    }

    fn put(&self, path: &str, png: Arc<[u8]>, now: Instant) {
        let mut kept = self.kept.lock().unwrap();
        let Kept { by_path, order } = &mut *kept;
        if by_path.insert(path.to_string(), (now, png)).is_none() {
            order.push_back(path.to_string());
        }
        while order.len() > KEEP {
            let oldest = order.pop_front().expect("longer than KEEP");
            by_path.remove(&oldest);
        }
    }
}

/// How many cards are drawn at once: one a core, as each takes one.
static DRAWING: LazyLock<tokio::sync::Semaphore> = LazyLock::new(|| {
    let cores = std::thread::available_parallelism().map_or(1, |n| n.get());
    tokio::sync::Semaphore::new(cores)
});

/// The image at `url`, if its server answers with one.
async fn fetch(http: &reqwest::Client, url: &str) -> Option<Fetched> {
    let res = http.get(url).send().await.ok()?;
    if !res.status().is_success() {
        return None;
    }
    let media_type = res.headers().get(header::CONTENT_TYPE);
    let media_type = media_type
        .and_then(|v| v.to_str().ok())
        .unwrap_or("image/jpeg");
    let media_type = media_type.to_string();
    let bytes = res.bytes().await.ok()?;
    Some(Fetched {
        media_type,
        bytes: Arc::new(bytes.to_vec()),
    })
}

/// The card at `uri`, read from the index by `read`: kept, or drawn.
async fn answer(
    app: Arc<App>,
    uri: Uri,
    read: impl FnOnce(&Reader) -> rusqlite::Result<Card>,
) -> Response {
    let Some(index) = &app.index else {
        return StatusCode::NOT_FOUND.into_response();
    };
    let path = uri.path().to_string();
    let png = match app.cards.get(&path, Instant::now()) {
        Some(png) => png,
        None => {
            let card = index.read(|db| {
                read(&Reader {
                    db,
                    cdn: &app.cdn,
                    rankings: &app.rankings,
                    viewer: None,
                    service: None,
                })
            });
            let card = match card {
                Ok(card) => card,
                Err(e) => {
                    tracing::warn!(%path, error = %e, "og: reading a card");
                    return StatusCode::INTERNAL_SERVER_ERROR.into_response();
                }
            };
            let fetches = card
                .urls()
                .into_iter()
                .map(|url| async { Some((url.to_string(), fetch(&app.ctx.http, url).await?)) });
            let images: HashMap<String, Fetched> = futures::future::join_all(fetches)
                .await
                .into_iter()
                .flatten()
                .collect();
            let (svg, images) = svg(&card, &images).finish();
            let _turn = DRAWING.acquire().await.expect("never closed");
            let png: Arc<[u8]> = tokio::task::spawn_blocking(move || draw::render(&svg, images))
                .await
                .expect("drawing a card does not panic")
                .into();
            app.cards.put(&path, png.clone(), Instant::now());
            png
        }
    };
    let headers = [
        (header::CONTENT_TYPE, "image/png".to_string()),
        (
            header::CACHE_CONTROL,
            format!("public, max-age={}", KEPT.as_secs()),
        ),
        (header::ACCESS_CONTROL_ALLOW_ORIGIN, "*".to_string()),
    ];
    (headers, png.to_vec()).into_response()
}

async fn profile(State(app): State<Arc<App>>, Path(actor): Path<String>, uri: Uri) -> Response {
    answer(app, uri, |r| r.profile_card(&actor)).await
}

async fn gallery(
    State(app): State<Arc<App>>,
    Path((actor, rkey)): Path<(String, String)>,
    uri: Uri,
) -> Response {
    answer(app, uri, |r| r.gallery_card(&actor, &rkey)).await
}

async fn story(
    State(app): State<Arc<App>>,
    Path((actor, rkey)): Path<(String, String)>,
    uri: Uri,
) -> Response {
    answer(app, uri, |r| r.story_card(&actor, &rkey)).await
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_card_is_kept_for_five_minutes_and_the_newest_two_hundred() {
        let cards = Cards::default();
        let png: Arc<[u8]> = Arc::from(&b"png"[..]);
        let now = Instant::now();
        cards.put("/a", png.clone(), now);
        cards.put("/a", png.clone(), now);
        assert!(cards.get("/a", now).is_some());
        assert!(cards.get("/a", now + KEPT).is_none());
        assert!(cards.get("/none", now).is_none());
        for i in 0..KEEP {
            cards.put(&format!("/{i}"), png.clone(), now);
        }
        assert!(cards.get("/a", now).is_none(), "the oldest is dropped");
        assert!(cards.get(&format!("/{}", KEEP - 1), now).is_some());
    }
}

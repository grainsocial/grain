//! The Camera feed, and cameras as grain names them: a camera's make and
//! model, as EXIF writes them, read as `web/src/lib/utils/cameraName.ts`
//! reads them, so that the raw string and the name a card shows both
//! find the same galleries.

use super::feed::{empty, filtered, listed_param};
use super::moderation::shown;
use super::{Params, Reader};
use crate::cdn::THUMBNAIL;
use crate::index::records::Photo;
use crate::xrpc::Failure;
use rusqlite::params;
use serde_json::{Value, json};

/// Every make and model the index holds, as EXIF writes them.
pub const CAMERAS_SQL: &str = "SELECT make || ' ' || model FROM photo_exif
     WHERE make IS NOT NULL AND model IS NOT NULL GROUP BY make, model";

/// What a gallery in the feed has: a photo taken with one of `?5`.
pub const FILTER: &str =
    "EXISTS (SELECT 1 FROM gallery_item i JOIN photo_exif e ON e.photo = i.item
       WHERE i.gallery = g.uri AND e.make || ' ' || e.model IN (SELECT value FROM json_each(?5)))";

/// Camera: the galleries with a photo taken with the camera `camera`
/// names, by its raw make and model or its cleaned name.
pub fn feed(r: &Reader, p: &Params) -> Result<Value, Failure> {
    let Some(camera) = p.get("camera") else {
        return Ok(empty());
    };
    let target = clean(camera);
    let raws: Vec<String> = r
        .all::<(String,)>(CAMERAS_SQL, [])?
        .into_iter()
        .map(|(raw,)| raw)
        .filter(|raw| clean(raw) == target)
        .collect();
    if raws.is_empty() {
        return Ok(empty());
    }
    filtered(r, p, FILTER, vec![listed_param(&raws)])
}

/// How many cameras `getCameras` lists.
const CAMERAS: usize = 30;

/// How many thumbnails a camera carries, enough for its tile.
const THUMBS: usize = 4;

/// How many photos each make and model the index holds, the most first.
pub const COUNTS_SQL: &str = "SELECT make, model, count(*) FROM photo_exif
     WHERE make IS NOT NULL AND model IS NOT NULL GROUP BY make, model";

/// The latest photos taken with the make `?1` and model `?2`, of
/// accounts shown, `?3` of them.
pub fn latest_sql() -> String {
    format!(
        "SELECT p.* FROM photo_exif e JOIN photo p ON p.uri = e.photo
         WHERE e.make = ?1 AND e.model = ?2 AND {}
         ORDER BY p.created_at DESC, p.uri LIMIT ?3",
        shown("p.did")
    )
}

/// A camera: its name, its count, and the makes and models it is.
type Camera = (String, i64, Vec<(String, String)>);

/// `social.grain.gallery.getCameras`: the cameras the most photos were
/// taken with, by the name a card gives them, makes and models that read
/// as one counted as one, each with its latest photos.
pub fn get_cameras(r: &Reader, _: &Params) -> Result<Value, Failure> {
    let rows: Vec<(String, String, i64)> = r.all(COUNTS_SQL, [])?;
    let mut cameras: Vec<Camera> = Vec::new();
    for (make, model, n) in rows {
        let name = clean(&format!("{make} {model}"));
        if name.is_empty() {
            continue;
        }
        match cameras.iter_mut().find(|c| c.0 == name) {
            Some(c) => {
                c.1 += n;
                c.2.push((make, model));
            }
            None => cameras.push((name, n, vec![(make, model)])),
        }
    }
    cameras.sort_by(|a, b| {
        b.1.cmp(&a.1)
            .then_with(|| a.0.to_lowercase().cmp(&b.0.to_lowercase()))
            .then_with(|| a.0.cmp(&b.0))
    });
    cameras.truncate(CAMERAS);
    let mut answer = Vec::new();
    for (camera, count, raws) in cameras {
        let mut photos = Vec::new();
        for (make, model) in &raws {
            photos.extend(r.rows::<Photo>(&latest_sql(), params![make, model, THUMBS as i64])?);
        }
        photos.sort_by(|a, b| b.record.created_at.cmp(&a.record.created_at));
        let thumbs: Vec<String> = photos
            .iter()
            .take(THUMBS)
            .filter_map(|p| r.cdn.url(&p.did, &p.record.photo.0, THUMBNAIL))
            .collect();
        answer.push(json!({"camera": camera, "photoCount": count, "thumbs": thumbs}));
    }
    Ok(json!({ "cameras": answer }))
}

/// A step of a pattern [`RULES`] match.
#[derive(Clone, Copy)]
enum Step {
    /// These letters, in either case.
    Word(&'static str),
    /// This character, or none.
    Maybe(char),
    /// Any run of white space, or none.
    Space,
}

use Step::{Maybe, Space, Word};

/// What `cleanCameraName` strips from a maker's name, in order: each a
/// pattern that starts at a word's start, whether it must end at a
/// word's end, whether its letters match in either case, and what it
/// leaves in its place.
const RULES: &[(&[Step], bool, bool, &str)] = &[
    (
        &[
            Word("IMAGING COMPANY"),
            Maybe(','),
            Space,
            Word("LTD"),
            Maybe('.'),
        ],
        false,
        true,
        "",
    ),
    (&[Word("IMAGING CORP"), Maybe('.')], false, true, ""),
    (
        &[
            Word("PHOTO FILM CO."),
            Maybe(','),
            Space,
            Word("LTD"),
            Maybe('.'),
        ],
        false,
        true,
        "PHOTO FILM",
    ),
    (&[Word("CAMERA AG")], true, true, ""),
    (&[Word("CORPORATION")], true, true, ""),
    (
        &[Word("CO."), Maybe(','), Space, Word("LTD"), Maybe('.')],
        false,
        true,
        "",
    ),
    (&[Word("GmbH")], true, false, ""),
];

fn word_char(c: u8) -> bool {
    c.is_ascii_alphanumeric() || c == b'_'
}

/// Where `steps` matching at `at` in `s` ends, if they do.
fn matches(s: &[u8], at: usize, steps: &[Step], either_case: bool) -> Option<usize> {
    let mut i = at;
    for step in steps {
        match *step {
            Word(w) => {
                let w = w.as_bytes();
                let got = s.get(i..i + w.len())?;
                let same = match either_case {
                    true => got.eq_ignore_ascii_case(w),
                    false => got == w,
                };
                if !same {
                    return None;
                }
                i += w.len();
            }
            Maybe(c) => {
                if s.get(i) == Some(&(c as u8)) {
                    i += 1;
                }
            }
            Space => {
                while s.get(i).is_some_and(u8::is_ascii_whitespace) {
                    i += 1;
                }
            }
        }
    }
    Some(i)
}

/// `raw` with every match of `steps` replaced by `with`.
fn strip(raw: &str, steps: &[Step], ends: bool, either_case: bool, with: &str) -> String {
    let s = raw.as_bytes();
    let mut out = String::with_capacity(raw.len());
    let mut i = 0;
    let mut kept = 0;
    while i < s.len() {
        let starts = i == 0 || !word_char(s[i - 1]);
        let end = starts
            .then(|| matches(s, i, steps, either_case))
            .flatten()
            .filter(|&e| !ends || e == s.len() || !word_char(s[e]));
        match end {
            Some(e) => {
                out.push_str(&raw[kept..i]);
                out.push_str(with);
                i = e;
                kept = e;
            }
            None => i += 1,
        }
    }
    out.push_str(&raw[kept..]);
    out
}

/// A camera's make and model as a card names it: the maker's company
/// words dropped, a word said twice running said once, and a maker's
/// name in capitals or in lower case written as a name.
pub fn clean(raw: &str) -> String {
    let mut s = raw.to_string();
    for (steps, ends, either_case, with) in RULES {
        s = strip(&s, steps, *ends, *either_case, with);
    }
    let mut words: Vec<&str> = Vec::new();
    for w in s.split_whitespace() {
        if words
            .last()
            .is_none_or(|last| last.to_uppercase() != w.to_uppercase())
        {
            words.push(w);
        }
    }
    words
        .into_iter()
        .map(|w| {
            let upper = w.len() >= 4 && w.bytes().all(|c| c.is_ascii_uppercase());
            let lower = w.len() >= 2 && w.bytes().all(|c| c.is_ascii_lowercase());
            match (upper, lower) {
                (true, _) => format!("{}{}", &w[..1], w[1..].to_ascii_lowercase()),
                (_, true) => format!("{}{}", w[..1].to_ascii_uppercase(), &w[1..]),
                _ => w.to_string(),
            }
        })
        .collect::<Vec<_>>()
        .join(" ")
}

#[cfg(test)]
pub fn queries() -> Vec<String> {
    vec![
        CAMERAS_SQL.into(),
        super::feed::filtered_sql(FILTER),
        COUNTS_SQL.into(),
        latest_sql(),
    ]
}

#[cfg(test)]
mod tests {
    use super::clean;

    #[test]
    fn a_camera_reads_as_a_card_names_it() {
        for (raw, name) in [
            ("RICOH IMAGING COMPANY, LTD. GR II", "Ricoh GR II"),
            ("RICOH IMAGING COMPANY, LTD. RICOH GR III", "Ricoh GR III"),
            ("NIKON CORPORATION NIKON D600", "Nikon D600"),
            ("OLYMPUS IMAGING CORP. TG-3", "Olympus TG-3"),
            (
                "FUJI PHOTO FILM CO., LTD. SP-3000",
                "Fuji Photo Film SP-3000",
            ),
            ("LEICA CAMERA AG LEICA Q (Typ 116)", "Leica Q (Typ 116)"),
            (
                "KONICA MINOLTA ALPHA SWEET DIGITAL",
                "Konica Minolta Alpha Sweet Digital",
            ),
            ("samsung Galaxy S24+", "Samsung Galaxy S24+"),
            ("Apple iPhone 14 Pro", "Apple iPhone 14 Pro"),
            ("SONY ILCE-7M3", "Sony ILCE-7M3"),
            ("FUJIFILM X-T30 II", "Fujifilm X-T30 II"),
            ("Canon Co., Ltd EOS R", "Canon EOS R"),
            ("Leica Camera GmbH M11", "Leica Camera M11"),
            ("ZEISS GMBH ZX1", "Zeiss Gmbh ZX1"),
            ("NOCORPORATION X", "Nocorporation X"),
            ("", ""),
        ] {
            assert_eq!(clean(raw), name, "{raw}");
        }
    }
}

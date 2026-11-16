//! Places: the Location feed, the galleries at a place, named by the label
//! a view shows for it, by its H3 cell, or both; and `getLocations`, the
//! places galleries were made at, and how many were made at each.

use super::feed::{empty, filtered};
use super::moderation::{shown, unhidden};
use super::place::{REGIONS, country_code};
use super::{Params, Reader, list};
use crate::cdn::THUMBNAIL;
use crate::xrpc::Failure;
use rusqlite::types::Value as Sql;
use serde_json::{Value, json};

/// Location: by `name`, the label a view shows for a place, where the
/// call gives one and it finds any; otherwise by `location`, an H3 cell,
/// a city's (resolution 5) taking in each place within it.
pub fn feed(r: &Reader, p: &Params) -> Result<Value, Failure> {
    let name = p.get("name").map(str::trim).unwrap_or_default();
    let location = p.get("location");
    if !name.is_empty() {
        let (filter, own) = by_name(name);
        let page = filtered(r, p, &filter, own)?;
        if location.is_none() || page["items"].as_array().is_some_and(|i| !i.is_empty()) {
            return Ok(page);
        }
    }
    let Some(cell) = location else {
        return Ok(empty());
    };
    filtered(r, p, CELL_FILTER, cells(cell))
}

/// One reading of a place's label: the parts of a gallery's address it
/// would say, and a region the address may have or leave out.
#[derive(Default)]
struct Reading<'a> {
    locality: Option<&'a str>,
    region: Option<&'a str>,
    country: Option<&'a str>,
    region_or_none: Option<&'a str>,
}

/// The ways `name` may have been written, as a label lists a place's
/// parts, `[locality, region, country]`, whichever it has, after the
/// place's own name where it has one: a label of two parts may be a
/// locality's or a region's, and one of one part a country's or a
/// locality's.
fn readings(name: &str) -> Vec<Reading<'_>> {
    let parts: Vec<&str> = name
        .split(',')
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .collect();
    match *parts.as_slice() {
        [.., locality, region, country] => vec![
            Reading {
                locality: Some(locality),
                region: Some(region),
                country: Some(country),
                ..Default::default()
            },
            // A place within a locality of no region, or of one named as
            // it is, as "Tokyo Midtown, Minato, JP" and "India Street,
            // New York, US" are; not Washington, D.C. for "Seattle,
            // Washington, US".
            Reading {
                locality: Some(region),
                country: Some(country),
                region_or_none: Some(region),
                ..Default::default()
            },
        ],
        [first, country] => vec![
            Reading {
                locality: Some(first),
                country: Some(country),
                ..Default::default()
            },
            Reading {
                region: Some(first),
                country: Some(country),
                ..Default::default()
            },
        ],
        [only] => vec![
            Reading {
                country: Some(only),
                ..Default::default()
            },
            Reading {
                locality: Some(only),
                ..Default::default()
            },
        ],
        _ => vec![],
    }
}

/// Each spelling of the country `raw` names that an address may hold, in
/// capitals: its code, an alias of it, and its English name.
pub fn spellings(raw: &str) -> Vec<String> {
    let Some(code) = country_code(raw) else {
        return vec![];
    };
    let mut all = vec![code.clone()];
    for (alias, of) in super::place::ALIASES {
        if *of == code && !all.iter().any(|a| a == alias) {
            all.push(alias.to_string());
        }
    }
    if let Some((_, name)) = REGIONS.iter().find(|(c, _)| *c == code) {
        let name = name.to_uppercase();
        if !all.contains(&name) {
            all.push(name);
        }
    }
    all
}

/// The filter for galleries at the place `name` labels, and its
/// parameters from `?5`: any reading of it its address says, or a place
/// named just so.
fn by_name(name: &str) -> (String, Vec<Sql>) {
    let mut own: Vec<Sql> = Vec::new();
    let mut next = |value: &str| {
        own.push(Sql::Text(value.to_string()));
        format!("?{}", own.len() + 4)
    };
    let field = |f: &str| format!("json_extract(g.address, '$.{f}')");
    let mut any: Vec<String> = Vec::new();
    for reading in readings(name) {
        let mut all = Vec::new();
        if let Some(locality) = reading.locality {
            all.push(format!(
                "UPPER({}) = UPPER({})",
                field("locality"),
                next(locality)
            ));
        }
        if let Some(region) = reading.region {
            all.push(format!(
                "UPPER({}) = UPPER({})",
                field("region"),
                next(region)
            ));
        }
        if let Some(country) = reading.country {
            let mut spelled = Vec::new();
            for spelling in spellings(country) {
                spelled.push(next(&spelling));
            }
            all.push(format!(
                "UPPER({}) IN ({})",
                field("country"),
                spelled.join(", ")
            ));
        }
        if let Some(region) = reading.region_or_none {
            all.push(format!(
                "({0} IS NULL OR UPPER({0}) = UPPER({1}))",
                field("region"),
                next(region)
            ));
        }
        any.push(format!("({})", all.join(" AND ")));
    }
    any.push(format!(
        "json_extract(g.location, '$.name') = {}",
        next(name)
    ));
    (format!("({})", any.join(" OR ")), own)
}

/// How many cell ranges [`CELL_FILTER`] reads: the cell itself, and its
/// descendants at each finer resolution, 6 to 15.
const RANGES: usize = 11;

/// What a gallery in the feed has: a cell within one of the ranges `?5`
/// to `?26` bound, each from its first to its last cell.
pub const CELL_FILTER: &str = "(g.h3 BETWEEN ?5 AND ?6 OR g.h3 BETWEEN ?7 AND ?8
     OR g.h3 BETWEEN ?9 AND ?10 OR g.h3 BETWEEN ?11 AND ?12 OR g.h3 BETWEEN ?13 AND ?14
     OR g.h3 BETWEEN ?15 AND ?16 OR g.h3 BETWEEN ?17 AND ?18 OR g.h3 BETWEEN ?19 AND ?20
     OR g.h3 BETWEEN ?21 AND ?22 OR g.h3 BETWEEN ?23 AND ?24 OR g.h3 BETWEEN ?25 AND ?26)";

/// The resolution H3 calls a city's, whose cells take in the places
/// within them.
const CITY: u64 = 5;

/// The ranges of cells [`CELL_FILTER`] reads for `cell`: the cell itself,
/// and where it is a city's, each cell within it, a range a resolution.
/// H3 numbers a cell's descendants at one resolution in a run, its own
/// digits then the finer ones, so each run is a range of the hex strings
/// cells are written as, which are all fifteen digits long.
fn cells(cell: &str) -> Vec<Sql> {
    let mut ranges = vec![(cell.to_string(), cell.to_string()); RANGES];
    let index = u64::from_str_radix(cell, 16).ok();
    let city = index.filter(|i| mode(*i) == 1 && resolution(*i) == CITY);
    if let (Some(index), true) = (city, cell == cell.to_lowercase()) {
        for (slot, res) in ranges.iter_mut().skip(1).zip(CITY + 1..=15) {
            let at = (index & !(0xf << 52)) | (res << 52);
            let (mut first, mut last) = (at, at);
            for digit in CITY + 1..=res {
                let shift = (15 - digit) * 3;
                first &= !(0b111 << shift);
                last = (last & !(0b111 << shift)) | (0b110 << shift);
            }
            *slot = (format!("{first:x}"), format!("{last:x}"));
        }
    }
    ranges
        .into_iter()
        .flat_map(|(first, last)| [Sql::Text(first), Sql::Text(last)])
        .collect()
}

fn mode(index: u64) -> u64 {
    (index >> 59) & 0xf
}

fn resolution(index: u64) -> u64 {
    (index >> 52) & 0xf
}

/// How many places `getLocations` lists in full.
const PLACES: usize = 30;

/// How many galleries' covers a place carries, enough for its tile.
const THUMBS: usize = 4;

/// The cell `cell` is in at a city's resolution: itself where it is a
/// city's or coarser; none where it is no cell.
fn city_of(cell: &str) -> Option<String> {
    let index = u64::from_str_radix(cell, 16)
        .ok()
        .filter(|i| mode(*i) == 1)?;
    if resolution(index) <= CITY {
        return Some(cell.to_string());
    }
    let mut at = (index & !(0xf << 52)) | (CITY << 52);
    for digit in CITY + 1..=15 {
        at |= 0b111 << ((15 - digit) * 3);
    }
    Some(format!("{at:x}"))
}

/// Every gallery with a place, of an account shown and carrying no label
/// that hides, the latest first: where it is, and what its address says.
pub fn places_sql() -> String {
    format!(
        "SELECT g.uri, g.created_at, json_extract(g.location, '$.name'), g.h3,
                json_extract(g.address, '$.locality'), json_extract(g.address, '$.region'),
                json_extract(g.address, '$.country')
         FROM gallery g INDEXED BY gallery_h3 WHERE g.h3 IS NOT NULL AND {} AND {}
         ORDER BY g.created_at DESC, g.uri
         -- sorts: gallery, as the map shows every gallery with a place",
        shown("g.did"),
        unhidden("g.uri")
    )
}

/// The first photo of each gallery of `?1`.
pub const COVERS_SQL: &str = "SELECT i.gallery, p.did, p.photo FROM gallery_item i
     JOIN photo p ON p.uri = i.item
     WHERE i.gallery IN (SELECT value FROM json_each(?1)) ORDER BY i.position, i.uri";

/// A gallery's place, as `places_sql` reads it.
type Spot = (
    String,
    String,
    Option<String>,
    String,
    Option<String>,
    Option<String>,
    Option<String>,
);

/// `value`, trimmed, where something is left.
fn given(value: &Option<String>) -> Option<&str> {
    value.as_deref().map(str::trim).filter(|v| !v.is_empty())
}

/// What a place is grouped by: its address, its name, or its city's
/// cell, whichever it has first.
fn key(spot: &Spot) -> Option<String> {
    let (_, _, name, cell, locality, region, country) = spot;
    let country = country.as_deref().and_then(country_code);
    let (locality, region) = (given(locality), given(region));
    if locality.is_some() || region.is_some() || country.is_some() {
        let lower = |v: Option<&str>| v.map(str::to_lowercase).unwrap_or_default();
        let country = country.unwrap_or_default();
        return Some(format!("A:{country}|{}|{}", lower(region), lower(locality)));
    }
    if let Some(name) = given(name) {
        return Some(format!("N:{}", name.to_lowercase()));
    }
    city_of(cell).map(|c| format!("H:{c}"))
}

/// What a place is called on its tile: its locality, region and
/// country's code; a country alone by its English name; or its own name.
fn label(spot: &Spot) -> Option<String> {
    let (_, _, name, _, locality, region, country) = spot;
    let country = country.as_deref().and_then(country_code);
    let (locality, region) = (given(locality), given(region));
    if locality.is_some() || region.is_some() {
        let parts: Vec<&str> = [locality, region, country.as_deref()]
            .into_iter()
            .flatten()
            .collect();
        return Some(parts.join(", "));
    }
    if let Some(code) = country {
        let named = REGIONS
            .iter()
            .find(|(c, _)| *c == code)
            .map(|(_, n)| n.to_string());
        return Some(named.unwrap_or(code));
    }
    given(name).map(str::to_string)
}

/// Counts of each of a place's names or cells, in the order first seen.
#[derive(Default, Clone)]
struct Tally(Vec<(String, usize)>);

impl Tally {
    fn add(&mut self, value: &str, n: usize) {
        match self.0.iter_mut().find(|(v, _)| v == value) {
            Some((_, count)) => *count += n,
            None => self.0.push((value.to_string(), n)),
        }
    }

    /// Each value, the most counted first, those counted alike as seen.
    fn ranked(&self) -> Vec<String> {
        let mut all = self.0.clone();
        all.sort_by_key(|a| std::cmp::Reverse(a.1));
        all.into_iter().map(|(v, _)| v).collect()
    }
}

/// A place: what its galleries call it and where they are, how many
/// they are, and the latest of them, with when.
#[derive(Default)]
struct Place {
    names: Tally,
    cells: Tally,
    galleries: Vec<(String, String)>,
    country: String,
    region: String,
    locality: String,
    count: usize,
}

/// A place as listed: its name, its cell, how many galleries, all its
/// cells, and its latest galleries.
type Ranked = (String, String, usize, Vec<String>, Vec<String>);

/// `social.grain.gallery.getLocations`: the places galleries were made
/// at, the most galleries first; each of them only as a map plots it
/// where `pins` asks, and otherwise the first thirty, with their cells
/// and the covers of their latest galleries.
pub fn get_locations(r: &Reader, p: &Params) -> Result<Value, Failure> {
    let pins = match p.get("pins") {
        None | Some("false") => false,
        Some("true") => true,
        Some(_) => return Err(Failure::invalid("pins must be a boolean")),
    };
    let spots: Vec<Spot> = r.all(&places_sql(), [])?;
    let mut keys: Vec<String> = Vec::new();
    let mut places: std::collections::HashMap<String, Place> = Default::default();
    for spot in &spots {
        let (Some(key), Some(label)) = (key(spot), label(spot)) else {
            continue;
        };
        let place = places.entry(key.clone()).or_insert_with(|| {
            keys.push(key);
            Place {
                country: spot.6.as_deref().and_then(country_code).unwrap_or_default(),
                region: given(&spot.5).unwrap_or_default().to_lowercase(),
                locality: given(&spot.4).unwrap_or_default().to_lowercase(),
                ..Place::default()
            }
        });
        place.count += 1;
        if place.galleries.len() < THUMBS {
            place.galleries.push((spot.0.clone(), spot.1.clone()));
        }
        place.names.add(&label, 1);
        place.cells.add(&spot.3, 1);
    }
    // A place with no region, as one geocoder gives "Lisbon, PT" and
    // another "Lisbon, Lisbon, PT", is folded into the one place of its
    // locality and country that has one; where there are more, as
    // Portland is in Oregon and in Maine, it stands alone.
    for key in keys.clone() {
        let Some(place) = places.get(&key) else {
            continue;
        };
        if !place.region.is_empty() || place.locality.is_empty() {
            continue;
        }
        let twins: Vec<&String> = keys
            .iter()
            .filter(|k| {
                places.get(*k).is_some_and(|o| {
                    !o.region.is_empty()
                        && o.locality == place.locality
                        && o.country == place.country
                })
            })
            .collect();
        let [into] = twins[..] else { continue };
        let into = into.clone();
        let place = places.remove(&key).expect("present");
        let twin = places.get_mut(&into).expect("present");
        twin.count += place.count;
        for (name, n) in &place.names.0 {
            twin.names.add(name, *n);
        }
        for (cell, n) in &place.cells.0 {
            twin.cells.add(cell, *n);
        }
        twin.galleries.extend(place.galleries);
        twin.galleries.sort_by(|a, b| b.1.cmp(&a.1));
        twin.galleries.truncate(THUMBS);
    }
    let mut ranked: Vec<Ranked> = keys
        .iter()
        .filter_map(|k| places.get(k))
        .filter_map(|place| {
            // The name most of its galleries give it, the first given
            // where two are given alike.
            let mut best: Option<&(String, usize)> = None;
            for named in &place.names.0 {
                if best.is_none_or(|b| named.1 > b.1) {
                    best = Some(named);
                }
            }
            let cells = place.cells.ranked();
            let (name, cell) = (best?.0.clone(), cells.first()?.clone());
            let galleries = place.galleries.iter().map(|(u, _)| u.clone()).collect();
            Some((name, cell, place.count, cells, galleries))
        })
        .collect();
    ranked.sort_by(|a, b| {
        b.2.cmp(&a.2)
            .then_with(|| a.0.to_lowercase().cmp(&b.0.to_lowercase()))
            .then_with(|| a.0.cmp(&b.0))
    });
    if pins {
        let pins: Vec<Value> = ranked
            .iter()
            .map(|(name, cell, count, _, _)| json!({"name": name, "h3Index": cell, "galleryCount": count}))
            .collect();
        return Ok(json!({ "locations": pins }));
    }
    ranked.truncate(PLACES);
    let uris: Vec<&str> = ranked
        .iter()
        .flat_map(|p| p.4.iter().map(String::as_str))
        .collect();
    let mut covers: std::collections::HashMap<String, String> = Default::default();
    for (gallery, did, photo) in r.all::<(String, String, String)>(COVERS_SQL, [list(&uris)])? {
        let blob: Value = serde_json::from_str(&photo).unwrap_or_default();
        if let (false, Some(url)) = (
            covers.contains_key(&gallery),
            r.cdn.url(&did, &blob, THUMBNAIL),
        ) {
            covers.insert(gallery, url);
        }
    }
    let locations: Vec<Value> = ranked
        .into_iter()
        .map(|(name, cell, count, cells, galleries)| {
            let thumbs: Vec<&String> = galleries.iter().filter_map(|g| covers.get(g)).collect();
            json!({"name": name, "h3Index": cell, "galleryCount": count, "h3Cells": cells, "thumbs": thumbs})
        })
        .collect();
    Ok(json!({ "locations": locations }))
}

#[cfg(test)]
pub fn queries() -> Vec<String> {
    use super::feed::filtered_sql;
    let (named, _) = by_name("The Space Needle, Seattle, Washington, US");
    vec![
        filtered_sql(&named),
        filtered_sql(CELL_FILTER),
        places_sql(),
        COVERS_SQL.into(),
    ]
}

#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::types::ValueRef;

    fn texts(values: &[Sql]) -> Vec<String> {
        values
            .iter()
            .map(|v| ValueRef::from(v).as_str().unwrap().to_string())
            .collect()
    }

    #[test]
    fn a_city_takes_in_the_cells_within_it() {
        // Ocean Beach, a resolution 10 cell, and the city cell it is in.
        let venue = "8a2830959c2ffff";
        let city = "85283097fffffff";
        let ranges = texts(&cells(city));
        assert_eq!(ranges.len(), RANGES * 2);
        assert_eq!(&ranges[..2], [city, city]);
        // Resolution 10, its five finer digits run from 0 to 6.
        let (first, last) = (&ranges[10], &ranges[11]);
        assert_eq!(
            (first.as_str(), last.as_str()),
            ("8a2830940007fff", "8a2830976db7fff")
        );
        assert!(first.as_str() <= venue && venue <= last.as_str());
        // Resolution 15 has no digit left unused.
        assert_eq!(
            (ranges[20].as_str(), ranges[21].as_str()),
            ("8f2830940000000", "8f2830976db6db6")
        );
        // A cell finer than a city's, or none at all, is only itself.
        for other in [venue, "nonsense", "85283097FFFFFFF"] {
            assert!(texts(&cells(other)).iter().all(|c| c == other));
        }
    }

    #[test]
    fn a_label_is_read_every_way_it_may_have_been_written() {
        let (filter, own) = by_name("Paris, FR");
        assert_eq!(
            texts(&own),
            [
                "Paris",
                "FR",
                "FRANCE",
                "Paris",
                "FR",
                "FRANCE",
                "Paris, FR"
            ]
        );
        assert_eq!(filter.matches(" OR ").count(), 2);
        let (_, own) = by_name("Seattle, Washington, US");
        assert_eq!(
            texts(&own),
            [
                "Seattle",
                "Washington",
                "US",
                "USA",
                "UNITED STATES",
                "Washington",
                "US",
                "USA",
                "UNITED STATES",
                "Washington",
                "Seattle, Washington, US"
            ]
        );
        let (_, own) = by_name("Waldport");
        assert_eq!(texts(&own), ["WALDPORT", "Waldport", "Waldport"]);
        let (filter, own) = by_name(" , ");
        assert_eq!(texts(&own), [" , "]);
        assert!(!filter.contains("address"));
    }

    #[test]
    fn a_country_is_spelled_every_way_an_address_holds_it() {
        assert_eq!(spellings("usa"), ["US", "USA", "UNITED STATES"]);
        assert_eq!(spellings("Greece"), ["GR", "GREECE"]);
        assert_eq!(spellings("Narnia"), ["NARNIA"]);
        assert!(spellings(" ").is_empty());
    }
}

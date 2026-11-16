use super::*;
use crate::index::Index;
use crate::index::plan::{scans, sized};

#[test]
fn the_reads_read_by_index() {
    let index = Index::memory().unwrap();
    let mut queries = Vec::new();
    queries.extend(actor::queries());
    queries.extend(gallery::queries());
    queries.extend(comment::queries());
    queries.extend(graph::queries());
    queries.extend(story::queries());
    queries.extend(feed::queries());
    queries.extend(views::queries());
    queries.extend(search::queries());
    queries.extend(sitemap::queries());
    queries.extend(notification::queries());
    queries.extend(crate::push::send::queries());
    queries.push(crate::gallery::going_sql());
    index.read(|db| {
        sized(db);
        for sql in &queries {
            assert_eq!(scans(db, sql), Vec::<String>::new(), "{sql}");
        }
    });
}

fn params(pairs: &[(&str, &str)]) -> Params {
    Params(
        pairs
            .iter()
            .map(|(k, v)| (k.to_string(), v.to_string()))
            .collect(),
    )
}

#[test]
fn a_limit_is_held_to_its_bounds() {
    let limit = |v: &str| {
        params(&[("limit", v)])
            .limit(30, 100)
            .map_err(|f| f.message)
    };
    assert_eq!(params(&[]).limit(30, 100), Ok(30));
    assert_eq!(limit("100"), Ok(100));
    assert_eq!(limit("0").unwrap_err(), "limit can not be less than 1");
    assert_eq!(
        limit("101").unwrap_err(),
        "limit can not be greater than 100"
    );
    assert_eq!(limit("ten").unwrap_err(), "limit must be an integer");
}

#[test]
fn a_cursor_names_the_last_rows_key_and_uri() {
    let none = params(&[]);
    assert_eq!(none.after(true).unwrap(), (String::new(), String::new()));
    assert_eq!(none.after(false).unwrap().0, PAST_THE_END);
    let at = params(&[("cursor", "2026-10-31T12:00:00.000Z::at://did:plc:a/c/r")]);
    let (sort, uri) = at.after(false).unwrap();
    assert_eq!(
        (sort.as_str(), uri.as_str()),
        ("2026-10-31T12:00:00.000Z", "at://did:plc:a/c/r")
    );
    let bad = params(&[("cursor", "12")]).after(false).unwrap_err();
    assert_eq!(
        (bad.error, bad.message.as_str()),
        ("InvalidRequest", "malformed cursor")
    );

    let rows = vec![("a", "1"), ("b", "2"), ("c", "3")];
    assert_eq!(page(rows.clone(), 3, |r| *r), (rows.clone(), None));
    let (two, cursor) = page(rows, 2, |r| *r);
    assert_eq!((two.len(), cursor.as_deref()), (2, Some("b::2")));
}

#[test]
fn parameters_are_held_to_their_formats() {
    let p = params(&[("gallery", "not a uri")]);
    assert_eq!(
        p.at_uri("gallery").unwrap_err().message,
        "gallery must be a valid at-uri"
    );
    let missing = p.required("story").unwrap_err().message;
    assert_eq!(missing, "Params must have the property \"story\"");
}

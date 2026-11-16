//! grain's queries: the XRPC methods that answer from the index alone,
//! each one a function of a [`Reader`] and the call's [`Params`].
//!
//! A call is answered as Bluesky's appview answers one: its parameters
//! held to its lexicon (a `limit` out of bounds is refused, not clamped),
//! pages turned by a cursor naming the last row's sort key and URI rather
//! than an offset, and a caller named by a service token ([`viewer`])
//! whose follows, mutes, blocks and favorites fill each view's `viewer`.
//! What a read leaves out is written once, in [`moderation`]; how a
//! record reads as a view, once, in [`views`].
//!
//! [`viewer`]: crate::viewer

pub mod actor;
pub mod camera;
pub mod comment;
pub mod feed;
pub mod foryou;
pub mod gallery;
pub mod graph;
pub mod location;
pub mod moderation;
pub mod notification;
pub mod place;
pub mod search;
pub mod sitemap;
pub mod story;
pub mod views;

use crate::App;
use crate::cdn::Cdn;
use crate::index::records::Record;
use crate::index::{Row, row};
use crate::xrpc::Failure;
use axum::extract::{Query, State};
use axum::http::{HeaderMap, StatusCode, Uri};
use axum::{Json, Router, routing::get};
use grain::lexicon;
use rusqlite::Connection;
use rusqlite::types::FromSql;
use serde_json::Value;
use std::sync::Arc;

/// What a query reads with: the index, where blobs are drawn, and who is
/// asking.
pub struct Reader<'a> {
    pub db: &'a Connection,
    pub cdn: &'a Cdn,
    /// The caller, if they said who they are.
    pub viewer: Option<&'a str>,
    /// The server's own DID, if it has one.
    pub service: Option<&'a str>,
}

/// A query: its answer, from the index, for its parameters.
pub type Method = fn(&Reader, &Params) -> Result<Value, Failure>;

/// Each query served, by its NSID.
pub const METHODS: &[(&str, Method)] = &[
    ("social.grain.actor.getProfile", actor::get_profile),
    ("social.grain.actor.getFavorites", actor::get_favorites),
    ("social.grain.gallery.getGallery", gallery::get_gallery),
    ("social.grain.gallery.getFavorites", gallery::get_favorites),
    ("social.grain.comment.getThread", comment::get_thread),
    ("social.grain.graph.getFollowers", graph::get_followers),
    ("social.grain.graph.getFollowing", graph::get_following),
    (
        "social.grain.graph.getKnownFollowers",
        graph::get_known_followers,
    ),
    ("social.grain.graph.getBlocks", graph::get_blocks),
    ("social.grain.graph.getMutes", graph::get_mutes),
    ("social.grain.story.getStories", story::get_stories),
    ("social.grain.story.getStory", story::get_story),
    ("social.grain.story.getAuthors", story::get_authors),
    ("social.grain.story.getArchive", story::get_archive),
    ("social.grain.feed.describeFeeds", feed::describe_feeds),
    ("social.grain.feed.getFeed", feed::get_feed),
    ("social.grain.actor.searchActors", search::search_actors),
    (
        "social.grain.actor.getSuggestedFollows",
        actor::get_suggested_follows,
    ),
    (
        "social.grain.gallery.searchGalleries",
        search::search_galleries,
    ),
    ("social.grain.gallery.getCameras", camera::get_cameras),
    ("social.grain.gallery.getLocations", location::get_locations),
    (
        "social.grain.notification.listNotifications",
        notification::list_notifications,
    ),
    (
        "social.grain.notification.getUnreadCount",
        notification::get_unread_count,
    ),
    ("social.grain.server.getSitemap", sitemap::get_sitemap),
];

/// `router` with each of [`METHODS`] at `/xrpc/<nsid>`, and typeahead,
/// which asks Bluesky's too ([`search::typeahead`]).
pub fn routes(router: Router<Arc<App>>) -> Router<Arc<App>> {
    let router = router.route(
        "/xrpc/social.grain.actor.searchActorsTypeahead",
        get(search::typeahead),
    );
    METHODS.iter().fold(router, |router, &(nsid, method)| {
        let path = format!("/xrpc/{nsid}");
        router.route(
            &path,
            get(
                move |State(app): State<Arc<App>>, headers: HeaderMap, uri: Uri| {
                    answer(app, headers, uri, nsid, method)
                },
            ),
        )
    })
}

/// `method`'s answer to a call of `nsid`: who is asking found first, then
/// the index read as no write runs.
async fn answer(
    app: Arc<App>,
    headers: HeaderMap,
    uri: Uri,
    nsid: &'static str,
    method: Method,
) -> Result<Json<Value>, Failure> {
    let Some(index) = &app.index else {
        let why = "this server keeps no index";
        return Err(Failure::new(
            StatusCode::NOT_IMPLEMENTED,
            "MethodNotImplemented",
            why,
        ));
    };
    let params = params(&uri);
    let viewer = crate::viewer::viewer(&app, &headers, nsid).await?;
    index.read(|db| {
        let reader = Reader {
            db,
            cdn: &app.cdn,
            viewer: viewer.as_deref(),
            service: app.did.as_deref(),
        };
        method(&reader, &params).map(Json)
    })
}

/// The parameters `uri` gives, none where it gives none that parse.
fn params(uri: &Uri) -> Params {
    Params(
        Query::try_from_uri(uri)
            .map(|Query(q)| q)
            .unwrap_or_default(),
    )
}

/// A query's parameters, as its URL names them.
#[derive(Debug, Default, Clone)]
pub struct Params(pub Vec<(String, String)>);

/// The cursor a page starts from when it is the first: past every key a
/// row has, whichever way the rows run.
const PAST_THE_END: &str = "\u{10FFFF}";

impl Params {
    pub fn get(&self, name: &str) -> Option<&str> {
        self.0
            .iter()
            .find(|(k, _)| k == name)
            .map(|(_, v)| v.as_str())
    }

    /// The parameter `name`, which the call must give.
    pub fn required(&self, name: &str) -> Result<&str, Failure> {
        let why = || Failure::invalid(format!("Params must have the property \"{name}\""));
        self.get(name).ok_or_else(why)
    }

    /// The `at-uri` parameter `name`, which the call must give.
    pub fn at_uri(&self, name: &str) -> Result<&str, Failure> {
        let uri = self.required(name)?;
        match lexicon::valid_at_uri(uri) {
            true => Ok(uri),
            false => Err(Failure::invalid(format!("{name} must be a valid at-uri"))),
        }
    }

    /// `limit`: `default` where the call gives none, and otherwise from 1
    /// to `max`, as the method's lexicon bounds it.
    pub fn limit(&self, default: usize, max: usize) -> Result<usize, Failure> {
        let Some(given) = self.get("limit") else {
            return Ok(default);
        };
        match given.parse::<i64>() {
            Err(_) => Err(Failure::invalid("limit must be an integer")),
            Ok(n) if n < 1 => Err(Failure::invalid("limit can not be less than 1")),
            Ok(n) if n as usize > max => Err(Failure::invalid(format!(
                "limit can not be greater than {max}"
            ))),
            Ok(n) => Ok(n as usize),
        }
    }

    /// Where a page of rows ordered by a sort key and then their URI picks
    /// up: the key and URI of the last row the cursor names, or, with no
    /// cursor, a key past every row's, from whichever end `ascending`
    /// starts.
    pub fn after(&self, ascending: bool) -> Result<(String, String), Failure> {
        let Some(cursor) = self.get("cursor") else {
            let end = if ascending { "" } else { PAST_THE_END };
            return Ok((end.to_string(), end.to_string()));
        };
        let (sort, uri) = cursor
            .split_once("::")
            .ok_or_else(|| Failure::invalid("malformed cursor"))?;
        Ok((sort.to_string(), uri.to_string()))
    }
}

/// The page of `rows`, fetched one past `limit`, and the cursor to the
/// next if there is one: the last row's sort key and URI, as `key` has
/// them.
pub fn page<T>(
    mut rows: Vec<T>,
    limit: usize,
    key: impl Fn(&T) -> (&str, &str),
) -> (Vec<T>, Option<String>) {
    if rows.len() <= limit {
        return (rows, None);
    }
    rows.truncate(limit);
    let cursor = rows.last().map(|last| {
        let (sort, uri) = key(last);
        format!("{sort}::{uri}")
    });
    (rows, cursor)
}

/// `items` as the JSON array a `json_each` parameter reads.
pub fn list<S: AsRef<str>>(items: &[S]) -> String {
    Value::from(items.iter().map(|s| s.as_ref()).collect::<Vec<_>>()).to_string()
}

impl Reader<'_> {
    /// The caller, for a method only an account may call.
    pub fn signed_in(&self) -> Result<&str, Failure> {
        self.viewer.ok_or_else(Failure::authentication_required)
    }

    /// The DID `actor`, a DID or a handle, names, if the index knows the
    /// handle: handles are kept in lower case, and one may be written with
    /// an `@` before it.
    pub fn resolve(&self, actor: &str) -> rusqlite::Result<Option<String>> {
        if actor.starts_with("did:") {
            return Ok(Some(actor.to_string()));
        }
        let handle = actor.trim_start_matches('@').to_lowercase();
        let sql = "SELECT did FROM repo WHERE handle = ?1";
        let dids: Vec<(String,)> = self.all(sql, [handle])?;
        Ok(dids.into_iter().next().map(|(did,)| did))
    }

    /// The `actor` parameter, as the DID it names; refused where it names
    /// no account the index knows, as Bluesky refuses one.
    pub fn actor(&self, params: &Params) -> Result<String, Failure> {
        let actor = params.required("actor")?;
        if !(lexicon::valid_did(actor) || lexicon::valid_handle(actor.trim_start_matches('@'))) {
            return Err(Failure::invalid("actor must be a valid did or a handle"));
        }
        self.resolve(actor)?
            .ok_or_else(|| Failure::invalid("Profile not found"))
    }

    /// The `at-uri` parameter `name`, its authority made a DID where it is
    /// a handle the index knows, as records are kept by their DID's URI.
    pub fn record_uri(&self, params: &Params, name: &str) -> Result<String, Failure> {
        let uri = params.at_uri(name)?;
        let rest = &uri["at://".len()..];
        let (authority, path) = rest.split_once('/').unwrap_or((rest, ""));
        Ok(match self.resolve(authority)? {
            Some(did) if !path.is_empty() => format!("at://{did}/{path}"),
            _ => uri.to_string(),
        })
    }

    /// The records of `T` `sql` selects, whole.
    pub fn rows<T: Record>(
        &self,
        sql: &str,
        params: impl rusqlite::Params,
    ) -> rusqlite::Result<Vec<Row<T>>> {
        let mut stmt = self.db.prepare_cached(sql)?;
        let rows = stmt.query_map(params, row::<T>)?;
        rows.collect()
    }

    /// The rows `sql` selects, each as a tuple of its columns.
    pub fn all<T: Columns>(
        &self,
        sql: &str,
        params: impl rusqlite::Params,
    ) -> rusqlite::Result<Vec<T>> {
        let mut stmt = self.db.prepare_cached(sql)?;
        let rows = stmt.query_map(params, T::from_row)?;
        rows.collect()
    }
}

/// A result row as a tuple of its columns, in order.
pub trait Columns: Sized {
    fn from_row(row: &rusqlite::Row) -> rusqlite::Result<Self>;
}

macro_rules! columns {
    ($($t:ident $i:tt),*) => {
        impl<$($t: FromSql),*> Columns for ($($t,)*) {
            fn from_row(row: &rusqlite::Row) -> rusqlite::Result<Self> {
                Ok(($(row.get($i)?,)*))
            }
        }
    };
}

columns!(A 0);
columns!(A 0, B 1);
columns!(A 0, B 1, C 2);
columns!(A 0, B 1, C 2, D 3);
columns!(A 0, B 1, C 2, D 3, E 4);
columns!(A 0, B 1, C 2, D 3, E 4, F 5, G 6);

#[cfg(test)]
mod tests;

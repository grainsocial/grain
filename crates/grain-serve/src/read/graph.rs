//! `social.grain.graph.*`: who follows an account, whom it follows, and
//! which of its followers the viewer follows too; and whom the viewer
//! blocked and muted.
//!
//! Lists of accounts leave out those not shown and those that block, or
//! are blocked by, the viewer; not those the viewer muted. Each page holds
//! an account once, however many records it holds for the one follow.
//!
//! The viewer's own blocks and mutes list every one, shown or not, so
//! that each can be taken back: a block by its record, the latest first,
//! a mute as the index keeps it ([`crate::graph`]).

use super::moderation::{shown, unblocked};
use super::views::put;
use super::{Params, Reader, list, page};
use crate::cdn::AVATAR;
use crate::xrpc::Failure;
use rusqlite::params;
use serde_json::{Value, json};
use std::collections::HashMap;

/// Each of `dids`, in order and once, as a list's item: who it is, and,
/// where there is a viewer, whether they follow it.
pub fn accounts(r: &Reader, dids: &[&str]) -> rusqlite::Result<Vec<Value>> {
    let mut once: Vec<&str> = Vec::new();
    for did in dids {
        if !once.contains(did) {
            once.push(did);
        }
    }
    let actors = r.actors(&once)?;
    let follows: HashMap<String, String> = r
        .all::<(String, String)>(
            "SELECT subject, uri FROM follow WHERE did = ?1 AND subject IN (SELECT value FROM json_each(?2))
             ORDER BY uri DESC",
            params![r.viewer, list(&once)],
        )?
        .into_iter()
        .collect();
    Ok(once
        .iter()
        .map(|did| {
            let actor = &actors[*did];
            let mut item = json!({"did": did, "handle": actor.handle});
            if let Some(p) = &actor.profile {
                put(&mut item, "displayName", p.record.display_name.clone());
                put(&mut item, "description", p.record.description.clone());
                let avatar = p
                    .record
                    .avatar
                    .as_ref()
                    .and_then(|a| r.cdn.url(did, &a.0, AVATAR));
                put(&mut item, "avatar", avatar);
            }
            if r.viewer.is_some() {
                let mut viewer = json!({});
                put(&mut viewer, "following", follows.get(*did).cloned());
                item["viewer"] = viewer;
            }
            item
        })
        .collect())
}

/// Which way a list of follows runs: to an account, or from it.
#[derive(Clone, Copy)]
pub enum Way {
    Followers,
    Following,
}

impl Way {
    /// The column naming the account listed, and the one naming the
    /// account the list is of.
    fn columns(self) -> (&'static str, &'static str) {
        match self {
            Way::Followers => ("did", "subject"),
            Way::Following => ("subject", "did"),
        }
    }

    /// A page of the accounts listed, the latest follow first, and how
    /// many they are in all.
    pub fn sql(self) -> (String, String) {
        let (listed, of) = self.columns();
        let filter = format!(
            "f.{of} = ?1 AND {} AND {}",
            shown(&format!("f.{listed}")),
            unblocked(&format!("f.{listed}"), "?2")
        );
        let rows = format!(
            "SELECT f.{listed}, f.created_at, f.uri FROM follow f WHERE {filter}
               AND (f.created_at, f.uri) < (?3, ?4) ORDER BY f.created_at DESC, f.uri DESC LIMIT ?5"
        );
        let count = format!("SELECT count(DISTINCT f.{listed}) FROM follow f WHERE {filter}");
        (rows, count)
    }
}

fn listing(r: &Reader, p: &Params, way: Way) -> Result<Value, Failure> {
    let did = r.actor(p)?;
    let limit = p.limit(50, 100)?;
    let (at, after) = p.after(false)?;
    let (rows_sql, count_sql) = way.sql();
    let rows: Vec<(String, String, String)> = r.all(
        &rows_sql,
        params![did, r.viewer, at, after, (limit + 1) as i64],
    )?;
    let total: i64 =
        r.db.query_row(&count_sql, params![did, r.viewer], |row| row.get(0))?;
    let (rows, cursor) = page(rows, limit, |(_, at, uri)| (at.as_str(), uri.as_str()));
    let dids: Vec<&str> = rows.iter().map(|(did, _, _)| did.as_str()).collect();
    let mut answer = json!({"totalCount": total, "items": accounts(r, &dids)?});
    put(&mut answer, "cursor", cursor);
    Ok(answer)
}

/// `social.grain.graph.getFollowers`.
pub fn get_followers(r: &Reader, p: &Params) -> Result<Value, Failure> {
    listing(r, p, Way::Followers)
}

/// `social.grain.graph.getFollowing`.
pub fn get_following(r: &Reader, p: &Params) -> Result<Value, Failure> {
    listing(r, p, Way::Following)
}

/// The followers of `?1` the viewer `?2` follows, the latest follow
/// first, one row an account.
pub fn known_sql() -> String {
    format!(
        "SELECT f.did FROM follow f JOIN follow v ON v.did = ?2 AND v.subject = f.did
         WHERE f.subject = ?1 AND {} AND {}
         GROUP BY f.did ORDER BY max(f.created_at) DESC, f.did LIMIT ?3",
        shown("f.did"),
        unblocked("f.did", "?2")
    )
}

/// `social.grain.graph.getKnownFollowers`: of an account's followers,
/// those the viewer follows, which only an account may ask.
pub fn get_known_followers(r: &Reader, p: &Params) -> Result<Value, Failure> {
    let did = r.actor(p)?;
    let viewer = r.signed_in()?;
    let limit = p.limit(50, 50)?;
    if did == viewer {
        return Ok(json!({ "items": [] }));
    }
    let known: Vec<(String,)> = r.all(&known_sql(), params![did, viewer, limit as i64])?;
    let dids: Vec<&str> = known.iter().map(|(d,)| d.as_str()).collect();
    let mut items = accounts(r, &dids)?;
    for item in items.iter_mut().filter_map(Value::as_object_mut) {
        item.remove("viewer");
    }
    Ok(json!({ "items": items }))
}

/// The blocks `?1` made, the latest first, after the cursor's `?2` and
/// `?3`.
pub const BLOCKS_SQL: &str = "SELECT subject, created_at, uri FROM block
     WHERE did = ?1 AND (created_at, uri) < (?2, ?3)
     ORDER BY created_at DESC, uri DESC LIMIT ?4";

/// The accounts `?1` muted, the latest first, after the cursor's `?2` and
/// `?3`.
pub const MUTES_SQL: &str = "SELECT subject, created_at FROM mute
     WHERE did = ?1 AND (created_at, subject) < (?2, ?3)
     ORDER BY created_at DESC, subject DESC LIMIT ?4";

/// Each of `dids` as a `blockItem` or `muteItem` names it: who it is.
fn named(r: &Reader, dids: &[&str]) -> rusqlite::Result<Vec<Value>> {
    let actors = r.actors(dids)?;
    Ok(dids
        .iter()
        .map(|did| {
            let actor = &actors[*did];
            let mut item = json!({"did": did, "handle": actor.handle});
            if let Some(p) = &actor.profile {
                put(&mut item, "displayName", p.record.display_name.clone());
                let avatar = p.record.avatar.as_ref();
                put(
                    &mut item,
                    "avatar",
                    avatar.and_then(|a| r.cdn.url(did, &a.0, AVATAR)),
                );
            }
            item
        })
        .collect())
}

/// `social.grain.graph.getBlocks`: the accounts the viewer blocked, each
/// with the block's record, which only an account may ask.
pub fn get_blocks(r: &Reader, p: &Params) -> Result<Value, Failure> {
    let viewer = r.signed_in()?;
    let limit = p.limit(50, 100)?;
    let (at, after) = p.after(false)?;
    let rows: Vec<(String, String, String)> =
        r.all(BLOCKS_SQL, params![viewer, at, after, (limit + 1) as i64])?;
    let (rows, cursor) = page(rows, limit, |(_, at, uri)| (at.as_str(), uri.as_str()));
    let dids: Vec<&str> = rows.iter().map(|(did, _, _)| did.as_str()).collect();
    let mut items = named(r, &dids)?;
    for (item, (_, _, uri)) in items.iter_mut().zip(&rows) {
        item["blockUri"] = uri.as_str().into();
    }
    let mut answer = json!({ "items": items });
    put(&mut answer, "cursor", cursor);
    Ok(answer)
}

/// `social.grain.graph.getMutes`: the accounts the viewer muted, which
/// only an account may ask.
pub fn get_mutes(r: &Reader, p: &Params) -> Result<Value, Failure> {
    let viewer = r.signed_in()?;
    let limit = p.limit(50, 100)?;
    let (at, after) = p.after(false)?;
    let rows: Vec<(String, String)> =
        r.all(MUTES_SQL, params![viewer, at, after, (limit + 1) as i64])?;
    let (rows, cursor) = page(rows, limit, |(did, at)| (at.as_str(), did.as_str()));
    let dids: Vec<&str> = rows.iter().map(|(did, _)| did.as_str()).collect();
    let mut answer = json!({ "items": named(r, &dids)? });
    put(&mut answer, "cursor", cursor);
    Ok(answer)
}

#[cfg(test)]
pub fn queries() -> Vec<String> {
    let (a, b) = Way::Followers.sql();
    let (c, d) = Way::Following.sql();
    vec![a, b, c, d, known_sql(), BLOCKS_SQL.into(), MUTES_SQL.into()]
}

//! `social.grain.actor.*`: an account's profile, the galleries it
//! favorited, and who it might follow.

use super::moderation::{shown, unblocked, unhidden, unmuted};
use super::views::put;
use super::{Params, Reader, list, page};
use crate::cdn::AVATAR;
use crate::index::records::Json;
use crate::xrpc::Failure;
use axum::http::StatusCode;
use rusqlite::params;
use serde_json::{Map, Value, json};

/// Why an account's profile is not shown, as Bluesky's appview says it:
/// taken down, here or by its host, deactivated, or deleted.
fn withheld(r: &Reader, did: &str) -> Result<(), Failure> {
    let (taken, host): (bool, Option<String>) = r.db.query_row(
        "SELECT EXISTS (SELECT 1 FROM takedown WHERE did = ?1),
                (SELECT host_status FROM repo WHERE did = ?1)",
        [did],
        |row| Ok((row.get(0)?, row.get(1)?)),
    )?;
    let refused = |error, why: &str| Err(Failure::new(StatusCode::BAD_REQUEST, error, why));
    match host.as_deref() {
        _ if taken => refused("AccountTakedown", "Account has been suspended"),
        Some("deactivated") => refused("AccountDeactivated", "Account is deactivated"),
        Some("deleted") => refused("InvalidRequest", "Profile not found"),
        Some(_) => refused("AccountTakedown", "Account has been suspended"),
        None => Ok(()),
    }
}

/// An account's galleries with photos in them, whether its feed shows
/// them or not; its followers; and whom it follows: accounts, however
/// many records say so.
const COUNTS: [&str; 3] = [
    "SELECT count(*) FROM gallery g WHERE g.did = ?1
     AND EXISTS (SELECT 1 FROM gallery_item i WHERE i.gallery = g.uri)",
    "SELECT count(DISTINCT did) FROM follow WHERE subject = ?1",
    "SELECT count(DISTINCT subject) FROM follow WHERE did = ?1",
];

/// Whom an account takes messages from on Germ.
const GERM: &str =
    "SELECT message_me FROM germ_declaration d WHERE d.did = ?1 ORDER BY d.uri LIMIT 1";

/// The URI of the one record of `table` by `did` naming `subject`.
const RELATION: &[(&str, &str)] = &[
    (
        "following",
        "SELECT uri FROM follow WHERE did = ?1 AND subject = ?2 ORDER BY uri LIMIT 1",
    ),
    (
        "followedBy",
        "SELECT uri FROM follow WHERE did = ?2 AND subject = ?1 ORDER BY uri LIMIT 1",
    ),
    (
        "blocking",
        "SELECT uri FROM block WHERE did = ?1 AND subject = ?2 ORDER BY uri LIMIT 1",
    ),
    (
        "blockedBy",
        "SELECT uri FROM block WHERE did = ?2 AND subject = ?1 ORDER BY uri LIMIT 1",
    ),
    (
        "muted",
        "SELECT subject FROM mute WHERE did = ?1 AND subject = ?2",
    ),
];

/// `social.grain.actor.getProfile`: the account, its counts, whom it
/// takes messages from on Germ, and, for a viewer other than itself, how
/// the two stand. A follow either way is not said where either blocks
/// the other.
pub fn get_profile(r: &Reader, p: &Params) -> Result<Value, Failure> {
    let did = r.actor(p)?;
    withheld(r, &did)?;
    let actor = r
        .actors(&[did.as_str()])?
        .remove(&did)
        .expect("an actor for each DID asked");
    let count = |sql: &str| r.db.query_row(sql, [&did], |row| row.get::<_, i64>(0));
    let [galleries, followers, follows] = COUNTS;
    let (galleries, followers, follows) = (count(galleries)?, count(followers)?, count(follows)?);
    let germ: Vec<(Option<Json>,)> = r.all(GERM, [&did])?;
    let mut view = json!({
        "did": did,
        "handle": actor.handle,
        "galleryCount": galleries,
        "followersCount": followers,
        "followsCount": follows,
    });
    put(
        &mut view,
        "messageMe",
        germ.into_iter().next().and_then(|(m,)| m).map(|m| m.0),
    );
    let mut labelled = vec![did.as_str()];
    if let Some(profile) = &actor.profile {
        let record = &profile.record;
        view["cid"] = profile.cid.as_str().into();
        put(&mut view, "displayName", record.display_name.clone());
        put(&mut view, "description", record.description.clone());
        let avatar = record
            .avatar
            .as_ref()
            .and_then(|a| r.cdn.url(&did, &a.0, AVATAR));
        put(&mut view, "avatar", avatar);
        put(&mut view, "createdAt", record.created_at.clone());
        labelled.push(&profile.uri);
    }
    let labels: Vec<Value> = r.labels(&labelled)?.into_values().flatten().collect();
    put(&mut view, "labels", (!labels.is_empty()).then_some(labels));
    // The viewer, unless they are the account itself.
    let other = r.viewer.filter(|v| *v != did);
    let mut stand = Map::new();
    for (field, sql) in RELATION {
        let found: Vec<(String,)> = r.all(sql, params![other, did])?;
        if let Some((uri,)) = found.into_iter().next() {
            stand.insert(field.to_string(), uri.into());
        }
    }
    if stand.contains_key("blocking") || stand.contains_key("blockedBy") {
        stand.remove("following");
        stand.remove("followedBy");
    }
    for flag in ["blockedBy", "muted"] {
        if stand.contains_key(flag) {
            stand.insert(flag.into(), true.into());
        }
    }
    put(&mut view, "viewer", (!stand.is_empty()).then_some(stand));
    Ok(view)
}

/// The galleries the viewer favorited, the latest favorite first: one
/// row a gallery however many times it was favorited, of authors shown,
/// with photos in it, and not labelled to hide.
pub fn favorites_sql() -> String {
    format!(
        "SELECT f.subject, max(f.created_at) AS at FROM favorite f JOIN gallery g ON g.uri = f.subject
         WHERE f.did = ?1 AND {} AND {}
           AND EXISTS (SELECT 1 FROM gallery_item i WHERE i.gallery = g.uri)
         GROUP BY f.subject HAVING (at, f.subject) < (?2, ?3)
         ORDER BY at DESC, f.subject DESC LIMIT ?4",
        shown("g.did"),
        unhidden("g.uri"),
    )
}

/// `social.grain.actor.getFavorites`: the galleries an account favorited,
/// which only the account itself may ask for.
pub fn get_favorites(r: &Reader, p: &Params) -> Result<Value, Failure> {
    let did = r.actor(p)?;
    if r.signed_in()? != did {
        return Err(Failure::invalid(
            "an account's favorites are its own to list",
        ));
    }
    let limit = p.limit(30, 100)?;
    let (at, after) = p.after(false)?;
    let rows: Vec<(String, String)> = r.all(
        &favorites_sql(),
        params![did, at, after, (limit + 1) as i64],
    )?;
    let (rows, cursor) = page(rows, limit, |(uri, at)| (at.as_str(), uri.as_str()));
    let uris: Vec<&str> = rows.iter().map(|(uri, _)| uri.as_str()).collect();
    let mut answer = json!({ "items": r.galleries_at(&uris)? });
    put(&mut answer, "cursor", cursor);
    Ok(answer)
}

/// SQL that holds where `did` is one `?1` might be shown to follow: shown,
/// not followed by `?1` yet, and neither blocking, blocked by nor muted
/// by them.
fn followable(did: &str) -> String {
    format!(
        "{} AND {did} NOT IN (SELECT subject FROM follow WHERE did = ?1) AND {} AND {}",
        shown(did),
        unblocked(did, "?1"),
        unmuted(did, "?1")
    )
}

/// The accounts `?1` follows on Bluesky that have a grain profile, `?2`
/// of them.
pub fn bsky_follows_sql() -> String {
    format!(
        "SELECT DISTINCT f.subject FROM bsky_follow f JOIN profile p ON p.did = f.subject
         WHERE f.did = ?1 AND f.subject != ?1 AND {}
         ORDER BY f.subject LIMIT ?2",
        followable("f.subject")
    )
}

/// The most followed accounts with a grain profile, other than `?2`'s,
/// `?3` of them.
pub fn popular_sql() -> String {
    format!(
        "SELECT s.subject FROM (SELECT subject, count(*) AS n FROM follow GROUP BY subject) s
         WHERE EXISTS (SELECT 1 FROM profile p WHERE p.did = s.subject)
           AND s.subject NOT IN (SELECT value FROM json_each(?2)) AND {}
         ORDER BY s.n DESC, s.subject LIMIT ?3
         -- scans: follow, counting every follow for the most followed, until a count is kept
         -- sorts: follow, as above",
        followable("s.subject")
    )
}

/// How many follow each of `?1`.
pub const FOLLOWERS_SQL: &str = "SELECT subject, count(DISTINCT did) FROM follow
     WHERE subject IN (SELECT value FROM json_each(?1)) GROUP BY subject";

/// `social.grain.actor.getSuggestedFollows`: who `actor` might follow on
/// grain, those they follow on Bluesky first, then the most followed.
pub fn get_suggested_follows(r: &Reader, p: &Params) -> Result<Value, Failure> {
    let actor = r.actor(p)?;
    let limit = p.limit(10, 20)?;
    let mut dids: Vec<String> = r
        .all::<(String,)>(&bsky_follows_sql(), params![actor, limit as i64])?
        .into_iter()
        .map(|(d,)| d)
        .collect();
    if dids.len() < limit {
        let mut not = dids.clone();
        not.push(actor.clone());
        let more: Vec<(String,)> = r.all(
            &popular_sql(),
            params![actor, list(&not), (limit - dids.len()) as i64],
        )?;
        dids.extend(more.into_iter().map(|(d,)| d));
    }
    let dids: Vec<&str> = dids.iter().map(String::as_str).collect();
    let actors = r.actors(&dids)?;
    let followers: std::collections::HashMap<String, i64> = r
        .all::<(String, i64)>(FOLLOWERS_SQL, [list(&dids)])?
        .into_iter()
        .collect();
    let items: Vec<Value> = dids
        .iter()
        .map(|did| {
            let actor = &actors[*did];
            let mut item = json!({
                "did": did,
                "handle": actor.handle,
                "followersCount": followers.get(*did).copied().unwrap_or(0),
            });
            if let Some(p) = &actor.profile {
                put(&mut item, "displayName", p.record.display_name.clone());
                put(&mut item, "description", p.record.description.clone());
                let avatar = p.record.avatar.as_ref();
                put(
                    &mut item,
                    "avatar",
                    avatar.and_then(|a| r.cdn.url(&p.did, &a.0, AVATAR)),
                );
            }
            item
        })
        .collect();
    Ok(json!({ "items": items }))
}

/// The SQL these queries run, for the plan check.
#[cfg(test)]
pub fn queries() -> Vec<String> {
    let mut all: Vec<String> = RELATION.iter().map(|(_, sql)| sql.to_string()).collect();
    all.extend(COUNTS.iter().map(|s| s.to_string()));
    all.push(GERM.into());
    all.push(favorites_sql());
    all.extend([bsky_follows_sql(), popular_sql(), FOLLOWERS_SQL.into()]);
    all
}

//! Groups: `social.grain.group.getGroup`, `listGroups`, `getSubmissions`,
//! `joinGroup`, `leaveGroup`, `createGroup` and `getGroupHost`.
//!
//! A group is an account that declared itself one
//! (`fyi.opensocial.declaration`, in the index), run by a group host: the
//! PDS its DID document names, which serves `fyi.opensocial.*` and names
//! itself by the DID its `/.well-known/did.json` gives ([`host_of`]). Its
//! profile is its grain profile, else what its host lists of it
//! ([`listing`]); its pool is its `social.grain.group.item` records, in
//! the index.
//!
//! Who belongs is not public: the roster lives in the group's members
//! space (`fyi.opensocial.members`), which only members read. So whether
//! the viewer belongs is theirs to say, and is checked the way the host
//! decides it: a credential for the members space, given to members alone
//! ([`is_member`]). The groups a viewer is in are the members spaces their
//! own PDS lists, where they keep an acceptance
//! (`fyi.opensocial.acceptance`), each confirmed so ([`groups_of`]): a PDS
//! keeps listing a space after the acceptance in it is gone, and stores
//! one the host never admitted. Joining and leaving are the host's to
//! decide, asked as the viewer by service auth their PDS signs
//! ([`call_host`]).
//!
//! Starting one takes a group host that has agreed to found groups for
//! grain, `--group-host` ([`starter`]): it founds the group with the
//! caller as its founder and hands grain a session as it
//! ([`create_group`]).

use super::{as_account, checked, credential_for, parse, support};
use crate::App;
use crate::login;
use crate::read::{Params, Reader, list};
use crate::write::writer;
use crate::xrpc::Failure;
use anyhow::Context;
use axum::Json;
use axum::body::Bytes;
use axum::extract::{Query, State};
use axum::http::{HeaderMap, StatusCode};
use grain::space::{self, Admin, MEMBERS};
use grain::xrpc::{Xrpc, XrpcError};
use serde::Deserialize;
use serde_json::{Value, json};
use std::collections::{HashMap, HashSet};
use std::sync::Arc;
use std::time::{Duration, Instant};

pub const GET: &str = "social.grain.group.getGroup";
pub const LIST: &str = "social.grain.group.listGroups";
pub const SUBMISSIONS: &str = "social.grain.group.getSubmissions";
pub const JOIN: &str = "social.grain.group.joinGroup";
pub const LEAVE: &str = "social.grain.group.leaveGroup";
pub const CREATE: &str = "social.grain.group.createGroup";
pub const HOST: &str = "social.grain.group.getGroupHost";

/// What a group host is asked to found a group by.
const PROVISION: &str = "fyi.opensocial.provisionGroup";

/// What grain asks for of a group it starts, to speak for it on grain:
/// its profile, and its answers to what is offered to its pool.
const GROUP_SCOPE: &str = "atproto repo:social.grain.actor.profile \
repo:social.grain.group.item repo:social.grain.group.decline";

/// How long a group started waits for its declaration to reach the
/// index, and how often it looks.
const DECLARED_WITHIN: Duration = Duration::from_secs(5);
const DECLARED_EVERY: Duration = Duration::from_millis(200);

const ACCEPTANCE: &str = "fyi.opensocial.acceptance";

/// How long a host's listing of a group is kept.
const LISTING_LASTS: Duration = Duration::from_secs(10 * 60);

/// How long a refusal of a group's member list is kept, so that a page a
/// non-member reloads does not ask for a credential each time.
const REFUSAL_LASTS: Duration = Duration::from_secs(2 * 60);

/// Where a group is run: its host's URL, and the DID service tokens name
/// it by.
#[derive(Debug, Clone, PartialEq)]
pub struct Host {
    pub url: String,
    pub did: String,
}

/// The host of `group`: its PDS, as its DID document names it, and the
/// DID that PDS's `/.well-known/did.json` names it by.
pub async fn host_of(app: &App, group: &str) -> anyhow::Result<Host> {
    let url = grain::identity::resolve_pds(&app.ctx, group).await?;
    let url = url.trim_end_matches('/').to_string();
    let doc = app.ctx.guarded.get(format!("{url}/.well-known/did.json"));
    let doc: Value = doc.send().await?.error_for_status()?.json().await?;
    let did = doc["id"].as_str();
    let did = did.context(format!("{url} names itself by no DID"))?;
    Ok(Host {
        url,
        did: did.to_string(),
    })
}

/// What `group`'s host lists of it, unauthenticated: its name, about,
/// site, how to join and rules, and its avatar, which the host serves.
/// None from a host that lists no such group, or does not answer. Kept a
/// while, unless `fresh`.
pub async fn listing(app: &App, group: &str, fresh: bool) -> Option<Value> {
    {
        let kept = app.spaces.listings.lock().unwrap();
        let kept = kept
            .get(group)
            .filter(|(at, _)| at.elapsed() < LISTING_LASTS);
        if let Some((_, listing)) = kept.filter(|_| !fresh) {
            return listing.clone();
        }
    }
    let found = listed(app, group).await.ok().flatten();
    let mut kept = app.spaces.listings.lock().unwrap();
    kept.insert(group.to_string(), (Instant::now(), found.clone()));
    found
}

async fn listed(app: &App, group: &str) -> anyhow::Result<Option<Value>> {
    let host = host_of(app, group).await?;
    let groups: Value = Xrpc::new(app.ctx.guarded.clone(), &host.url)
        .query("fyi.opensocial.listGroups", &[], None)
        .await?;
    let groups = groups["groups"].as_array().cloned().unwrap_or_default();
    let found = groups.into_iter().find(|g| g["did"] == group);
    Ok(found.map(|mut found| {
        if let Some(avatar) = found["avatar"].as_str() {
            let version = &avatar[avatar.len().saturating_sub(12)..];
            found["avatarUrl"] = format!("{}/img/{group}/avatar?v={version}", host.url).into();
        }
        found
    }))
}

/// Whether `did` declared itself a group.
pub fn is_group(app: &App, did: &str) -> Result<bool, Failure> {
    let index = support::index(app)?;
    let sql = "SELECT 1 FROM group_declaration d WHERE d.did = ?1 LIMIT 1";
    let found = index.read(|db| db.prepare_cached(sql)?.exists([did]));
    Ok(found?)
}

/// Whether `group`'s host admits `viewer` to its member list: given a
/// credential for it. A group is a member of none. The host's refusal is
/// kept a while, unless `fresh`; any other failure is not kept, and
/// answers no this once.
pub async fn is_member(app: &App, viewer: &str, group: &str, fresh: bool) -> Result<bool, Failure> {
    let key = (viewer.to_string(), group.to_string());
    let refused = app.spaces.refused.lock().unwrap().get(&key).copied();
    let lately = !fresh && refused.is_some_and(|at| at.elapsed() < REFUSAL_LASTS);
    if lately || is_group(app, viewer)? {
        return Ok(false);
    }
    let got = credential_for(app, viewer, GET, &space::members(group)).await;
    let mut refused = app.spaces.refused.lock().unwrap();
    match got {
        Ok(_) => {
            refused.remove(&key);
            Ok(true)
        }
        // Only the host's no is kept; anything else is asked again.
        Err(e) => {
            let refusal = e.error == "NotAuthorized";
            refused.extend(refusal.then(|| (key, Instant::now())));
            Ok(false)
        }
    }
}

async fn candidates(app: &App, viewer: &str) -> Result<Vec<String>, Failure> {
    let spaces = as_account(app, viewer, LIST, |session| async move {
        space::list_spaces(&app.ctx, &session, MEMBERS).await
    })
    .await?;
    let mut groups: Vec<String> = Vec::new();
    for named in spaces
        .iter()
        .filter_map(|s| space::of_kind(s, MEMBERS).ok())
    {
        if !groups.contains(&named.authority) {
            groups.push(named.authority);
        }
    }
    Ok(groups)
}

/// The groups `viewer` is in: their PDS's candidates, each confirmed by
/// its host. None for a viewer whose PDS does not say, and none for a
/// group, which [`is_member`] finds a member of none.
pub async fn groups_of(app: &App, viewer: &str) -> Result<Vec<String>, Failure> {
    let Ok(candidates) = candidates(app, viewer).await else {
        return Ok(Vec::new());
    };
    let checks = candidates.iter().map(|g| is_member(app, viewer, g, false));
    let checked = futures::future::join_all(checks).await;
    let mine = candidates.iter().zip(checked);
    Ok(mine
        .filter(|(_, m)| matches!(m, Ok(true)))
        .map(|(g, _)| g.clone())
        .collect())
}

/// Writes `viewer`'s acceptance of `group`, their half of being in it.
async fn accept(app: &App, viewer: &str, group: &str) -> Result<(), Failure> {
    let members = space::members(group);
    let record = json!({ "$type": ACCEPTANCE, "createdAt": grain::keys::now_iso() });
    let (members, record) = (&members, &record);
    as_account(app, viewer, JOIN, |session| async move {
        let admin = Admin {
            ctx: &app.ctx,
            session: &session,
        };
        admin.put_record(members, ACCEPTANCE, "self", record).await
    })
    .await
}

/// Takes `viewer`'s acceptance of `group` back.
async fn withdraw(app: &App, viewer: &str, group: &str) -> Result<(), Failure> {
    let members = space::members(group);
    let members = &members;
    as_account(app, viewer, LEAVE, |session| async move {
        let admin = Admin {
            ctx: &app.ctx,
            session: &session,
        };
        admin.delete_record(members, ACCEPTANCE, "self").await
    })
    .await
}

/// Calls the procedure `lxm` at `group`'s host as `did`, with service
/// auth its PDS signs for the host. A host's refusal is told as it said
/// it.
pub async fn call_host(
    app: &App,
    did: &str,
    group: &str,
    lxm: &str,
    body: &Value,
) -> Result<Value, Failure> {
    let host = host_of(app, group).await;
    let host = host.map_err(|e| super::upstream(format!("finding {group}'s host: {e:#}")))?;
    let aud = &host.did;
    let token = as_account(app, did, lxm, |session| async move {
        grain::auth::service_token(&app.ctx, &session, aud, lxm).await
    })
    .await?;
    let auth = grain::xrpc::Auth::bearer(&token);
    let answered = Xrpc::new(app.ctx.guarded.clone(), &host.url)
        .procedure(lxm, Some(body), Some(&auth))
        .await;
    answered.map_err(|e| match XrpcError::of(&e) {
        Some(x) if (400..500).contains(&x.status) => {
            let why = format!("{}: {}", x.error, x.message);
            Failure::new(StatusCode::BAD_REQUEST, "InvalidRequest", why)
        }
        _ => super::upstream(format!("{lxm} at {}: {e:#}", host.url)),
    })
}

const POOLS_SQL: &str = "SELECT i.did, count(*), max(i.created_at) FROM group_item i
    JOIN gallery g ON g.uri = i.gallery
    WHERE i.did IN (SELECT value FROM json_each(?1)) GROUP BY i.did";

const PENDING_SQL: &str = "SELECT count(*) FROM group_submission s WHERE s.group_did = ?1
    AND NOT EXISTS (SELECT 1 FROM group_item i WHERE i.did = s.group_did AND i.gallery = s.gallery)
    AND NOT EXISTS (SELECT 1 FROM group_decline d WHERE d.did = s.group_did AND d.submission = s.uri)";

const SUBMITTED_SQL: &str =
    "SELECT s.uri, s.group_did FROM group_submission s WHERE s.did = ?1 AND s.gallery = ?2";

const POOLED_SQL: &str = "SELECT i.uri, i.did FROM group_item i WHERE i.gallery = ?1";

const DECLINED_SQL: &str = "SELECT d.submission FROM group_decline d WHERE d.gallery = ?1";

/// What a viewer asking of groups is, for their views.
pub(super) struct Asking<'a> {
    pub(super) viewer: Option<&'a str>,
    /// The gallery the viewer's standing in each group is asked for.
    pub(super) gallery: Option<&'a str>,
    /// The groups the viewer is in.
    pub(super) mine: &'a [String],
}

/// `dids`, groups, as `groupView`s, in order.
pub(super) async fn views(
    app: &App,
    dids: &[String],
    asking: &Asking<'_>,
) -> Result<Vec<Value>, Failure> {
    let listed = dids
        .iter()
        .map(|did| listing(app, did, asking.viewer == Some(did.as_str())));
    let listed = futures::future::join_all(listed).await;
    let index = support::index(app)?;
    let read = index.read(|db| {
        let reader = Reader {
            db,
            cdn: &app.cdn,
            rankings: &app.rankings,
            viewer: asking.viewer,
            service: app.did.as_deref(),
        };
        let wanted: Vec<&str> = dids.iter().map(String::as_str).collect();
        let actors = reader.actors(&wanted)?;
        let pools: Vec<(String, i64, String)> = reader.all(POOLS_SQL, [list(dids)])?;
        let acting = asking.viewer.filter(|v| dids.iter().any(|d| d == v));
        let pending: Option<i64> = match acting {
            Some(group) => reader
                .all::<(i64,)>(PENDING_SQL, [group])?
                .first()
                .map(|r| r.0),
            None => None,
        };
        let standing = match (asking.viewer, asking.gallery) {
            (Some(viewer), Some(gallery)) => {
                let submitted: Vec<(String, String)> =
                    reader.all(SUBMITTED_SQL, [viewer, gallery])?;
                let pooled: Vec<(String, String)> = reader.all(POOLED_SQL, [gallery])?;
                let declined: Vec<(String,)> = reader.all(DECLINED_SQL, [gallery])?;
                Some((submitted, pooled, declined))
            }
            _ => None,
        };
        Ok::<_, rusqlite::Error>((actors, pools, pending, standing))
    });
    let (actors, pools, pending, standing) = read?;
    let pools: HashMap<&str, (i64, &str)> = pools
        .iter()
        .map(|(did, n, last)| (did.as_str(), (*n, last.as_str())))
        .collect();
    let mut out = Vec::new();
    for (did, listed) in dids.iter().zip(listed) {
        let actor = actors.get(did.as_str());
        let profile = actor.and_then(|a| a.profile.as_ref());
        let listed = listed.unwrap_or(Value::Null);
        let handle = actor.map(|a| a.handle.as_str()).unwrap_or(did);
        let mut view = json!({ "did": did, "handle": handle });
        let named = profile.and_then(|p| p.record.display_name.clone());
        let named = named.or_else(|| listed["displayName"].as_str().map(str::to_string));
        crate::read::views::put(&mut view, "displayName", named);
        let about = profile.and_then(|p| p.record.description.clone());
        let about = about.or_else(|| listed["description"].as_str().map(str::to_string));
        crate::read::views::put(&mut view, "description", about);
        let avatar = profile.and_then(|p| p.record.avatar.as_ref());
        let avatar = avatar.and_then(|a| app.cdn.url(did, &a.0, crate::cdn::AVATAR));
        let avatar = avatar.or_else(|| listed["avatarUrl"].as_str().map(str::to_string));
        crate::read::views::put(&mut view, "avatar", avatar);
        crate::read::views::put(&mut view, "url", listed["url"].as_str());
        let (count, last) = pools.get(did.as_str()).copied().unwrap_or((0, ""));
        view["poolCount"] = count.into();
        if !last.is_empty() {
            view["lastActivityAt"] = last.into();
        }
        let policy = listed["joinPolicy"]
            .as_str()
            .map(|p| p.rsplit('#').next().unwrap_or(p));
        crate::read::views::put(&mut view, "joinPolicy", policy);
        let rules: Vec<Value> = listed["rules"]
            .as_array()
            .into_iter()
            .flatten()
            .filter_map(|r| {
                let rkey = r["rkey"].as_str()?;
                let mut rule = json!({
                    // As a record in a space is named here: by the URI it
                    // would have in its repo.
                    "uri": format!("at://{did}/fyi.opensocial.rule/{rkey}"),
                    "title": r["title"].as_str()?,
                });
                crate::read::views::put(&mut rule, "text", r["text"].as_str());
                Some(rule)
            })
            .collect();
        if !rules.is_empty() {
            view["rules"] = rules.into();
        }
        let acting = asking.viewer == Some(did.as_str());
        if acting {
            view["pendingCount"] = pending.unwrap_or(0).into();
        }
        let member = asking.mine.contains(did);
        let submission = standing.as_ref().and_then(|(submitted, pooled, declined)| {
            let submitted = submitted.iter().find(|(_, g)| g == did).map(|(u, _)| u);
            let item = pooled.iter().find(|(_, g)| g == did).map(|(u, _)| u);
            let status = match (submitted, item) {
                (_, Some(_)) => "accepted",
                (Some(uri), None) if declined.iter().any(|(d,)| d == uri) => "declined",
                (Some(_), None) => "pending",
                (None, None) => return None,
            };
            let uri = submitted.or(item)?;
            let mut state = json!({ "uri": uri, "status": status });
            crate::read::views::put(&mut state, "item", item.map(String::as_str));
            Some(state)
        });
        if acting || member || submission.is_some() {
            let mut viewer = json!({});
            if acting {
                viewer["acting"] = true.into();
            }
            if member {
                viewer["member"] = true.into();
            }
            crate::read::views::put(&mut viewer, "submission", submission);
            view["viewer"] = viewer;
        }
        out.push(view);
    }
    Ok(out)
}

/// Refuses `group` unless it is a group's DID, before its host is looked
/// for or anything is written.
fn a_group(app: &App, group: &str) -> Result<(), Failure> {
    let did = atproto::syntax::is_did(group);
    match did && is_group(app, group)? {
        true => Ok(()),
        false => Err(Failure::invalid("group must be a group's did")),
    }
}

/// The group `actor`, a DID or handle, names: one the index has a
/// declaration of.
fn group_named(app: &App, actor: &str) -> Result<String, Failure> {
    let index = support::index(app)?;
    let did = index.read(|db| {
        let reader = Reader {
            db,
            cdn: &app.cdn,
            rankings: &app.rankings,
            viewer: None,
            service: None,
        };
        reader.resolve(actor)
    })?;
    match did {
        Some(did) if is_group(app, &did)? => Ok(did),
        _ => Err(Failure::invalid("Not a group")),
    }
}

/// The caller, if they say who they are.
async fn viewer(app: &App, headers: &HeaderMap, lxm: &str) -> Result<Option<String>, Failure> {
    crate::viewer::viewer(app, headers, lxm).await
}

/// `getGroup`: the group, and, for a viewer, whether they are in it as its
/// host says now. One admitted since they last looked has no acceptance
/// yet, and this is where it is written.
pub async fn get_group(
    State(app): State<Arc<App>>,
    headers: HeaderMap,
    Query(params): Query<Vec<(String, String)>>,
) -> Result<Json<Value>, Failure> {
    let app: &App = &app;
    let group = group_named(app, Params(params).required("actor")?)?;
    let viewer = viewer(app, &headers, GET).await?;
    let mut mine = Vec::new();
    if let Some(viewer) = viewer.as_deref().filter(|v| *v != group)
        && is_member(app, viewer, &group, true).await?
    {
        let listed = candidates(app, viewer).await.unwrap_or_default();
        if !listed.contains(&group) {
            // Taken as it comes: they are in it either way.
            let _ = accept(app, viewer, &group).await;
        }
        mine.push(group.clone());
    }
    let asking = Asking {
        viewer: viewer.as_deref(),
        gallery: None,
        mine: &mine,
    };
    let view = views(app, std::slice::from_ref(&group), &asking).await?;
    Ok(Json(view.into_iter().next().unwrap_or_default()))
}

fn list_groups_sql() -> String {
    format!(
        "SELECT d.did FROM group_declaration d WHERE {}
         ORDER BY (SELECT max(i.created_at) FROM group_item i WHERE i.did = d.did) DESC NULLS LAST,
           d.created_at DESC LIMIT ?1
         -- scans: group_declaration, as groups are few, each made on a group host
         -- sorts: group_declaration, as above",
        crate::read::moderation::shown("d.did")
    )
}

/// `listGroups`: every group shown, the ones whose pool moved latest
/// first; one with an empty pool still lists, or nothing could be
/// offered to it. With `gallery`, the viewer's standing in each for it.
pub async fn list_groups(
    State(app): State<Arc<App>>,
    headers: HeaderMap,
    Query(params): Query<Vec<(String, String)>>,
) -> Result<Json<Value>, Failure> {
    let app: &App = &app;
    let params = Params(params);
    let limit = params.limit(50, 100)?;
    let gallery = params.get("gallery");
    if gallery.is_some_and(|g| !atproto::lexicon::is_at_uri(g)) {
        return Err(Failure::invalid("gallery must be a valid at-uri"));
    }
    let index = support::index(app)?;
    let dids: Vec<String> = index.read(|db| {
        let mut stmt = db.prepare_cached(&list_groups_sql())?;
        let rows = stmt.query_map([limit as i64], |r| r.get(0))?;
        rows.collect::<rusqlite::Result<_>>()
    })?;
    let viewer = viewer(app, &headers, LIST).await?;
    let mine = match &viewer {
        Some(v) => groups_of(app, v).await.unwrap_or_default(),
        None => Vec::new(),
    };
    let asking = Asking {
        viewer: viewer.as_deref(),
        gallery,
        mine: &mine,
    };
    Ok(Json(json!({ "groups": views(app, &dids, &asking).await? })))
}

fn submissions_sql() -> String {
    format!(
        "SELECT s.uri, s.cid, s.gallery, s.created_at, s.did FROM group_submission s
         WHERE s.group_did = ?1 AND {}
           AND NOT EXISTS (SELECT 1 FROM group_item i WHERE i.did = s.group_did AND i.gallery = s.gallery)
           AND NOT EXISTS (SELECT 1 FROM group_decline d WHERE d.did = s.group_did AND d.submission = s.uri)
         ORDER BY s.created_at DESC LIMIT ?2",
        crate::read::moderation::shown("s.did")
    )
}

/// `getSubmissions`: what was offered to `group` and neither pooled nor
/// declined, latest first: anyone's, as who is a member is not for grain
/// to say, and whoever acts as the group decides.
pub async fn get_submissions(
    State(app): State<Arc<App>>,
    headers: HeaderMap,
    Query(params): Query<Vec<(String, String)>>,
) -> Result<Json<Value>, Failure> {
    let app: &App = &app;
    let params = Params(params);
    let group = params.required("group")?;
    if !atproto::syntax::is_did(group) {
        return Err(Failure::invalid("group must be a valid did"));
    }
    let limit = params.limit(30, 100)?;
    let viewer = viewer(app, &headers, SUBMISSIONS).await?;
    let index = support::index(app)?;
    let submissions = index.read(|db| {
        let reader = Reader {
            db,
            cdn: &app.cdn,
            rankings: &app.rankings,
            viewer: viewer.as_deref(),
            service: app.did.as_deref(),
        };
        let sql = submissions_sql();
        let rows: Vec<(String, String, String, String, String)> =
            reader.all(&sql, rusqlite::params![group, limit as i64])?;
        let wanted: Vec<&str> = rows.iter().map(|r| r.2.as_str()).collect();
        let unique: Vec<&str> = {
            let mut seen = HashSet::new();
            wanted.iter().copied().filter(|g| seen.insert(*g)).collect()
        };
        let galleries = reader.galleries_at(&unique)?;
        let by_uri: HashMap<&str, &Value> = galleries
            .iter()
            .filter_map(|g| Some((g["uri"].as_str()?, g)))
            .collect();
        let views: Vec<Value> = rows
            .iter()
            .filter_map(|(uri, cid, gallery, at, _)| {
                let gallery = by_uri.get(gallery.as_str())?;
                Some(json!({
                    "uri": uri,
                    "cid": cid,
                    "group": group,
                    "gallery": gallery,
                    "createdAt": at,
                }))
            })
            .collect();
        Ok::<_, rusqlite::Error>(views)
    })?;
    Ok(Json(json!({ "submissions": submissions })))
}

#[derive(Deserialize)]
struct JoinInput {
    group: String,
    message: Option<String>,
}

/// `joinGroup`: asks `group`'s host to let the caller in. Admitted, the
/// caller's acceptance is written; pending, it is written when the group's
/// page next finds them admitted ([`get_group`]).
pub async fn join_group(
    State(app): State<Arc<App>>,
    headers: HeaderMap,
    body: Bytes,
) -> Result<Json<Value>, Failure> {
    let app: &App = &app;
    let did = writer(app, &headers, JOIN).await?;
    let input: JoinInput = parse(&body)?;
    a_group(app, &input.group)?;
    let mut ask = json!({ "group": input.group });
    crate::read::views::put(&mut ask, "message", input.message);
    let answer = call_host(app, &did, &input.group, "fyi.opensocial.requestJoin", &ask).await?;
    if answer["status"] != "admitted" {
        return Ok(Json(json!({ "status": "pending" })));
    }
    let key = (did.clone(), input.group.clone());
    app.spaces.refused.lock().unwrap().remove(&key);
    // Taken as it comes: the group's page writes it if this does not.
    let _ = accept(app, &did, &input.group).await;
    Ok(Json(json!({ "status": "admitted" })))
}

#[derive(Deserialize)]
struct LeaveInput {
    group: String,
}

/// `leaveGroup`: takes the caller's acceptance back, while the space still
/// takes their writes, then asks the host to let them go.
pub async fn leave_group(
    State(app): State<Arc<App>>,
    headers: HeaderMap,
    body: Bytes,
) -> Result<Json<Value>, Failure> {
    let app: &App = &app;
    let did = writer(app, &headers, LEAVE).await?;
    let input: LeaveInput = parse(&body)?;
    a_group(app, &input.group)?;
    let _ = withdraw(app, &did, &input.group).await;
    let ask = json!({ "group": input.group });
    call_host(app, &did, &input.group, "fyi.opensocial.leaveGroup", &ask).await?;
    app.spaces.forget(&did, &space::members(&input.group));
    app.spaces.forget(&did, &space::pool(&input.group));
    let key = (did, input.group);
    app.spaces
        .refused
        .lock()
        .unwrap()
        .insert(key, Instant::now());
    Ok(Json(json!({})))
}

/// The group host groups are started on: where it is, the DID service
/// tokens name it by, and the domain a group's handle ends in, the first
/// it says it takes.
#[derive(Debug, Clone, PartialEq)]
pub struct Starter {
    pub url: String,
    pub did: String,
    pub handle_domain: String,
}

/// The group host `--group-host` names, as it describes itself, kept
/// once it has; none for a server that starts no groups, or whose host
/// does not say.
pub async fn starter(app: &App) -> Option<Starter> {
    let url = app.web.as_ref()?.group_host.clone()?;
    if let Some(kept) = app.spaces.starter.lock().unwrap().clone() {
        return Some(kept);
    }
    let described = described(app, url).await;
    if let Err(e) = &described {
        tracing::info!(error = %format!("{e:#}"), "a group host did not describe itself");
    }
    let starter = described.ok()?;
    *app.spaces.starter.lock().unwrap() = Some(starter.clone());
    Some(starter)
}

/// The group host at `url`, by its DID document and `describeServer`.
async fn described(app: &App, url: String) -> anyhow::Result<Starter> {
    let doc = app.ctx.guarded.get(format!("{url}/.well-known/did.json"));
    let doc: Value = doc.send().await?.error_for_status()?.json().await?;
    let described: Value = Xrpc::new(app.ctx.guarded.clone(), &url)
        .query("com.atproto.server.describeServer", &[], None)
        .await?;
    let did = doc["id"].as_str().context("it names itself by no DID")?;
    let domain = described["availableUserDomains"][0].as_str();
    let domain = domain.context("it takes no handles")?;
    Ok(Starter {
        did: did.to_string(),
        handle_domain: domain.to_string(),
        url,
    })
}

/// `getGroupHost`: where groups are started, and the domain their handles
/// end in; nothing from a server that starts none.
pub async fn get_group_host(State(app): State<Arc<App>>) -> Json<Value> {
    Json(match starter(&app).await {
        Some(s) => json!({ "url": s.url, "handleDomain": s.handle_domain }),
        None => json!({}),
    })
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct CreateInput {
    name: String,
    display_name: String,
    description: Option<String>,
}

/// Whether `name` can begin a handle at a PDS: 3 to 18 letters, digits
/// and hyphens, starting and ending with no hyphen.
fn a_name(name: &str) -> bool {
    let ok = |c: char| c.is_ascii_lowercase() || c.is_ascii_digit();
    (3..=18).contains(&name.len())
        && name.chars().all(|c| ok(c) || c == '-')
        && name.starts_with(ok)
        && name.ends_with(ok)
}

/// `createGroup`: starts a group on the group host, the caller its
/// founder. The host founds it by service auth the caller's PDS signs,
/// and hands grain a session as the group ([`login::provisioned`]); then
/// the caller has the host open its pool, grain writes its profile as the
/// group, and the caller's acceptance makes it theirs on grain at once.
/// It answers once the group's declaration, which the host writes, has
/// reached the index, or after a few seconds, when the group's page
/// looks for itself.
pub async fn create_group(
    State(app): State<Arc<App>>,
    headers: HeaderMap,
    body: Bytes,
) -> Result<Json<Value>, Failure> {
    let app: &App = &app;
    let did = writer(app, &headers, CREATE).await?;
    let input: CreateInput = parse(&body)?;
    let (Some(starter), Some(web)) = (starter(app).await, app.web.as_deref()) else {
        let why = "This Grain does not start groups";
        return Err(Failure::new(StatusCode::BAD_REQUEST, "NotSupported", why));
    };
    let name = input.name.trim().to_lowercase();
    if !a_name(&name) {
        let why = "Use 3 to 18 letters, numbers and hyphens, not starting or ending with a hyphen";
        return Err(Failure::new(StatusCode::BAD_REQUEST, "InvalidName", why));
    }
    let handle = format!("{name}{}", starter.handle_domain);
    let mut profile = json!({
        "$type": "social.grain.actor.profile",
        "displayName": input.display_name,
        "createdAt": grain::keys::now_iso(),
    });
    crate::read::views::put(&mut profile, "description", input.description.clone());
    let profile = checked(app, "social.grain.actor.profile", profile)?;

    let aud = &starter.did;
    let token = as_account(app, &did, PROVISION, |session| async move {
        grain::auth::service_token(&app.ctx, &session, aud, PROVISION).await
    })
    .await?;
    let mut ask = json!({
        "handle": handle,
        "displayName": input.display_name,
        "scope": GROUP_SCOPE,
    });
    crate::read::views::put(&mut ask, "description", input.description);
    let url = format!("{}/xrpc/{PROVISION}", starter.url);
    let bearer = format!("Bearer {token}");
    let started = login::provisioned(app, web, &url, &ask, &bearer, &handle).await;
    let group = started.map_err(|e| {
        tracing::info!(%did, %handle, error = %format!("{e:#}"), "a group host did not start a group");
        let refused = grain::oauth::Refused::of(&e);
        match refused.is_some_and(|r| r.error.to_lowercase().contains("handle")) {
            true => Failure::new(
                StatusCode::BAD_REQUEST,
                "HandleUnavailable",
                "That handle is taken or not allowed. Try another one",
            ),
            false => Failure::new(
                StatusCode::BAD_REQUEST,
                "CreateFailed",
                "The group couldn't be started right now. Try again later",
            ),
        }
    })?;

    // Which spaces a group has, and who reads them, is its host's to
    // say, so it is the founder who asks for the pool.
    let pool = json!({
        "group": group,
        "type": space::POOL,
        "skey": "self",
        "name": "Pool",
        "readableBy": ["member"],
    });
    let opened = call_host(app, &did, &group, "fyi.opensocial.createSpace", &pool).await;
    if let Err(e) = opened {
        tracing::info!(%group, error = %e.message, "a group's pool was not opened");
        let why = "The group was started, but its pool couldn't be set up. Try again later";
        return Err(Failure::new(StatusCode::BAD_REQUEST, "PoolFailed", why));
    }
    let collection = "social.grain.actor.profile";
    crate::write::put(app, &group, collection, "self", profile, [None, None]).await?;
    // Taken as it comes: the group's page writes it if this does not.
    let _ = accept(app, &did, &group).await;
    let began = Instant::now();
    while !is_group(app, &group)? && began.elapsed() < DECLARED_WITHIN {
        tokio::time::sleep(DECLARED_EVERY).await;
    }
    Ok(Json(json!({ "did": group, "handle": handle })))
}

/// The queries the views of groups run, for their plans to be checked.
#[cfg(test)]
pub fn queries() -> Vec<String> {
    vec![
        POOLS_SQL.into(),
        PENDING_SQL.into(),
        SUBMITTED_SQL.into(),
        POOLED_SQL.into(),
        DECLINED_SQL.into(),
        submissions_sql(),
        "SELECT 1 FROM group_declaration d WHERE d.did = ?1 LIMIT 1".into(),
    ]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_name_begins_a_handle() {
        for name in ["abc", "film-club", "a1b", "x23456789012345678"] {
            assert!(a_name(name), "{name}");
        }
        for name in [
            "ab",
            "-abc",
            "abc-",
            "Film",
            "film club",
            "x234567890123456789",
            "café",
        ] {
            assert!(!a_name(name), "{name}");
        }
    }

    #[test]
    fn the_reads_of_groups_read_by_index() {
        let index = crate::index::Index::memory().unwrap();
        index.read(|db| {
            crate::index::plan::sized(db);
            for sql in queries() {
                let scans = crate::index::plan::scans(db, &sql);
                assert_eq!(scans, Vec::<String>::new(), "{sql}");
            }
            // Every group is listed, so every declaration is read.
            let scans = crate::index::plan::scans(db, &list_groups_sql());
            assert_eq!(scans, ["SCAN d"]);
        });
    }
}

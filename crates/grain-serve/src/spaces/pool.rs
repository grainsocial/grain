//! Groups' pools: `social.grain.group.*`.
//!
//! A group's pool is one space of type `social.grain.group`, anchored on
//! the group, keyed `self`, which the group's host made. Its members
//! write their own records into their own repos there: a gallery, its
//! photos and the items joining them ([`create_gallery`]), and the
//! favorites ([`put_favorite`]) and comments ([`create_comment`]) they
//! give each other's galleries. Nothing in it reaches a firehose, so
//! nothing of it is in the index: a pool is read by asking the space
//! which repos are in it and reading each where it is held ([`read_pool`]),
//! which is also why a comment on your gallery is read from the
//! commenter's repo.
//!
//! Who reads what: a pool's galleries, photos, favorites and comments are
//! read by the group's members, with a credential the group's host gives
//! only to a member; anyone else is `NotAuthorized` ([`list_galleries`],
//! [`get_gallery`]). A viewer's feed ([`list_feed`]) is every pool of the
//! groups they are in ([`super::group::groups_of`]), each read so. Writes
//! are a member's own: each names the caller's repo, which their PDS
//! takes in the pool only from a member the host lets write, so no one
//! removes another's gallery, favorite or comment here.

use super::group::{Asking, groups_of, is_group, views};
use super::{admin, as_account, caller, checked, credential_for, parse, refused};
use crate::App;
use crate::read::{Params, Reader};
use crate::write::writer;
use crate::xrpc::Failure;
use axum::Json;
use axum::body::Bytes;
use axum::extract::{Query, State};
use axum::http::HeaderMap;
use grain::space::{self, Credential, Record};
use serde::Deserialize;
use serde_json::{Value, json};
use std::collections::HashMap;
use std::sync::Arc;

pub const CREATE: &str = "social.grain.group.createGallery";
pub const DELETE: &str = "social.grain.group.deleteGallery";
pub const GET: &str = "social.grain.group.getGallery";
pub const LIST: &str = "social.grain.group.listGalleries";
pub const FEED: &str = "social.grain.group.listFeed";
pub const COMMENT: &str = "social.grain.group.createComment";
pub const UNCOMMENT: &str = "social.grain.group.deleteComment";
pub const FAVORITE: &str = "social.grain.group.putFavorite";

const GALLERY: &str = "social.grain.gallery";
const ITEM: &str = "social.grain.gallery.item";
const PHOTO: &str = "social.grain.photo";
const COMMENTS: &str = "social.grain.comment";
const FAVORITES: &str = "social.grain.favorite";

/// The most photos a gallery is made with.
const MOST: usize = 100;

/// A gallery in a pool, as its members' repos there hold it.
struct Pooled {
    did: String,
    rkey: String,
    /// The URI it would have in its author's repo, which favorites and
    /// comments name it by.
    uri: String,
    title: String,
    description: Option<String>,
    created_at: Option<String>,
    /// Its photos in order, as `galleryItem`s.
    photos: Vec<Value>,
    /// The repos and keys of its favorites.
    favs: Vec<(String, String)>,
    /// Its comments, oldest first, each with its author's DID.
    comments: Vec<(String, Value)>,
}

#[derive(Deserialize)]
struct PhotoInput {
    photo: Value,
    alt: Option<String>,
    #[serde(rename = "aspectRatio")]
    aspect_ratio: Value,
}

/// The writes making `did`'s gallery `rkey` in a space: the gallery, its
/// photos (keyed `<rkey>-<n>`) and the items joining them, which name the
/// gallery and each photo by the URI each would have in `did`'s repo, as
/// records in a space have none of their own. Returns the gallery's URI
/// too. Each record is held to its lexicon first.
fn gallery_writes(
    app: &App,
    did: &str,
    rkey: &str,
    title: &str,
    description: Option<&str>,
    photos: Vec<PhotoInput>,
    now: &str,
) -> Result<(String, Vec<Value>), Failure> {
    let gallery_uri = format!("at://{did}/{GALLERY}/{rkey}");
    let mut gallery = json!({ "$type": GALLERY, "title": title, "createdAt": now });
    if let Some(description) = description {
        gallery["description"] = description.into();
    }
    let mut writes = vec![space::create(
        GALLERY,
        rkey,
        checked(app, GALLERY, gallery)?,
    )];
    for (n, photo) in photos.into_iter().enumerate() {
        let key = format!("{rkey}-{n}");
        let record = json!({
            "$type": PHOTO,
            "photo": photo.photo,
            "alt": photo.alt.unwrap_or_default(),
            "aspectRatio": photo.aspect_ratio,
            "createdAt": now,
        });
        writes.push(space::create(PHOTO, &key, checked(app, PHOTO, record)?));
        let item = json!({
            "$type": ITEM,
            "gallery": gallery_uri,
            "item": format!("at://{did}/{PHOTO}/{key}"),
            "position": n,
            "createdAt": now,
        });
        writes.push(space::create(ITEM, &key, checked(app, ITEM, item)?));
    }
    Ok((gallery_uri, writes))
}

/// Every record of `collection` in `repo`'s repo in the credential's
/// space; a refusal drops the credential.
async fn read(
    app: &App,
    credential: &Credential,
    repo: &str,
    collection: &str,
) -> Result<Vec<Record>, Failure> {
    match space::read_with(&app.ctx, credential, repo, collection).await {
        Ok(records) => Ok(records),
        Err(e) => Err(refused(app, credential, e)),
    }
}

/// Each of `dids` as grain shows a person in a space, to `viewer`: their
/// DID, and their handle, display name and avatar where the index has
/// them. Their grain profile is a public record of their own, so it is
/// shown in a space as anywhere.
fn people(app: &App, viewer: &str, dids: &[&str]) -> Result<HashMap<String, Value>, Failure> {
    let index = super::support::index(app)?;
    let actors = index.read(|db| {
        let reader = Reader {
            db,
            cdn: &app.cdn,
            rankings: &app.rankings,
            viewer: Some(viewer),
            service: app.did.as_deref(),
        };
        reader.actors(dids)
    })?;
    let view = |did: &str| {
        let mut view = json!({ "did": did });
        let actor = actors.get(did);
        let handle = actor.map(|a| a.handle.as_str());
        let handle = handle.filter(|h| *h != "handle.invalid");
        crate::read::views::put(&mut view, "handle", handle);
        let profile = actor.and_then(|a| a.profile.as_ref()).map(|p| &p.record);
        let name = profile.and_then(|p| p.display_name.clone());
        crate::read::views::put(&mut view, "displayName", name);
        let avatar = profile.and_then(|p| p.avatar.as_ref());
        let avatar = avatar.and_then(|a| app.cdn.url(did, &a.0, crate::cdn::AVATAR));
        crate::read::views::put(&mut view, "avatar", avatar);
        view
    };
    Ok(dids.iter().map(|d| (d.to_string(), view(d))).collect())
}

fn did_param(params: &Params, key: &str) -> Result<String, Failure> {
    let group = params.required(key)?;
    if !grain::lexicon::valid_did(group) {
        return Err(Failure::invalid(format!("{key} must be a valid did")));
    }
    Ok(group.to_string())
}

fn valid_group(group: &str) -> Result<(), Failure> {
    match grain::lexicon::valid_did(group) {
        true => Ok(()),
        false => Err(Failure::invalid("group must be a valid did")),
    }
}

/// Refuses `did` unless `group`'s host admits them to its pool. Their
/// own PDS would take the write regardless, into their own repo there,
/// but the authority lists only the repos of those it lets write, so a
/// write from anyone else would be read by no one; this says so first.
async fn pooling(app: &App, did: &str, lxm: &str, group: &str) -> Result<(), Failure> {
    credential_for(app, did, lxm, &space::pool(group))
        .await
        .map(drop)
}

fn text(value: &Value, key: &str) -> Option<String> {
    value[key].as_str().map(str::to_string)
}

/// Every gallery in `group`'s pool, newest first, read as `viewer` asking
/// by `lxm`, whom the group's host must admit.
async fn read_pool(
    app: &App,
    viewer: &str,
    lxm: &str,
    group: &str,
) -> Result<Vec<Pooled>, Failure> {
    let space = space::pool(group);
    let credential = credential_for(app, viewer, lxm, &space).await?;
    let repos = match space::repos_with(&app.ctx, &credential).await {
        Ok(repos) => repos,
        Err(e) => return Err(refused(app, &credential, e)),
    };
    let credential = &credential;
    let reads = repos.iter().map(|repo| async move {
        let read = tokio::try_join!(
            read(app, credential, repo, GALLERY),
            read(app, credential, repo, ITEM),
            read(app, credential, repo, PHOTO),
            read(app, credential, repo, FAVORITES),
            read(app, credential, repo, COMMENTS),
        );
        read.map(|read| (repo, read))
    });
    let repos = futures::future::try_join_all(reads).await?;

    // Favorites and comments are gathered across every repo, then given
    // to the gallery each names.
    let mut favs: HashMap<String, Vec<(String, String)>> = HashMap::new();
    let mut said: HashMap<String, Vec<(String, Value)>> = HashMap::new();
    for (did, (_, _, _, favorites, comments)) in &repos {
        for f in favorites {
            if let Some(subject) = text(&f.value, "subject") {
                let fav = (did.to_string(), f.rkey.clone());
                favs.entry(subject).or_default().push(fav);
            }
        }
        let worded = comments
            .iter()
            .filter_map(|c| Some((c, text(&c.value, "subject")?, text(&c.value, "text")?)));
        for (c, subject, words) in worded {
            let mut view = json!({
                "uri": format!("at://{did}/{COMMENTS}/{}", c.rkey),
                "rkey": c.rkey,
                "text": words,
            });
            for key in ["facets", "replyTo", "createdAt"] {
                if !c.value[key].is_null() {
                    view[key] = c.value[key].clone();
                }
            }
            said.entry(subject)
                .or_default()
                .push((did.to_string(), view));
        }
    }

    let mut out = Vec::new();
    for (did, (galleries, items, photos, _, _)) in &repos {
        for g in galleries {
            let uri = format!("at://{did}/{GALLERY}/{}", g.rkey);
            let mut comments = said.remove(&uri).unwrap_or_default();
            comments.sort_by(|a, b| a.1["createdAt"].as_str().cmp(&b.1["createdAt"].as_str()));
            out.push(Pooled {
                did: did.to_string(),
                rkey: g.rkey.clone(),
                title: g.value["title"].as_str().unwrap_or("Untitled").into(),
                description: text(&g.value, "description"),
                created_at: text(&g.value, "createdAt"),
                photos: photos_of(did, &uri, items, photos),
                favs: favs.remove(&uri).unwrap_or_default(),
                comments,
                uri,
            });
        }
    }
    out.sort_by(|a, b| b.created_at.cmp(&a.created_at));
    Ok(out)
}

/// The photos of `did`'s gallery `uri`, in order: a photo whose record or
/// picture is gone is left out, not the gallery.
fn photos_of(did: &str, uri: &str, items: &[Record], photos: &[Record]) -> Vec<Value> {
    let mut mine: Vec<&Value> = items
        .iter()
        .map(|i| &i.value)
        .filter(|i| i["gallery"].as_str() == Some(uri))
        .collect();
    mine.sort_by_key(|i| i["position"].as_i64().unwrap_or(0));
    let photo_uri = |rkey: &str| format!("at://{did}/{PHOTO}/{rkey}");
    mine.iter()
        .enumerate()
        .filter_map(|(n, item)| {
            let wanted = item["item"].as_str()?;
            let photo = photos.iter().find(|p| photo_uri(&p.rkey) == wanted)?;
            let cid = space::blob_cid(&photo.value["photo"])?;
            let position = item["position"].as_i64().unwrap_or(n as i64);
            let mut view = json!({ "uri": wanted, "did": did, "cid": cid, "position": position });
            for key in ["alt", "aspectRatio"] {
                if !photo.value[key].is_null() {
                    view[key] = photo.value[key].clone();
                }
            }
            Some(view)
        })
        .collect()
}

/// `pooled` as a card for `viewer`, with its author as `people` shows
/// them: what `poolGallery` and `poolFeedItem` share.
fn card(pooled: &Pooled, group: &str, viewer: &str, people: &HashMap<String, Value>) -> Value {
    let mut view = json!({
        "space": space::pool(group),
        "did": pooled.did,
        "rkey": pooled.rkey,
        "title": pooled.title,
        "uri": pooled.uri,
        "photoCount": pooled.photos.len(),
        "favCount": pooled.favs.len(),
        "commentCount": pooled.comments.len(),
    });
    crate::read::views::put(&mut view, "description", pooled.description.clone());
    crate::read::views::put(&mut view, "createdAt", pooled.created_at.clone());
    crate::read::views::put(&mut view, "viewerFav", viewer_fav(pooled, viewer));
    let person = people.get(&pooled.did).and_then(Value::as_object);
    for (key, value) in person.into_iter().flatten().filter(|(k, _)| *k != "did") {
        view[key] = value.clone();
    }
    view
}

fn viewer_fav(pooled: &Pooled, viewer: &str) -> Option<String> {
    let mine = pooled.favs.iter().find(|(did, _)| did == viewer);
    mine.map(|(_, rkey)| rkey.clone())
}

/// The people `pooled` names: their authors, and for a gallery read
/// whole, whoever commented on it.
fn people_of<'a>(
    app: &App,
    viewer: &str,
    pooled: impl Iterator<Item = &'a str>,
) -> Result<HashMap<String, Value>, Failure> {
    let mut dids: Vec<&str> = Vec::new();
    for did in pooled {
        if !dids.contains(&did) {
            dids.push(did);
        }
    }
    people(app, viewer, &dids)
}

/// `listGalleries`: every gallery in `group`'s pool, newest first, each
/// with its first photo as its cover.
pub async fn list_galleries(
    State(app): State<Arc<App>>,
    headers: HeaderMap,
    Query(params): Query<Vec<(String, String)>>,
) -> Result<Json<Value>, Failure> {
    let app: &App = &app;
    let viewer = caller(app, &headers, LIST).await?;
    let params = Params(params);
    let group = did_param(&params, "group")?;
    let limit = params.limit(50, 100)?;
    let mut pooled = read_pool(app, &viewer, LIST, &group).await?;
    pooled.truncate(limit);
    let people = people_of(app, &viewer, pooled.iter().map(|p| p.did.as_str()))?;
    let galleries: Vec<Value> = pooled
        .iter()
        .map(|p| {
            let mut view = card(p, &group, &viewer, &people);
            if let Some(cover) = p.photos.first() {
                view["cover"] = cover.clone();
            }
            view
        })
        .collect();
    let space = space::pool(&group);
    Ok(Json(json!({ "space": space, "galleries": galleries })))
}

/// `listFeed`: every gallery in the pools of the groups the viewer is in,
/// newest first, and those groups; for a group signed in as itself, its
/// own pool, as a group is in no groups. A pool that does not answer is
/// left out, unless none does.
pub async fn list_feed(
    State(app): State<Arc<App>>,
    headers: HeaderMap,
    Query(params): Query<Vec<(String, String)>>,
) -> Result<Json<Value>, Failure> {
    let app: &App = &app;
    let viewer = caller(app, &headers, FEED).await?;
    let limit = Params(params).limit(30, 100)?;
    let groups = match is_group(app, &viewer)? {
        true => vec![viewer.clone()],
        false => groups_of(app, &viewer).await?,
    };
    let viewer = &viewer;
    let reads = groups.iter().map(|group| async move {
        let read = read_pool(app, viewer, FEED, group).await;
        read.map(|pooled| pooled.into_iter().map(|p| (group.clone(), p)))
    });
    let mut read = Vec::new();
    let mut first_failure = None;
    for got in futures::future::join_all(reads).await {
        match got {
            Ok(pooled) => read.extend(pooled),
            Err(e) => {
                first_failure.get_or_insert(e);
            }
        }
    }
    if let Some(e) = first_failure.filter(|_| read.is_empty()) {
        return Err(e);
    }
    read.sort_by(|a, b| b.1.created_at.cmp(&a.1.created_at));
    read.truncate(limit);
    let people = people_of(app, viewer, read.iter().map(|(_, p)| p.did.as_str()))?;
    let galleries: Vec<Value> = read
        .iter()
        .map(|(group, p)| {
            let mut view = card(p, group, viewer, &people);
            view["group"] = group.as_str().into();
            view["items"] = p.photos.clone().into();
            view
        })
        .collect();
    let mut shown: Vec<String> = Vec::new();
    for (group, _) in &read {
        if !shown.contains(group) {
            shown.push(group.clone());
        }
    }
    let asking = Asking {
        viewer: Some(viewer),
        gallery: None,
        mine: &groups,
    };
    let groups = views(app, &shown, &asking).await?;
    Ok(Json(json!({ "galleries": galleries, "groups": groups })))
}

/// `getGallery`: `did`'s gallery `rkey` in `group`'s pool, with its
/// favorites and comments; one not there is answered with none of them.
pub async fn get_gallery(
    State(app): State<Arc<App>>,
    headers: HeaderMap,
    Query(params): Query<Vec<(String, String)>>,
) -> Result<Json<Value>, Failure> {
    let app: &App = &app;
    let viewer = caller(app, &headers, GET).await?;
    let params = Params(params);
    let group = did_param(&params, "group")?;
    let did = did_param(&params, "did")?;
    let rkey = params.required("rkey")?;
    let pooled = read_pool(app, &viewer, GET, &group).await?;
    let found = pooled.iter().find(|p| p.did == did && p.rkey == rkey);
    let commenters = found.into_iter().flat_map(|p| &p.comments);
    let named = std::iter::once(did.as_str()).chain(commenters.map(|(d, _)| d.as_str()));
    let people = people_of(app, &viewer, named)?;
    let mut out = people[&did].clone();
    out["space"] = space::pool(&group).into();
    out["viewerIsAuthor"] = (viewer == did).into();
    let Some(found) = found else {
        out["favCount"] = 0.into();
        out["commentCount"] = 0.into();
        out["comments"] = json!([]);
        out["items"] = json!([]);
        return Ok(Json(out));
    };
    let mut gallery = json!({ "uri": found.uri, "title": found.title });
    crate::read::views::put(&mut gallery, "description", found.description.clone());
    crate::read::views::put(&mut gallery, "createdAt", found.created_at.clone());
    out["gallery"] = gallery;
    out["favCount"] = found.favs.len().into();
    crate::read::views::put(&mut out, "viewerFav", viewer_fav(found, &viewer));
    out["commentCount"] = found.comments.len().into();
    let comments: Vec<Value> = found
        .comments
        .iter()
        .map(|(author, comment)| {
            let mut comment = comment.clone();
            comment["author"] = people[author].clone();
            comment
        })
        .collect();
    out["comments"] = comments.into();
    out["items"] = found.photos.clone().into();
    Ok(Json(out))
}

#[derive(Deserialize)]
struct CreateInput {
    group: String,
    rkey: String,
    title: String,
    description: Option<String>,
    #[serde(default)]
    photos: Vec<PhotoInput>,
}

/// `createGallery`: writes the caller's gallery, its photos (keyed
/// `<rkey>-<n>`) and its items into their repo in `group`'s pool, at
/// once, if the group's host lets them write there. The pool is there
/// already, so nothing is made or shared.
pub async fn create_gallery(
    State(app): State<Arc<App>>,
    headers: HeaderMap,
    body: Bytes,
) -> Result<Json<Value>, Failure> {
    let app: &App = &app;
    let did = writer(app, &headers, CREATE).await?;
    let input: CreateInput = parse(&body)?;
    valid_group(&input.group)?;
    if !grain::lexicon::valid_record_key(&input.rkey) || input.rkey.len() > 64 {
        return Err(Failure::invalid("rkey must be a record key of 64 at most"));
    }
    if input.photos.len() > MOST {
        let why = format!("a gallery is made with {MOST} photos at most");
        return Err(Failure::invalid(why));
    }
    pooling(app, &did, CREATE, &input.group).await?;
    let now = grain::keys::now_iso();
    let (uri, writes) = gallery_writes(
        app,
        &did,
        &input.rkey,
        &input.title,
        input.description.as_deref(),
        input.photos,
        &now,
    )?;
    let space = space::pool(&input.group);
    let (space, writes) = (&space, &writes);
    as_account(app, &did, CREATE, |session| async move {
        admin(app, &session).apply_writes(space, writes).await
    })
    .await?;
    Ok(Json(json!({ "space": space, "uri": uri })))
}

#[derive(Deserialize)]
struct DeleteInput {
    group: String,
    rkey: String,
}

/// `deleteGallery`: removes the caller's gallery `rkey` from `group`'s
/// pool, with the items joining it and the photos they name, as their
/// repo there holds them: read, not guessed from their keys, so none is
/// left behind. Returns how many records went.
pub async fn delete_gallery(
    State(app): State<Arc<App>>,
    headers: HeaderMap,
    body: Bytes,
) -> Result<Json<Value>, Failure> {
    let app: &App = &app;
    let did = writer(app, &headers, DELETE).await?;
    let input: DeleteInput = parse(&body)?;
    valid_group(&input.group)?;
    let space = &space::pool(&input.group);
    let (did, rkey) = (&did, &input.rkey);
    let deleted = as_account(app, did, DELETE, |session| async move {
        let admin = admin(app, &session);
        let items = admin.records(space, ITEM).await?;
        let uri = format!("at://{did}/{GALLERY}/{rkey}");
        let photos = format!("at://{did}/{PHOTO}/");
        let mine: Vec<&Record> = items
            .iter()
            .filter(|i| i.value["gallery"].as_str() == Some(uri.as_str()))
            .collect();
        let mut writes = vec![space::delete(GALLERY, rkey)];
        writes.extend(mine.iter().map(|i| space::delete(ITEM, &i.rkey)));
        let mut keys: Vec<&str> = Vec::new();
        for item in &mine {
            let key = item.value["item"]
                .as_str()
                .and_then(|i| i.strip_prefix(&photos));
            if let Some(key) = key.filter(|k| !keys.contains(k)) {
                keys.push(key);
            }
        }
        writes.extend(keys.iter().map(|k| space::delete(PHOTO, k)));
        admin.apply_writes(space, &writes).await?;
        Ok(writes.len())
    })
    .await?;
    Ok(Json(json!({ "deleted": deleted })))
}

#[derive(Deserialize)]
struct CommentInput {
    group: String,
    gallery: String,
    text: String,
    facets: Option<Value>,
    #[serde(rename = "replyTo")]
    reply_to: Option<String>,
}

/// `createComment`: writes the caller's comment on `gallery` into their
/// repo in `group`'s pool, beside the gallery, not in their public repo,
/// where it would name the pool's gallery to everyone.
pub async fn create_comment(
    State(app): State<Arc<App>>,
    headers: HeaderMap,
    body: Bytes,
) -> Result<Json<Value>, Failure> {
    let app: &App = &app;
    let did = writer(app, &headers, COMMENT).await?;
    let input: CommentInput = parse(&body)?;
    valid_group(&input.group)?;
    let words = input.text.trim();
    if words.is_empty() {
        return Err(Failure::invalid("A comment needs something in it."));
    }
    let mut record = json!({
        "$type": COMMENTS,
        "text": words,
        "subject": input.gallery,
        "createdAt": grain::keys::now_iso(),
    });
    crate::read::views::put(&mut record, "facets", input.facets);
    crate::read::views::put(&mut record, "replyTo", input.reply_to);
    let record = &checked(app, COMMENTS, record)?;
    pooling(app, &did, COMMENT, &input.group).await?;
    let space = &space::pool(&input.group);
    let rkey = &grain::keys::tid();
    as_account(app, &did, COMMENT, |session| async move {
        let admin = admin(app, &session);
        admin.put_record(space, COMMENTS, rkey, record).await
    })
    .await?;
    let uri = format!("at://{did}/{COMMENTS}/{rkey}");
    Ok(Json(json!({ "uri": uri, "rkey": rkey })))
}

#[derive(Deserialize)]
struct UncommentInput {
    group: String,
    rkey: String,
}

/// `deleteComment`: deletes the caller's own comment `rkey` from their
/// repo in `group`'s pool.
pub async fn delete_comment(
    State(app): State<Arc<App>>,
    headers: HeaderMap,
    body: Bytes,
) -> Result<Json<Value>, Failure> {
    let app: &App = &app;
    let did = writer(app, &headers, UNCOMMENT).await?;
    let input: UncommentInput = parse(&body)?;
    valid_group(&input.group)?;
    let (space, rkey) = (&space::pool(&input.group), &input.rkey);
    as_account(app, &did, UNCOMMENT, |session| async move {
        admin(app, &session)
            .delete_record(space, COMMENTS, rkey)
            .await
    })
    .await?;
    Ok(Json(json!({ "deleted": true })))
}

#[derive(Deserialize)]
struct FavoriteInput {
    group: String,
    gallery: String,
    on: bool,
}

/// `putFavorite`: favorites `gallery` in `group`'s pool for the caller,
/// or takes it back, in their repo there. Their favorite of it is found
/// by reading their own favorites, so the client holds no key; asking
/// twice makes one.
pub async fn put_favorite(
    State(app): State<Arc<App>>,
    headers: HeaderMap,
    body: Bytes,
) -> Result<Json<Value>, Failure> {
    let app: &App = &app;
    let did = writer(app, &headers, FAVORITE).await?;
    let input: FavoriteInput = parse(&body)?;
    valid_group(&input.group)?;
    let record = json!({
        "$type": FAVORITES,
        "subject": input.gallery,
        "createdAt": grain::keys::now_iso(),
    });
    let record = &checked(app, FAVORITES, record)?;
    // Taking one's own favorite back is never refused.
    if input.on {
        pooling(app, &did, FAVORITE, &input.group).await?;
    }
    let space = &space::pool(&input.group);
    let input = &input;
    let rkey = as_account(app, &did, FAVORITE, |session| async move {
        let admin = admin(app, &session);
        let mine = admin.records(space, FAVORITES).await?;
        let subject = Some(input.gallery.as_str());
        let existing = mine.iter().find(|f| f.value["subject"].as_str() == subject);
        match (existing, input.on) {
            (Some(f), false) => {
                admin.delete_record(space, FAVORITES, &f.rkey).await?;
                Ok(None)
            }
            (None, false) => Ok(None),
            (Some(f), true) => Ok(Some(f.rkey.clone())),
            (None, true) => {
                let rkey = grain::keys::tid();
                admin.put_record(space, FAVORITES, &rkey, record).await?;
                Ok(Some(rkey))
            }
        }
    })
    .await?;
    let mut out = json!({ "on": input.on });
    crate::read::views::put(&mut out, "rkey", rkey);
    Ok(Json(out))
}

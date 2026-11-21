//! A grain profile made from the account's Bluesky profile when it logs
//! in to the web, as knotless-serve's login sets off finding an account's
//! spaces: in the background, so a login never waits on it and never
//! fails by it.
//!
//! An account whose `social.grain.actor.profile` has a `displayName` is
//! left as it is. Otherwise its `app.bsky.actor.profile` gives the grain
//! profile its `displayName`, `description` and `avatar` (the blob as the
//! Bluesky profile names it), with the `createdAt` of the grain profile
//! there is, or now. One there is is put over, swapped on its CID; else
//! one is made at `self`. An account with no Bluesky profile and no grain
//! profile gets a bare one, its `createdAt` alone, so every account that
//! logs in has the profile that makes grain track it; one with an unnamed
//! grain profile and no Bluesky profile is left as it is. Both are read from the account's PDS, which has
//! them before the index may; the write goes through the web session
//! ([`crate::write`]), so it is in the index once it is made.

use crate::App;
use crate::xrpc::Failure;
use grain::keys;
use grain::xrpc::Xrpc;
use serde_json::{Value, json};
use std::sync::Arc;

const GRAIN: &str = "social.grain.actor.profile";
const BSKY: &str = "app.bsky.actor.profile";
const SELF: &str = "self";

/// What [`seed`] did.
#[derive(Debug, PartialEq, Eq)]
pub enum Seeded {
    /// The grain profile has a name already.
    Named,
    /// There is no Bluesky profile to name it from, and a grain profile
    /// there is was left as it is.
    NoBluesky,
    /// A grain profile was made, at this URI.
    Made(String),
    /// The grain profile there was was put over, at this URI.
    Put(String),
}

/// Seeds `did`'s grain profile from its Bluesky profile in the background
/// ([`seeded`]), saying in the log only how it failed: the task, which
/// a login leaves to run.
pub fn seed(app: &Arc<App>, did: &str) -> tokio::task::JoinHandle<()> {
    let (app, did) = (app.clone(), did.to_string());
    tokio::spawn(async move {
        if let Err(e) = seeded(&app, &did).await {
            tracing::info!(%did, error = %format!("{e:#}"), "seeding a profile from Bluesky");
        }
    })
}

/// Seeds `did`'s grain profile from its Bluesky profile, with its web
/// session, as the module says.
pub async fn seeded(app: &App, did: &str) -> anyhow::Result<Seeded> {
    let session = super::session(app, did).await.map_err(failed)?;
    let pds = Xrpc::new(app.ctx.guarded.clone(), &session.service);
    let grain = crate::sync::get_record(&pds, did, GRAIN, SELF).await?;
    let named = |g: &Value| g["displayName"].as_str().is_some_and(|n| !n.is_empty());
    if grain.as_ref().is_some_and(|(_, g)| named(g)) {
        return Ok(Seeded::Named);
    }
    let bsky = crate::sync::get_record(&pds, did, BSKY, SELF).await?;
    let record = match (&bsky, &grain) {
        (None, Some(_)) => return Ok(Seeded::NoBluesky),
        (None, None) => from_bluesky(&json!({}), None),
        (Some((_, bsky)), _) => from_bluesky(bsky, grain.as_ref().map(|(_, g)| g)),
    };
    match grain {
        Some((cid, _)) => {
            let swaps = [Some(cid), None];
            let put = crate::write::put(app, did, GRAIN, SELF, record, swaps).await;
            Ok(Seeded::Put(put.map_err(failed)?.0))
        }
        None => {
            let made = crate::write::create(app, did, GRAIN, Some(SELF), record, None).await;
            Ok(Seeded::Made(made.map_err(failed)?.0))
        }
    }
}

/// The grain profile `bsky`, a Bluesky profile, makes: its name,
/// description and avatar where it has them, made when `grain`, the grain
/// profile there is, says it was, or now.
pub fn from_bluesky(bsky: &Value, grain: Option<&Value>) -> Value {
    let created = grain.and_then(|g| g["createdAt"].as_str());
    let created = created.map_or_else(keys::now_iso, str::to_string);
    let mut record = json!({ "$type": GRAIN, "createdAt": created });
    for key in ["displayName", "description"] {
        if let Some(text) = bsky[key].as_str().filter(|t| !t.is_empty()) {
            record[key] = text.into();
        }
    }
    if bsky["avatar"].is_object() {
        record["avatar"] = bsky["avatar"].clone();
    }
    record
}

fn failed(f: Failure) -> anyhow::Error {
    anyhow::anyhow!("{}: {}", f.error, f.message)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_bluesky_profile_gives_what_it_has() {
        let avatar =
            json!({"$type": "blob", "ref": {"$link": "bafk"}, "mimeType": "image/png", "size": 9});
        let bsky = json!({"displayName": "Alice", "description": "", "avatar": avatar,
            "banner": avatar, "pronouns": "she/her"});
        let was = json!({"createdAt": "2025-01-01T00:00:00.000Z", "description": "old"});
        let made = from_bluesky(&bsky, Some(&was));
        assert_eq!(
            made,
            json!({"$type": GRAIN, "createdAt": "2025-01-01T00:00:00.000Z",
                "displayName": "Alice", "avatar": avatar})
        );
        let fresh = from_bluesky(&json!({}), None);
        assert!(atproto::lexicon::is_datetime(
            fresh["createdAt"].as_str().unwrap()
        ));
        assert_eq!(fresh.as_object().unwrap().len(), 2);
    }
}

//! Push: the devices an account has its notifications pushed to, which
//! `social.grain.notification.registerPush` and `unregisterPush` keep
//! ([`crate::index::push`]), taken as Bluesky's
//! `app.bsky.notification.registerPush` takes them.
//!
//! The apps call them with a service token for grain-serve's DID, which
//! `serviceDid` names too: a device registered for another service is
//! refused rather than kept for pushes this one would send. `platform` is
//! `ios`, `android` or `web`, and `appId` the app's bundle or package id.
//!
//! A push goes by the platform's own service: [`apns`] for `ios`, [`fcm`]
//! for `android`, each set up on its own, so a server with only one sends
//! to its devices and leaves the others' tokens be. `web` devices are
//! kept, but nothing is pushed to them. [`send`] pushes what each record
//! new to the index notifies.

pub mod apns;
pub mod fcm;
pub mod send;

use crate::App;
use crate::index::Index;
use crate::xrpc::Failure;
use axum::Json;
use axum::body::Bytes;
use axum::extract::State;
use axum::http::{HeaderMap, StatusCode};
use serde::Deserialize;
use serde_json::{Value, json};
use std::collections::BTreeMap;
use std::sync::Arc;

/// The methods, as a service token for each names it in `lxm`.
pub const REGISTER: &str = "social.grain.notification.registerPush";
pub const UNREGISTER: &str = "social.grain.notification.unregisterPush";

/// The platforms a device registers on.
pub const PLATFORMS: [&str; 3] = ["ios", "android", "web"];

/// The longest token kept, in bytes: an APNs token is 64 hex digits and
/// an FCM one under 200 characters, and a web push subscription, as JSON,
/// some hundreds.
pub const MOST_TOKEN_BYTES: usize = 4096;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Device {
    service_did: String,
    token: String,
    platform: String,
    #[allow(dead_code)]
    app_id: String,
}

/// The index, the account calling `lxm` and the device it names, or why
/// not.
async fn device<'a>(
    app: &'a App,
    headers: &HeaderMap,
    body: &[u8],
    lxm: &str,
) -> Result<(&'a Index, String, Device), Failure> {
    let Some(index) = &app.index else {
        let why = "this server keeps no index";
        return Err(Failure::new(
            StatusCode::NOT_IMPLEMENTED,
            "MethodNotImplemented",
            why,
        ));
    };
    let did = crate::viewer::writer(app, headers, lxm).await?;
    let device: Device = serde_json::from_slice(body).map_err(|e| {
        Failure::invalid(format!(
            "the input is not {{serviceDid, token, platform, appId}}: {e}"
        ))
    })?;
    if app.did.as_deref() != Some(device.service_did.as_str()) {
        let why = format!("serviceDid {} is not this server", device.service_did);
        return Err(Failure::invalid(why));
    }
    if !PLATFORMS.contains(&device.platform.as_str()) {
        let why = format!("platform is ios, android or web, not {}", device.platform);
        return Err(Failure::invalid(why));
    }
    if device.token.is_empty() || device.token.len() > MOST_TOKEN_BYTES {
        let why = format!("token is 1 to {MOST_TOKEN_BYTES} bytes");
        return Err(Failure::invalid(why));
    }
    Ok((index, did, device))
}

/// `social.grain.notification.registerPush`: the caller's pushes sent to
/// the device from then on.
pub async fn register(
    State(app): State<Arc<App>>,
    headers: HeaderMap,
    body: Bytes,
) -> Result<Json<Value>, Failure> {
    let (index, did, device) = device(&app, &headers, &body, REGISTER).await?;
    let now = grain::keys::now_iso();
    index.register_push(&did, &device.token, &device.platform, &now)?;
    Ok(Json(json!({})))
}

/// `social.grain.notification.unregisterPush`: the caller's pushes no
/// longer sent to the device, as when it logs out there. One it never
/// registered is no failure.
pub async fn unregister(
    State(app): State<Arc<App>>,
    headers: HeaderMap,
    body: Bytes,
) -> Result<Json<Value>, Failure> {
    let (index, did, device) = device(&app, &headers, &body, UNREGISTER).await?;
    index.unregister_push(&did, &device.token)?;
    Ok(Json(json!({})))
}

/// A notification as it is pushed.
#[derive(Debug, Clone, PartialEq, Default)]
pub struct Message {
    pub title: String,
    pub body: String,
    /// What the app reads to know where a tap goes: `type`, and the `uri`
    /// or `did` it is about.
    pub data: BTreeMap<String, String>,
    /// The number the app's icon shows, where the platform has one.
    pub badge: Option<i64>,
}

/// What became of a push.
#[derive(Debug, Clone, PartialEq)]
pub enum Outcome {
    Sent,
    /// The service says no device answers to the token any more: it is
    /// forgotten.
    Gone,
    /// It may go if tried again, and why it did not.
    Retry(String),
    /// It will not go, and why.
    Failed(String),
}

/// How grain-serve pushes: by APNs, by FCM, both or neither.
#[derive(Debug, Clone, PartialEq, Default)]
pub struct Config {
    pub apns: Option<apns::Config>,
    pub fcm: Option<fcm::Config>,
}

impl Config {
    /// Push as grain-serve's flags and environment name it, `get` reading
    /// each ([`apns::Config::given`], [`fcm::Config::given`]).
    pub fn given(get: impl Fn(&str) -> Option<String>) -> Config {
        Config {
            apns: apns::Config::given(&get),
            fcm: fcm::Config::given(&get),
        }
    }
}

/// The services a server pushes by, each ready.
#[derive(Default)]
pub struct Transports {
    pub apns: Option<apns::Apns>,
    pub fcm: Option<fcm::Fcm>,
}

impl Transports {
    /// The services `config` names, their keys read: a failure where one
    /// is named and its key cannot be.
    pub fn new(config: &Config) -> anyhow::Result<Transports> {
        Ok(Transports {
            apns: config.apns.clone().map(apns::Apns::new).transpose()?,
            fcm: config.fcm.clone().map(fcm::Fcm::new).transpose()?,
        })
    }

    /// Pushes `message` to the device `token` on `platform`; none for a
    /// platform no service here pushes to.
    pub async fn send(&self, platform: &str, token: &str, message: &Message) -> Option<Outcome> {
        match platform {
            "ios" => Some(self.apns.as_ref()?.send(token, message).await),
            "android" => Some(self.fcm.as_ref()?.send(token, message).await),
            _ => None,
        }
    }
}

/// The DER a PEM block holds.
fn der_of_pem(pem: &str) -> Option<Vec<u8>> {
    use base64::Engine;
    let body: String = pem
        .lines()
        .map(str::trim)
        .filter(|l| !l.is_empty() && !l.starts_with("-----"))
        .collect();
    base64::engine::general_purpose::STANDARD.decode(body).ok()
}

#[cfg(test)]
mod tests;

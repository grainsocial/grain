//! Apple's push service, APNs, for iOS devices: HTTP/2, authenticated by
//! a JWT the team's key signs (ES256), naming the key and the team, and
//! good for up to an hour, so one is made every fifty minutes and used for
//! every push between.
//!
//! A push is an alert: `aps` holds the title and body, the default sound
//! and the badge, and the notification's own fields sit beside it, where
//! the app reads where a tap goes ([`Message::data`]).
//!
//! APNs answers 410 for a token no device answers to any more, which is
//! [`Outcome::Gone`]. A 403 for the JWT (`ExpiredProviderToken`,
//! `InvalidProviderToken`) makes a new one for the next try, and 429s,
//! 5xx and failures to reach it are tried again; any other answer is
//! not.

use super::{Message, Outcome, der_of_pem};
use anyhow::Context;
use grain::crypto::P256Key;
use serde_json::{Value, json};
use std::path::PathBuf;
use std::sync::Mutex;
use std::time::{Duration, Instant};

/// APNs for apps signed for the App Store and TestFlight.
pub const PRODUCTION: &str = "https://api.push.apple.com";
/// APNs for apps built for development.
pub const SANDBOX: &str = "https://api.sandbox.push.apple.com";

/// How long a JWT is used for: APNs refuses one older than an hour, and
/// one made more than once in twenty minutes.
pub const JWT_FOR: Duration = Duration::from_secs(50 * 60);

/// How long a push may take.
pub const TIMEOUT: Duration = Duration::from_secs(15);

/// How grain-serve reaches APNs.
#[derive(Debug, Clone, PartialEq)]
pub struct Config {
    /// `GRAIN_APNS_KEY_FILE`, from the environment: the team's key, a
    /// `.p8` file.
    pub key_file: PathBuf,
    /// `--apns-key-id`: the key's ID, as Apple names it.
    pub key_id: String,
    /// `--apns-team-id`: the team's ID.
    pub team_id: String,
    /// `--apns-topic`: the app's bundle ID.
    pub topic: String,
    /// `--apns-url`: [`PRODUCTION`] unless it names another, such as
    /// [`SANDBOX`] for apps built for development.
    pub url: String,
}

impl Config {
    /// APNs as grain-serve's flags and environment name it, `get` reading
    /// each: none without a key file. What they leave unset is empty,
    /// which [`Apns::new`] refuses.
    pub fn given(get: impl Fn(&str) -> Option<String>) -> Option<Config> {
        let set = |name: &str| get(name).filter(|v| !v.is_empty());
        let named = |name: &str| set(name).unwrap_or_default();
        Some(Config {
            key_file: set("GRAIN_APNS_KEY_FILE")?.into(),
            key_id: named("--apns-key-id"),
            team_id: named("--apns-team-id"),
            topic: named("--apns-topic"),
            url: set("--apns-url").map_or(PRODUCTION.into(), |url| {
                url.trim_end_matches('/').to_string()
            }),
        })
    }
}

/// APNs, ready to push.
pub struct Apns {
    http: reqwest::Client,
    config: Config,
    key: P256Key,
    /// The JWT in use, and when it was made.
    pub(super) jwt: Mutex<Option<(String, Instant)>>,
}

impl Apns {
    /// APNs as `config` names it, its key read.
    pub fn new(config: Config) -> anyhow::Result<Apns> {
        use p256::pkcs8::DecodePrivateKey;
        for (name, value) in [
            ("--apns-key-id", &config.key_id),
            ("--apns-team-id", &config.team_id),
            ("--apns-topic", &config.topic),
        ] {
            if value.is_empty() {
                anyhow::bail!("GRAIN_APNS_KEY_FILE needs {name} too");
            }
        }
        let path = config.key_file.display();
        let pem = std::fs::read_to_string(&config.key_file)
            .with_context(|| format!("reading the APNs key {path}"))?;
        let key = der_of_pem(&pem)
            .and_then(|der| p256::ecdsa::SigningKey::from_pkcs8_der(&der).ok())
            .with_context(|| format!("{path} is not a P-256 key in PKCS #8 PEM"))?;
        let key = P256Key::from_bytes(&key.to_bytes())?;
        let http = reqwest::Client::builder()
            .http2_prior_knowledge()
            .timeout(TIMEOUT)
            .build()?;
        Ok(Apns {
            http,
            config,
            key,
            jwt: Mutex::new(None),
        })
    }

    /// The JWT to push with: the one in use, unless it is [`JWT_FOR`] old.
    fn jwt(&self) -> String {
        let mut jwt = self.jwt.lock().unwrap();
        if let Some((token, made)) = &*jwt
            && made.elapsed() < JWT_FOR
        {
            return token.clone();
        }
        let header = json!({ "kid": self.config.key_id });
        let claims = json!({ "iss": self.config.team_id, "iat": grain::keys::now_secs() });
        let token = self.key.sign_jwt(&header, &claims);
        *jwt = Some((token.clone(), Instant::now()));
        token
    }

    /// What `message` is to APNs.
    pub fn payload(message: &Message) -> Value {
        let mut aps = json!({
            "alert": { "title": message.title, "body": message.body },
            "sound": "default",
        });
        if let Some(badge) = message.badge {
            aps["badge"] = badge.into();
        }
        // The data first, so that no field of it stands in for `aps`.
        let mut payload: serde_json::Map<String, Value> = message
            .data
            .iter()
            .map(|(k, v)| (k.clone(), v.as_str().into()))
            .collect();
        payload.insert("aps".into(), aps);
        payload.into()
    }

    /// Pushes `message` to the device `token`.
    pub async fn send(&self, token: &str, message: &Message) -> Outcome {
        // A device token is hex, and names a path under APNs's.
        if token.is_empty() || !token.bytes().all(|b| b.is_ascii_hexdigit()) {
            return Outcome::Failed("not an APNs device token".into());
        }
        let url = format!("{}/3/device/{token}", self.config.url);
        let sent = self
            .http
            .post(url)
            .bearer_auth(self.jwt())
            .header("apns-topic", &self.config.topic)
            .header("apns-push-type", "alert")
            .json(&Self::payload(message))
            .send()
            .await;
        let res = match sent {
            Ok(res) => res,
            Err(e) => return Outcome::Retry(format!("APNs: {}", e.without_url())),
        };
        let status = res.status().as_u16();
        let body = res.text().await.unwrap_or_default();
        let reason = serde_json::from_str::<Value>(&body)
            .ok()
            .and_then(|v| v["reason"].as_str().map(str::to_string))
            .unwrap_or_default();
        let why = format!("APNs {status} {reason}");
        match status {
            200 => Outcome::Sent,
            410 => Outcome::Gone,
            403 if reason.ends_with("ProviderToken") => {
                *self.jwt.lock().unwrap() = None;
                Outcome::Retry(why)
            }
            429 | 500.. => Outcome::Retry(why),
            _ => Outcome::Failed(why),
        }
    }
}

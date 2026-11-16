//! Firebase Cloud Messaging, FCM, for Android devices: its HTTP v1 API,
//! with an OAuth access token a Google service account's key earns. The
//! account signs a JWT asserting the messaging scope (RS256), and Google's
//! token endpoint trades it for a token good for an hour, used, less a
//! minute, for every push in it.
//!
//! A push is data only, every field a string: `title` and `body` beside
//! the notification's own fields ([`Message::data`]). The app draws the
//! notification itself from them, as it must to know where a tap goes; a
//! `notification` block would have Android draw it, and skip the app, while
//! the app is in the background. It goes at high priority, so Doze does not
//! hold it. FCM has no badge: a launcher counts what the app has posted.
//!
//! FCM's `UNREGISTERED` names a token no device answers to any more,
//! which is [`Outcome::Gone`]. A 401 or 403 drops the access token for a
//! new one on the next try, and 429s, 5xx and failures to reach it are
//! tried again; any other answer is not.

use super::{Message, Outcome, der_of_pem};
use anyhow::{Context, bail};
use base64::Engine;
use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use ring::signature::{RSA_PKCS1_SHA256, RsaKeyPair};
use serde::Deserialize;
use serde_json::{Value, json};
use std::path::PathBuf;
use std::time::{Duration, Instant};
use tokio::sync::Mutex;

/// FCM's API.
pub const URL: &str = "https://fcm.googleapis.com";

/// Where a service account's JWT is traded, unless its key file says.
pub const TOKEN_URL: &str = "https://oauth2.googleapis.com/token";

/// The one scope sending needs.
pub const SCOPE: &str = "https://www.googleapis.com/auth/firebase.messaging";

/// How long a push, or a trade for a token, may take.
pub const TIMEOUT: Duration = Duration::from_secs(15);

/// How grain-serve reaches FCM.
#[derive(Debug, Clone, PartialEq)]
pub struct Config {
    /// `GRAIN_FCM_KEY_FILE`, from the environment: the service account's key, the JSON Google
    /// gives for it, of an account with the Firebase Messaging role.
    pub key_file: PathBuf,
    /// `--fcm-project-id`: the Firebase project, if not the one the key
    /// file names.
    pub project_id: Option<String>,
    /// [`URL`].
    pub url: String,
}

impl Config {
    /// FCM as the environment names it: none without a key file.
    pub fn given(get: impl Fn(&str) -> Option<String>) -> Option<Config> {
        let set = |name: &str| get(name).filter(|v| !v.is_empty());
        Some(Config {
            key_file: set("GRAIN_FCM_KEY_FILE")?.into(),
            project_id: set("--fcm-project-id"),
            url: URL.into(),
        })
    }
}

/// A service account's key file, as far as it is read.
#[derive(Deserialize)]
struct Account {
    client_email: String,
    private_key: String,
    project_id: Option<String>,
    token_uri: Option<String>,
}

/// FCM, ready to push.
pub struct Fcm {
    http: reqwest::Client,
    /// Where pushes are sent.
    send_url: String,
    client_email: String,
    token_url: String,
    key: RsaKeyPair,
    /// The access token in use, and until when.
    access: Mutex<Option<(String, Instant)>>,
}

/// What Google's token endpoint grants.
#[derive(Deserialize)]
struct Granted {
    access_token: String,
    expires_in: Option<u64>,
}

impl Fcm {
    /// FCM as `config` names it, its key file read.
    pub fn new(config: Config) -> anyhow::Result<Fcm> {
        let path = config.key_file.display();
        let json = std::fs::read_to_string(&config.key_file)
            .with_context(|| format!("reading the FCM key file {path}"))?;
        let account: Account = serde_json::from_str(&json)
            .with_context(|| format!("{path} is not a service account's key file"))?;
        let key = der_of_pem(&account.private_key)
            .and_then(|der| RsaKeyPair::from_pkcs8(&der).ok())
            .with_context(|| format!("{path}'s private_key is not an RSA key in PKCS #8 PEM"))?;
        let Some(project) = config.project_id.or(account.project_id) else {
            bail!("{path} names no project_id, and --fcm-project-id is not given");
        };
        let http = reqwest::Client::builder().timeout(TIMEOUT).build()?;
        Ok(Fcm {
            http,
            send_url: format!("{}/v1/projects/{project}/messages:send", config.url),
            client_email: account.client_email,
            token_url: account.token_uri.unwrap_or_else(|| TOKEN_URL.into()),
            key,
            access: Mutex::new(None),
        })
    }

    /// The JWT the service account trades for an access token.
    fn assertion(&self) -> String {
        let now = grain::keys::now_secs();
        let header = json!({ "alg": "RS256", "typ": "JWT" });
        let claims = json!({
            "iss": self.client_email,
            "scope": SCOPE,
            "aud": self.token_url,
            "iat": now,
            "exp": now + 3600,
        });
        let body = format!(
            "{}.{}",
            URL_SAFE_NO_PAD.encode(header.to_string()),
            URL_SAFE_NO_PAD.encode(claims.to_string())
        );
        let mut sig = vec![0; self.key.public().modulus_len()];
        let rng = ring::rand::SystemRandom::new();
        self.key
            .sign(&RSA_PKCS1_SHA256, &rng, body.as_bytes(), &mut sig)
            .expect("an RSA key signs");
        format!("{body}.{}", URL_SAFE_NO_PAD.encode(sig))
    }

    /// The access token to push with: the one in use, unless it is a
    /// minute from expiring; else one traded for now.
    async fn access_token(&self) -> Result<String, String> {
        let mut access = self.access.lock().await;
        if let Some((token, until)) = &*access
            && Instant::now() < *until
        {
            return Ok(token.clone());
        }
        let form = [
            ("grant_type", "urn:ietf:params:oauth:grant-type:jwt-bearer"),
            ("assertion", &self.assertion()),
        ];
        let res = self.http.post(&self.token_url).form(&form).send().await;
        let res = res.map_err(|e| format!("FCM's token endpoint: {}", e.without_url()))?;
        let status = res.status();
        if !status.is_success() {
            return Err(format!("FCM's token endpoint answered {status}"));
        }
        let granted: Granted = res
            .json()
            .await
            .map_err(|e| format!("FCM's token endpoint granted no access_token: {e}"))?;
        let lasts = granted.expires_in.unwrap_or(3600).saturating_sub(60);
        let until = Instant::now() + Duration::from_secs(lasts);
        *access = Some((granted.access_token.clone(), until));
        Ok(granted.access_token)
    }

    /// What `message` is to FCM, for the device `token`.
    pub fn payload(token: &str, message: &Message) -> Value {
        // The data first, so that no field of it stands in for the text.
        let mut data: serde_json::Map<String, Value> = message
            .data
            .iter()
            .map(|(k, v)| (k.clone(), v.as_str().into()))
            .collect();
        data.insert("title".into(), message.title.as_str().into());
        data.insert("body".into(), message.body.as_str().into());
        json!({
            "message": {
                "token": token,
                "data": data,
                "android": { "priority": "HIGH" },
            }
        })
    }

    /// Pushes `message` to the device `token`.
    pub async fn send(&self, token: &str, message: &Message) -> Outcome {
        let access = match self.access_token().await {
            Ok(access) => access,
            Err(why) => return Outcome::Retry(why),
        };
        let sent = self
            .http
            .post(&self.send_url)
            .bearer_auth(access)
            .json(&Self::payload(token, message))
            .send()
            .await;
        let res = match sent {
            Ok(res) => res,
            Err(e) => return Outcome::Retry(format!("FCM: {}", e.without_url())),
        };
        let status = res.status().as_u16();
        let body = res.text().await.unwrap_or_default();
        let why = format!("FCM {status}");
        match status {
            200..=299 => Outcome::Sent,
            _ if body.contains("UNREGISTERED") => Outcome::Gone,
            401 | 403 => {
                *self.access.lock().await = None;
                Outcome::Retry(why)
            }
            429 | 500.. => Outcome::Retry(why),
            _ => Outcome::Failed(why),
        }
    }
}

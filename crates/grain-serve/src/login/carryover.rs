//! Browsers logged in to grain.social before grain-serve served it stay
//! logged in: the one runtime file that reads hatk's session cookies, and
//! deleted once `--carry-cookies-until` has passed, with the
//! `carried_cookie_key` table.
//!
//! hatk sealed `__hatk_session`, `{did, handle, ts}`, and
//! `__hatk_session_accounts`, `{accounts: [{did, handle}], ts}`, with
//! AES-256-GCM: the value is the IV and the sealed bytes, each base64url,
//! a `.` between. Each lasts 30 days from `ts`. The index keeps the
//! key, 32 bytes, as `carried_cookie_key`, and the sessions hatk held as
//! `web_session`s.
//!
//! On a request with `__hatk_session` and no `grain_session`, before
//! `--carry-cookies-until`, [`carry`] opens it, and each account it
//! and its accounts cookie name that has a session here, not taken down,
//! is logged in as a login of this server's would log it in: the request
//! goes on with those cookies, so it is answered as that account, and the
//! answer sets them. hatk's cookies are cleared once read. Each account
//! carried is logged, by its DID, so that the logs say when they stop.

use super::{COOKIE, LASTS, MOST, OTHERS, Web, cookie, held, set_others};
use crate::App;
use aes_gcm::aead::{Aead, AeadCore, KeyInit, OsRng};
use aes_gcm::{Aes256Gcm, Nonce};
use axum::extract::{Request, State};
use axum::http::{HeaderValue, header};
use axum::middleware::Next;
use axum::response::Response;
use base64::Engine;
use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use grain::keys;
use serde::Deserialize;
use std::sync::Arc;

/// hatk's session cookie.
pub const SESSION: &str = "__hatk_session";
/// hatk's cookie of the other accounts a browser was logged in to.
pub const ACCOUNTS: &str = "__hatk_session_accounts";
/// How long hatk held a cookie to, in seconds from its `ts`.
const MAX_AGE: u64 = 30 * 24 * 60 * 60;

/// What opens hatk's cookies, and until when.
pub struct Carryover {
    cipher: Aes256Gcm,
    /// The last moment a cookie is carried, in seconds since the epoch.
    until: u64,
}

#[derive(Deserialize)]
struct Account {
    did: String,
}

#[derive(Deserialize)]
struct Sealed {
    did: Option<String>,
    accounts: Option<Vec<Account>>,
    ts: Option<u64>,
}

impl Carryover {
    pub fn new(key: &[u8; 32], until: u64) -> Carryover {
        Carryover {
            cipher: Aes256Gcm::new(key.into()),
            until,
        }
    }

    /// What `value` holds, if it was sealed under this key and is no
    /// older than hatk held it to at `now`, in seconds.
    fn open(&self, value: &str, now: u64) -> Option<Sealed> {
        let (iv, sealed) = value.split_once('.')?;
        let iv: [u8; 12] = URL_SAFE_NO_PAD.decode(iv).ok()?.try_into().ok()?;
        let sealed = URL_SAFE_NO_PAD.decode(sealed).ok()?;
        let plain = self
            .cipher
            .decrypt(&Nonce::from(iv), sealed.as_ref())
            .ok()?;
        let opened: Sealed = serde_json::from_slice(&plain).ok()?;
        (now.saturating_sub(opened.ts?) <= MAX_AGE).then_some(opened)
    }

    /// The account a session cookie names, while it lasts.
    fn session(&self, value: &str, now: u64) -> Option<String> {
        self.open(value, now)?.did
    }

    /// The accounts an accounts cookie names, while it lasts, the one
    /// logged in to last first.
    fn accounts(&self, value: &str, now: u64) -> Vec<String> {
        let accounts = self.open(value, now).and_then(|o| o.accounts);
        let dids = accounts.unwrap_or_default().into_iter().map(|a| a.did);
        // hatk kept them oldest first.
        dids.rev().collect()
    }
}

/// `payload` sealed as hatk sealed its cookies, under `key`: what the
/// tests carry.
#[doc(hidden)]
pub fn seal(key: &[u8; 32], payload: &serde_json::Value) -> String {
    let cipher = Aes256Gcm::new(key.into());
    let iv = Aes256Gcm::generate_nonce(&mut OsRng);
    let plain = serde_json::to_vec(payload).expect("a payload serializes");
    let sealed = cipher.encrypt(&iv, plain.as_ref()).expect("AES-GCM seals");
    format!(
        "{}.{}",
        URL_SAFE_NO_PAD.encode(iv),
        URL_SAFE_NO_PAD.encode(sealed)
    )
}

impl Web {
    /// This web, carrying hatk's cookies until `until`, in seconds since
    /// the epoch, if `index` keeps their key; as it was otherwise.
    pub fn carrying(
        mut self,
        index: &crate::index::Index,
        until: Option<u64>,
    ) -> rusqlite::Result<Web> {
        let key = match until {
            Some(_) => index.carried_cookie_key()?,
            None => None,
        };
        self.carryover = key
            .zip(until)
            .map(|(key, until)| Carryover::new(&key, until));
        Ok(self)
    }
}

/// Trades hatk's cookies for this server's, as [the module](self) says.
pub async fn carry(State(app): State<Arc<App>>, mut req: Request, next: Next) -> Response {
    let now = keys::now_secs();
    let carrying = app
        .web
        .as_ref()
        .and_then(|w| Some((w, w.carryover.as_ref()?)));
    let theirs = cookie(req.headers(), SESSION);
    let (Some((web, carryover)), Some(theirs)) = (carrying, theirs) else {
        return next.run(req).await;
    };
    if now > carryover.until {
        return next.run(req).await;
    }
    // The account in use first, then the others, each once, and only
    // those with a session here; none if the one in use has none.
    let mut carried: Vec<(String, String)> = Vec::new();
    let named = carryover
        .session(&theirs, now)
        .filter(|_| cookie(req.headers(), COOKIE).is_none());
    if let Some(did) = named.clone() {
        let accounts = cookie(req.headers(), ACCOUNTS);
        let others = accounts.map(|a| carryover.accounts(&a, now));
        for did in std::iter::once(did).chain(others.unwrap_or_default()) {
            let token = web.token(&did);
            if !carried.iter().any(|(d, _)| *d == did) && held(&app, &token).is_some() {
                tracing::info!(%did, "carried a web login");
                carried.push((did, token));
            }
        }
    }
    let mut set = Vec::new();
    if !carried.is_empty() && carried.first().map(|(d, _)| d) == named.as_ref() {
        let (_, token) = carried.remove(0);
        let mut pairs = format!("{COOKIE}={token}");
        if !carried.is_empty() {
            set.push(set_others(web, &carried));
            let others: Vec<&str> = carried.iter().take(MOST).map(|(_, t)| t.as_str()).collect();
            pairs = format!("{pairs}; {OTHERS}={}", others.join("~"));
        }
        // Ahead of what the browser sent, so that they are the ones read.
        let was = req.headers().get_all(header::COOKIE).into_iter();
        let was = was.filter_map(|v| v.to_str().ok());
        let all = std::iter::once(pairs.as_str()).chain(was);
        let all = all.collect::<Vec<_>>().join("; ");
        let all = HeaderValue::from_str(&all).expect("cookies are a header");
        req.headers_mut().insert(header::COOKIE, all);
        set.push(web.set_cookie(COOKIE, &token, LASTS));
    }
    let mut res = next.run(req).await;
    let headers = res.headers_mut();
    for cookie in set {
        headers.append(header::SET_COOKIE, cookie);
    }
    for name in [SESSION, ACCOUNTS] {
        headers.append(header::SET_COOKIE, web.set_cookie(name, "", 0));
    }
    res
}

#[cfg(test)]
pub(crate) mod tests {
    use super::*;
    use serde_json::json;

    /// The key hatk's code draws from its fixture JWK, and cookies hatk's
    /// own `encrypt` (`packages/hatk/src/oauth/session.ts`) sealed under it,
    /// on Node.
    const KEY: &str = "a0fb2a23a97fa7176425a2702c7ca2a8591deb89b7246a792454bc61e52a6903";
    /// `{did: "did:plc:alice", handle: "alice.test", ts: TS}`.
    const SEALED: &str = "I6P9CeNFQcdHEY0L.HElY4WaZK-ppTgpSHAM6qzTp79yV-I_sikV_ELstmDVG6kWDa8nO8i2X2LvmSs9V6kgO4uSGZcxkdLjd4by0zn-108EdnD_RsHOTYbU";
    /// bob, then alice, as hatk adds them, at `TS`.
    const SEALED_ACCOUNTS: &str = "iJ8hHV7f-dh9Z8ib.ggEwfCvNERTYOrDh7M4O4eT2TqyZYCFxNGadZxaAbH0iHRcwwKv0hwTJ3TiHfLUABp3lc7OsRdLO9l61LcQ8uxnWZ9gZzLIrb-Hxqzy6BoyXBG4fKqZ2tYmmI_ol4IgJznsxqiHPQOWNcx61AiBGMvQTX0wkaTsJmA5bAWOiU5MVQrhpWSo";
    const TS: u64 = 1793500000;

    pub(crate) fn key() -> [u8; 32] {
        let bytes: Vec<u8> = (0..KEY.len())
            .step_by(2)
            .map(|i| u8::from_str_radix(&KEY[i..i + 2], 16).unwrap())
            .collect();
        bytes.try_into().unwrap()
    }

    #[test]
    fn hatks_cookies_open_while_they_last() {
        let c = Carryover::new(&key(), u64::MAX);
        let alice = Some("did:plc:alice".to_string());
        assert_eq!(c.session(SEALED, TS), alice);
        assert_eq!(c.session(SEALED, TS + MAX_AGE), alice);
        assert_eq!(c.session(SEALED, TS + MAX_AGE + 1), None, "past 30 days");
        assert_eq!(
            c.accounts(SEALED_ACCOUNTS, TS),
            ["did:plc:alice", "did:plc:bob"]
        );
        assert!(c.accounts(SEALED_ACCOUNTS, TS + MAX_AGE + 1).is_empty());
        assert!(c.accounts(SEALED, TS).is_empty());
        assert_eq!(c.session(SEALED_ACCOUNTS, TS), None);
        // What the tests seal opens as hatk's does.
        let ours = seal(&key(), &json!({ "did": "did:plc:carol", "ts": TS }));
        assert_eq!(c.session(&ours, TS).as_deref(), Some("did:plc:carol"));
    }

    #[test]
    fn anything_else_opens_as_nothing() {
        let c = Carryover::new(&key(), u64::MAX);
        let (iv, sealed) = SEALED.split_once('.').unwrap();
        let mut bytes = URL_SAFE_NO_PAD.decode(sealed).unwrap();
        bytes[0] ^= 1;
        let tampered = format!("{iv}.{}", URL_SAFE_NO_PAD.encode(bytes));
        let short = format!("AAAA.{sealed}");
        let not_json = seal(&key(), &json!("a string"));
        for wrong in ["", "no-dot", "!!.!!", &short, &tampered, &not_json] {
            assert_eq!(c.session(wrong, TS), None, "{wrong}");
        }
        // Under another key, nothing opens.
        assert_eq!(Carryover::new(&[7; 32], u64::MAX).session(SEALED, TS), None);
    }
}

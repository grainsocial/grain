//! Handle → DID → PDS: cached on disk so a warm lookup spends no round
//! trip on it. What a DID document names is read by `atproto::did`.
//!
//! The hosts identity data names, a handle's, a `did:web`'s and the PDS a
//! DID document names, are held to [`crate::guard`]; the PLC directory and
//! the handle resolvers set are asked as they are set.

use crate::env::{Ctx, HandleResolver};
use crate::keys::now_secs;
use crate::store;
use crate::xrpc::{Xrpc, XrpcError};
use anyhow::{Context, Result, anyhow, bail};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::BTreeMap;
use std::path::Path;
use std::sync::Mutex;
use std::time::{Duration, Instant};

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct Identity {
    pub did: String,
    pub pds: String,
}

/// A name that is no account's handle: one no account can have, as
/// atproto's handles are hostnames of two labels or more, like
/// `alice.example.com`, or one a resolver asked answered that no account
/// has.
#[derive(Debug)]
pub struct NoSuchHandle(pub String);

impl std::fmt::Display for NoSuchHandle {
    fn fmt(&self, f: &mut std::fmt::Formatter) -> std::fmt::Result {
        write!(f, "{}: no one's handle", self.0)
    }
}

impl std::error::Error for NoSuchHandle {}

/// The DID of the server reached at `public_url`, an `https://` or
/// `http://` URL: the `did:web` of its host, as knotless-serve's and
/// grain-serve's are of their `--public-url`.
/// `https://grain.social` is `did:web:grain.social`.
pub fn service_did(public_url: &str) -> Result<String> {
    let url = public_url.trim_end_matches('/');
    let host = url
        .strip_prefix("https://")
        .or_else(|| url.strip_prefix("http://"))
        .filter(|h| !h.is_empty() && !h.contains('/'))
        .ok_or_else(|| anyhow!("{public_url}: a public URL is http(s)://host[:port]"))?;
    Ok(format!("did:web:{}", host.replace(':', "%3A")))
}

/// Whether `handle` is one an account can have: labels of letters, digits
/// and inner hyphens, two or more, the last starting with a letter.
pub fn valid_handle(handle: &str) -> bool {
    let label = |l: &str| {
        !l.is_empty()
            && l.len() <= 63
            && !l.starts_with('-')
            && !l.ends_with('-')
            && l.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'-')
    };
    let labels: Vec<&str> = handle.split('.').collect();
    let tld = labels.last().and_then(|l| l.bytes().next());
    handle.len() <= 253
        && labels.len() >= 2
        && labels.iter().all(|l| label(l))
        && tld.is_some_and(|b| b.is_ascii_alphabetic())
}

#[derive(Serialize, Deserialize)]
struct Cached {
    did: String,
    pds: String,
    at: u64,
}

pub async fn resolve(ctx: &Ctx, authority: &str) -> Result<Identity> {
    let path = ctx.env.cache_dir.join("identity.json");
    let mut cache: BTreeMap<String, Cached> = store::read(&path).unwrap_or_default();
    if let Some(hit) = cache.get(authority)
        && now_secs().saturating_sub(hit.at) < ctx.env.identity_ttl.as_secs()
        && !gone(hit)
    {
        return Ok(Identity {
            did: hit.did.clone(),
            pds: hit.pds.clone(),
        });
    }
    let did = if authority.starts_with("did:") {
        authority.to_string()
    } else {
        resolve_handle(ctx, authority).await?
    };
    let pds = match &ctx.env.service {
        Some(service) => service.clone(),
        None => resolve_pds(ctx, &did).await?,
    };
    cache.insert(
        authority.to_string(),
        Cached {
            did: did.clone(),
            pds: pds.clone(),
            at: now_secs(),
        },
    );
    // A cache that cannot be written only costs the next lookup.
    let _ = store::write(&path, &cache, false);
    Ok(Identity { did, pds })
}

/// A PDS that said an account is not there, as the one it left says once
/// it moves: the DID it named, if it named one, and when.
struct Gone {
    server: String,
    did: Option<String>,
    at: u64,
}

/// What PDSes said is not there, newest last, a few hundred at most.
static GONE: Mutex<Vec<Gone>> = Mutex::new(Vec::new());

/// Notes `refused`, from `server`, if it says an account is not there:
/// an identity cached before then as on that PDS is looked up again.
pub(crate) fn heard(server: &str, refused: &XrpcError) {
    let missing = matches!(
        refused.error.as_str(),
        "RepoNotFound" | "RepoDeactivated" | "AccountDeactivated"
    ) || refused.message.starts_with("Could not find repo");
    if !missing {
        return;
    }
    let did = refused
        .message
        .split_whitespace()
        .find(|w| w.starts_with("did:"));
    let mut gone = GONE.lock().unwrap();
    if gone.len() >= 256 {
        gone.remove(0);
    }
    gone.push(Gone {
        server: origin(server),
        did: did.map(str::to_string),
        at: now_secs(),
    });
}

/// Whether `hit`'s PDS has said since it was cached that its account is
/// not there.
fn gone(hit: &Cached) -> bool {
    let server = origin(&hit.pds);
    GONE.lock().unwrap().iter().any(|g| {
        g.server == server && g.at >= hit.at && g.did.as_ref().is_none_or(|d| *d == hit.did)
    })
}

/// `url`'s scheme, host and port, as a server is told apart.
fn origin(url: &str) -> String {
    reqwest::Url::parse(url).map_or_else(|_| url.to_string(), |u| u.origin().ascii_serialization())
}

/// Drops from the cache under `cache_dir` each identity whose PDS has
/// said its account is not there, for a process ending on that error:
/// the next looks the account up again rather than wait out the cache.
pub fn forget_gone(cache_dir: &Path) {
    let path = cache_dir.join("identity.json");
    if let Some(mut cache) = store::read::<BTreeMap<String, Cached>>(&path) {
        let before = cache.len();
        cache.retain(|_, hit| !gone(hit));
        if cache.len() < before {
            let _ = store::write(&path, &cache, false);
        }
    }
}

#[derive(Serialize, Deserialize)]
struct CachedHandle {
    handle: Option<String>,
    at: u64,
}

/// The handle `did` claims, if it resolves back to `did`; `None` when it
/// claims none, or one that does not. Cached on disk, as identities are.
pub async fn handle(ctx: &Ctx, did: &str) -> Option<String> {
    let path = ctx.env.cache_dir.join("handles.json");
    let mut cache: BTreeMap<String, CachedHandle> = store::read(&path).unwrap_or_default();
    if let Some(hit) = cache.get(did)
        && now_secs().saturating_sub(hit.at) < ctx.env.identity_ttl.as_secs()
    {
        return hit.handle.clone();
    }
    let handle = verified_handle(ctx, did).await.ok().flatten();
    cache.insert(
        did.to_string(),
        CachedHandle {
            handle: handle.clone(),
            at: now_secs(),
        },
    );
    let _ = store::write(&path, &cache, false);
    handle
}

/// The handle `did` claims, if it resolves back to `did`; `None` when it
/// claims none, or one that does not. Looked up now, uncached; an error
/// when `did`'s document cannot be read, which says nothing of its handle.
pub async fn verified_handle(ctx: &Ctx, did: &str) -> Result<Option<String>> {
    let doc = document(ctx, did).await?;
    let claimed = doc["alsoKnownAs"][0].as_str();
    let claimed = claimed.and_then(|a| a.strip_prefix("at://")).unwrap_or(did);
    let verified = resolve_handle(ctx, claimed).await.ok();
    Ok((verified.as_deref() == Some(did)).then(|| claimed.to_string()))
}

/// The handles of `dids` that have one, by DID.
pub async fn handles<'a>(
    ctx: &Ctx,
    dids: impl IntoIterator<Item = &'a str>,
) -> BTreeMap<String, String> {
    let mut dids: Vec<&str> = dids.into_iter().collect();
    dids.sort();
    dids.dedup();
    let found = futures::future::join_all(dids.iter().map(|d| handle(ctx, d))).await;
    dids.into_iter()
        .zip(found)
        .filter_map(|(did, h)| Some((did.to_string(), h?)))
        .collect()
}

/// Drops `authority` from the cache, for a caller that found it stale.
pub fn forget(ctx: &Ctx, authority: &str) {
    let path = ctx.env.cache_dir.join("identity.json");
    if let Some(mut cache) = store::read::<BTreeMap<String, Cached>>(&path)
        && cache.remove(authority).is_some()
    {
        let _ = store::write(&path, &cache, false);
    }
}

pub async fn resolve_handle(ctx: &Ctx, handle: &str) -> Result<String> {
    // Asked of nobody: a scanner's `/wp-admin` is no one's to look up.
    // Resolving over plain http is for local servers, as `127.0.0.1:port`,
    // whose names are not handles.
    let local = ctx
        .env
        .handle_resolvers
        .iter()
        .any(|r| matches!(r, HandleResolver::WellKnown { scheme } if scheme == "http"));
    if !local && !valid_handle(handle) {
        return Err(NoSuchHandle(handle.into()).into());
    }
    let mut failures = Vec::new();
    // A resolver that answered 400 looked and found no one: a crawler
    // following a test's `alice.test` is not a server failing.
    let mut refused = false;
    for resolver in &ctx.env.handle_resolvers {
        let attempt = match resolver {
            HandleResolver::WellKnown { scheme } => well_known(ctx, scheme, handle).await,
            HandleResolver::Xrpc { service } => {
                #[derive(Deserialize)]
                struct Out {
                    did: String,
                }
                Xrpc::new(ctx.http.clone(), service)
                    .query::<Out>(
                        "com.atproto.identity.resolveHandle",
                        &[("handle", handle)],
                        None,
                    )
                    .await
                    .map(|o| o.did)
            }
        };
        match attempt {
            Ok(did) if did.starts_with("did:") => return Ok(did),
            Ok(other) => failures.push(format!("not a DID: {other}")),
            Err(err) => {
                refused |= XrpcError::of(&err).is_some_and(|e| e.status == 400);
                failures.push(err.to_string());
            }
        }
    }
    if refused {
        return Err(NoSuchHandle(handle.into()).into());
    }
    bail!("cannot resolve handle {handle}: {}", failures.join("; "))
}

/// How long a lookup at a host the name alone points to may take: a handle's
/// `/.well-known/atproto-did`, a `did:web` document. Any name can point at a
/// host that takes the connection and never answers, which held a request
/// for the client's whole timeout; atproto's own resolvers wait as long.
pub const LOOKUP: Duration = Duration::from_secs(3);

async fn well_known(ctx: &Ctx, scheme: &str, handle: &str) -> Result<String> {
    let url = format!("{scheme}://{handle}/.well-known/atproto-did");
    ctx.may_ask(&url)?;
    let req = ctx.guarded.get(url).timeout(LOOKUP);
    let res = crate::telemetry::send(req, 0).await?.error_for_status()?;
    Ok(res.text().await?.trim().to_string())
}

pub async fn resolve_pds(ctx: &Ctx, did: &str) -> Result<String> {
    let doc = document(ctx, did).await?;
    pds(ctx, did, &doc)
}

/// The PDS `doc`, `did`'s DID document, names, if it may be asked
/// ([`Ctx::may_ask`]); a refusal is a [`crate::guard::Refused`].
pub fn pds(ctx: &Ctx, did: &str, doc: &Value) -> Result<String> {
    let pds = atproto::did::pds(doc);
    let pds = pds.ok_or_else(|| anyhow!("{did} names no #atproto_pds service"))?;
    ctx.may_ask(&pds)?;
    Ok(pds)
}

/// Where `did`'s DID document is read: the PLC directory, or its
/// `did:web` host.
fn document_url(ctx: &Ctx, did: &str) -> Result<String> {
    if let Some(host) = did.strip_prefix("did:web:") {
        let host = host.replace("%3A", ":");
        Ok(format!(
            "{}://{host}/.well-known/did.json",
            ctx.env.did_web_scheme
        ))
    } else if did.starts_with("did:plc:") {
        Ok(format!("{}/{did}", ctx.env.plc_url.trim_end_matches('/')))
    } else {
        bail!("{did}: unsupported DID method");
    }
}

/// DID documents as they were last read, by where, and when: a server
/// checks the tokens of the same few accounts over and over.
static KEPT: Mutex<BTreeMap<String, (Instant, Value)>> = Mutex::new(BTreeMap::new());

/// How long a DID document read is taken as it stands.
const KEPT_FOR: Duration = Duration::from_secs(300);

/// `did`'s DID document, from the PLC directory or its `did:web` host.
pub async fn document(ctx: &Ctx, did: &str) -> Result<Value> {
    let url = document_url(ctx, did)?;
    let req = if did.starts_with("did:web:") {
        ctx.may_ask(&url)?;
        ctx.guarded.get(&url).timeout(LOOKUP)
    } else {
        ctx.http.get(&url)
    };
    let res = crate::telemetry::send(req, 0).await?;
    let res = res.error_for_status().context(format!("resolving {did}"))?;
    let doc: Value = res.json().await?;
    let kept = (Instant::now(), doc.clone());
    KEPT.lock().unwrap().insert(url, kept);
    Ok(doc)
}

/// `did`'s DID document as [`document`] read it in the last few minutes,
/// else read now. What it names may have changed since: a key that turns
/// a signature away is worth reading again.
pub async fn kept_document(ctx: &Ctx, did: &str) -> Result<Value> {
    let url = document_url(ctx, did)?;
    let kept = KEPT.lock().unwrap().get(&url).cloned();
    match kept {
        Some((at, doc)) if at.elapsed() < KEPT_FOR => Ok(doc),
        _ => document(ctx, did).await,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::env::Env;
    use serde_json::json;

    #[test]
    fn handles() {
        for good in ["alice.test", "a.b.example.com", "x-1.bsky.social"] {
            assert!(valid_handle(good), "{good}");
        }
        let long = format!("{}.com", "a".repeat(64));
        for bad in [
            "wp-admin", "", "a..b", "-a.com", "a-.com", "a.1com", "a_b.com", &long,
        ] {
            assert!(!valid_handle(bad), "{bad}");
        }
        assert_eq!(
            NoSuchHandle("wp-admin".into()).to_string(),
            "wp-admin: no one's handle"
        );
    }

    #[tokio::test]
    async fn no_lookup_for_what_is_not_a_handle() {
        let ctx = Ctx::new(crate::env::Env::from_vars(|_| None));
        let err = resolve_handle(&ctx, "wp-admin").await.unwrap_err();
        assert!(err.downcast_ref::<NoSuchHandle>().is_some(), "{err}");
    }

    #[tokio::test]
    async fn a_resolver_down_is_no_answer() {
        let ctx = Ctx::new(crate::env::Env::from_vars(|k| {
            (k == "GRAIN_HANDLE_RESOLVER").then(|| "http://127.0.0.1:1".into())
        }));
        let err = resolve_handle(&ctx, "alice.example.com").await.unwrap_err();
        assert!(err.downcast_ref::<NoSuchHandle>().is_none(), "{err}");
    }

    #[tokio::test]
    async fn an_account_gone_from_its_pds_is_looked_up_again() {
        let dir = tempfile::tempdir().unwrap();
        let cache_dir = dir.path().to_str().unwrap().to_string();
        let ctx = Ctx::new(crate::env::Env::from_vars(|k| match k {
            "GRAIN_CACHE_DIR" => Some(cache_dir.clone()),
            "GRAIN_PLC_URL" => Some("http://127.0.0.1:1".into()),
            _ => None,
        }));
        let cached = |did: &str, pds: &str| Cached {
            did: did.into(),
            pds: pds.into(),
            at: now_secs(),
        };
        let cache = BTreeMap::from([
            (
                "did:plc:moved".to_string(),
                cached("did:plc:moved", "https://old.test/"),
            ),
            (
                "did:plc:stays".to_string(),
                cached("did:plc:stays", "https://old.test"),
            ),
            (
                "did:plc:other".to_string(),
                cached("did:plc:other", "https://other.test"),
            ),
        ]);
        let path = dir.path().join("identity.json");
        store::write(&path, &cache, false).unwrap();
        let id = resolve(&ctx, "did:plc:moved").await.unwrap();
        assert_eq!(id.pds, "https://old.test/");

        let refused = |error: &str, message: &str| XrpcError {
            status: 400,
            error: error.into(),
            message: message.into(),
            reset: None,
        };
        // Neither another error nor another server's says anything of it.
        heard("https://old.test", &refused("InvalidRequest", "bad cursor"));
        heard("https://elsewhere.test", &refused("RepoNotFound", ""));
        assert!(resolve(&ctx, "did:plc:moved").await.is_ok());
        heard(
            "https://old.test/xrpc/com.atproto.repo.listRecords",
            &refused("InvalidRequest", "Could not find repo: did:plc:moved"),
        );
        assert!(resolve(&ctx, "did:plc:moved").await.is_err());
        assert!(resolve(&ctx, "did:plc:stays").await.is_ok());
        forget_gone(dir.path());
        let left: BTreeMap<String, Cached> = store::read(&path).unwrap();
        assert_eq!(
            left.keys().collect::<Vec<_>>(),
            ["did:plc:other", "did:plc:stays"]
        );
        forget_gone(dir.path());
        // With no cache at all, there is nothing to drop.
        forget_gone(&dir.path().join("none"));

        // Naming no DID, it is every account cached as there.
        heard(
            "https://old.test",
            &refused("AccountDeactivated", "Account is deactivated"),
        );
        assert!(resolve(&ctx, "did:plc:stays").await.is_err());
        assert!(resolve(&ctx, "did:plc:other").await.is_ok());
        assert_eq!(origin("not a url"), "not a url");
        for _ in 0..300 {
            heard("https://many.test", &refused("RepoNotFound", ""));
        }
        assert_eq!(GONE.lock().unwrap().len(), 256);
    }

    #[test]
    fn document_urls() {
        let ctx = Ctx::new(Env::from_vars(|k| {
            (k == "GRAIN_PLC_URL").then(|| "http://plc.test/".into())
        }));
        let url = |did: &str| document_url(&ctx, did);
        assert_eq!(url("did:plc:abc").unwrap(), "http://plc.test/did:plc:abc");
        assert_eq!(
            url("did:web:example.com%3A8080").unwrap(),
            "https://example.com:8080/.well-known/did.json"
        );
        assert!(url("did:key:zDn").is_err());
    }

    #[tokio::test]
    async fn one_pds_serves_everyone_when_named() {
        let dir = tempfile::tempdir().unwrap();
        let cache_dir = dir.path().to_str().unwrap().to_string();
        let ctx = Ctx::new(Env::from_vars(|k| match k {
            "GRAIN_CACHE_DIR" => Some(cache_dir.clone()),
            "GRAIN_SERVICE" => Some("http://pds.test".into()),
            _ => None,
        }));
        let id = resolve(&ctx, "did:plc:anyone").await.unwrap();
        assert_eq!(id.pds, "http://pds.test");
    }

    /// Answers every request to `listener` with 200 and `body`.
    fn answer(listener: std::net::TcpListener, body: String) {
        use std::io::Write;
        std::thread::spawn(move || {
            for stream in listener.incoming() {
                let mut stream = stream.unwrap();
                crate::xrpc::tests::read_request(&mut stream);
                let answer = format!(
                    "HTTP/1.1 200 OK\r\ncontent-length: {}\r\nconnection: close\r\n\r\n{body}",
                    body.len()
                );
                let _ = stream.write_all(answer.as_bytes());
            }
        });
    }

    #[tokio::test]
    async fn a_did_web_account_and_its_handle() {
        let docs = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
        let names = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
        let port = docs.local_addr().unwrap().port();
        let did = format!("did:web:127.0.0.1%3A{port}");
        let name = names.local_addr().unwrap().to_string();
        let key = crate::crypto::P256Key::generate().public();
        let doc = json!({
            "id": did,
            "alsoKnownAs": [format!("at://{name}")],
            "verificationMethod": [{
                "id": format!("{did}#atproto"),
                "type": "Multikey",
                "publicKeyMultibase": key.to_multibase(),
            }],
            "service": [{
                "id": "#atproto_pds",
                "type": "AtprotoPersonalDataServer",
                "serviceEndpoint": "http://pds.test/",
            }],
        });
        answer(docs, doc.to_string());
        answer(names, format!("{did}\n"));
        let dir = tempfile::tempdir().unwrap();
        let cache_dir = dir.path().to_str().unwrap().to_string();
        let ctx = Ctx::new(Env::from_vars(|k| match k {
            "GRAIN_CACHE_DIR" => Some(cache_dir.clone()),
            "GRAIN_DID_WEB_SCHEME" => Some("http".into()),
            "GRAIN_HANDLE_RESOLVER" => Some("well-known:http".into()),
            "GRAIN_ALLOW_PRIVATE" => Some("1".into()),
            _ => None,
        }));
        let id = resolve(&ctx, &name).await.unwrap();
        let pds = "http://pds.test".to_string();
        assert_eq!(
            id,
            Identity {
                did: did.clone(),
                pds: pds.clone()
            }
        );
        let path = dir.path().join("identity.json");
        let cached: BTreeMap<String, Cached> = store::read(&path).unwrap();
        assert_eq!(cached[&name].did, did);
        // Warm, it is the cache's answer.
        assert_eq!(resolve(&ctx, &name).await.unwrap().did, did);

        assert_eq!(resolve_pds(&ctx, &did).await.unwrap(), pds);
        let doc = kept_document(&ctx, &did).await.unwrap();
        assert_eq!(atproto::did::signing_key(&doc).unwrap(), key);
        assert_eq!(
            verified_handle(&ctx, &did).await.unwrap(),
            Some(name.clone())
        );
        assert_eq!(handle(&ctx, &did).await, Some(name.clone()));
        let both = super::handles(&ctx, [did.as_str(), did.as_str()]).await;
        assert_eq!(both, BTreeMap::from([(did.clone(), name.clone())]));

        forget(&ctx, &name);
        let cached: BTreeMap<String, Cached> = store::read(&path).unwrap();
        assert!(!cached.contains_key(&name));
        // A DID no document is served for has no handle to show.
        let nowhere = "did:web:127.0.0.1%3A1";
        assert!(verified_handle(&ctx, nowhere).await.is_err());
        assert_eq!(handle(&ctx, nowhere).await, None);
    }

    #[tokio::test]
    async fn hosts_identity_data_names_are_asked_only_if_public() {
        let dir = tempfile::tempdir().unwrap();
        let cache_dir = dir.path().to_str().unwrap().to_string();
        let ctx = |scheme: &'static str| {
            let cache_dir = cache_dir.clone();
            Ctx::new(Env::from_vars(move |k| match k {
                "GRAIN_CACHE_DIR" => Some(cache_dir.clone()),
                "GRAIN_DID_WEB_SCHEME" => Some(scheme.into()),
                "GRAIN_HANDLE_RESOLVER" => Some(format!("well-known:{scheme}")),
                _ => None,
            }))
        };
        let refused = |err: anyhow::Error| {
            let refused = err.downcast_ref::<crate::guard::Refused>();
            refused
                .map(|r| r.0.clone())
                .unwrap_or_else(|| panic!("{err:#}"))
        };
        // A did:web host on loopback, over http or https.
        let did = "did:web:127.0.0.1%3A2583";
        let why = refused(document(&ctx("http"), did).await.unwrap_err());
        assert_eq!(
            why,
            "http://127.0.0.1:2583/.well-known/did.json is not on https"
        );
        let why = refused(document(&ctx("https"), did).await.unwrap_err());
        assert!(why.ends_with("is not at a public address"), "{why}");
        // A handle's host, over http.
        let why = resolve_handle(&ctx("http"), "alice.test")
            .await
            .unwrap_err();
        assert!(
            why.to_string()
                .contains("alice.test/.well-known/atproto-did is not on https")
        );
        // A DID document's PDS.
        let ctx = ctx("https");
        let doc = |pds: &str| json!({"service": [{"id": "#atproto_pds", "serviceEndpoint": pds}]});
        let pds = |at: &str| pds(&ctx, "did:plc:a", &doc(at));
        assert_eq!(pds("https://pds.example/").unwrap(), "https://pds.example");
        for inward in [
            "http://pds.example",
            "https://10.0.0.1",
            "https://[::1]:2583",
        ] {
            assert!(refused(pds(inward).unwrap_err()).starts_with(inward));
        }
        assert!(pds("").is_err());
        assert!(super::pds(&ctx, "did:plc:a", &json!({})).is_err());
    }
}

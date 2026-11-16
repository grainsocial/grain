//! Process configuration, read once from the environment.

use std::path::PathBuf;
use std::time::Duration;

/// How a handle becomes a DID, tried in order.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum HandleResolver {
    /// `<scheme>://<handle>/.well-known/atproto-did`.
    WellKnown { scheme: String },
    /// `com.atproto.identity.resolveHandle` on a service.
    Xrpc { service: String },
}

/// grain's appview.
pub const APPVIEW: &str = "https://grain.social";

#[derive(Clone, Debug)]
pub struct Env {
    /// Where sessions are kept, and the account this machine acts as.
    pub config_dir: PathBuf,
    pub cache_dir: PathBuf,
    pub plc_url: String,
    pub handle_resolvers: Vec<HandleResolver>,
    /// Scheme for did:web documents; tests serve them over plain http.
    pub did_web_scheme: String,
    /// Certificates to trust beside the usual roots, PEM: a local network
    /// behind a proxy with a CA of its own.
    pub ca_certs: Option<PathBuf>,
    /// Skips DID resolution: every identity is served by this PDS.
    pub service: Option<String>,
    /// grain's appview, which reports go to and admins moderate at
    /// (`GRAIN_APPVIEW`): grain.social unless it says otherwise.
    pub appview: String,
    /// The appview's DID, which service tokens are for
    /// (`GRAIN_APPVIEW_DID`), when it is not the `did:web` of
    /// [`Env::appview`]'s host: one with a port has none atproto takes.
    pub appview_did: Option<String>,
    /// The account to act as, when not the one last logged in.
    pub identifier: Option<String>,
    /// An app password for [`Env::identifier`], to log in with when no
    /// session is kept.
    pub password: Option<String>,
    /// The command an OAuth login opens its page with, the URL added last.
    pub browser: Option<String>,
    pub identity_ttl: Duration,
    pub timeout: Duration,
    /// Whether hosts identity data names may be asked at loopback, private
    /// and other addresses that are not the public internet's, and not on
    /// https (`GRAIN_ALLOW_PRIVATE=1`): for tests and dev only, as a local
    /// PDS is. See [`crate::guard`].
    pub allow_private: bool,
}

impl Env {
    pub fn from_process() -> Env {
        Env::from_vars(|name| std::env::var(name).ok())
    }

    pub fn from_vars(get: impl Fn(&str) -> Option<String>) -> Env {
        let home = get("HOME").unwrap_or_else(|| ".".into());
        let dir = |own: &str, xdg: &str, fallback: &str| {
            get(own).map(PathBuf::from).unwrap_or_else(|| {
                get(xdg)
                    .map(PathBuf::from)
                    .unwrap_or_else(|| PathBuf::from(&home).join(fallback))
                    .join("grain")
            })
        };
        let num = |name: &str, default: u64| {
            get(name)
                .and_then(|v| v.parse::<u64>().ok())
                .unwrap_or(default)
        };
        let handle_resolvers = match get("GRAIN_HANDLE_RESOLVER") {
            Some(list) => list
                .split(',')
                .filter(|s| !s.is_empty())
                .map(|s| match s.strip_prefix("well-known:") {
                    Some(scheme) => HandleResolver::WellKnown {
                        scheme: scheme.into(),
                    },
                    None => HandleResolver::Xrpc { service: s.into() },
                })
                .collect(),
            None => vec![
                HandleResolver::WellKnown {
                    scheme: "https".into(),
                },
                HandleResolver::Xrpc {
                    service: "https://public.api.bsky.app".into(),
                },
            ],
        };
        Env {
            config_dir: dir("GRAIN_CONFIG_DIR", "XDG_CONFIG_HOME", ".config"),
            cache_dir: dir("GRAIN_CACHE_DIR", "XDG_CACHE_HOME", ".cache"),
            plc_url: get("GRAIN_PLC_URL").unwrap_or_else(|| "https://plc.directory".into()),
            handle_resolvers,
            did_web_scheme: get("GRAIN_DID_WEB_SCHEME").unwrap_or_else(|| "https".into()),
            ca_certs: get("GRAIN_CA_CERTS")
                .filter(|v| !v.is_empty())
                .map(PathBuf::from),
            service: get("GRAIN_SERVICE").filter(|v| !v.is_empty()),
            appview: get("GRAIN_APPVIEW")
                .filter(|v| !v.is_empty())
                .map_or_else(|| APPVIEW.into(), |v| v.trim_end_matches('/').into()),
            appview_did: get("GRAIN_APPVIEW_DID").filter(|v| !v.is_empty()),
            identifier: get("GRAIN_IDENTIFIER").filter(|v| !v.is_empty()),
            password: get("GRAIN_PASSWORD").filter(|v| !v.is_empty()),
            browser: get("GRAIN_BROWSER").filter(|v| !v.is_empty()),
            identity_ttl: Duration::from_secs(num("GRAIN_IDENTITY_TTL_SECS", 3600)),
            timeout: Duration::from_secs(num("GRAIN_TIMEOUT_SECS", 60)),
            allow_private: get("GRAIN_ALLOW_PRIVATE").as_deref() == Some("1"),
        }
    }
}

/// Configuration plus the HTTP clients a process shares, so every request
/// to a PDS reuses its connection.
#[derive(Clone)]
pub struct Ctx {
    pub env: Env,
    /// For the hosts this process is set to ask, and its own account's.
    pub http: reqwest::Client,
    /// For the hosts identity data names, held to [`crate::guard`]: a
    /// `did:web` host, a handle's, the PDS a DID document names.
    pub guarded: reqwest::Client,
}

impl Ctx {
    pub fn new(env: Env) -> Ctx {
        let base = || {
            let mut http = reqwest::Client::builder();
            for cert in env.ca_certs.iter().flat_map(|path| extra_roots(path)) {
                http = http.add_root_certificate(cert);
            }
            http.user_agent(concat!("grain/", env!("CARGO_PKG_VERSION")))
                .connect_timeout(Duration::from_secs(10))
                .timeout(env.timeout)
                // Under the 5s Node servers keep an idle connection by
                // default, as a PLC directory does: past it, one can close
                // under the request reusing it. A PDS keeps one 90s, which
                // ties with any longer wait here.
                .pool_idle_timeout(Duration::from_secs(4))
                .tcp_nodelay(true)
        };
        let built = "the HTTP client configuration is static";
        let http = base().build().expect(built);
        let guarded = crate::guard::client(base(), env.allow_private);
        let guarded = guarded.build().expect(built);
        Ctx { env, http, guarded }
    }

    /// Whether `url`, as identity data names it, may be asked
    /// ([`crate::guard::may_ask`]): any may when private hosts are allowed.
    pub fn may_ask(&self, url: &str) -> Result<(), crate::guard::Refused> {
        if self.env.allow_private {
            return Ok(());
        }
        crate::guard::may_ask(url)
    }
}

/// The certificates in the PEM file at `path`; none, said once, if it
/// can't be read, so a mistyped path fails as an untrusted server would.
fn extra_roots(path: &std::path::Path) -> Vec<reqwest::Certificate> {
    let roots = std::fs::read(path)
        .map_err(anyhow::Error::from)
        .and_then(|pem| Ok(reqwest::Certificate::from_pem_bundle(&pem)?));
    roots.unwrap_or_else(|err| {
        eprintln!("grain: GRAIN_CA_CERTS {}: {err}", path.display());
        Vec::new()
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;

    fn env(vars: &[(&str, &str)]) -> Env {
        let map: HashMap<String, String> = vars
            .iter()
            .map(|(k, v)| (k.to_string(), v.to_string()))
            .collect();
        Env::from_vars(|k| map.get(k).cloned())
    }

    #[test]
    fn defaults() {
        let e = env(&[("HOME", "/home/a")]);
        assert_eq!(e.config_dir, PathBuf::from("/home/a/.config/grain"));
        assert_eq!(e.cache_dir, PathBuf::from("/home/a/.cache/grain"));
        assert_eq!(e.plc_url, "https://plc.directory");
        assert_eq!(e.did_web_scheme, "https");
        assert_eq!(
            e.handle_resolvers,
            vec![
                HandleResolver::WellKnown {
                    scheme: "https".into()
                },
                HandleResolver::Xrpc {
                    service: "https://public.api.bsky.app".into()
                }
            ]
        );
        assert_eq!(e.identity_ttl, Duration::from_secs(3600));
        assert_eq!(e.timeout, Duration::from_secs(60));
        assert!(e.service.is_none());
        assert_eq!(e.appview, APPVIEW);
        let elsewhere = env(&[("GRAIN_APPVIEW", "http://127.0.0.1:2600/")]);
        assert_eq!(elsewhere.appview, "http://127.0.0.1:2600");
        assert!(e.appview_did.is_none());
        let named = env(&[("GRAIN_APPVIEW_DID", "did:web:grain.test")]);
        assert_eq!(named.appview_did.as_deref(), Some("did:web:grain.test"));
        assert!(e.ca_certs.is_none());
        assert!(e.identifier.is_none() && e.password.is_none() && e.browser.is_none());
        assert!(!e.allow_private);
        let ctx = Ctx::new(e);
        assert!(ctx.may_ask("http://127.0.0.1:2583").is_err());
        let bare = env(&[]);
        assert_eq!(bare.cache_dir, PathBuf::from("./.cache/grain"));
        assert_eq!(bare.config_dir, PathBuf::from("./.config/grain"));
    }

    #[test]
    fn overrides() {
        let e = env(&[
            ("XDG_CACHE_HOME", "/x"),
            ("XDG_CONFIG_HOME", "/y"),
            ("GRAIN_IDENTIFIER", "alice.test"),
            ("GRAIN_PASSWORD", "hunter2"),
            ("GRAIN_BROWSER", "firefox --new-tab"),
            ("GRAIN_HANDLE_RESOLVER", "well-known:http,http://pds,"),
            ("GRAIN_PLC_URL", "http://plc"),
            ("GRAIN_DID_WEB_SCHEME", "http"),
            ("GRAIN_SERVICE", "http://pds"),
            ("GRAIN_IDENTITY_TTL_SECS", "5"),
            ("GRAIN_TIMEOUT_SECS", "soon"),
            ("GRAIN_ALLOW_PRIVATE", "1"),
        ]);
        assert_eq!(e.cache_dir, PathBuf::from("/x/grain"));
        assert_eq!(e.config_dir, PathBuf::from("/y/grain"));
        assert_eq!(e.identifier.as_deref(), Some("alice.test"));
        assert_eq!(e.password.as_deref(), Some("hunter2"));
        assert_eq!(e.browser.as_deref(), Some("firefox --new-tab"));
        assert_eq!(e.plc_url, "http://plc");
        assert_eq!(e.did_web_scheme, "http");
        assert_eq!(e.service.as_deref(), Some("http://pds"));
        assert_eq!(e.identity_ttl, Duration::from_secs(5));
        assert_eq!(e.timeout, Duration::from_secs(60));
        assert!(e.allow_private);
        assert!(!env(&[("GRAIN_ALLOW_PRIVATE", "yes")]).allow_private);
        assert_eq!(
            e.handle_resolvers,
            vec![
                HandleResolver::WellKnown {
                    scheme: "http".into()
                },
                HandleResolver::Xrpc {
                    service: "http://pds".into()
                }
            ]
        );
        assert_eq!(
            env(&[("GRAIN_CACHE_DIR", "/c")]).cache_dir,
            PathBuf::from("/c")
        );
        assert!(env(&[("GRAIN_SERVICE", "")]).service.is_none());
        assert_eq!(
            env(&[("GRAIN_CONFIG_DIR", "/k")]).config_dir,
            PathBuf::from("/k")
        );
        assert_eq!(Ctx::new(e).may_ask("http://127.0.0.1:2583"), Ok(()));
    }

    /// A throwaway self-signed CA, only for reading back.
    const TEST_CA: &str = "-----BEGIN CERTIFICATE-----\nMIIBjTCCATOgAwIBAgIUW5Z0OJcr5A6Uzy+D+Jc6OM3cDt8wCgYIKoZIzj0EAwIw\nGzEZMBcGA1UEAwwQa25vdGxlc3MgdGVzdCBDQTAgFw0yNjEwMjQwMDIzMTRaGA8y\nMTI2MDkzMDAwMjMxNFowGzEZMBcGA1UEAwwQa25vdGxlc3MgdGVzdCBDQTBZMBMG\nByqGSM49AgEGCCqGSM49AwEHA0IABJyz7he0x9D3F54sUTSlH1cmYOJFqVKhOxg/\nhms5rbXMyiARmltNCbVSSq//HJd/YNouFdBOXNnOuot4qukk3iajUzBRMB0GA1Ud\nDgQWBBQGfpQL8IXKrgaOIycZIqo3E3pdDzAfBgNVHSMEGDAWgBQGfpQL8IXKrgaO\nIycZIqo3E3pdDzAPBgNVHRMBAf8EBTADAQH/MAoGCCqGSM49BAMCA0gAMEUCIBeZ\nk3lRccBXvvSJxmcoAKKnalqoI/600ObPgeVxRkSyAiEAsBLjRbTAWH5dOVShu82A\n++dP/h0UHb5o4K49o69ITM8=\n-----END CERTIFICATE-----\n";

    #[test]
    fn extra_roots_are_read_from_a_pem_file() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("ca.pem");
        std::fs::write(&path, TEST_CA).unwrap();
        assert_eq!(extra_roots(&path).len(), 1);
        // A mistyped path trusts nothing more.
        assert!(extra_roots(&dir.path().join("missing.pem")).is_empty());
        let e = env(&[("GRAIN_CA_CERTS", path.to_str().unwrap())]);
        assert_eq!(e.ca_certs.as_deref(), Some(path.as_path()));
        Ctx::new(e);
        assert!(env(&[("GRAIN_CA_CERTS", "")]).ca_certs.is_none());
    }
}

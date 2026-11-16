//! What a host that identity data names may be asked. A DID document names
//! whatever PDS it likes, a `did:web` whatever host, a handle whatever
//! name, and anyone can make grain-serve look one up, so such a host is
//! asked only on https, at a public address, its hostname resolved to
//! public addresses only ([`PublicOnly`]), and no redirect is followed
//! ([`client`]). `GRAIN_ALLOW_PRIVATE=1` lifts this for tests and dev
//! ([`crate::env::Env::allow_private`]).
//!
//! The PLC directory, the handle resolvers and the services a process is
//! configured with are its settings, not identity data, and are asked as
//! they are set.

use std::net::{IpAddr, SocketAddr};
use std::sync::Arc;

/// Why a host identity data names is not asked.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Refused(pub String);

impl std::fmt::Display for Refused {
    fn fmt(&self, f: &mut std::fmt::Formatter) -> std::fmt::Result {
        f.write_str(&self.0)
    }
}

impl std::error::Error for Refused {}

/// Whether `ip` is the public internet's: not loopback, private,
/// link-local, shared, reserved, multicast, or for documentation.
pub fn public(ip: IpAddr) -> bool {
    match ip {
        IpAddr::V4(v4) => {
            let [a, b, c, _] = v4.octets();
            let special = v4.is_private() || v4.is_loopback() || v4.is_link_local();
            let special = special || v4.is_documentation() || v4.is_multicast();
            let special = special || a == 0 || a >= 240 || (a == 100 && (b & 0xc0) == 64);
            !(special || (a == 198 && (b & 0xfe) == 18) || (a == 192 && b == 0 && c == 0))
        }
        IpAddr::V6(v6) => match v6.to_ipv4_mapped() {
            Some(v4) => public(v4.into()),
            // Global unicast, less the documentation prefix.
            None => {
                let [s, t, ..] = v6.segments();
                (s & 0xe000) == 0x2000 && !(s == 0x2001 && t == 0xdb8)
            }
        },
    }
}

/// Whether `url`, as identity data names it, may be asked: on https, and
/// not at an address that is not public. A hostname's addresses are held
/// to the same when it is resolved ([`PublicOnly`]).
pub fn may_ask(url: &str) -> Result<(), Refused> {
    let parsed = reqwest::Url::parse(url).map_err(|e| Refused(format!("{url}: {e}")))?;
    if parsed.scheme() != "https" {
        return Err(Refused(format!("{url} is not on https")));
    }
    let host = parsed.host_str().unwrap_or_default();
    let ip = host.trim_matches(['[', ']']).parse::<IpAddr>().ok();
    if ip.is_some_and(|ip| !public(ip)) {
        return Err(Refused(format!("{url} is not at a public address")));
    }
    Ok(())
}

/// Resolves a hostname to its public addresses only, so that a name
/// pointing inward is not asked.
pub struct PublicOnly;

impl reqwest::dns::Resolve for PublicOnly {
    fn resolve(&self, name: reqwest::dns::Name) -> reqwest::dns::Resolving {
        Box::pin(async move {
            let found = tokio::net::lookup_host((name.as_str(), 0)).await?;
            let found: Vec<SocketAddr> = found.filter(|a| public(a.ip())).collect();
            let why = format!("{} has no public address", name.as_str());
            if found.is_empty() {
                return Err(why.into());
            }
            Ok(Box::new(found.into_iter()) as reqwest::dns::Addrs)
        })
    }
}

/// `http`, held to this policy: no redirects, since one could lead
/// anywhere the name could not, and hostnames resolved to public addresses
/// only, unless `allow_private`.
pub fn client(http: reqwest::ClientBuilder, allow_private: bool) -> reqwest::ClientBuilder {
    let http = http.redirect(reqwest::redirect::Policy::none());
    if allow_private {
        http
    } else {
        http.dns_resolver(Arc::new(PublicOnly))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use reqwest::dns::Resolve;

    #[test]
    fn only_public_addresses() {
        for ip in ["8.8.8.8", "1.1.1.1", "2606:4700::1111", "::ffff:8.8.8.8"] {
            assert!(public(ip.parse().unwrap()), "{ip}");
        }
        let inward = [
            "127.0.0.1",
            "10.1.2.3",
            "172.16.0.1",
            "192.168.1.1",
            "169.254.169.254",
            "100.64.0.1",
            "0.0.0.0",
            "255.255.255.255",
            "240.0.0.1",
            "198.18.0.1",
            "192.0.0.8",
            "192.0.2.1",
            "224.0.0.1",
            "::1",
            "::",
            "fc00::1",
            "fd12::1",
            "fe80::1",
            "ff02::1",
            "2001:db8::1",
            "64:ff9b::a00:1",
            "::ffff:127.0.0.1",
        ];
        for ip in inward {
            assert!(!public(ip.parse().unwrap()), "{ip}");
        }
    }

    #[test]
    fn urls_asked() {
        assert_eq!(may_ask("https://pds.example"), Ok(()));
        assert_eq!(may_ask("https://8.8.8.8/xrpc"), Ok(()));
        let refused = |url| may_ask(url).unwrap_err().to_string();
        assert_eq!(
            refused("http://pds.example"),
            "http://pds.example is not on https"
        );
        for url in [
            "https://127.0.0.1:2583",
            "https://[::1]",
            "https://10.0.0.2",
            "https://169.254.169.254/latest/meta-data",
        ] {
            assert_eq!(refused(url), format!("{url} is not at a public address"));
        }
        assert!(refused("not a url").starts_with("not a url: "));
    }

    #[tokio::test]
    async fn names_resolve_to_public_addresses_only() {
        let resolve = |name: &str| PublicOnly.resolve(name.parse().unwrap());
        let found: Vec<SocketAddr> = resolve("8.8.8.8").await.unwrap().collect();
        assert_eq!(found, ["8.8.8.8:0".parse().unwrap()]);
        for name in ["127.0.0.1", "localhost"] {
            let why = resolve(name).await.err().unwrap().to_string();
            assert_eq!(why, format!("{name} has no public address"));
        }
    }

    #[tokio::test]
    async fn a_guarded_client_asks_no_name_that_points_inward() {
        let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
        let port = listener.local_addr().unwrap().port();
        let http = client(reqwest::Client::builder(), false).build().unwrap();
        let err = http
            .get(format!("http://localhost:{port}/"))
            .send()
            .await
            .unwrap_err();
        let chain = format!("{:?}", anyhow::Error::from(err));
        assert!(chain.contains("localhost has no public address"), "{chain}");
        client(reqwest::Client::builder(), true).build().unwrap();
    }
}

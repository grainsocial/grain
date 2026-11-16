//! A reference PDS for the process (`harness/pds.mjs`), accounts on it,
//! and contexts that resolve identities through it. As knotless's
//! `crates/knotless/tests/common`.
#![allow(dead_code)]

use grain::env::{Ctx, Env};
use serde::Deserialize;
use std::io::{BufRead, BufReader};
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::{Mutex, OnceLock};

#[derive(Deserialize, Clone, Debug)]
pub struct Account {
    pub handle: String,
    pub did: String,
    pub password: String,
}

#[derive(Deserialize, Clone, Debug)]
pub struct Net {
    pub pds: String,
    pub plc: String,
    /// Whether the PDS is on the permissioned spaces alpha
    /// (`GRAIN_DEV_ENV`).
    #[serde(default)]
    pub spaces: bool,
    pub client: ClientTls,
    pub accounts: Vec<Account>,
}

/// The hostname the harness resolves to 127.0.0.1 for confidential OAuth
/// clients, and the certificate it trusts for it.
#[derive(Deserialize, Clone, Debug)]
pub struct ClientTls {
    pub host: String,
    pub cert: String,
    pub key: String,
}

static NET: OnceLock<Net> = OnceLock::new();
static CHILD: Mutex<Option<Child>> = Mutex::new(None);

pub fn root() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).join("../..")
}

/// The harness `GRAIN_TEST_NET` names, if it is there and listening: one
/// `just pds` left running, or harness/cov.mjs's.
fn shared() -> Option<Net> {
    let file = std::env::var_os("GRAIN_TEST_NET")?;
    let net: Net = serde_json::from_str(&std::fs::read_to_string(file).ok()?).ok()?;
    let addr = net
        .pds
        .trim_start_matches("http://")
        .replace("localhost", "127.0.0.1");
    std::net::TcpStream::connect(addr).ok()?;
    Some(net)
}

/// The reference PDS: the one `GRAIN_TEST_NET` names, if it is up, else
/// one started for this test binary, which exits when this process does
/// and its stdin closes.
pub fn net() -> &'static Net {
    NET.get_or_init(|| {
        if let Some(net) = shared() {
            return net;
        }
        // The dev-env picks free ports and then binds them, so harnesses
        // starting side by side can collide: try again on a fresh one.
        let mut failures = Vec::new();
        for _ in 0..3 {
            match start() {
                Ok((net, child)) => {
                    *CHILD.lock().unwrap() = Some(child);
                    return net;
                }
                Err(log) => failures.push(log),
            }
        }
        panic!("the harness exited:\n{}", failures.join("\n---\n"));
    })
}

/// One harness, up and reporting, or why it died.
fn start() -> Result<(Net, Child), String> {
    let mut child = Command::new("node")
        .arg(root().join("harness/pds.mjs"))
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .expect("node runs harness/pds.mjs (`just setup` installs its packages)");
    // Kept to explain a harness that dies before it is up.
    let log = std::sync::Arc::new(Mutex::new(String::new()));
    let stderr = BufReader::new(child.stderr.take().unwrap());
    let sink = log.clone();
    let drained = std::thread::spawn(move || {
        for line in stderr.lines().map_while(Result::ok) {
            let mut log = sink.lock().unwrap();
            if log.len() < 1 << 16 {
                log.push_str(&line);
                log.push('\n');
            }
        }
    });
    let mut lines = BufReader::new(child.stdout.take().unwrap()).lines();
    let net: Net = loop {
        let Some(Ok(line)) = lines.next() else {
            let _ = child.wait();
            let _ = drained.join();
            return Err(log.lock().unwrap().clone());
        };
        if line.starts_with("{\"pds\"") {
            break serde_json::from_str(&line).unwrap();
        }
    };
    std::thread::spawn(move || for _ in lines {});
    Ok((net, child))
}

/// Whether the PDS is on the spaces alpha, saying so when it is not: a
/// test of spaces passes trivially without it.
pub fn spaces() -> bool {
    let on = net().spaces;
    if !on {
        eprintln!("skipped: the PDS is not on the spaces alpha (GRAIN_DEV_ENV)");
    }
    on
}

static NEXT: Mutex<usize> = Mutex::new(0);

/// A handle no other test binary, in this run or an earlier one on the
/// same harness, has: a handle's first label is at most 18 characters.
pub fn fresh_handle() -> String {
    let n = {
        let mut next = NEXT.lock().unwrap();
        *next += 1;
        *next
    };
    let nanos = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_nanos();
    let tag = (nanos as u64 ^ (u64::from(std::process::id()) << 32)) as u32;
    format!("g{tag:08x}{n}.test")
}

/// A new account, which no other test uses.
pub async fn account() -> Account {
    let handle = fresh_handle();
    let password = format!("{handle}-password");
    let res: serde_json::Value = reqwest::Client::new()
        .post(format!(
            "{}/xrpc/com.atproto.server.createAccount",
            net().pds
        ))
        .json(&serde_json::json!({
            "email": format!("{handle}@test.com"),
            "handle": handle,
            "password": password,
        }))
        .send()
        .await
        .and_then(|r| r.error_for_status())
        .expect("the harness makes an account")
        .json()
        .await
        .unwrap();
    Account {
        handle,
        did: res["did"].as_str().unwrap().to_string(),
        password,
    }
}

/// A context whose config and cache are under `dir`, resolving handles at
/// the PDS and DIDs at the harness's PLC directory, asking private hosts,
/// with `extra` beside or in their place.
pub fn ctx(dir: &Path, extra: &[(&str, &str)]) -> Ctx {
    let net = net();
    let dir = dir.to_str().unwrap().to_string();
    let extra: Vec<(String, String)> = extra
        .iter()
        .map(|(k, v)| (k.to_string(), v.to_string()))
        .collect();
    Ctx::new(Env::from_vars(|k| {
        if let Some((_, v)) = extra.iter().find(|(key, _)| key == k) {
            return Some(v.clone());
        }
        match k {
            "GRAIN_CONFIG_DIR" => Some(format!("{dir}/config")),
            "GRAIN_CACHE_DIR" => Some(format!("{dir}/cache")),
            "GRAIN_HANDLE_RESOLVER" => Some(net.pds.clone()),
            "GRAIN_PLC_URL" => Some(net.plc.clone()),
            // The reference PDS is on loopback, over http.
            "GRAIN_ALLOW_PRIVATE" => Some("1".into()),
            _ => None,
        }
    }))
}

/// A browser that signs in as `account` and approves, plus `extra` (such
/// as `--reject`): `harness/authorize.mjs`, as `GRAIN_BROWSER` runs it.
pub fn browser(account: &Account, extra: &str) -> String {
    format!(
        "node {} {} {} --ca {} {extra}",
        root().join("harness/authorize.mjs").display(),
        account.handle,
        account.password,
        net().client.cert,
    )
}

/// Runs [`browser`] on `url`, as a user would approve it, and waits for it.
pub async fn approve(account: &Account, extra: &str, url: &str) {
    let command = browser(account, extra);
    let mut words = command.split_whitespace();
    let status = tokio::process::Command::new(words.next().unwrap())
        .args(words)
        .arg(url)
        .status()
        .await
        .unwrap();
    assert!(status.success(), "harness/authorize.mjs failed on {url}");
}

/// An https front for a server on `port`, at the harness's client
/// hostname, until it is dropped.
pub struct TlsProxy {
    pub url: String,
    child: Child,
}

impl Drop for TlsProxy {
    fn drop(&mut self) {
        let _ = self.child.kill();
        let _ = self.child.wait();
    }
}

pub fn tls_proxy(port: u16) -> TlsProxy {
    let tls = &net().client;
    let mut child = Command::new("node")
        .arg(root().join("harness/tls-proxy.mjs"))
        .args([&tls.cert, &tls.key, &port.to_string()])
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .spawn()
        .expect("node runs harness/tls-proxy.mjs");
    let mut line = String::new();
    BufReader::new(child.stdout.take().unwrap())
        .read_line(&mut line)
        .unwrap();
    TlsProxy {
        url: format!("https://{}:{}", tls.host, line.trim()),
        child,
    }
}

//! Backfill: each account the index tracks, its repo read whole, checked,
//! and made the index's. As opensocial's network index
//! (`packages/group-sites/src/networkIndex.ts`).
//!
//! Which accounts: those a collection directory (microcosm's lightrail,
//! then Bluesky's relay) says write one of the signal collections, a grain
//! profile or a group declaration, and those the index queues itself: one
//! newly tracked, one whose host says it is back ([`Index::track`],
//! [`Index::set_host_status`]), one an admin asks for again
//! ([`Backfill::add_repos`], [`Backfill::resync`]).
//!
//! Each repo is read from a mirror of the network (microcosm's hubble) as
//! STAR-lite, zstd'd and streamed, and failing that, from the account's own
//! PDS as a CAR. Either is checked as it is read ([`grain::repo`]): its
//! records make the tree its commit signed, and the account's key signed
//! it. Only the collections the index keeps are kept, and nothing is
//! written until the whole has checked out.
//!
//! What is newer wins: each record is put at the revision the repo was read
//! at, and what the index has from a later one (a write or deletion the
//! stream applied since) stands. What the index has of the account that
//! the repo no longer does is deleted, unless it is newer than the repo.
//! Its handle is the one its document claims, if that names it back: the
//! stream names a handle only when it changes.
//!
//! The queue is the index's `repo` table: a few repos are read at once, at
//! most a few from any one host, and one that fails is tried again later,
//! each time after twice as long, until it is given up on. A host that
//! asks to be left alone a while (429) is.
//!
//! A DID document names whatever PDS it likes, so one is asked only as
//! [`grain::guard`] allows: on https, at a public address, its hostname
//! resolved to public addresses only, and no redirect followed
//! (`GRAIN_ALLOW_PRIVATE=1` lifts this for tests and dev).

use crate::index::{Applied, Index, PutError, records};
use anyhow::{Context, anyhow};
use bytes::Bytes;
use grain::crypto::PublicKey;
use grain::env::Ctx;
use grain::repo::star;
use grain::{drisl, identity, lexicon};
use serde::Deserialize;
use serde_json::Value;
use std::collections::{HashMap, HashSet};
use std::io::Read;
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tokio::sync::{Notify, OwnedSemaphorePermit, Semaphore, mpsc};
use tokio::time::{Instant, timeout};

/// The collections whose records make their author an account grain
/// tracks.
pub const SIGNALS: [&str; 2] = ["social.grain.actor.profile", "fyi.opensocial.declaration"];

/// How long a deletion is remembered at most: no repo read is older.
const DELETIONS_KEPT: Duration = Duration::from_secs(7 * 24 * 3600);

/// What backfill is set to do.
#[derive(Debug, Clone, PartialEq)]
pub struct Config {
    /// Collection directories asked who writes the signal collections, in
    /// turn until one answers.
    pub directories: Vec<String>,
    /// The mirror each repo is read from first, as STAR-lite.
    pub mirror: Option<String>,
    /// Repos read at once.
    pub concurrency: usize,
    /// Requests to any one host at once.
    pub per_host: usize,
    /// Tries at a repo before it is given up on.
    pub attempts: i64,
    /// How long after the first failure it is tried again, doubling after.
    pub retry: Duration,
    /// Hosts whose repos are never read, and their subdomains'.
    pub skip: Vec<String>,
    /// How long a server may take to start answering, or go quiet partway.
    pub idle: Duration,
    /// How long one repo's read may take in all.
    pub total: Duration,
    /// How often the directories are asked again.
    pub rediscover: Duration,
    /// How often the queue is looked at when nothing says to.
    pub poll: Duration,
}

impl Default for Config {
    fn default() -> Config {
        Config {
            directories: vec![
                "https://lightrail.microcosm.blue".into(),
                "https://relay1.us-east.bsky.network".into(),
            ],
            mirror: Some("https://hubble.microcosm.blue".into()),
            concurrency: 5,
            per_host: 2,
            attempts: 8,
            retry: Duration::from_secs(60),
            // Bridgy Fed hosts every bridged fediverse account, each with
            // the whole of its history: their live posts come by the stream.
            skip: vec!["atproto.brid.gy".into()],
            idle: Duration::from_secs(30),
            total: Duration::from_secs(600),
            rediscover: Duration::from_secs(6 * 3600),
            poll: Duration::from_secs(5),
        }
    }
}

impl Config {
    /// As grain-serve's flags give it, `given` reading each as it was
    /// given, empty or not: none unless `--backfill` names the
    /// directories, comma-separated. `--backfill-skip` is comma-separated
    /// too, `--backfill-mirror` the mirror, and `--backfill-concurrency` a
    /// number; each left out is as [`Config::default`] has it, and the
    /// skip list or mirror given empty is none.
    pub fn given(given: impl Fn(&str) -> Option<String>) -> Result<Option<Config>, String> {
        let list = |v: String| -> Vec<String> {
            let items = v.split(',').map(|s| s.trim().trim_end_matches('/'));
            items.filter(|s| !s.is_empty()).map(String::from).collect()
        };
        let get = |name: &str| given(name).filter(|v| !v.is_empty());
        let Some(directories) = get("--backfill").map(list) else {
            return Ok(None);
        };
        let d = Config::default();
        let concurrency = match get("--backfill-concurrency") {
            Some(n) => n
                .parse::<usize>()
                .map_err(|_| "--backfill-concurrency takes a number")?,
            None => d.concurrency,
        };
        Ok(Some(Config {
            directories,
            skip: given("--backfill-skip").map_or(d.skip, list),
            mirror: given("--backfill-mirror").map_or(d.mirror, |m| list(m).into_iter().next()),
            concurrency: concurrency.max(1),
            ..d
        }))
    }
}

/// A repo read and made the index's.
#[derive(Debug, Clone, PartialEq)]
pub struct Done {
    /// The revision it was read at.
    pub rev: String,
    /// Read from the mirror, rather than the account's PDS.
    pub mirrored: bool,
    /// Records written, deleted, and refused as not fitting their lexicon.
    pub written: usize,
    pub deleted: usize,
    pub refused: usize,
}

/// Why a repo was not read: to try again, or not.
#[derive(Debug)]
struct Failure {
    why: String,
    give_up: bool,
}

fn retry(why: impl std::fmt::Display) -> Failure {
    Failure {
        why: format!("{why:#}"),
        give_up: false,
    }
}

fn give_up(why: impl std::fmt::Display) -> Failure {
    Failure {
        why: format!("{why:#}"),
        give_up: true,
    }
}

/// What a repo held of the collections the index keeps, checked.
struct Fetched {
    rev: String,
    /// Each record's URI, CID and value.
    records: Vec<(String, String, Value)>,
    /// The URI of every record of those collections, fitting or not.
    present: HashSet<String>,
}

/// A host's slots, and when it said to wait until.
type Host = (Arc<Semaphore>, Option<Instant>);

/// The hosts asked.
struct Hosts {
    per_host: usize,
    hosts: Mutex<HashMap<String, Host>>,
}

impl Hosts {
    /// A slot at `host`, once it is not waited on.
    async fn enter(&self, host: &str) -> OwnedSemaphorePermit {
        let (slots, until) = {
            let mut hosts = self.hosts.lock().unwrap();
            let at = hosts
                .entry(host.to_string())
                .or_insert_with(|| (Arc::new(Semaphore::new(self.per_host)), None));
            (at.0.clone(), at.1)
        };
        if let Some(until) = until {
            tokio::time::sleep_until(until).await;
        }
        slots
            .acquire_owned()
            .await
            .expect("a host's slots are never closed")
    }

    fn pause(&self, host: &str, wait: Duration) {
        let mut hosts = self.hosts.lock().unwrap();
        if let Some(at) = hosts.get_mut(host) {
            at.1 = Some(Instant::now() + wait);
        }
    }
}

/// The host of `url`.
fn host_of(url: &str) -> String {
    let url = reqwest::Url::parse(url).ok();
    url.and_then(|u| u.host_str().map(String::from))
        .unwrap_or_default()
}

pub struct Backfill {
    index: Arc<Index>,
    ctx: Ctx,
    config: Config,
    /// Downloads take as long as they take, so not the context's client.
    http: reqwest::Client,
    hosts: Hosts,
    wake: Notify,
}

impl Backfill {
    pub fn new(index: Arc<Index>, ctx: Ctx, config: Config) -> Arc<Backfill> {
        let http = reqwest::Client::builder()
            .user_agent(concat!("grain/", env!("CARGO_PKG_VERSION")))
            .connect_timeout(Duration::from_secs(10));
        let http = grain::guard::client(http, ctx.env.allow_private)
            .build()
            .expect("the HTTP client configuration is static");
        let hosts = Hosts {
            per_host: config.per_host.max(1),
            hosts: Mutex::default(),
        };
        Arc::new(Backfill {
            index,
            ctx,
            config,
            http,
            hosts,
            wake: Notify::new(),
        })
    }

    /// Tracks each of `dids`, to be read; how many were not tracked before.
    pub fn add_repos(&self, dids: &[String]) -> rusqlite::Result<usize> {
        let mut added = 0;
        for did in dids.iter().filter(|d| lexicon::valid_did(d)) {
            added += usize::from(self.index.track(did)?);
        }
        self.wake.notify_one();
        Ok(added)
    }

    /// Queues `did` to be read again now, whatever became of it before.
    pub fn resync(&self, did: &str) -> rusqlite::Result<()> {
        self.index.resync(did)?;
        self.wake.notify_one();
        Ok(())
    }

    /// Asks the directories who writes the signal collections, and tracks
    /// each; how many were not tracked before.
    pub async fn discover(&self) -> anyhow::Result<usize> {
        let mut found = 0;
        for collection in SIGNALS {
            let mut last = anyhow!("no collection directory is set");
            let mut dids = None;
            for dir in &self.config.directories {
                match self.who_writes(dir, collection).await {
                    Ok(them) => {
                        dids = Some(them);
                        break;
                    }
                    Err(e) => last = e.context(format!("{dir}: {collection}")),
                }
            }
            found += self.add_repos(&dids.ok_or(last)?)?;
        }
        Ok(found)
    }

    /// Every account `dir` says has records of `collection`.
    async fn who_writes(&self, dir: &str, collection: &str) -> anyhow::Result<Vec<String>> {
        #[derive(Deserialize)]
        struct Page {
            #[serde(default)]
            repos: Vec<Repo>,
            cursor: Option<String>,
        }
        #[derive(Deserialize)]
        struct Repo {
            did: String,
        }
        let (mut dids, mut cursor) = (Vec::new(), None::<String>);
        loop {
            let base = format!("{dir}/xrpc/com.atproto.sync.listReposByCollection");
            let params = [("collection", collection), ("limit", "2000")];
            let from = cursor.iter().map(|c| ("cursor", c.as_str()));
            let url = reqwest::Url::parse_with_params(&base, params.into_iter().chain(from))?;
            let res = timeout(self.config.idle, self.http.get(url).send()).await??;
            let page: Page = res.error_for_status()?.json().await?;
            let more = !page.repos.is_empty();
            dids.extend(page.repos.into_iter().map(|r| r.did));
            match page.cursor {
                Some(next) if more && cursor.as_ref() != Some(&next) => cursor = Some(next),
                _ => return Ok(dids),
            }
        }
    }

    /// Reads `did`'s repo and makes it the index's, keeping in its queue
    /// how that went: a failure is tried again later, or given up on.
    pub async fn backfill(&self, did: &str) -> anyhow::Result<Option<Done>> {
        match self.read_and_apply(did).await {
            Ok(done) => Ok(done),
            Err(failure) => {
                let tries = self.index.queued(did)?.map_or(0, |q| q.retry_count) + 1;
                let wait = self.config.retry.as_secs() << (tries - 1).min(16);
                let next = grain::keys::now_secs() as i64 + wait.min(6 * 3600) as i64;
                let again = (!failure.give_up && tries < self.config.attempts).then_some(next);
                self.index.backfill_failed(did, &failure.why, again)?;
                Err(anyhow!(failure.why))
            }
        }
    }

    async fn read_and_apply(&self, did: &str) -> Result<Option<Done>, Failure> {
        let doc = identity::document(&self.ctx, did).await.map_err(retry)?;
        let key = identity::signing_key(&doc).map_err(give_up)?;
        let pds = identity::pds(&self.ctx, did, &doc).map_err(give_up)?;
        let host = host_of(&pds);
        if self
            .config
            .skip
            .iter()
            .any(|s| host == *s || host.ends_with(&format!(".{s}")))
        {
            let why = format!("its host, {host}, is skipped");
            self.index.backfill_skipped(did, &why).map_err(retry)?;
            return Ok(None);
        }
        let mirrored = match &self.config.mirror {
            Some(mirror) => self.fetch(mirror, did, &key, true).await,
            None => Err(retry("no mirror")),
        };
        let (read, mirrored) = match mirrored {
            Ok(fetched) => (fetched, true),
            Err(why) => {
                tracing::debug!(%did, why = why.why, "backfill: reading from its PDS");
                (self.fetch(&pds, did, &key, false).await?, false)
            }
        };
        let index = self.index.clone();
        let owned = did.to_string();
        let apply = move || apply(&index, &owned, read, mirrored);
        let done = tokio::task::spawn_blocking(apply).await.map_err(retry)??;
        // The stream names an account's handle only when it changes, so one
        // tracked from its first write would otherwise have none: it is the
        // handle its document claims, if that names it back.
        if let Some(handle) = identity::handle(&self.ctx, did).await {
            self.index.set_handle(did, &handle).map_err(retry)?;
        }
        Ok(Some(done))
    }

    /// `did`'s repo from `base`'s `getRepo`, read as it streams and checked
    /// against `key`: as STAR-lite if `lite` and it has it.
    async fn fetch(
        &self,
        base: &str,
        did: &str,
        key: &PublicKey,
        lite: bool,
    ) -> Result<Fetched, Failure> {
        let host = host_of(base);
        let _slot = self.hosts.enter(&host).await;
        let url = format!("{base}/xrpc/com.atproto.sync.getRepo?did={did}");
        let mut req = self.http.get(url);
        if lite {
            let accept = format!("{}, application/vnd.ipld.car;q=0.5", star::MEDIA_TYPE);
            req = req
                .header("accept", accept)
                .header("accept-encoding", "zstd");
        }
        let deadline = Instant::now() + self.config.total;
        let sent = timeout(self.config.idle, req.send()).await;
        let res = sent
            .map_err(|_| retry(format!("{host} did not answer")))?
            .map_err(retry)?;
        let status = res.status();
        if status == reqwest::StatusCode::TOO_MANY_REQUESTS {
            let after = res
                .headers()
                .get("retry-after")
                .and_then(|v| v.to_str().ok()?.parse().ok());
            self.hosts
                .pause(&host, Duration::from_secs(after.unwrap_or(60).min(3600)));
            return Err(retry(format!("{host} asked to be left alone a while")));
        }
        if !status.is_success() {
            let why = format!("{host} answered {status}");
            return Err(if status.is_client_error() {
                give_up(why)
            } else {
                retry(why)
            });
        }
        let (tx, rx) = mpsc::channel(16);
        let pump = pump(res, tx, self.config.idle);
        let (did, key) = (did.to_string(), key.clone());
        let check = move || {
            check(
                Chunks {
                    rx,
                    at: Bytes::new(),
                },
                &did,
                &key,
            )
        };
        let check = tokio::task::spawn_blocking(check);
        let both = tokio::time::timeout_at(deadline, async { tokio::join!(pump, check).1 });
        let checked = both
            .await
            .map_err(|_| retry(format!("{host} took too long")))?;
        checked.map_err(retry)?.map_err(retry)
    }

    /// Reads every repo the queue holds, a few at a time, until the task is
    /// dropped, and asks the directories again now and then.
    pub async fn run(self: Arc<Self>) {
        let mut discovered: Option<Instant> = None;
        let mut running = tokio::task::JoinSet::new();
        let mut busy = HashSet::new();
        loop {
            if discovered.is_none_or(|at| at.elapsed() >= self.config.rediscover) {
                discovered = Some(Instant::now());
                let me = self.clone();
                tokio::spawn(async move { me.tend().await });
            }
            let want = self.config.concurrency.saturating_sub(running.len());
            let now = grain::keys::now_secs() as i64;
            let pending = self.index.pending(now, want + busy.len());
            let pending = pending.unwrap_or_default().into_iter();
            let fresh: Vec<String> = pending.filter(|d| !busy.contains(d)).take(want).collect();
            for did in fresh {
                busy.insert(did.clone());
                let me = self.clone();
                running.spawn(async move {
                    match me.backfill(&did).await {
                        Ok(done) => tracing::info!(%did, ?done, "backfill: read"),
                        Err(e) => tracing::info!(%did, error = %e, "backfill: failed"),
                    }
                    did
                });
            }
            tokio::select! {
                Some(Ok(did)) = running.join_next(), if !running.is_empty() => {
                    busy.remove(&did);
                }
                _ = self.wake.notified() => {}
                _ = tokio::time::sleep(self.config.poll) => {}
            }
        }
    }

    /// What is done now and then: the directories asked, and deletions no
    /// repo read now is old enough to need forgotten.
    async fn tend(&self) {
        match self.discover().await {
            Ok(found) => tracing::info!(found, "backfill: asked who writes grain"),
            Err(e) => tracing::warn!(error = %format!("{e:#}"), "backfill: no directory answered"),
        }
        let before = grain::keys::now_micros().saturating_sub(DELETIONS_KEPT.as_micros() as u64);
        let forgotten = self
            .index
            .forget_deletions(&grain::keys::tid_from(before, 0));
        tracing::info!(?forgotten, "backfill: old deletions forgotten");
    }
}

/// Sends `res`'s body to `tx` a chunk at a time, failing it where the
/// server goes quiet for `idle`, until it ends or no one reads it.
async fn pump(
    mut res: reqwest::Response,
    tx: mpsc::Sender<std::io::Result<Bytes>>,
    idle: Duration,
) {
    loop {
        let next = match timeout(idle, res.chunk()).await {
            Ok(Ok(Some(chunk))) => Ok(chunk),
            Ok(Ok(None)) => return,
            Ok(Err(e)) => Err(std::io::Error::other(e)),
            Err(_) => Err(std::io::Error::other("the server went quiet")),
        };
        let failed = next.is_err();
        if tx.send(next).await.is_err() || failed {
            return;
        }
    }
}

/// A body as [`pump`] sends it, to read on a blocking thread.
struct Chunks {
    rx: mpsc::Receiver<std::io::Result<Bytes>>,
    at: Bytes,
}

impl Read for Chunks {
    fn read(&mut self, buf: &mut [u8]) -> std::io::Result<usize> {
        while self.at.is_empty() {
            match self.rx.blocking_recv() {
                Some(chunk) => self.at = chunk?,
                None => return Ok(0),
            }
        }
        let n = buf.len().min(self.at.len());
        buf[..n].copy_from_slice(&self.at.split_to(n));
        Ok(n)
    }
}

/// `did`'s repo from `body`, checked against `key`: its records of the
/// collections the index keeps, once the whole has checked out.
fn check(body: impl Read + Send + 'static, did: &str, key: &PublicKey) -> anyhow::Result<Fetched> {
    let spill = Box::new(tempfile::tempfile().context("a file to spill a CAR to")?);
    let mut archive = grain::repo::open(body, did, key, spill)?;
    let (mut records, mut present) = (Vec::new(), HashSet::new());
    while let Some((path, bytes)) = archive.record()? {
        let collection = path.split_once('/').map_or("", |(c, _)| c);
        if records::table_of(collection).is_none() {
            continue;
        }
        let uri = format!("at://{did}/{path}");
        present.insert(uri.clone());
        if let Some(record) = drisl::record(&bytes) {
            records.push((uri, drisl::cid_text(&drisl::cid(&bytes)), record));
        }
    }
    let commit = archive.finish()?;
    Ok(Fetched {
        rev: commit.rev,
        records,
        present,
    })
}

/// `read`, `did`'s repo, made the index's.
fn apply(index: &Index, did: &str, read: Fetched, mirrored: bool) -> Result<Done, Failure> {
    let mut done = Done {
        rev: read.rev,
        mirrored,
        written: 0,
        deleted: 0,
        refused: 0,
    };
    for (uri, cid, record) in &read.records {
        let applied = match index.put_rev(uri, cid, record, &done.rev) {
            Err(PutError::Refused(why)) => {
                tracing::debug!(%uri, %why, "backfill: skipped a record");
                done.refused += 1;
                continue;
            }
            other => other.map_err(retry)?,
        };
        done.written += usize::from(matches!(applied, Applied::Created | Applied::Updated));
    }
    done.deleted = index
        .backfilled(did, &done.rev, &read.present)
        .map_err(retry)?;
    Ok(done)
}

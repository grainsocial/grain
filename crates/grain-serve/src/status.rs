//! `/healthz` and `/_status`, as knotless-serve answers them.
//!
//! `/healthz` is the liveness check a rollout and docker's healthcheck
//! wait on: it answers `ok` once the server listens, whatever is upstream.
//!
//! `/_status` is whether this server is doing its job, for a monitor off
//! the host to poll. Every page can answer 200 while the feed that keeps
//! the index current is dead, so this checks:
//!
//! - each feed followed: connected, and an event lately;
//! - the index answers a read;
//! - the disk the index is on has room: under 15% free is told of, under
//!   5% fails, as a full disk fails every write.
//!
//! 200 when all of that holds, else 503, and JSON saying which part failed,
//! with the version and commit running.

use crate::App;
use axum::Json;
use axum::extract::State;
use axum::http::{StatusCode, header};
use axum::response::{IntoResponse, Response};
use serde::Serialize;
use std::collections::BTreeMap;
use std::path::Path;
use std::sync::{Arc, LazyLock, Mutex};
use std::time::{Duration, Instant};

/// How long Jetstream may stay silent. grain's subscription brings every
/// account's identity and account events and Bluesky's posts besides, so
/// two minutes without one is a feed gone dead; it is also about how long
/// a follower waits on a silent connection, through a ping, before it
/// connects again ([`grain::jetstream::Timing`]).
pub const JETSTREAM_STALE: Duration = Duration::from_secs(120);

/// The share of the disk free below which it is low: told of among the
/// problems, still 200.
pub const DISK_LOW: f64 = 0.15;

/// The share free below which the disk counts as full and `/_status`
/// fails.
pub const DISK_FULL: f64 = 0.05;

/// When the server started serving ([`crate::serve`]).
pub static STARTED: LazyLock<Instant> = LazyLock::new(Instant::now);

/// The whole answer.
#[derive(Serialize, Debug, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Status {
    /// Whether all of it holds: the answer is 200 when it does, else 503.
    pub ok: bool,
    /// What does not hold, a line each.
    pub problems: Vec<String>,
    /// The version running, and the commit it was built from when the
    /// image says (`GRAIN_COMMIT`, Dockerfile).
    pub version: &'static str,
    pub commit: Option<&'static str>,
    pub uptime_seconds: u64,
    /// The feeds the index follows.
    pub feeds: Vec<Feed>,
    /// The index, when the server keeps one.
    pub index: Option<Check>,
    /// The disk the index is on, when there is one.
    pub disk: Option<Disk>,
}

/// A feed followed.
#[derive(Serialize, Debug, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Feed {
    pub name: String,
    pub url: String,
    /// Whether it is bringing events: connected, and one came lately.
    pub ok: bool,
    pub connected: bool,
    /// Seconds since its last event, or since it was first followed if
    /// none has come.
    pub silent_seconds: u64,
    pub stale_after_seconds: u64,
    /// Events it has brought since the server started.
    pub events: u64,
    /// The sequence number of the last, which moves while it is alive.
    pub seq: Option<i64>,
}

/// A part that works or does not.
#[derive(Serialize, Debug, Clone, PartialEq)]
pub struct Check {
    pub ok: bool,
    pub error: Option<String>,
}

/// The disk the index is on.
#[derive(Serialize, Debug, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Disk {
    pub path: String,
    /// `ok`, `low`, `full`, or `unknown` when it could not be asked.
    pub state: String,
    pub ok: bool,
    pub free_bytes: u64,
    pub total_bytes: u64,
    pub error: Option<String>,
}

/// How a disk with `free` of its `total` bytes is: `ok`, `low` or `full`.
pub fn disk_state(free: u64, total: u64) -> &'static str {
    let share = free as f64 / total.max(1) as f64;
    match share {
        s if s < DISK_FULL => "full",
        s if s < DISK_LOW => "low",
        _ => "ok",
    }
}

/// The disk `path` is on, asked of its nearest directory that exists.
pub fn disk(path: &Path) -> Disk {
    let at = path.ancestors().find(|p| p.exists()).unwrap_or(path);
    let mut disk = Disk {
        path: path.display().to_string(),
        state: "unknown".into(),
        ok: false,
        free_bytes: 0,
        total_bytes: 0,
        error: None,
    };
    match rustix::fs::statvfs(at) {
        Ok(space) => {
            disk.free_bytes = space.f_bavail * space.f_frsize;
            disk.total_bytes = space.f_blocks * space.f_frsize;
            let state = disk_state(disk.free_bytes, disk.total_bytes);
            (disk.state, disk.ok) = (state.into(), state != "full");
        }
        Err(err) => disk.error = Some(format!("{}: {err}", at.display())),
    }
    disk
}

/// What `/_status` says of a disk that is not `ok`, among its problems.
fn disk_problem(disk: &Disk) -> Option<String> {
    let free = 100 * disk.free_bytes / disk.total_bytes.max(1);
    match (disk.state.as_str(), &disk.error) {
        ("ok", _) => None,
        (_, Some(err)) => Some(format!("disk: {err}")),
        (state, None) => Some(format!("disk {state}: {free}% free")),
    }
}

/// The feeds an index follows, as each follower tells of it.
#[derive(Default)]
pub struct Feeds(Mutex<BTreeMap<String, Followed>>);

/// A feed as its follower last told of it.
struct Followed {
    url: String,
    connected: bool,
    /// When it was first followed, which a feed that never brought an
    /// event is silent since.
    since: Instant,
    last: Option<Instant>,
    events: u64,
    seq: Option<i64>,
}

impl Feeds {
    /// That the feed `name` is followed from `url`, not yet connected.
    pub fn follows(&self, name: &str, url: &str) {
        let followed = Followed {
            url: url.to_string(),
            connected: false,
            since: Instant::now(),
            last: None,
            events: 0,
            seq: None,
        };
        self.0.lock().unwrap().insert(name.to_string(), followed);
    }

    /// That the feed `name` connected, or dropped.
    pub fn connected(&self, name: &str, connected: bool) {
        let mut feeds = self.0.lock().unwrap();
        feeds
            .get_mut(name)
            .into_iter()
            .for_each(|f| f.connected = connected);
    }

    /// That the feed `name` brought an event, numbered `seq`.
    pub fn heard(&self, name: &str, seq: Option<i64>) {
        let mut feeds = self.0.lock().unwrap();
        feeds.get_mut(name).into_iter().for_each(|feed| {
            feed.last = Some(Instant::now());
            feed.events += 1;
            feed.seq = seq.or(feed.seq);
        });
    }

    /// The feeds, as `/_status` tells of them, each dead once silent past
    /// `stale`.
    pub fn list(&self, stale: Duration) -> Vec<Feed> {
        let feeds = self.0.lock().unwrap();
        let feed = |(name, f): (&String, &Followed)| {
            let silent = f.last.unwrap_or(f.since).elapsed();
            Feed {
                name: name.clone(),
                url: f.url.clone(),
                ok: f.connected && silent <= stale,
                connected: f.connected,
                silent_seconds: silent.as_secs(),
                stale_after_seconds: stale.as_secs(),
                events: f.events,
                seq: f.seq,
            }
        };
        feeds.iter().map(feed).collect()
    }
}

impl App {
    /// How this server is, its feeds counted dead once silent past `stale`.
    pub fn status(&self, stale: Duration) -> Status {
        let index = self.index.as_deref();
        let feeds = index.map(|i| i.feeds.list(stale)).unwrap_or_default();
        let mut problems = Vec::new();
        for f in feeds.iter().filter(|f| !f.ok) {
            let why = match f.connected {
                true => format!("no event for {}s", f.silent_seconds),
                false => "not connected".to_string(),
            };
            problems.push(format!("{}: {why}", f.name));
        }
        let fed = feeds.is_empty() || feeds.iter().any(|f| f.ok);
        let checked = index.map(|i| match i.answers() {
            Ok(()) => Check {
                ok: true,
                error: None,
            },
            Err(err) => Check {
                ok: false,
                error: Some(format!("{err:#}")),
            },
        });
        let failed = checked.as_ref().and_then(|c| c.error.as_ref());
        problems.extend(failed.map(|e| format!("index: {e}")));
        let disk = index.and_then(|i| i.path()).map(disk);
        problems.extend(disk.as_ref().and_then(disk_problem));
        Status {
            ok: fed && checked.as_ref().is_none_or(|c| c.ok) && disk.as_ref().is_none_or(|d| d.ok),
            problems,
            version: env!("CARGO_PKG_VERSION"),
            commit: option_env!("GRAIN_COMMIT"),
            uptime_seconds: STARTED.elapsed().as_secs(),
            feeds,
            index: checked,
            disk,
        }
    }
}

/// `GET /healthz`.
pub async fn healthz() -> &'static str {
    "ok"
}

/// `GET /_status`.
pub async fn status(State(app): State<Arc<App>>) -> Response {
    let status = app.status(JETSTREAM_STALE);
    let code = match status.ok {
        true => StatusCode::OK,
        false => StatusCode::SERVICE_UNAVAILABLE,
    };
    (code, [(header::CACHE_CONTROL, "no-store")], Json(status)).into_response()
}

#[cfg(test)]
mod tests {
    use super::*;
    use grain::env::{Ctx, Env};

    fn app(index: Option<crate::index::Index>) -> App {
        let mut app = App::bare(Ctx::new(Env::from_vars(|_| None)));
        app.index = index.map(Arc::new);
        app
    }

    #[test]
    fn feeds() {
        // Nothing kept, nothing followed: nothing to be stale.
        let s = app(None).status(JETSTREAM_STALE);
        assert!(s.ok, "{s:?}");
        assert_eq!((s.feeds.len(), s.index, s.disk), (0, None, None));
        assert_eq!(s.version, env!("CARGO_PKG_VERSION"));

        let alone = app(Some(crate::index::Index::memory().unwrap()));
        let feeds = &alone.index.as_ref().unwrap().feeds;
        // Followed but never connected: not ok.
        feeds.follows("jetstream", "wss://jetstream.test");
        feeds.connected("jetstream", false);
        let s = alone.status(JETSTREAM_STALE);
        assert!(!s.ok);
        assert_eq!(s.problems, ["jetstream: not connected"]);
        assert_eq!(
            s.index,
            Some(Check {
                ok: true,
                error: None
            })
        );
        assert_eq!(s.disk, None, "an index in memory is on no disk");

        // Connected and bringing events: ok.
        feeds.connected("jetstream", true);
        feeds.heard("jetstream", Some(7));
        feeds.heard("jetstream", None);
        feeds.heard("elsewhere", Some(1));
        let s = alone.status(JETSTREAM_STALE);
        assert!(s.ok, "{s:?}");
        let f = &s.feeds[0];
        assert_eq!((f.events, f.seq, f.connected), (2, Some(7), true));
        assert_eq!(f.url, "wss://jetstream.test");

        // Connected, but silent past the threshold: stale.
        std::thread::sleep(Duration::from_millis(5));
        let s = alone.status(Duration::from_millis(1));
        assert!(!s.ok);
        assert_eq!(s.problems, ["jetstream: no event for 0s"]);
    }

    #[test]
    fn disk_thresholds() {
        assert_eq!(disk_state(100, 100), "ok");
        assert_eq!(disk_state(15, 100), "ok");
        assert_eq!(disk_state(14, 100), "low");
        assert_eq!(disk_state(5, 100), "low");
        assert_eq!(disk_state(4, 100), "full");
        assert_eq!(disk_state(0, 0), "full");
        let at = |state: &str, free: u64, error: Option<&str>| Disk {
            path: "/data".into(),
            state: state.into(),
            ok: state != "full",
            free_bytes: free,
            total_bytes: 100,
            error: error.map(String::from),
        };
        assert_eq!(disk_problem(&at("ok", 50, None)), None);
        assert_eq!(
            disk_problem(&at("low", 12, None)).unwrap(),
            "disk low: 12% free"
        );
        assert_eq!(
            disk_problem(&at("full", 3, None)).unwrap(),
            "disk full: 3% free"
        );
        assert_eq!(
            disk_problem(&at("unknown", 0, Some("gone"))).unwrap(),
            "disk: gone"
        );
        // A directory that exists is asked of its own disk; a path under
        // none that does, of the nearest that does.
        let dir = tempfile::tempdir().unwrap();
        let here = disk(&dir.path().join("not/yet/index.db"));
        assert!(here.total_bytes > 0 && here.error.is_none(), "{here:?}");
        let nowhere = disk(Path::new("relative-and-missing"));
        assert_eq!(nowhere.state, "unknown");
        assert!(nowhere.error.is_some());
    }

    #[tokio::test]
    async fn answers() {
        assert_eq!(healthz().await, "ok");
        let dir = tempfile::tempdir().unwrap();
        let index = crate::index::Index::open(&dir.path().join("index.db")).unwrap();
        let kept = Arc::new(app(Some(index)));
        let res = status(State(kept.clone())).await;
        assert_eq!(res.status(), StatusCode::OK);
        assert_eq!(res.headers()[header::CACHE_CONTROL], "no-store");
        let body = axum::body::to_bytes(res.into_body(), usize::MAX).await;
        let body: serde_json::Value = serde_json::from_slice(&body.unwrap()).unwrap();
        assert_eq!(
            body["disk"]["path"],
            dir.path().join("index.db").display().to_string()
        );
        assert_eq!(body["index"]["ok"], true);
        kept.index
            .as_ref()
            .unwrap()
            .feeds
            .follows("jetstream", "wss://j");
        let res = status(State(kept)).await;
        assert_eq!(res.status(), StatusCode::SERVICE_UNAVAILABLE);
    }
}

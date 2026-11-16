//! What grain-serve does, as JSON lines on stderr, one an event, and
//! counts of it: for `/metrics`, and for a summary each minute.
//!
//! Field names follow OpenTelemetry's semantic conventions where they
//! have one (`http.route`, `server.address`, `http.response.status_code`),
//! so the lines can be shipped to a backend as they are. Each line made
//! while a request is served carries its `trace_id`, which the calls it
//! makes hand on as a W3C `traceparent`.
//!
//! Nothing here logs a URL's query, a header, a cookie, a token or a body.

use rand_core::RngCore;
use reqwest::header::{HeaderName, HeaderValue};
use std::collections::BTreeMap;
use std::fmt::Write as _;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{LazyLock, Mutex, OnceLock};
use std::time::{Duration, Instant, SystemTime};
pub use tracing::Level;
use tracing_subscriber::layer::SubscriberExt;
use tracing_subscriber::util::SubscriberInitExt;
use tracing_subscriber::{EnvFilter, Registry, reload};

/// What an event says beyond its message, each only if set.
#[derive(Default)]
pub struct Fields<'a> {
    pub version: Option<&'a str>,
    pub commit: Option<&'a str>,
    pub did: Option<&'a str>,
    pub host: Option<&'a str>,
    pub source: Option<&'a str>,
    pub reason: Option<&'a str>,
    pub error: Option<String>,
    /// An SQL statement, as written, its parameters unbound.
    pub query: Option<&'a str>,
    pub count: Option<u64>,
    pub failed: Option<u64>,
    pub slow: Option<u64>,
    pub mean_ms: Option<u64>,
    pub max_ms: Option<u64>,
    pub duration_ms: Option<u64>,
}

macro_rules! event {
    ($level:expr, $message:expr, $f:expr, $trace:expr) => {
        tracing::event!(
            target: "grain",
            $level,
            version = $f.version,
            commit = $f.commit,
            did = $f.did,
            server.address = $f.host,
            source = $f.source,
            reason = $f.reason,
            error = $f.error.as_deref(),
            db.query.text = $f.query,
            count = $f.count,
            failed = $f.failed,
            slow = $f.slow,
            mean_ms = $f.mean_ms,
            max_ms = $f.max_ms,
            duration_ms = $f.duration_ms,
            trace_id = $trace,
            "{}",
            $message
        )
    };
}

/// Logs `message` at `level`, with `f`'s fields and the trace it is in.
pub fn note(level: Level, message: &str, f: &Fields) {
    let trace = trace_id();
    let trace = trace.as_deref();
    match level {
        Level::ERROR => event!(Level::ERROR, message, f, trace),
        Level::WARN => event!(Level::WARN, message, f, trace),
        Level::INFO => event!(Level::INFO, message, f, trace),
        _ => event!(Level::DEBUG, message, f, trace),
    }
}

/// Milliseconds, as a log line gives a duration.
pub fn millis(d: Duration) -> u64 {
    u64::try_from(d.as_millis()).unwrap_or(u64::MAX)
}

/// The slowest a request or a call is before it is logged at warn:
/// `GRAIN_SLOW_MS`, else a second.
static SLOW_MS: AtomicU64 = AtomicU64::new(1000);

/// Whether what took `took` was slow: past `GRAIN_SLOW_MS`.
pub fn slow(took: Duration) -> bool {
    millis(took) >= SLOW_MS.load(Ordering::Relaxed)
}

type Reload = reload::Handle<EnvFilter, Registry>;

static RELOAD: OnceLock<Reload> = OnceLock::new();

static BUILD: OnceLock<(String, String)> = OnceLock::new();

static STARTED: LazyLock<SystemTime> = LazyLock::new(SystemTime::now);

/// Logs from here on as JSON lines on stderr, at the level `RUST_LOG` sets
/// (info, unset), and says so: what is starting, of which version and
/// commit. Panics are logged too, with where they happened.
pub fn init(name: &str, version: &str, commit: Option<&str>) {
    let filter = EnvFilter::try_from_default_env().unwrap_or(EnvFilter::new("info"));
    let (filter, handle) = reload::Layer::new(filter);
    let _ = tracing_subscriber::registry()
        .with(filter)
        .with(layer())
        .try_init();
    let _ = RELOAD.set(handle);
    let given = std::env::var("GRAIN_SLOW_MS").ok();
    SLOW_MS.store(slow_ms(given.as_deref()), Ordering::Relaxed);
    let commit = commit.unwrap_or("unknown");
    let _ = BUILD.set((version.to_string(), commit.to_string()));
    LazyLock::force(&STARTED);
    std::panic::set_hook(Box::new(panicked));
    let f = Fields {
        version: Some(version),
        commit: Some(commit),
        ..Fields::default()
    };
    note(Level::INFO, &format!("{name} starting"), &f);
}

/// The JSON lines' layer: the event's fields at the top level, no spans.
fn layer<S>() -> impl tracing_subscriber::Layer<S>
where
    S: tracing::Subscriber + for<'a> tracing_subscriber::registry::LookupSpan<'a>,
{
    tracing_subscriber::fmt::layer()
        .json()
        .flatten_event(true)
        .with_current_span(false)
        .with_span_list(false)
        .with_writer(std::io::stderr)
}

fn slow_ms(given: Option<&str>) -> u64 {
    given.and_then(|v| v.parse().ok()).unwrap_or(1000)
}

fn panicked(info: &std::panic::PanicHookInfo) {
    let f = Fields {
        error: Some(info.to_string()),
        ..Fields::default()
    };
    note(Level::ERROR, "panicked", &f);
}

/// Logs from now on at the levels `directives` sets, as `RUST_LOG` takes
/// them: `debug`, or `info,grain::outgoing=debug`.
pub fn set_filter(directives: &str) -> Result<(), String> {
    let filter = EnvFilter::try_new(directives).map_err(|e| e.to_string())?;
    let handle = RELOAD.get().ok_or("logging is not set up")?;
    let _ = handle.reload(filter);
    Ok(())
}

tokio::task_local! {
    static TRACE: String;
}

/// The trace the task is in: the request being served.
pub fn trace_id() -> Option<String> {
    TRACE.try_with(String::clone).ok()
}

/// Runs `f` in the trace `id`.
pub async fn traced<F: Future>(id: String, f: F) -> F::Output {
    TRACE.scope(id, f).await
}

/// The trace a `traceparent` header names, if it is a valid one; else a
/// new trace.
pub fn trace_from(traceparent: Option<&str>) -> String {
    let given = traceparent.and_then(trace_of);
    given.unwrap_or_else(|| hex(16))
}

fn trace_of(traceparent: &str) -> Option<String> {
    let id = traceparent.split('-').nth(1)?;
    let hex = id.len() == 32 && id.bytes().all(|b| b.is_ascii_hexdigit());
    (hex && id.bytes().any(|b| b != b'0')).then(|| id.to_ascii_lowercase())
}

fn hex(bytes: usize) -> String {
    let mut buf = vec![0u8; bytes];
    rand_core::OsRng.fill_bytes(&mut buf);
    buf.iter().fold(String::new(), |mut s, b| {
        let _ = write!(s, "{b:02x}");
        s
    })
}

/// A path as a log line gives it: no query, and not too long.
pub fn short(path: &str) -> String {
    path.chars().take(120).collect()
}

/// Sends `req`, the `resend`th time it is sent again, and logs it: at
/// debug, or warn if it failed or was slow, by host and path, never its
/// query or headers. In a trace, it hands the trace on as `traceparent`.
pub async fn send(req: reqwest::RequestBuilder, resend: u32) -> reqwest::Result<reqwest::Response> {
    let (client, req) = req.build_split();
    let mut req = req?;
    if let Some(id) = trace_id() {
        let parent = format!("00-{id}-{}-01", hex(8));
        let parent = HeaderValue::try_from(parent).expect("hex is a header value");
        let name = HeaderName::from_static("traceparent");
        req.headers_mut().insert(name, parent);
    }
    let call = Call {
        host: req.url().host_str().unwrap_or_default().to_string(),
        method: req.method().to_string(),
        path: short(req.url().path()),
        resend,
    };
    let started = Instant::now();
    let res = client.execute(req).await;
    let status = res.as_ref().ok().map(|r| r.status().as_u16());
    let error = res.as_ref().err().map(error_type);
    call.done(status, error.as_deref(), started.elapsed());
    res
}

struct Call {
    host: String,
    method: String,
    path: String,
    resend: u32,
}

impl Call {
    fn done(&self, status: Option<u16>, error: Option<&str>, took: Duration) {
        let ms = millis(took);
        let server_error = status.filter(|s| *s >= 500).map(|s| s.to_string());
        let error = error.or(server_error.as_deref());
        let slow = slow(took);
        let outcome = status.map_or(error.unwrap_or_default().to_string(), |s| s.to_string());
        let host = record(|s| s.call(&self.host, &outcome, ms, error.is_some(), slow));
        let rpc = self.path.strip_prefix("/xrpc/");
        let resent = (self.resend > 0).then_some(self.resend);
        let trace = trace_id();
        macro_rules! line {
            ($level:expr) => {
                tracing::event!(
                    target: "grain::outgoing",
                    $level,
                    server.address = host.as_str(),
                    http.request.method = self.method.as_str(),
                    url.path = self.path.as_str(),
                    rpc.method = rpc,
                    http.response.status_code = status,
                    error.type = error,
                    http.request.resend_count = resent,
                    duration_ms = ms,
                    trace_id = trace.as_deref(),
                    "outgoing"
                )
            };
        }
        match error.is_some() || slow {
            true => line!(Level::WARN),
            false => line!(Level::DEBUG),
        }
    }
}

/// What kind of failure `err` is, and why, without the URL it names.
fn error_type(err: &reqwest::Error) -> String {
    let kind = match () {
        _ if err.is_timeout() => "timeout",
        _ if err.is_connect() => "connect",
        _ if err.is_body() || err.is_decode() => "body",
        _ => "request",
    };
    let mut said = kind.to_string();
    let mut source = std::error::Error::source(err);
    while let Some(cause) = source {
        let _ = write!(said, ": {cause}");
        source = cause.source();
    }
    said
}

/// Logs, at warn, the SQL statement `sql`, which took `took`: one that
/// made the request it ran in slow, in its trace. It is as written, its
/// parameters unbound, so nothing it was given is logged; its whitespace
/// is closed up, and it is cut at 500 characters.
pub fn sql(sql: &str, took: Duration) {
    let text: String = sql
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .chars()
        .take(500)
        .collect();
    let f = Fields {
        query: Some(&text),
        duration_ms: Some(millis(took)),
        ..Fields::default()
    };
    note(Level::WARN, "sql", &f);
}

/// The bounds of the duration histograms' buckets, in milliseconds.
const BOUNDS_MS: [u64; 11] = [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000];

/// How many hosts calls are counted by; the rest are `other`.
const HOSTS: usize = 200;

#[derive(Default, Clone)]
struct Timings {
    count: u64,
    failed: u64,
    slow: u64,
    sum_ms: u64,
    max_ms: u64,
    buckets: [u64; BOUNDS_MS.len()],
}

impl Timings {
    fn add(&mut self, ms: u64, failed: bool, slow: bool) {
        self.count += 1;
        self.failed += u64::from(failed);
        self.slow += u64::from(slow);
        self.sum_ms += ms;
        self.max_ms = self.max_ms.max(ms);
        for (bucket, bound) in self.buckets.iter_mut().zip(BOUNDS_MS) {
            *bucket += u64::from(ms <= bound);
        }
    }

    fn merge(&mut self, other: &Timings) {
        self.count += other.count;
        self.failed += other.failed;
        self.slow += other.slow;
        self.sum_ms += other.sum_ms;
        self.max_ms = self.max_ms.max(other.max_ms);
        for (bucket, more) in self.buckets.iter_mut().zip(other.buckets) {
            *bucket += more;
        }
    }

    fn fields(&self) -> Fields<'static> {
        Fields {
            count: Some(self.count),
            failed: Some(self.failed),
            slow: Some(self.slow),
            mean_ms: Some(self.sum_ms / self.count.max(1)),
            max_ms: Some(self.max_ms),
            ..Fields::default()
        }
    }
}

#[derive(Default)]
struct Stats {
    /// Requests served, by route, method and status.
    served: BTreeMap<(String, String, u16), Timings>,
    /// Calls made, by host and status or failure.
    called: BTreeMap<(String, String), Timings>,
}

impl Stats {
    /// Counts a call to `host`, or to `other` past [`HOSTS`] of them: the
    /// host it was counted under.
    fn call(&mut self, host: &str, outcome: &str, ms: u64, failed: bool, slow: bool) -> String {
        let known = self.called.keys().any(|(h, _)| h == host);
        let hosts = self
            .called
            .keys()
            .map(|(h, _)| h)
            .collect::<std::collections::BTreeSet<_>>();
        let host = match known || hosts.len() < HOSTS {
            true => host.to_string(),
            false => "other".to_string(),
        };
        let key = (host.clone(), outcome.to_string());
        self.called.entry(key).or_default().add(ms, failed, slow);
        host
    }
}

/// Since the start, for `/metrics`, and since the last summary.
static TOTAL: LazyLock<Mutex<Stats>> = LazyLock::new(Mutex::default);
static WINDOW: LazyLock<Mutex<Stats>> = LazyLock::new(Mutex::default);

/// Counts into both, returning what the count since the start did.
fn record<T>(count: impl Fn(&mut Stats) -> T) -> T {
    count(&mut WINDOW.lock().unwrap());
    count(&mut TOTAL.lock().unwrap())
}

/// A request served, as the line logged for it says.
pub struct Served<'a> {
    /// The route it matched, as its template: `/xrpc/{*method}`.
    pub route: Option<&'a str>,
    pub method: &'a str,
    pub path: &'a str,
    /// The client, as its `User-Agent` names itself.
    pub agent: Option<&'a str>,
    pub status: u16,
    /// The body's length, when known before it is sent.
    pub bytes: Option<u64>,
    pub took: Duration,
    pub trace: &'a str,
    /// Why it failed, for a 5xx.
    pub cause: Option<&'a str>,
}

/// The HTTP methods a request is counted under by name; any other, which
/// a client may make up without end, is counted as `other`, so the counts
/// and `/metrics` stay bounded.
const METHODS: [&str; 9] = [
    "GET", "HEAD", "POST", "PUT", "DELETE", "PATCH", "OPTIONS", "CONNECT", "TRACE",
];

/// `method` as a request is counted under it ([`METHODS`]).
fn counted_method(method: &str) -> &str {
    METHODS
        .into_iter()
        .find(|m| *m == method)
        .unwrap_or("other")
}

/// Logs a request served and counts it: at error if it failed on this
/// side, warn if slow, info otherwise, and debug for a health check.
pub fn served(r: &Served) {
    let ms = millis(r.took);
    let failed = r.status >= 500;
    let slow = slow(r.took);
    let route = r.route.unwrap_or("fallback");
    let key = (
        route.to_string(),
        counted_method(r.method).to_string(),
        r.status,
    );
    record(|s| {
        s.served
            .entry(key.clone())
            .or_default()
            .add(ms, failed, slow)
    });
    let health = ["/healthz", "/xrpc/_health"].contains(&route);
    let quiet = health && !failed && !slow;
    macro_rules! line {
        ($level:expr) => {
            tracing::event!(
                target: "grain::request",
                $level,
                http.route = r.route,
                http.request.method = r.method,
                url.path = r.path,
                user_agent.original = r.agent,
                http.response.status_code = r.status,
                http.response.body.size = r.bytes,
                duration_ms = ms,
                trace_id = r.trace,
                error = r.cause,
                "request"
            )
        };
    }
    match (failed, slow, quiet) {
        (true, _, _) => line!(Level::ERROR),
        (false, true, _) => line!(Level::WARN),
        (false, false, true) => line!(Level::DEBUG),
        (false, false, false) => line!(Level::INFO),
    }
}

/// Logs, at info, what was counted since the last summary: requests
/// served, and calls made to each host. Nothing for what saw none.
pub fn summarize() {
    let window = std::mem::take(&mut *WINDOW.lock().unwrap());
    let mut served = Timings::default();
    window.served.values().for_each(|t| served.merge(t));
    if served.count > 0 {
        note(Level::INFO, "summary: requests", &served.fields());
    }
    let mut hosts: BTreeMap<&str, Timings> = BTreeMap::new();
    for ((host, _), t) in &window.called {
        hosts.entry(host).or_default().merge(t);
    }
    for (host, t) in hosts {
        let f = Fields {
            host: Some(host),
            ..t.fields()
        };
        note(Level::INFO, "summary: outgoing", &f);
    }
}

/// What was counted since the start, in Prometheus's text format: rate,
/// errors and duration per route and per host called, by OpenTelemetry's
/// metric names.
pub fn metrics() -> String {
    let total = TOTAL.lock().unwrap();
    let mut out = String::new();
    let (version, commit) = BUILD.get().cloned().unwrap_or_default();
    let started = STARTED
        .duration_since(SystemTime::UNIX_EPOCH)
        .unwrap_or_default();
    let _ = writeln!(out, "# TYPE grain_build_info gauge");
    let _ = writeln!(
        out,
        "grain_build_info{{version=\"{version}\",commit=\"{commit}\"}} 1"
    );
    let _ = writeln!(out, "# TYPE process_start_time_seconds gauge");
    let _ = writeln!(out, "process_start_time_seconds {}", started.as_secs());
    let name = "http_server_request_duration_seconds";
    let _ = writeln!(out, "# TYPE {name} histogram");
    for ((route, method, status), t) in &total.served {
        let labels = format!(
            "http_route=\"{}\",http_request_method=\"{method}\",http_response_status_code=\"{status}\"",
            quoted(route)
        );
        histogram(&mut out, name, &labels, t);
    }
    let name = "http_client_request_duration_seconds";
    let _ = writeln!(out, "# TYPE {name} histogram");
    for ((host, outcome), t) in &total.called {
        let labels = format!(
            "server_address=\"{}\",outcome=\"{}\"",
            quoted(host),
            quoted(outcome)
        );
        histogram(&mut out, name, &labels, t);
    }
    out
}

fn histogram(out: &mut String, name: &str, labels: &str, t: &Timings) {
    for (bound, n) in BOUNDS_MS.iter().zip(t.buckets) {
        let le = *bound as f64 / 1000.0;
        let _ = writeln!(out, "{name}_bucket{{{labels},le=\"{le}\"}} {n}");
    }
    let _ = writeln!(out, "{name}_bucket{{{labels},le=\"+Inf\"}} {}", t.count);
    let _ = writeln!(out, "{name}_sum{{{labels}}} {}", t.sum_ms as f64 / 1000.0);
    let _ = writeln!(out, "{name}_count{{{labels}}} {}", t.count);
}

/// `value` as a Prometheus label value takes it.
fn quoted(value: &str) -> String {
    value
        .replace('\\', "\\\\")
        .replace('"', "\\\"")
        .replace('\n', "\\n")
}

#[cfg(test)]
pub(crate) mod tests {
    use super::*;
    use std::cell::RefCell;
    use std::sync::{Arc, Mutex, Once};
    use tracing_subscriber::layer::SubscriberExt;

    thread_local! {
        /// What is logged on this thread while `logged` runs.
        static KEPT: RefCell<Option<Vec<u8>>> = const { RefCell::new(None) };
    }

    /// What is logged while `f` runs, at every level, as JSON lines.
    ///
    /// One subscriber, global and interested in everything, keeps the
    /// lines of whichever thread is in `logged`. A subscriber scoped to
    /// the test would not do: tracing caches each callsite's interest
    /// process-wide, and while a scoped one is the only one alive it asks
    /// only the default of the thread that reaches a callsite first. Other
    /// tests here make calls through `send` with no subscriber, so one
    /// of them reaching a callsite first marks it never, and the line
    /// this test waits for is never made.
    pub(crate) fn logged(f: impl FnOnce()) -> Vec<serde_json::Value> {
        static GLOBAL: Once = Once::new();
        GLOBAL.call_once(|| {
            let layer = tracing_subscriber::fmt::layer()
                .json()
                .flatten_event(true)
                .with_writer(|| Kept);
            let subscriber = tracing_subscriber::registry()
                .with(tracing_subscriber::EnvFilter::new("trace"))
                .with(layer);
            tracing::subscriber::set_global_default(subscriber).unwrap();
        });
        // A callsite first reached while the subscriber was being set
        // may have cached the interest of none.
        tracing::callsite::rebuild_interest_cache();
        KEPT.with(|k| *k.borrow_mut() = Some(Vec::new()));
        f();
        let kept = KEPT.with(|k| k.borrow_mut().take()).unwrap_or_default();
        let text = String::from_utf8(kept).unwrap();
        text.lines()
            .map(|l| serde_json::from_str(l).unwrap())
            .collect()
    }

    /// Writes to the lines of the thread in `logged`, if it is; else
    /// nowhere.
    struct Kept;

    impl std::io::Write for Kept {
        fn write(&mut self, buf: &[u8]) -> std::io::Result<usize> {
            KEPT.with(|k| {
                if let Some(kept) = k.borrow_mut().as_mut() {
                    kept.extend_from_slice(buf);
                }
            });
            Ok(buf.len())
        }
        fn flush(&mut self) -> std::io::Result<()> {
            Ok(())
        }
    }

    #[test]
    fn settings() {
        assert_eq!(millis(Duration::from_secs(2)), 2000);
        assert_eq!(short(&"a".repeat(500)).len(), 120);
        std::io::Write::flush(&mut Kept).unwrap();
        let _ = layer::<Registry>();
        assert_eq!(slow_ms(None), 1000);
        assert_eq!(slow_ms(Some("250")), 250);
        assert_eq!(slow_ms(Some("soon")), 1000);
        // Never set up here: refused either way.
        assert!(set_filter("[[[").unwrap_err().contains("invalid"));
        assert_eq!(set_filter("debug").unwrap_err(), "logging is not set up");
    }

    #[test]
    fn notes_at_each_level() {
        let lines = logged(|| {
            for level in [Level::ERROR, Level::WARN, Level::INFO, Level::TRACE] {
                let f = Fields {
                    did: Some("did:plc:alice"),
                    error: Some("broke".into()),
                    count: Some(3),
                    ..Fields::default()
                };
                note(level, "said", &f);
            }
        });
        let said: Vec<&serde_json::Value> =
            lines.iter().filter(|l| l["message"] == "said").collect();
        let levels: Vec<&str> = said.iter().map(|l| l["level"].as_str().unwrap()).collect();
        assert_eq!(levels, ["ERROR", "WARN", "INFO", "DEBUG"]);
        assert_eq!(said[0]["did"], "did:plc:alice");
        assert_eq!(said[0]["count"], 3);
        assert!(said[0].get("reason").is_none());
    }

    #[test]
    fn panics_are_logged() {
        let lines = logged(|| {
            let before = std::panic::take_hook();
            std::panic::set_hook(Box::new(panicked));
            let _ = std::panic::catch_unwind(|| panic!("on fire"));
            std::panic::set_hook(before);
        });
        let line = lines.iter().find(|l| l["message"] == "panicked").unwrap();
        assert!(line["error"].as_str().unwrap().contains("on fire"));
    }

    #[test]
    fn sql_statements() {
        let lines = logged(|| {
            sql(
                "SELECT uri\n    FROM record -- scans: record\n",
                Duration::from_millis(250),
            )
        });
        let line = lines.iter().find(|l| l["message"] == "sql").unwrap();
        assert_eq!(line["level"], "WARN");
        assert_eq!(
            line["db.query.text"],
            "SELECT uri FROM record -- scans: record"
        );
        assert_eq!(line["duration_ms"], 250);
        let long = format!("SELECT {}", "x".repeat(600));
        let lines = logged(|| sql(&long, Duration::ZERO));
        let line = lines.iter().find(|l| l["message"] == "sql").unwrap();
        assert_eq!(line["db.query.text"].as_str().unwrap().len(), 500);
    }

    #[test]
    fn hosts_past_the_most_are_other() {
        let mut stats = Stats::default();
        for n in 0..HOSTS {
            stats.call(&format!("h{n}"), "200", 1, false, false);
        }
        assert_eq!(stats.call("h0", "200", 1, false, false), "h0");
        assert_eq!(stats.call("new", "200", 1, false, false), "other");
    }

    #[test]
    fn made_up_methods_are_counted_as_other() {
        assert_eq!(counted_method("GET"), "GET");
        assert_eq!(counted_method("PROPFIND"), "other");
        assert_eq!(counted_method("get"), "other");
    }

    #[test]
    fn served_and_summarized() {
        let lines = logged(|| {
            record(|s| s.call("pds.test", "200", 3, false, false));
            for (route, status, ms) in [
                (Some("/xrpc/_health"), 200, 1),
                (Some("/xrpc/social.grain.unspecced.getTimeline"), 200, 2),
                (Some("/xrpc/social.grain.unspecced.getTimeline"), 502, 2),
                (None, 200, 5000),
            ] {
                served(&Served {
                    route,
                    method: "GET",
                    path: "/xrpc/social.grain.unspecced.getTimeline",
                    agent: Some("Mozilla/5.0"),
                    status,
                    bytes: Some(10),
                    took: Duration::from_millis(ms),
                    trace: "t",
                    cause: (status >= 500).then_some("PDS down"),
                });
            }
            summarize();
        });
        let requests: Vec<&serde_json::Value> =
            lines.iter().filter(|l| l["message"] == "request").collect();
        let levels: Vec<&str> = requests
            .iter()
            .map(|l| l["level"].as_str().unwrap())
            .collect();
        assert_eq!(levels, ["DEBUG", "INFO", "ERROR", "WARN"]);
        assert_eq!(requests[2]["error"], "PDS down");
        assert_eq!(
            requests[2]["http.route"],
            "/xrpc/social.grain.unspecced.getTimeline"
        );
        assert_eq!(requests[1]["http.response.status_code"], 200);
        assert_eq!(requests[1]["user_agent.original"], "Mozilla/5.0");
        let summary = |m: &str| lines.iter().find(|l| l["message"] == m).cloned();
        let summed = summary("summary: requests").unwrap();
        assert!(summed["count"].as_u64().unwrap() >= 4);
        assert!(summary("summary: outgoing").is_some());
        let text = metrics();
        assert!(text.contains("http_route=\"fallback\""));
        assert!(text.contains("process_start_time_seconds"));
        assert!(text.contains("server_address=\"pds.test\",outcome=\"200\""));
        assert_eq!(quoted("a\"b\\c\nd"), "a\\\"b\\\\c\\nd");
    }

    #[test]
    fn traces() {
        let id = "4bf92f3577b34da6a3ce929d0e0e4736";
        let parent = format!("00-{id}-00f067aa0ba902b7-01");
        assert_eq!(trace_from(Some(&parent)), id);
        assert_eq!(trace_from(Some(&parent.to_uppercase())), id);
        for bad in ["junk", "00-xyz-00f067aa0ba902b7-01"] {
            assert_ne!(trace_from(Some(bad)), id);
        }
        let zeros = format!("00-{}-00f067aa0ba902b7-01", "0".repeat(32));
        assert_eq!(trace_from(Some(&zeros)).len(), 32);
        assert_eq!(trace_from(None).len(), 32);
        assert_eq!(trace_id(), None);
        let rt = tokio::runtime::Builder::new_current_thread()
            .build()
            .unwrap();
        let within = rt.block_on(traced(id.into(), async { trace_id() }));
        assert_eq!(within.as_deref(), Some(id));
    }

    /// A server that answers each request with `status`, and the headers
    /// of the last it was sent.
    pub(crate) fn answering(status: &'static str) -> (String, Arc<Mutex<String>>) {
        use std::io::{Read, Write};
        let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
        let url = format!("http://{}", listener.local_addr().unwrap());
        let asked = Arc::new(Mutex::new(String::new()));
        let kept = asked.clone();
        std::thread::spawn(move || {
            for stream in listener.incoming() {
                let mut stream = stream.unwrap();
                let mut buf = [0u8; 4096];
                let n = stream.read(&mut buf).unwrap();
                *kept.lock().unwrap() = String::from_utf8_lossy(&buf[..n]).into_owned();
                let answer =
                    format!("HTTP/1.1 {status}\r\ncontent-length: 0\r\nconnection: close\r\n\r\n");
                let _ = stream.write_all(answer.as_bytes());
            }
        });
        (url, asked)
    }

    #[test]
    fn outgoing_calls() {
        let (ok, asked) = answering("200 OK");
        let (broken, _) = answering("503 Service Unavailable");
        let rt = tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .unwrap();
        let http = reqwest::Client::new();
        let lines = logged(|| {
            rt.block_on(async {
                let xrpc = format!("{ok}/xrpc/com.atproto.sync.getRepo?did=did:plc:x&secret=1");
                let id = "4bf92f3577b34da6a3ce929d0e0e4736".to_string();
                let sent = traced(id, send(http.get(&xrpc), 0)).await;
                assert_eq!(sent.unwrap().status(), 200);
                let sent = send(http.get(&broken), 1).await;
                assert_eq!(sent.unwrap().status(), 503);
                let refused = send(http.get("http://127.0.0.1:9/x"), 0).await;
                assert!(refused.is_err());
                let invalid = send(http.get("not a url"), 0).await;
                assert!(invalid.is_err());
            })
        });
        assert!(
            asked
                .lock()
                .unwrap()
                .contains("traceparent: 00-4bf92f3577b34da6a3ce929d0e0e4736-")
        );
        let calls: Vec<&serde_json::Value> = lines
            .iter()
            .filter(|l| l["message"] == "outgoing")
            .collect();
        assert_eq!(calls.len(), 3);
        assert_eq!(calls[0]["level"], "DEBUG");
        assert_eq!(calls[0]["rpc.method"], "com.atproto.sync.getRepo");
        assert_eq!(calls[0]["url.path"], "/xrpc/com.atproto.sync.getRepo");
        assert_eq!(calls[0]["server.address"], "127.0.0.1");
        assert_eq!(calls[0]["trace_id"], "4bf92f3577b34da6a3ce929d0e0e4736");
        assert!(!lines.iter().any(|l| l.to_string().contains("secret")));
        assert_eq!(calls[1]["level"], "WARN");
        assert_eq!(calls[1]["error.type"], "503");
        assert_eq!(calls[1]["http.request.resend_count"], 1);
        assert!(
            calls[2]["error.type"]
                .as_str()
                .unwrap()
                .starts_with("connect")
        );
    }

    #[test]
    fn slow_calls_warn() {
        let call = Call {
            host: "pds.test".into(),
            method: "GET".into(),
            path: "/x".into(),
            resend: 0,
        };
        let lines = logged(|| call.done(Some(200), None, Duration::from_secs(1)));
        assert_eq!(lines[0]["level"], "WARN");
        assert_eq!(lines[0]["duration_ms"], 1000);
        assert!(lines[0].get("rpc.method").is_none());
    }

    #[test]
    fn error_types() {
        let rt = tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .unwrap();
        let (url, _) = answering("200 OK");
        let http = reqwest::Client::new();
        // Asked of a listener that never answers, so the timeout always
        // comes first: a local 200 could beat even a zero one.
        let silent = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
        let never = format!("http://{}/", silent.local_addr().unwrap());
        let timeout = rt.block_on(async { http.get(&never).timeout(Duration::ZERO).send().await });
        let timeout = timeout.unwrap_err();
        assert!(error_type(&timeout).starts_with("timeout"));
        let built = http.get(&url).header("bad\nname", "x").build().unwrap_err();
        assert!(error_type(&built).starts_with("request"));
        let res = rt.block_on(http.get(&url).send()).unwrap();
        let body = rt.block_on(res.json::<serde_json::Value>()).unwrap_err();
        assert!(error_type(&body).starts_with("body"));
    }
}

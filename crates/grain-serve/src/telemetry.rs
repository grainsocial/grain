//! What this server logs of what it serves, and the numbers it keeps
//! (`grain::telemetry`): a line for each request, with the trace its
//! calls hand on, a line for each slow statement of the index's, and
//! `/metrics` and `/log` on a port of their own.

use axum::Router;
use axum::extract::{MatchedPath, Request};
use axum::http::{HeaderValue, StatusCode, header};
use axum::middleware::Next;
use axum::response::{IntoResponse, Response};
use axum::routing::{get, put};
use grain::telemetry::{self, Fields, Level};
use rusqlite::Connection;
use rusqlite::trace::{TraceEvent, TraceEventCodes};
use std::sync::{Arc, OnceLock};
use std::time::{Duration, Instant};

/// Why a response failed, for the line logged for it.
#[derive(Clone)]
pub struct Cause(pub String);

/// The route a request matched, as the routing finds it.
#[derive(Clone, Default)]
struct Route(Arc<OnceLock<String>>);

/// `routes`, each request through them logged and counted, in a trace
/// of its own or the one its `traceparent` names, which the answer gives
/// back as `x-trace-id`.
pub fn observed(routes: Router) -> Router {
    routes
        .route_layer(axum::middleware::from_fn(matched))
        .layer(axum::middleware::from_fn(observe))
}

async fn matched(req: Request, next: Next) -> Response {
    let path = req.extensions().get::<MatchedPath>();
    if let (Some(route), Some(path)) = (req.extensions().get::<Route>(), path) {
        let _ = route.0.set(path.as_str().to_string());
    }
    next.run(req).await
}

async fn observe(mut req: Request, next: Next) -> Response {
    let started = Instant::now();
    let route = Route::default();
    req.extensions_mut().insert(route.clone());
    let method = req.method().to_string();
    let path = telemetry::short(req.uri().path());
    let agent = req.headers().get(header::USER_AGENT);
    let agent = agent.map(HeaderValue::to_str).and_then(Result::ok);
    let agent = agent.map(str::to_string);
    let parent = req.headers().get("traceparent");
    let trace = telemetry::trace_from(parent.and_then(|v| v.to_str().ok()));
    let mut res = telemetry::traced(trace.clone(), next.run(req)).await;
    let id = HeaderValue::try_from(trace.as_str()).expect("hex is a header value");
    res.headers_mut().insert("x-trace-id", id);
    let cause = res.extensions().get::<Cause>();
    let bytes = axum::body::HttpBody::size_hint(res.body()).exact();
    telemetry::served(&telemetry::Served {
        route: route.0.get().map(String::as_str),
        method: &method,
        path: &path,
        agent: agent.as_deref(),
        status: res.status().as_u16(),
        bytes,
        took: started.elapsed(),
        trace: &trace,
        cause: cause.map(|c| c.0.as_str()),
    });
    res
}

/// Has `db` log each statement it runs that is slow ([`profiled`]), and
/// hand each to the planner, when they are planned
/// ([`crate::index::plans`]).
pub fn watch(db: &Connection) {
    let mut codes = TraceEventCodes::SQLITE_TRACE_PROFILE;
    if crate::index::plans::planning() {
        codes |= TraceEventCodes::SQLITE_TRACE_STMT;
    }
    db.trace_v2(codes, Some(traced));
}

fn traced(event: TraceEvent<'_>) {
    if let TraceEvent::Stmt(stmt, _) = &event {
        crate::index::plans::check(&stmt.sql());
    }
    if let TraceEvent::Profile(stmt, took) = event {
        profiled(took, &stmt.sql());
    }
}

/// Logs the statement `sql`, which took `took`, if that is a tenth of a
/// slow request or more (`GRAIN_SLOW_MS`, a second unless set): a request
/// seldom runs one statement alone, so one that slow is what made it
/// slow, and the line, in its trace, says which.
fn profiled(took: Duration, sql: &str) {
    if telemetry::slow(took.saturating_mul(10)) {
        telemetry::sql(sql, took);
    }
}

/// What is answered on `--metrics`, a port kept off the proxy: the
/// numbers at `/metrics`, and `PUT /log` setting what is logged, as
/// `RUST_LOG` does.
pub fn admin() -> Router {
    Router::new()
        .route("/metrics", get(metrics))
        .route("/log", put(level))
}

/// Answers [`admin`] on `addr`, if given, and says where.
pub async fn serve_admin(addr: Option<&str>) -> anyhow::Result<()> {
    let Some(addr) = addr else {
        return Ok(());
    };
    let listener = tokio::net::TcpListener::bind(addr).await?;
    let at = format!("http://{}", listener.local_addr()?);
    said("metrics listening", Some(&at));
    tokio::spawn(axum::serve(listener, admin()).into_future());
    Ok(())
}

async fn metrics() -> Response {
    let kind = "text/plain; version=0.0.4";
    ([(header::CONTENT_TYPE, kind)], telemetry::metrics()).into_response()
}

async fn level(body: String) -> Response {
    match telemetry::set_filter(body.trim()) {
        Ok(()) => format!("logging {}\n", body.trim()).into_response(),
        Err(err) => (StatusCode::BAD_REQUEST, err).into_response(),
    }
}

/// Logs a summary of what was counted every `every`, the first at once.
pub async fn summaries(every: Duration) {
    let mut tick = tokio::time::interval(every);
    loop {
        tick.tick().await;
        telemetry::summarize();
    }
}

/// How often what was counted is summed up in the log.
pub const SUMMARY: Duration = Duration::from_secs(60);

/// Logs, at info, `message` about this server: its address, or that it
/// is stopping.
pub fn said(message: &str, source: Option<&str>) {
    let fields = Fields {
        source,
        ..Fields::default()
    };
    telemetry::note(Level::INFO, message, &fields);
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn slow_statements() {
        profiled(Duration::ZERO, "SELECT 1");
        profiled(Duration::from_secs(5), "SELECT 1");
        let db = Connection::open_in_memory().unwrap();
        watch(&db);
        db.execute_batch("SELECT 1").unwrap();
    }

    #[tokio::test]
    async fn admin_answers() {
        let shown = metrics().await;
        let body = axum::body::to_bytes(shown.into_body(), usize::MAX)
            .await
            .unwrap();
        assert!(String::from_utf8_lossy(&body).contains("process_start_time_seconds"));
        // Logging is not set up in tests, so a level is refused.
        let refused = level("debug".into()).await;
        assert_eq!(refused.status(), StatusCode::BAD_REQUEST);
        serve_admin(None).await.unwrap();
        serve_admin(Some("127.0.0.1:0")).await.unwrap();
        let summarizing = tokio::spawn(summaries(SUMMARY));
        tokio::task::yield_now().await;
        summarizing.abort();
        said("stopping", None);
    }

    #[tokio::test]
    async fn each_request_is_in_a_trace_it_gives_back() {
        let failing = || async { crate::xrpc::Failure::from(rusqlite::Error::InvalidQuery) };
        let routes = Router::new()
            .route("/x/{n}", get(|| async { "ok" }))
            .route("/broken", get(failing));
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let url = format!("http://{}", listener.local_addr().unwrap());
        tokio::spawn(axum::serve(listener, observed(routes)).into_future());
        let http = reqwest::Client::new();
        let id = "4bf92f3577b34da6a3ce929d0e0e4736";
        let res = http
            .get(format!("{url}/x/1"))
            .header("traceparent", format!("00-{id}-00f067aa0ba902b7-01"))
            .header(header::USER_AGENT, "grain-test")
            .send()
            .await
            .unwrap();
        assert_eq!(res.headers()["x-trace-id"], id);
        let res = http.get(format!("{url}/nowhere")).send().await.unwrap();
        assert_eq!(res.status(), StatusCode::NOT_FOUND);
        assert_eq!(res.headers()["x-trace-id"].len(), 32);
        let res = http.get(format!("{url}/broken")).send().await.unwrap();
        assert_eq!(res.status(), StatusCode::INTERNAL_SERVER_ERROR);
    }
}

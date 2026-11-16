# Observability

What grain-serve records of what it does, how, and why that, for one
host running a few containers with one operator. It is knotless's
([docs/observability.md](https://knotless.dev/chadtmiller.com/knotless/blob/main/docs/observability.md)
there), the same lines and numbers under grain's names, and the reasons
given there hold here.

## What there is

- **Logs**: JSON lines on stderr, through `tracing` and
  `tracing-subscriber`, one an event, at the level `RUST_LOG` sets
  (`info` unset). `grain::telemetry::init` sets it up, and logs
  `grain-serve starting` with its `version` and `commit` (`GRAIN_COMMIT`,
  stamped into the build), and a panic as `panicked`, with where.
- **One wide line a request**: a `request` line when each request ends,
  as Stripe's canonical log lines are: `http.route` (its template, as
  `/xrpc/social.grain.unspecced.getTimeline`), `url.path` (no query),
  `http.request.method`, `user_agent.original`,
  `http.response.status_code`, `http.response.body.size` when known,
  `duration_ms` and `trace_id`. At info; at warn when over
  `GRAIN_SLOW_MS` (1000); at error for a 5xx, with the failure's
  `error` and message as `error`; and the health checks (`/xrpc/_health`,
  `/healthz`) at debug. `grain_serve::telemetry::observed` wraps the
  router for it, in `grain_serve::serve`.
- **A line for each call made**, to a PDS, the PLC directory, Bluesky or
  a handle's host, from the one place every call goes through
  (`grain::telemetry::send`): `outgoing`, with `server.address`,
  `url.path`, `rpc.method` for XRPC, `http.response.status_code`,
  `error.type`, `http.request.resend_count`, `duration_ms` and
  `trace_id`. At debug, so a busy minute does not drown the log; failed,
  5xx and slow ones at warn.
- **A line for each slow SQL statement**: `sql`, one of the index's that
  took a tenth of `GRAIN_SLOW_MS` (100 ms) or more, at warn, with its SQL
  as written (`db.query.text`, its parameters unbound, its whitespace
  closed up, cut at 500 characters) and `duration_ms`, in the trace of
  the request it ran in (`grain_serve::telemetry::watch`, on the index's
  connection).
- **Traces in every line**: each request is in a trace, the one its W3C
  `traceparent` names or a new one; every line logged while it is served
  carries its `trace_id`, every call it makes sends `traceparent`, and
  the answer gives it back as `x-trace-id`.
- **Field names from OpenTelemetry's semantic conventions**, so a
  collector can take the lines as they are.
- **RED metrics** at `/metrics`, in Prometheus's text format:
  `http_server_request_duration_seconds` by route, method and status,
  and `http_client_request_duration_seconds` by host called and outcome,
  OpenTelemetry's metric names; `grain_build_info` and
  `process_start_time_seconds`. Counted in two maps under a mutex.
- **A summary each minute**: `summary: requests` and `summary: outgoing`
  (by host), with `count`, `failed`, `slow`, `mean_ms` and `max_ms`, for
  what saw any.
- **The level changed at run time**: `PUT /log` with a `RUST_LOG`
  directive (`info,grain::outgoing=debug`), to see every call during an
  incident without the restart that would end it.
- **What it says of itself**: `listening` (`source`, its address, and
  `did`), `metrics listening`, `stopping: finishing the requests it has`,
  `stopped`, and `grain-serve failed` with `error` when it cannot start.

`/metrics` and `/log` are answered only on `--metrics <addr>`, a port of
their own, which a compose file binds to the container's own loopback
(`127.0.0.1:9464`): nothing outside the container reaches it, the proxy
included; `docker exec` does. Without `--metrics`, nowhere.

None of it logs a query string, a header, a cookie, a token or a body.
DIDs are logged; handles only as a path names them; client IPs never.

## What was left out, and why

As knotless leaves them out: the OpenTelemetry SDK and OTLP export (no
backend to send to; the ids and names are already W3C's and
OpenTelemetry's, so adding the layer later changes no line's meaning),
spans for each call inside a request, sampling, and a log store. jq over
the host's journal answers what one operator asks of one host.

knotless's lines that grain-serve has no part for are not here: git
commands, caches' hits and misses, and its feeds' connection and lag.

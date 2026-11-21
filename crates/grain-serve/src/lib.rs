//! grain's server. It answers atproto's health check and its DID
//! document ([`did`]),
//! `social.grain.sync.refreshRecords` and its deprecated
//! `indexRecords` ([`sync`]), the queries that read
//! the index alone ([`read`]), what an account has seen of its
//! notifications ([`notification`]) and the devices they are pushed to
//! ([`push`]), the stories it watched ([`story`]), muting ([`graph`]),
//! moderation ([`moderation`]), permissioned spaces ([`spaces`]), the
//! web's writes ([`write`]) and deleting a gallery ([`gallery`]), accounts
//! that go ([`accounts`]), draws the cards links unfurl into ([`og`]),
//! and logs the web in ([`login`]), handing the rest to the web's pages
//! ([`pages`]). Off the path of any request, its classifiers score what
//! arrives for moderators to review ([`classify`]).

pub mod accounts;
pub mod backfill;
pub mod cdn;
pub mod classify;
pub mod did;
pub mod gallery;
pub mod graph;
pub mod index;
pub mod jetstream;
pub mod login;
pub mod moderation;
pub mod notification;
pub mod og;
pub mod pages;
pub mod preferences;
pub mod push;
pub mod read;
pub mod spaces;
pub mod status;
pub mod story;
pub mod sync;
pub mod telemetry;
pub mod viewer;
pub mod write;
pub mod xrpc;

use anyhow::bail;
use axum::extract::DefaultBodyLimit;
use axum::http::StatusCode;
use axum::{Json, Router, routing::any, routing::get, routing::post};
use grain::env::Ctx;
use serde_json::{Value, json};
use std::path::PathBuf;
use std::sync::Arc;

/// Where the server listens unless `--listen` says.
pub const LISTEN: &str = "127.0.0.1:2600";

/// The flags `grain-serve` takes, each with a value. An empty value is
/// as if the flag were not given, so that a setting left unset turns its
/// part off: `--jetstream "$GRAIN_JETSTREAM"`.
pub const FLAGS: &[&str] = &[
    "--listen",
    "--index",
    "--public-url",
    "--jetstream",
    "--backfill",
    "--backfill-mirror",
    "--backfill-skip",
    "--backfill-concurrency",
    "--cdn",
    "--bsky-appview",
    "--sign-up-pds",
    "--group-host",
    "--carry-cookies-until",
    "--apns-key-id",
    "--apns-team-id",
    "--apns-topic",
    "--apns-url",
    "--fcm-project-id",
    "--clef-model",
    "--clef-url",
    "--check-index",
    "--metrics",
    "--web",
];

/// What `grain-serve` says of its flags when given one it does not take.
pub const USAGE: &str = "usage: grain-serve [--listen <addr>] [--index <file>] [--public-url <https://host>] [--jetstream <wss://host>] [--backfill <https://directory>[,...]] [--backfill-mirror <https://mirror>] [--backfill-skip <host>[,...]] [--backfill-concurrency <n>] [--cdn <https://imgproxy>] [--bsky-appview <https://appview>] [--sign-up-pds <https://pds>] [--group-host <https://host>] [--carry-cookies-until <rfc3339 time>] [--apns-key-id <id>] [--apns-team-id <id>] [--apns-topic <bundle id>] [--apns-url <https://apns>] [--fcm-project-id <id>] [--clef-model <model>] [--clef-url <url>] [--check-index <file>] [--metrics <addr>] [--web <http://app>]
environment: GRAIN_ADMIN_DIDS, GRAIN_CDN_KEY, GRAIN_CDN_SALT, GRAIN_APNS_KEY_FILE, GRAIN_FCM_KEY_FILE, CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_AI_TOKEN, RUST_LOG";

/// What the server is set to do, from its flags ([`FLAGS`]) and, for
/// secrets, key files and who its admins are, its environment.
#[derive(Debug, Clone, Default, PartialEq)]
pub struct Settings {
    /// `--listen`: where the server listens. None is [`LISTEN`].
    pub listen: Option<String>,
    /// `--index`: the index's file. None keeps no index.
    pub index: Option<PathBuf>,
    /// `--public-url`: where the server is reached, which names its DID
    /// ([`service_did`]). None has no DID, and takes no service tokens.
    pub public_url: Option<String>,
    /// `--backfill` and the rest ([`backfill::Config::given`]): how to
    /// backfill the index. None, as tests and dev run, reads no repos.
    pub backfill: Option<backfill::Config>,
    /// `--jetstream`: the Jetstream to feed the index from, such as
    /// [`jetstream::DEFAULT`]. None follows none, as tests and dev run.
    pub jetstream: Option<String>,
    /// `--cdn`, and `GRAIN_CDN_KEY` and `GRAIN_CDN_SALT` from the
    /// environment: grain's imgproxy, and the hex key and salt it signs
    /// paths with ([`cdn::Cdn`]). None draws images from Bluesky's CDN.
    pub cdn: [Option<String>; 3],
    /// `--bsky-appview`: the Bluesky appview whose typeahead
    /// `searchActorsTypeahead` fills out its own with, such as
    /// [`read::search::BSKY_APPVIEW`]. None asks none, as tests and dev
    /// run.
    pub bsky_appview: Option<String>,
    /// `--sign-up-pds`: where someone making an account on the web makes
    /// it. None is [`login::SIGN_UP_PDS`].
    pub sign_up_pds: Option<String>,
    /// `--group-host`: the group host the web starts groups on, which has
    /// agreed to found them for grain
    /// ([`spaces::group::create_group`]). None starts none.
    pub group_host: Option<String>,
    /// `GRAIN_ADMIN_DIDS`, from the environment: the DIDs of the accounts
    /// that moderate, separated by commas or spaces ([`moderation`]).
    pub admins: Vec<String>,
    /// `--carry-cookies-until`: the last moment, an RFC 3339 time, the web
    /// carries the cookies browsers held before grain-serve
    /// ([`login::carryover`]). None carries none.
    pub carry_cookies_until: Option<String>,
    /// `GRAIN_APNS_KEY_FILE` and `GRAIN_FCM_KEY_FILE` from the
    /// environment, and `--apns-*` and `--fcm-*`
    /// ([`push::Config::given`]): the services notifications are pushed
    /// by. With neither key file, as tests and dev run, none is pushed.
    pub push: push::Config,
    /// `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_AI_TOKEN` from the
    /// environment, and `--clef-*` ([`classify::clef::Config::given`]):
    /// Clef, for the classifiers to ask. None asks no model, and only
    /// bridged accounts' posts are labeled.
    pub clef: Option<classify::clef::Config>,
    /// `--check-index`: only check that the index at this path is of this
    /// build's tables, so that starting would leave it as it is
    /// ([`check_index`]), and serve nothing.
    pub check_index: Option<PathBuf>,
    /// `--metrics`: where `/metrics` and `PUT /log` are answered, apart
    /// from the rest ([`telemetry::admin`]). None answers them nowhere.
    pub metrics: Option<String>,
    /// `--web`: the web's app, a URL such as `http://web:3000`, that draws
    /// every page and is handed each request the server does not answer
    /// itself ([`pages`]). None hands on nothing: what the server does not
    /// answer is not found.
    pub web: Option<String>,
}

/// `grain-serve`'s settings, from its arguments, the first being the
/// program's name, and its environment ([`Settings::parse`]).
pub fn parse_args(args: &[String]) -> Result<Settings, String> {
    Settings::parse(args, |name| std::env::var(name).ok())
}

impl Settings {
    /// The settings `args` give, the first being the program's name, with
    /// what is kept in the environment read by `env`; the usage, saying
    /// what was wrong, for arguments it does not take.
    pub fn parse(
        args: &[String],
        env: impl Fn(&str) -> Option<String>,
    ) -> Result<Settings, String> {
        let mut flags = std::collections::HashMap::new();
        let mut it = args.iter().skip(1);
        while let Some(flag) = it.next() {
            let Some(name) = FLAGS.iter().find(|name| **name == flag.as_str()) else {
                return Err(format!("unexpected {flag}\n{USAGE}"));
            };
            let value = it.next().cloned().ok_or(format!("{flag} takes a value"))?;
            flags.insert(*name, value);
        }
        // A flag by its name, a variable by its own, as given; and either
        // empty as unset, for all but what tells the two apart.
        let given = |name: &str| match name.starts_with("--") {
            true => flags.get(name).cloned(),
            false => env(name),
        };
        let get = |name: &str| given(name).filter(|v| !v.is_empty());
        let url = |name: &str| get(name).map(|url| url.trim_end_matches('/').to_string());
        Ok(Settings {
            listen: get("--listen"),
            index: get("--index").map(PathBuf::from),
            public_url: get("--public-url"),
            backfill: backfill::Config::given(given)?,
            jetstream: get("--jetstream"),
            cdn: [get("--cdn"), get("GRAIN_CDN_KEY"), get("GRAIN_CDN_SALT")],
            bsky_appview: url("--bsky-appview"),
            sign_up_pds: get("--sign-up-pds"),
            group_host: url("--group-host"),
            admins: get("GRAIN_ADMIN_DIDS")
                .unwrap_or_default()
                .split([',', ' '])
                .filter(|did| !did.is_empty())
                .map(str::to_string)
                .collect(),
            carry_cookies_until: get("--carry-cookies-until"),
            push: push::Config::given(given),
            clef: classify::clef::Config::given(given),
            check_index: get("--check-index").map(PathBuf::from),
            metrics: get("--metrics"),
            web: url("--web"),
        })
    }

    /// The backfill these settings ask for, of `app`'s index, for the
    /// caller to run ([`backfill::Backfill::run`]).
    pub fn backfill(&self, app: &App) -> anyhow::Result<Option<Arc<backfill::Backfill>>> {
        let Some(config) = &self.backfill else {
            return Ok(None);
        };
        let index = app.index.clone();
        let index = index.ok_or_else(|| anyhow::anyhow!("--backfill needs --index"))?;
        let backfill = backfill::Backfill::new(index, app.ctx.clone(), config.clone());
        Ok(Some(backfill))
    }

    /// Starts following the Jetstream these settings name into `app`'s
    /// index, on the runtime this is called on; whether there is one.
    pub fn follow(&self, app: &App) -> anyhow::Result<bool> {
        let Some(url) = &self.jetstream else {
            return Ok(false);
        };
        let Some(index) = &app.index else {
            bail!("--jetstream needs --index");
        };
        let timing = grain::jetstream::Timing::default();
        let (index, ctx, url) = (index.clone(), app.ctx.clone(), url.clone());
        let follow = jetstream::follow(index, url, timing, jetstream::SAVE, Some(ctx));
        tokio::spawn(follow);
        Ok(true)
    }

    /// Starts pushing what arrives in `app`'s index by the services these
    /// settings name, on the runtime this is called on; whether any is.
    pub fn push(&self, app: &App) -> anyhow::Result<bool> {
        if self.push == push::Config::default() {
            return Ok(false);
        }
        let Some(index) = &app.index else {
            bail!("GRAIN_APNS_KEY_FILE and GRAIN_FCM_KEY_FILE need --index");
        };
        let transports = push::Transports::new(&self.push)?;
        tracing::info!(
            apns = transports.apns.is_some(),
            fcm = transports.fcm.is_some(),
            "pushing"
        );
        let retry = push::send::Retry::default();
        push::send::start(index.clone(), Arc::new(transports), retry);
        Ok(true)
    }

    /// Starts the classifiers on `app`'s index, on the runtime this is
    /// called on, asking the Clef these settings name; whether there is an
    /// index for them to score.
    pub fn classify(&self, app: &App) -> bool {
        let Some(index) = &app.index else {
            return false;
        };
        let classify = classify::Classify {
            index: index.clone(),
            ctx: app.ctx.clone(),
            cdn: app.cdn.clone(),
            clef: self.clef.clone(),
            labeler: app.did.clone(),
            timing: classify::Timing::default(),
        };
        classify.start()
    }

    /// The server `ctx` and these settings make: its index opened, and
    /// its DID named.
    pub fn app(&self, ctx: Ctx) -> anyhow::Result<App> {
        let did = self.public_url.as_deref().map(service_did).transpose()?;
        let [url, key, salt] = self.cdn.each_ref().map(Option::as_deref);
        let cdn = cdn::Cdn::new(url, key, salt)?;
        let index = match &self.index {
            Some(path) => Some(Arc::new(index::Index::open(path)?)),
            None => None,
        };
        let web = match (&self.public_url, &index) {
            (Some(url), Some(index)) => {
                let pds = self.sign_up_pds.as_deref().unwrap_or(login::SIGN_UP_PDS);
                let until = self.carry_cookies_until.as_deref();
                let until = until.map(|t| index.epoch_secs(t)).transpose()?;
                let web = login::Web::new(url, index, pds)?.carrying(index, until)?;
                let web = web.starting_groups(self.group_host.as_deref());
                Some(Arc::new(web))
            }
            _ => None,
        };
        Ok(App {
            ctx,
            index,
            did,
            cdn,
            bsky_appview: self.bsky_appview.clone(),
            web,
            admins: self.admins.clone(),
            cards: og::Cards::default(),
            rankings: Default::default(),
            pages: self.web.clone(),
            spaces: Default::default(),
        })
    }
}

/// What the routes share.
pub struct App {
    pub ctx: Ctx,
    /// The index, if the server keeps one.
    pub index: Option<Arc<index::Index>>,
    /// The DID service tokens name the server by in `aud`, if it has one:
    /// [`service_did`] of `--public-url`.
    pub did: Option<String>,
    /// Where views send clients for images.
    pub cdn: cdn::Cdn,
    /// The Bluesky appview typeahead asks too, if any.
    pub bsky_appview: Option<String>,
    /// The web's logins, for a server with a public URL and an index.
    pub web: Option<Arc<login::Web>>,
    /// The accounts that moderate, by DID ([`moderation`]).
    pub admins: Vec<String>,
    /// The OpenGraph cards drawn lately.
    pub cards: og::Cards,
    /// The For You rankings made lately ([`read::foryou::Rankings`]).
    pub rankings: read::foryou::Rankings,
    /// The web's app, handed what the server does not answer itself
    /// ([`pages`]), if there is one: `--web`.
    pub pages: Option<String>,
    /// The credentials spaces are read with lately ([`spaces::Spaces`]).
    pub spaces: spaces::Spaces,
}

impl App {
    /// A server that keeps no index and has no DID: one that answers its
    /// health check.
    pub fn bare(ctx: Ctx) -> App {
        App {
            ctx,
            index: None,
            did: None,
            cdn: cdn::Cdn::default(),
            bsky_appview: None,
            web: None,
            admins: Vec::new(),
            cards: og::Cards::default(),
            rankings: Default::default(),
            pages: None,
            spaces: Default::default(),
        }
    }
}

pub use grain::identity::service_did;

/// Whether the index at `path` is missing or of this build's tables, so
/// that starting with it leaves it as it is: what it says of it, or an
/// error saying what starting would do. Asked by deploy/rollout.sh before
/// starting a build beside a running one: both have the index open while
/// one hands over to the other, which is safe only if this one would not
/// migrate it.
pub fn check_index(path: &std::path::Path) -> anyhow::Result<String> {
    let this = index::schema::MIGRATIONS.len();
    match index::Index::version_at(path)? {
        Some(at) if at < this => bail!(
            "{}: its tables are version {at}, this build's {this}: starting would migrate it",
            path.display()
        ),
        Some(at) if at > this => bail!(
            "{}: its tables are version {at}, past this build's {this}: it would not start",
            path.display()
        ),
        _ => Ok(format!("{}: this build keeps it", path.display())),
    }
}

/// The routes the server answers, and, with [`App::pages`], the web's app
/// handed everything else ([`pages`]).
pub fn router(app: Arc<App>) -> Router {
    let pages = app.pages.as_deref().map(pages::pages).unwrap_or_default();
    spaces::routes(moderation::routes(og::routes(read::routes(Router::new()))))
        .route("/healthz", get(status::healthz))
        .route("/_status", get(status::status))
        .route("/xrpc/_health", get(health))
        .route(did::PATH, get(did::did_document))
        .route(&format!("/xrpc/{}", sync::LXM), post(sync::refresh_records))
        .route(
            &format!("/xrpc/{}", sync::INDEX_LXM),
            post(sync::index_records),
        )
        .route(
            &format!("/xrpc/{}", notification::UPDATE_SEEN),
            post(notification::update_seen),
        )
        .route(&format!("/xrpc/{}", graph::MUTE), post(graph::mute_actor))
        .route(
            &format!("/xrpc/{}", graph::UNMUTE),
            post(graph::unmute_actor),
        )
        .route(&format!("/xrpc/{}", push::REGISTER), post(push::register))
        .route(
            &format!("/xrpc/{}", push::UNREGISTER),
            post(push::unregister),
        )
        .route(
            &format!("/xrpc/{}", story::MARK_VIEWED),
            post(story::mark_viewed),
        )
        .route(
            &format!("/xrpc/{}", preferences::GET),
            get(preferences::get_preferences),
        )
        .route(
            &format!("/xrpc/{}", preferences::PUT),
            post(preferences::put_preferences),
        )
        .route(
            &format!("/xrpc/{}", preferences::SET),
            post(preferences::set_preference),
        )
        .route(
            "/xrpc/social.grain.repo.createRecord",
            post(write::create_record),
        )
        .route("/xrpc/social.grain.repo.putRecord", post(write::put_record))
        .route(
            "/xrpc/social.grain.repo.deleteRecord",
            post(write::delete_record),
        )
        .route(
            "/xrpc/social.grain.repo.applyWrites",
            post(write::apply_writes),
        )
        .route(
            "/xrpc/social.grain.repo.uploadBlob",
            post(write::upload_blob).layer(DefaultBodyLimit::max(write::MOST_BYTES)),
        )
        .route(
            &format!("/xrpc/{}", gallery::DELETE_GALLERY),
            post(gallery::delete_gallery),
        )
        .route(
            &format!("/xrpc/{}", accounts::DELETE_ACCOUNT),
            post(accounts::delete_account),
        )
        .route(login::METADATA, get(login::client_metadata))
        .route(login::JWKS, get(login::client_jwks))
        .route(login::APP_METADATA, get(login::app_client_metadata))
        .route("/oauth/login", post(login::login))
        .route(login::CALLBACK, get(login::callback))
        .route("/oauth/switch", post(login::switch))
        .route("/oauth/logout", post(login::logout))
        .route("/oauth/session", get(login::whoami))
        .route("/xrpc/{*method}", any(not_implemented))
        .merge(pages)
        .layer(axum::middleware::from_fn_with_state(
            app.clone(),
            login::carryover::carry,
        ))
        .layer(axum::middleware::from_fn(viewer::answers))
        .with_state(app)
}

/// A method the server does not serve, as atproto's XRPC servers refuse it.
async fn not_implemented() -> (StatusCode, Json<Value>) {
    let refused = json!({
        "error": "MethodNotImplemented",
        "message": "Method Not Implemented",
    });
    (StatusCode::NOT_IMPLEMENTED, Json(refused))
}

/// `/xrpc/_health`, as atproto services answer it: the running version.
async fn health() -> Json<Value> {
    Json(json!({ "version": env!("CARGO_PKG_VERSION") }))
}

/// Serves `app` on `listener` until the process is told to stop, by
/// SIGTERM or SIGINT, each request logged and counted
/// ([`telemetry::observed`]).
pub async fn serve(listener: tokio::net::TcpListener, app: Arc<App>) -> anyhow::Result<()> {
    std::sync::LazyLock::force(&status::STARTED);
    axum::serve(listener, telemetry::observed(router(app)))
        // As docker stops it (SIGTERM, through tini) or ctrl-c does: it
        // finishes the requests it has, for a rollout's old container.
        .with_graceful_shutdown(async {
            let kind = tokio::signal::unix::SignalKind::terminate();
            let mut term = tokio::signal::unix::signal(kind).expect("installing a SIGTERM handler");
            tokio::select! {
                _ = term.recv() => {}
                _ = tokio::signal::ctrl_c() => {}
            }
            telemetry::said("stopping: finishing the requests it has", None);
        })
        .await?;
    telemetry::said("stopped", None);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use grain::env::Env;

    #[test]
    fn the_did_is_the_public_urls_host() {
        let did = |url| service_did(url).unwrap();
        assert_eq!(did("https://grain.social"), "did:web:grain.social");
        assert_eq!(did("https://grain.social/"), "did:web:grain.social");
        assert_eq!(did("http://127.0.0.1:2600"), "did:web:127.0.0.1%3A2600");
        for wrong in ["grain.social", "https://", "https://grain.social/xrpc"] {
            let why = service_did(wrong).unwrap_err().to_string();
            assert!(why.starts_with(wrong), "{why}");
        }
    }

    /// `grain-serve` given `flags`.
    fn args(flags: &[&str]) -> Vec<String> {
        let all = std::iter::once("grain-serve").chain(flags.iter().copied());
        all.map(str::to_string).collect()
    }

    #[test]
    fn settings_are_read_from_flags_and_the_environment() {
        let none = |_: &str| None;
        assert_eq!(Settings::parse(&args(&[]), none), Ok(Settings::default()));
        // Every flag given empty is every part off.
        let empty: Vec<&str> = FLAGS.iter().flat_map(|f| [*f, ""]).collect();
        let off = Settings::parse(&args(&empty), |_| Some(String::new()));
        assert_eq!(off, Ok(Settings::default()));
        let set = Settings::parse(
            &args(&[
                "--listen",
                "0.0.0.0:2600",
                "--index",
                "/data/index.db",
                "--public-url",
                "https://grain.social",
                "--cdn",
                "https://cdn.grain.social",
                "--bsky-appview",
                "https://public.api.bsky.app/",
                "--sign-up-pds",
                "https://pds.test",
                "--group-host",
                "https://groups.test/",
                "--jetstream",
                jetstream::DEFAULT,
                "--web",
                "http://web:3000/",
            ]),
            |name| match name {
                "GRAIN_ADMIN_DIDS" => Some("did:plc:alice, did:web:bob.test".into()),
                "GRAIN_CDN_KEY" => Some("00".into()),
                // A setting is a flag: its variable is never read.
                "GRAIN_INDEX" => Some("/elsewhere.db".into()),
                _ => None,
            },
        )
        .unwrap();
        assert_eq!(set.listen.as_deref(), Some("0.0.0.0:2600"));
        assert_eq!(set.web.as_deref(), Some("http://web:3000"));
        assert_eq!(set.admins, ["did:plc:alice", "did:web:bob.test"]);
        assert_eq!(
            set.bsky_appview.as_deref(),
            Some("https://public.api.bsky.app")
        );
        assert_eq!(set.jetstream.as_deref(), Some(jetstream::DEFAULT));
        assert_eq!(set.cdn[0].as_deref(), Some("https://cdn.grain.social"));
        assert_eq!(set.cdn[1].as_deref(), Some("00"));
        assert!(
            set.app(Ctx::new(Env::from_vars(|_| None))).is_err(),
            "a CDN with no salt"
        );
        assert_eq!(set.index, Some(PathBuf::from("/data/index.db")));
        assert_eq!(set.public_url.as_deref(), Some("https://grain.social"));
        assert_eq!(set.sign_up_pds.as_deref(), Some("https://pds.test"));
        assert_eq!(set.group_host.as_deref(), Some("https://groups.test"));
        // The last of a flag given twice is the one taken.
        let twice = Settings::parse(&args(&["--index", "a.db", "--index", "b.db"]), none);
        assert_eq!(twice.unwrap().index, Some(PathBuf::from("b.db")));
    }

    #[test]
    fn what_it_does_not_take_is_refused_with_its_usage() {
        let none = |_: &str| None;
        let unknown = Settings::parse(&args(&["--private"]), none).unwrap_err();
        assert!(unknown.starts_with("unexpected --private\nusage: grain-serve"));
        assert!(FLAGS.iter().all(|flag| USAGE.contains(flag)));
        let bare = Settings::parse(&args(&["--index"]), none).unwrap_err();
        assert_eq!(bare, "--index takes a value");
        // A setting is a flag, not its old variable.
        let var = Settings::parse(&args(&["GRAIN_INDEX=/data/index.db"]), none);
        assert!(var.unwrap_err().starts_with("unexpected GRAIN_INDEX"));
    }

    #[test]
    fn the_index_is_checked_against_this_builds_tables() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("index.db");
        let said = check_index(&path).unwrap();
        assert!(said.ends_with("index.db: this build keeps it"), "{said}");
        drop(index::Index::open(&path).unwrap());
        assert!(check_index(&path).unwrap().ends_with("keeps it"));
        let at = |v: usize| {
            let db = rusqlite::Connection::open(&path).unwrap();
            db.pragma_update(None, "user_version", v as i64).unwrap();
            check_index(&path).unwrap_err().to_string()
        };
        let this = index::schema::MIGRATIONS.len();
        assert!(at(this - 1).ends_with("starting would migrate it"));
        assert!(at(this + 1).ends_with("it would not start"));
        let unreadable = dir.path().join("not-a-db");
        std::fs::write(&unreadable, "not sqlite at all, and long enough to be read").unwrap();
        assert!(check_index(&unreadable).is_err());
        let set = Settings::parse(&args(&["--check-index", "/data/index.db"]), |_| None);
        assert_eq!(
            set.unwrap().check_index,
            Some(PathBuf::from("/data/index.db"))
        );
    }

    #[tokio::test]
    async fn push_starts_where_a_service_is_named() {
        let ctx = || Ctx::new(Env::from_vars(|_| None));
        let none = Settings::default();
        assert!(!none.push(&none.app(ctx()).unwrap()).unwrap());
        let dir = tempfile::tempdir().unwrap();
        let named = |index: bool, key_file: &str| Settings {
            index: index.then(|| dir.path().join("index.db")),
            push: push::Config {
                apns: None,
                fcm: Some(push::fcm::Config {
                    key_file: dir.path().join(key_file),
                    project_id: Some("grain-test".into()),
                    url: push::fcm::URL.into(),
                }),
            },
            ..Settings::default()
        };
        let unindexed = named(false, "none.json");
        let why = unindexed.push(&unindexed.app(ctx()).unwrap()).unwrap_err();
        assert!(why.to_string().ends_with("need --index"), "{why}");
        let unreadable = named(true, "none.json");
        assert!(unreadable.push(&unreadable.app(ctx()).unwrap()).is_err());
        let account = serde_json::json!({
            "client_email": "push@grain-test.iam.gserviceaccount.com",
            "private_key": include_str!("push/test-rsa-key.pem"),
        });
        std::fs::write(dir.path().join("account.json"), account.to_string()).unwrap();
        let set = named(true, "account.json");
        assert!(set.push(&set.app(ctx()).unwrap()).unwrap());
    }

    #[test]
    fn the_app_opens_its_index_and_names_its_did() {
        let ctx = || Ctx::new(Env::from_vars(|_| None));
        let dir = tempfile::tempdir().unwrap();
        let settings = Settings {
            index: Some(dir.path().join("index.db")),
            public_url: Some("https://grain.social".into()),
            ..Settings::default()
        };
        let app = settings.app(ctx()).unwrap();
        assert!(app.index.is_some());
        assert_eq!(app.did.as_deref(), Some("did:web:grain.social"));
        let web = app.web.as_ref().expect("a public URL and an index log in");
        assert_eq!(
            web.client.id,
            "https://grain.social/oauth-client-metadata.json"
        );
        assert_eq!(web.sign_up_pds, login::SIGN_UP_PDS);
        assert_eq!(web.group_host, None);
        let hosting = Settings {
            group_host: Some("https://groups.test".into()),
            ..settings.clone()
        };
        let app = hosting.app(ctx()).unwrap();
        let web = app.web.as_ref().unwrap();
        assert_eq!(web.group_host.as_deref(), Some("https://groups.test"));
        let bare = Settings::default().app(ctx()).unwrap();
        assert!(bare.index.is_none() && bare.did.is_none() && bare.web.is_none());
        let wrong = Settings {
            public_url: Some("grain.social".into()),
            ..Settings::default()
        };
        assert!(wrong.app(ctx()).is_err());
        // A time to carry cookies until is one, or the server does not start.
        let until = |t: &str| Settings {
            carry_cookies_until: Some(t.into()),
            ..settings.clone()
        };
        assert!(until("2026-12-01T00:00:00Z").app(ctx()).is_ok());
        assert!(until("next month").app(ctx()).is_err());
    }
}

//! `grain-serve`: listens where `--listen` says, 127.0.0.1:2600 unless
//! given, keeping the index at `--index`, backfilled when `--backfill`
//! names directories and fed from `--jetstream` when that names one,
//! pushing by APNs and FCM when their key files are named, and taking
//! service tokens for the DID of `--public-url` when given, and handing
//! the web's pages to the app at `--web` when that names one
//! ([`grain_serve::Settings`], [`grain_serve::USAGE`]).

use anyhow::Context;
use grain::env::{Ctx, Env};
use grain::telemetry;
use std::sync::Arc;

fn main() -> anyhow::Result<()> {
    let args: Vec<String> = std::env::args().collect();
    let settings = match grain_serve::parse_args(&args) {
        Ok(settings) => settings,
        Err(usage) => {
            eprintln!("{usage}");
            std::process::exit(2);
        }
    };
    // Asked by deploy/rollout.sh before starting this build beside a
    // running one.
    if let Some(path) = &settings.check_index {
        println!("{}", grain_serve::check_index(path)?);
        return Ok(());
    }
    // GRAIN_COMMIT is the commit the image was built from (Dockerfile).
    let (version, commit) = (env!("CARGO_PKG_VERSION"), option_env!("GRAIN_COMMIT"));
    telemetry::init("grain-serve", version, commit);
    let runtime = tokio::runtime::Runtime::new().context("starting the runtime")?;
    let ran = runtime.block_on(run(settings));
    if let Err(err) = &ran {
        let f = telemetry::Fields {
            error: Some(format!("{err:#}")),
            ..Default::default()
        };
        telemetry::note(telemetry::Level::ERROR, "grain-serve failed", &f);
    }
    ran
}

async fn run(settings: grain_serve::Settings) -> anyhow::Result<()> {
    let app = settings.app(Ctx::new(Env::from_process()))?;
    if let Some(backfill) = settings.backfill(&app)? {
        tokio::spawn(backfill.run());
    }
    settings.push(&app)?;
    settings.classify(&app);
    settings.follow(&app)?;
    let addr = settings.listen.as_deref().unwrap_or(grain_serve::LISTEN);
    let listener = tokio::net::TcpListener::bind(addr)
        .await
        .with_context(|| format!("listening on {addr}"))?;
    let listening = format!("http://{}", listener.local_addr()?);
    let f = telemetry::Fields {
        source: Some(&listening),
        did: app.did.as_deref(),
        ..Default::default()
    };
    telemetry::note(telemetry::Level::INFO, "listening", &f);
    grain_serve::telemetry::serve_admin(settings.metrics.as_deref()).await?;
    tokio::spawn(grain_serve::telemetry::summaries(
        grain_serve::telemetry::SUMMARY,
    ));
    grain_serve::serve(listener, Arc::new(app)).await
}

//! Asking after an account Jetstream says was deleted, against a stand-in
//! PLC directory that is also each account's host: only an answer that
//! says so is gone, and one that cannot be had is asked again, then kept.

use axum::extract::{Query, State};
use axum::http::{StatusCode, Uri};
use axum::response::{IntoResponse, Response};
use axum::{Json, Router};
use grain_serve::accounts::{self, Asked, Patience, Settled};
use grain_serve::index::Index;
use serde_json::{Value, json};
use std::collections::HashMap;
use std::sync::Arc;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::time::Duration;

/// Each account by what its identity and its host say of it.
const HERE: &str = "did:plc:hereaaaaaaaaaaaaaaaaaaaa";
const DELETED: &str = "did:plc:deletedaaaaaaaaaaaaaaaa";
const DEACTIVATED: &str = "did:plc:deactivatedaaaaaaaaaaaa";
const SUSPENDED: &str = "did:plc:suspendedaaaaaaaaaaaaaa";
const NO_REPO: &str = "did:plc:norepoaaaaaaaaaaaaaaaaa";
const TOMBSTONE: &str = "did:plc:tombstoneaaaaaaaaaaaaaa";
const NEVER: &str = "did:plc:neveraaaaaaaaaaaaaaaaaa";
const PLC_DOWN: &str = "did:plc:plcdownaaaaaaaaaaaaaaaa";
const HOST_DOWN: &str = "did:plc:hostdownaaaaaaaaaaaaaaa";
const UNREACHABLE: &str = "did:plc:unreachableaaaaaaaaaaaa";
const ODD: &str = "did:plc:oddaaaaaaaaaaaaaaaaaaaaa";
const NO_HOST: &str = "did:plc:nohostaaaaaaaaaaaaaaaaa";
/// One PLC fails the first time it is asked, then says it is gone.
const FLAKY: &str = "did:plc:flakyaaaaaaaaaaaaaaaaaa";

struct Stand {
    base: String,
    /// A port nothing listens on.
    closed: String,
    asked: AtomicUsize,
}

fn doc(did: &str, pds: &str) -> Value {
    json!({
        "id": did,
        "service": [{
            "id": "#atproto_pds",
            "type": "AtprotoPersonalDataServer",
            "serviceEndpoint": pds,
        }],
    })
}

/// A status the host holds `did` at, not active.
fn inactive(did: &str, status: &str) -> Response {
    Json(json!({ "did": did, "active": false, "status": status })).into_response()
}

async fn answer(
    State(stand): State<Arc<Stand>>,
    uri: Uri,
    Query(q): Query<HashMap<String, String>>,
) -> Response {
    let refused = |status: StatusCode, error: &str| {
        let body = json!({ "error": error, "message": error });
        (status, Json(body)).into_response()
    };
    if uri.path() == "/xrpc/com.atproto.sync.getRepoStatus" {
        let did = q["did"].as_str();
        return match did {
            HERE => Json(json!({ "did": did, "active": true })).into_response(),
            DELETED | FLAKY => inactive(did, "deleted"),
            DEACTIVATED => inactive(did, "deactivated"),
            SUSPENDED => inactive(did, "suspended"),
            NO_REPO => refused(StatusCode::BAD_REQUEST, "RepoNotFound"),
            HOST_DOWN => refused(StatusCode::BAD_GATEWAY, "InternalServerError"),
            _ => Json(json!({ "did": did })).into_response(),
        };
    }
    let did = uri.path().trim_start_matches('/');
    match did {
        TOMBSTONE => refused(StatusCode::GONE, "DID not available"),
        PLC_DOWN => refused(StatusCode::SERVICE_UNAVAILABLE, "down"),
        FLAKY if stand.asked.fetch_add(1, Ordering::SeqCst) == 0 => {
            refused(StatusCode::INTERNAL_SERVER_ERROR, "busy")
        }
        UNREACHABLE => Json(doc(did, &stand.closed)).into_response(),
        NO_HOST => Json(json!({ "id": did, "service": [] })).into_response(),
        HERE | DELETED | DEACTIVATED | SUSPENDED | NO_REPO | HOST_DOWN | ODD | FLAKY => {
            Json(doc(did, &stand.base)).into_response()
        }
        _ => refused(StatusCode::NOT_FOUND, "DID not registered"),
    }
}

/// The stand-in, and a context that reads identities from it.
async fn stand_in() -> grain::env::Ctx {
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let base = format!("http://{}", listener.local_addr().unwrap());
    let closed = {
        let spare = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
        format!("http://{}", spare.local_addr().unwrap())
    };
    let stand = Arc::new(Stand {
        base: base.clone(),
        closed,
        asked: AtomicUsize::new(0),
    });
    let app = Router::new().fallback(answer).with_state(stand);
    tokio::spawn(async move { axum::serve(listener, app).await });
    let env = grain::env::Env::from_vars(|name| match name {
        "GRAIN_PLC_URL" => Some(base.clone()),
        "GRAIN_ALLOW_PRIVATE" => Some("1".into()),
        _ => None,
    });
    grain::env::Ctx::new(env)
}

/// Quick to try again, and soon done.
const BRIEF: Patience = Patience {
    first: Duration::from_millis(10),
    most: Duration::from_millis(20),
    tries: 3,
};

#[tokio::test]
async fn only_an_answer_that_says_so_is_gone() {
    let ctx = stand_in().await;
    // Active, or inactive in a way that can be undone: still there.
    for did in [HERE, DEACTIVATED, SUSPENDED] {
        assert_eq!(accounts::gone(&ctx, did).await, Asked::Active, "{did}");
    }
    for did in [DELETED, NO_REPO, TOMBSTONE, NEVER] {
        assert_eq!(accounts::gone(&ctx, did).await, Asked::Gone, "{did}");
    }
    for did in [PLC_DOWN, HOST_DOWN, UNREACHABLE, ODD, NO_HOST] {
        let asked = accounts::gone(&ctx, did).await;
        assert!(matches!(asked, Asked::Unknown(_)), "{did}: {asked:?}");
    }
}

#[tokio::test]
async fn an_account_not_settled_is_asked_again_then_kept() {
    let ctx = stand_in().await;
    let index = Arc::new(Index::memory().unwrap());
    let prefer = |did: &str| {
        index
            .read(|db| {
                db.execute(
                    "INSERT INTO preference VALUES (?1, 'theme', '\"dark\"', '')",
                    [did],
                )
            })
            .unwrap();
    };
    let prefers = |did: &str| -> i64 {
        index.read(|db| {
            db.query_row(
                "SELECT count(*) FROM preference WHERE did = ?1",
                [did],
                |r| r.get(0),
            )
            .unwrap()
        })
    };
    for did in [HERE, DEACTIVATED, FLAKY, PLC_DOWN, TOMBSTONE] {
        index.track(did).unwrap();
        prefer(did);
    }
    assert_eq!(
        accounts::settle(&index, &ctx, HERE, BRIEF).await,
        Settled::Kept
    );
    // Deactivated where it lives: kept, with what grain keeps for it.
    assert_eq!(
        accounts::settle(&index, &ctx, DEACTIVATED, BRIEF).await,
        Settled::Kept
    );
    assert_eq!(prefers(DEACTIVATED), 1);
    assert_eq!(index.host_status(DEACTIVATED).unwrap(), None);
    // PLC fails once, then the host says it was deleted.
    assert_eq!(
        accounts::settle(&index, &ctx, FLAKY, BRIEF).await,
        Settled::Purged
    );
    assert_eq!(
        accounts::settle(&index, &ctx, PLC_DOWN, BRIEF).await,
        Settled::GaveUp
    );
    assert_eq!(
        (prefers(HERE), prefers(FLAKY), prefers(PLC_DOWN)),
        (1, 0, 1)
    );
    assert_eq!(index.host_status(PLC_DOWN).unwrap(), None);

    // As the stream sends them, each asked after on its own.
    let (to, told) = tokio::sync::mpsc::unbounded_channel();
    let watching = tokio::spawn(accounts::deletions(index.clone(), ctx.clone(), told, BRIEF));
    to.send(TOMBSTONE.to_string()).unwrap();
    to.send(PLC_DOWN.to_string()).unwrap();
    drop(to);
    watching.await.unwrap();
    assert_eq!((prefers(TOMBSTONE), prefers(PLC_DOWN)), (0, 1));
    assert_eq!(
        index.host_status(TOMBSTONE).unwrap().as_deref(),
        Some("deleted")
    );
}

#[test]
fn patience_is_about_half_an_hour() {
    let p = Patience::default();
    assert_eq!((p.first.as_secs(), p.most.as_secs(), p.tries), (30, 600, 6));
}

//! The index fed from Jetstream: a stand-in serves subscribeEvents frames
//! on a local socket, and the index fills from what they carry.

use futures::SinkExt;
use grain::env::{Ctx, Env};
use grain::jetstream::Timing;
use grain_serve::Settings;
use grain_serve::index::records::{BskyPost, Gallery, Profile};
use grain_serve::index::{Index, Row};
use grain_serve::jetstream::{self, source};
use serde_json::{Value, json};
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Duration;
use tokio::sync::mpsc;
use tokio_tungstenite::tungstenite::handshake::server::{ErrorResponse, Request, Response};
use tokio_tungstenite::tungstenite::{Message, http};

const KIND: &str = "network.bsky.jetstream.subscribeEvents#";
const ALICE: &str = "did:plc:alice";
const BOB: &str = "did:plc:bob";
const CAROL: &str = "did:plc:carol";
const CID: &str = "bafyreia4w4bbvc5lqzkvexqlbwbagz5yfjfzzrqhfwqkhkk2xgekh4c6ai";
const EDITED: &str = "bafyreia4w4bbvc5lqzkvexqlbwbagz5yfjfzzrqhfwqkhkk2xgekh4c6aj";
const NOW: &str = "2026-10-31T12:00:00.000Z";
const KEY: &str = "3l3qo2vuowo2a";

/// What the stand-in does with a connection.
enum Plan {
    /// Refuses the handshake, as Jetstream does a cursor it no longer keeps.
    Refuse,
    /// Sends these frames, then closes.
    Send(Vec<Message>),
    /// Says nothing, and answers no ping.
    Silent,
}

fn message(payload: Value) -> Message {
    Message::Text(
        json!({"$type": "message", "payload": payload})
            .to_string()
            .into(),
    )
}

fn commit(
    seq: i64,
    did: &str,
    op: &str,
    collection: &str,
    cid: &str,
    record: Option<Value>,
) -> Message {
    let mut payload = json!({
        "$type": format!("{KIND}commit"), "seq": seq, "did": did, "time": NOW, "rev": rev(seq),
        "operation": op, "collection": collection, "rkey": KEY,
    });
    if let Some(mut record) = record {
        record["$type"] = collection.into();
        payload["record"] = record;
        payload["cid"] = cid.into();
    }
    message(payload)
}

/// The revision a stand-in commit of `seq` makes: later as `seq` is.
fn rev(seq: i64) -> String {
    grain::keys::tid_from(1_700_000_000_000_000 + seq as u64, 0)
}

/// `commit`, as a stream that names no revision sends it.
fn unrevved(commit: Message) -> Message {
    let mut frame: Value = serde_json::from_str(commit.to_text().unwrap()).unwrap();
    frame["payload"].as_object_mut().unwrap().remove("rev");
    Message::Text(frame.to_string().into())
}

fn account(seq: i64, did: &str, active: bool, status: Option<&str>) -> Message {
    let mut account = json!({"did": did, "active": active});
    if let Some(status) = status {
        account["status"] = status.into();
    }
    message(json!({"$type": format!("{KIND}account"), "seq": seq, "did": did, "account": account}))
}

fn gallery(title: &str) -> Option<Value> {
    Some(json!({"title": title, "createdAt": NOW}))
}

fn profile() -> Option<Value> {
    Some(json!({"displayName": "Alice"}))
}

fn uri(did: &str, collection: &str) -> String {
    format!("at://{did}/{collection}/{KEY}")
}

/// A stand-in Jetstream: each connection's request URI is sent on the
/// receiver, and `plan` says what is done with it.
// The handshake callback's error type is tungstenite's, not ours.
#[allow(clippy::result_large_err)]
async fn stand_in(
    plan: impl Fn(usize, &str) -> Plan + Send + Sync + 'static,
) -> (String, mpsc::UnboundedReceiver<String>) {
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let url = format!("ws://{}", listener.local_addr().unwrap());
    let (asked, asks) = mpsc::unbounded_channel();
    let plan = Arc::new(plan);
    tokio::spawn(async move {
        for n in 0..=usize::MAX {
            let (tcp, _) = listener.accept().await.unwrap();
            let (plan, asked) = (plan.clone(), asked.clone());
            tokio::spawn(async move {
                let mut planned = None;
                let callback =
                    |req: &Request, mut res: Response| -> Result<Response, ErrorResponse> {
                        let uri = req.uri().to_string();
                        let protocol = req.headers()["sec-websocket-protocol"].clone();
                        assert_eq!(protocol, "xrpc.v1.json");
                        let _ = asked.send(uri.clone());
                        match plan(n, &uri) {
                            Plan::Refuse => {
                                let refused = http::Response::builder().status(400);
                                Err(refused.body(Some("OutdatedCursor".into())).unwrap())
                            }
                            other => {
                                planned = Some(other);
                                res.headers_mut().insert("sec-websocket-protocol", protocol);
                                Ok(res)
                            }
                        }
                    };
                let Ok(mut ws) = tokio_tungstenite::accept_hdr_async(tcp, callback).await else {
                    return;
                };
                match planned {
                    Some(Plan::Send(frames)) => {
                        for frame in frames {
                            let _ = ws.send(frame).await;
                        }
                        let _ = ws.close(None).await;
                    }
                    _ => tokio::time::sleep(Duration::from_secs(30)).await,
                }
            });
        }
    });
    (url, asks)
}

fn fast(idle: Duration) -> Timing {
    Timing {
        retry: Duration::from_millis(10),
        retry_max: Duration::from_millis(80),
        idle,
    }
}

async fn wait_until(mut f: impl FnMut() -> bool) {
    for _ in 0..400 {
        if f() {
            return;
        }
        tokio::time::sleep(Duration::from_millis(25)).await;
    }
    panic!("condition never held");
}

fn gallery_of(index: &Index, did: &str) -> Option<Row<Gallery>> {
    index
        .get::<Gallery>(&uri(did, "social.grain.gallery"))
        .unwrap()
}

#[tokio::test(flavor = "multi_thread")]
async fn the_index_fills_from_jetstream() {
    let (url, mut asks) = stand_in(|n, _| match n {
        0 => Plan::Send(vec![
            // Not yet tracked: passed by.
            commit(1, ALICE, "create", "social.grain.gallery", CID, gallery("Early")),
            // A grain profile makes an account tracked.
            commit(2, ALICE, "create", "social.grain.actor.profile", CID, profile()),
            commit(3, ALICE, "create", "social.grain.gallery", CID, gallery("Fog")),
            commit(4, BOB, "create", "social.grain.gallery", CID, gallery("Bob's")),
            commit(5, BOB, "create", "app.bsky.feed.post", CID, Some(json!({"text": "elsewhere", "createdAt": NOW}))),
            // A record that does not fit is skipped, and the stream goes on.
            commit(6, ALICE, "create", "social.grain.comment", CID, Some(json!({"text": "no subject", "createdAt": NOW}))),
            Message::Text("not json".into()),
            Message::Binary(vec![1].into()),
            Message::Text(r#"{"$type":"error","error":"ConsumerTooSlow"}"#.into()),
            commit(7, ALICE, "create", "app.bsky.feed.like", CID, Some(json!({}))),
            message(json!({"$type": format!("{KIND}info"), "name": "OutdatedCursor", "message": "from 7"})),
            commit(8, ALICE, "update", "social.grain.gallery", EDITED, gallery("Fog, edited")),
            message(json!({"$type": format!("{KIND}identity"), "seq": 9, "did": ALICE,
                "identity": {"did": ALICE, "handle": "alice.test"}})),
            message(json!({"$type": format!("{KIND}identity"), "seq": 10, "did": BOB,
                "identity": {"did": BOB, "handle": "bob.test"}})),
            commit(11, ALICE, "create", "app.bsky.feed.post", CID, Some(json!({"text": "new gallery", "createdAt": NOW}))),
            // A create with no record says nothing to keep.
            commit(12, ALICE, "create", "social.grain.photo", CID, None),
        ]),
        1 => Plan::Send(vec![
            commit(13, ALICE, "delete", "social.grain.gallery", CID, None),
            account(14, ALICE, false, Some("deactivated")),
            account(15, ALICE, false, Some("throttled")),
            account(16, BOB, false, Some("deleted")),
        ]),
        2 => Plan::Send(vec![
            account(17, ALICE, true, None),
            account(18, ALICE, false, Some("deleted")),
        ]),
        _ => Plan::Send(vec![]),
    })
    .await;
    let dir = tempfile::tempdir().unwrap();
    let index = Arc::new(Index::open(&dir.path().join("index.db")).unwrap());
    let follow = jetstream::follow(
        index.clone(),
        url.clone(),
        fast(Duration::from_secs(5)),
        Duration::ZERO,
        None,
    );
    let following = tokio::spawn(follow);

    // It asks for the collections the index keeps, from the live tip.
    let first = asks.recv().await.unwrap();
    assert!(
        first.starts_with(
            "/xrpc/network.bsky.jetstream.subscribeEvents?collections=social.grain.gallery&"
        ),
        "{first}"
    );
    assert!(
        first.contains("collections=app.bsky.feed.post&") && first.contains("kinds=account"),
        "{first}"
    );
    assert!(!first.contains("cursor"), "{first}");

    // Each connection after starts where the last left off.
    assert!(asks.recv().await.unwrap().ends_with("&cursor=12"));
    assert!(asks.recv().await.unwrap().ends_with("&cursor=16"));
    wait_until(|| index.cursor(&source(&url)).unwrap() == Some(18)).await;

    // What alice wrote was kept, edited and deleted as she did; bob is not
    // tracked, and what he wrote passed by.
    assert!(index.tracks(ALICE) && !index.tracks(BOB));
    assert_eq!(gallery_of(&index, BOB), None);
    assert_eq!(
        index.repo(ALICE).unwrap().unwrap().0.as_deref(),
        Some("alice.test")
    );
    assert_eq!(index.repo(BOB).unwrap(), None);
    assert_eq!(
        index.host_status(ALICE).unwrap().as_deref(),
        Some("deleted")
    );
    // Deleted, her records went with her.
    assert_eq!(
        index
            .get::<Profile>(&uri(ALICE, "social.grain.actor.profile"))
            .unwrap(),
        None
    );
    assert_eq!(
        index
            .get::<BskyPost>(&uri(ALICE, "app.bsky.feed.post"))
            .unwrap(),
        None
    );
    following.abort();
    let _ = following.await;

    // Started again, it resumes where it was read to.
    while asks.try_recv().is_ok() {}
    let again = tokio::spawn(jetstream::follow(
        index.clone(),
        url.clone(),
        fast(Duration::from_secs(5)),
        Duration::ZERO,
        None,
    ));
    let resumed = asks.recv().await.unwrap();
    assert!(resumed.ends_with("&cursor=18"), "{resumed}");
    again.abort();
}

#[tokio::test(flavor = "multi_thread")]
async fn the_index_follows_writes_as_they_come() {
    // The delete waits until the edit has been seen: until then, each
    // connection after the first ends with nothing said.
    let edited = Arc::new(AtomicBool::new(false));
    let seen = edited.clone();
    let (url, mut asks) = stand_in(move |n, _| match n {
        0 => Plan::Send(vec![
            commit(
                1,
                ALICE,
                "create",
                "social.grain.actor.profile",
                CID,
                profile(),
            ),
            commit(
                2,
                ALICE,
                "create",
                "social.grain.gallery",
                CID,
                gallery("Fog"),
            ),
            commit(
                3,
                ALICE,
                "update",
                "social.grain.gallery",
                EDITED,
                gallery("Fog, edited"),
            ),
            account(4, ALICE, false, Some("deactivated")),
        ]),
        _ if seen.load(Ordering::SeqCst) => Plan::Send(vec![commit(
            5,
            ALICE,
            "delete",
            "social.grain.gallery",
            CID,
            None,
        )]),
        _ => Plan::Send(vec![]),
    })
    .await;
    let index = Arc::new(Index::memory().unwrap());
    let following = tokio::spawn(jetstream::follow(
        index.clone(),
        url,
        fast(Duration::from_secs(5)),
        Duration::from_secs(60),
        // Asking a host after each account deleted, though none is.
        Some(grain::env::Ctx::new(grain::env::Env::from_vars(|_| None))),
    ));
    asks.recv().await.unwrap();
    wait_until(|| gallery_of(&index, ALICE).is_some_and(|g| g.record.title == "Fog, edited")).await;
    assert_eq!(gallery_of(&index, ALICE).unwrap().cid, EDITED);
    assert_eq!(
        index.host_status(ALICE).unwrap().as_deref(),
        Some("deactivated")
    );
    edited.store(true, Ordering::SeqCst);
    assert!(asks.recv().await.unwrap().ends_with("&cursor=4"));
    wait_until(|| gallery_of(&index, ALICE).is_none()).await;
    following.abort();
}

#[tokio::test(flavor = "multi_thread")]
async fn a_cursor_past_retention_is_given_up() {
    let (url, mut asks) = stand_in(|_, uri| match uri {
        u if u.contains("cursor=5") => Plan::Refuse,
        u if u.contains("cursor=") => Plan::Send(vec![]),
        _ => Plan::Send(vec![commit(
            100,
            ALICE,
            "create",
            "social.grain.actor.profile",
            CID,
            profile(),
        )]),
    })
    .await;
    let index = Arc::new(Index::memory().unwrap());
    index.set_cursor(&source(&url), 5).unwrap();
    let following = tokio::spawn(jetstream::follow(
        index.clone(),
        url.clone(),
        fast(Duration::from_secs(5)),
        Duration::ZERO,
        None,
    ));
    // Refused at its cursor three times, it asks for the live tip.
    for _ in 0..3 {
        assert!(asks.recv().await.unwrap().ends_with("&cursor=5"));
    }
    let probe = asks.recv().await.unwrap();
    assert!(!probe.contains("cursor="), "{probe}");
    // And goes on from there, the old cursor given up.
    assert!(asks.recv().await.unwrap().ends_with("&cursor=100"));
    assert_eq!(index.cursor(&source(&url)).unwrap(), Some(100));
    assert!(index.tracks(ALICE));
    following.abort();
}

#[tokio::test(flavor = "multi_thread")]
async fn a_cursor_given_up_is_not_offered_again() {
    let (url, mut asks) = stand_in(|_, uri| match uri {
        u if u.contains("cursor=5") => Plan::Refuse,
        _ => Plan::Send(vec![]),
    })
    .await;
    let index = Arc::new(Index::memory().unwrap());
    index.set_cursor(&source(&url), 5).unwrap();
    let following = tokio::spawn(jetstream::follow(
        index.clone(),
        url.clone(),
        fast(Duration::from_secs(5)),
        Duration::ZERO,
        None,
    ));
    for _ in 0..3 {
        assert!(asks.recv().await.unwrap().ends_with("&cursor=5"));
    }
    // The live tip ends before it says anything: the old cursor is gone
    // all the same, and it is the live tip that is asked for again.
    assert!(!asks.recv().await.unwrap().contains("cursor="));
    assert!(!asks.recv().await.unwrap().contains("cursor="));
    assert_eq!(index.cursor(&source(&url)).unwrap(), None);
    following.abort();
}

#[tokio::test(flavor = "multi_thread")]
async fn an_instance_that_is_down_keeps_the_cursor() {
    let (url, mut asks) = stand_in(|_, _| Plan::Refuse).await;
    let index = Arc::new(Index::memory().unwrap());
    index.set_cursor(&source(&url), 5).unwrap();
    let following = tokio::spawn(jetstream::follow(
        index.clone(),
        url.clone(),
        fast(Duration::from_secs(5)),
        Duration::ZERO,
        None,
    ));
    let mut asked = Vec::new();
    for _ in 0..7 {
        asked.push(asks.recv().await.unwrap());
    }
    // Every third attempt probes the live tip; refused too, the cursor is
    // kept for the next.
    let cursors: Vec<bool> = asked.iter().map(|u| u.ends_with("&cursor=5")).collect();
    assert_eq!(cursors, [true, true, true, false, true, true, false]);
    assert_eq!(index.cursor(&source(&url)).unwrap(), Some(5));
    following.abort();
}

#[tokio::test(flavor = "multi_thread")]
async fn a_silent_jetstream_is_left() {
    let (url, mut asks) = stand_in(|n, _| match n {
        0 => Plan::Silent,
        _ => Plan::Send(vec![]),
    })
    .await;
    let index = Arc::new(Index::memory().unwrap());
    let following = tokio::spawn(jetstream::follow(
        index,
        url,
        fast(Duration::from_millis(100)),
        Duration::ZERO,
        None,
    ));
    asks.recv().await.unwrap();
    // Silent through a ping, it is given up and made again.
    let again = tokio::time::timeout(Duration::from_secs(5), asks.recv()).await;
    assert!(again.unwrap().is_some());
    following.abort();
}

#[tokio::test(flavor = "multi_thread")]
async fn an_index_that_fails_does_not_stop_the_stream() {
    let (url, mut asks) = stand_in(|n, _| match n {
        0 => Plan::Send(vec![
            commit(
                1,
                ALICE,
                "create",
                "social.grain.actor.profile",
                CID,
                profile(),
            ),
            commit(
                2,
                ALICE,
                "create",
                "social.grain.gallery",
                CID,
                gallery("Fog"),
            ),
        ]),
        _ => Plan::Send(vec![]),
    })
    .await;
    let index = Arc::new(Index::memory().unwrap());
    index.read(|db| {
        // Search's triggers on repo read gallery too.
        db.execute_batch(
            "DROP TABLE gallery; DROP TABLE stream_cursor;
             DROP TRIGGER repo_search_insert; DROP TRIGGER repo_search_handle;",
        )
        .unwrap()
    });
    let following = tokio::spawn(jetstream::follow(
        index.clone(),
        url,
        fast(Duration::from_secs(5)),
        Duration::ZERO,
        None,
    ));
    asks.recv().await.unwrap();
    // Neither the gallery nor the cursor could be kept; the profile was,
    // and it connects again all the same.
    asks.recv().await.unwrap();
    assert!(
        index
            .get::<Profile>(&uri(ALICE, "social.grain.actor.profile"))
            .unwrap()
            .is_some()
    );
    following.abort();
}

#[tokio::test(flavor = "multi_thread")]
async fn a_write_older_than_the_index_has_is_left() {
    let deleting = Arc::new(AtomicBool::new(false));
    let delete = deleting.clone();
    let (url, _asks) = stand_in(move |n, _| match n {
        0 => Plan::Send(vec![
            commit(
                5,
                ALICE,
                "update",
                "social.grain.gallery",
                EDITED,
                gallery("Older"),
            ),
            commit(6, ALICE, "delete", "social.grain.gallery", CID, None),
            unrevved(commit(
                7,
                ALICE,
                "create",
                "social.grain.actor.profile",
                CID,
                profile(),
            )),
        ]),
        _ if delete.load(Ordering::SeqCst) => Plan::Send(vec![unrevved(commit(
            8,
            ALICE,
            "delete",
            "social.grain.gallery",
            CID,
            None,
        ))]),
        _ => Plan::Send(vec![]),
    })
    .await;
    let index = Arc::new(Index::memory().unwrap());
    index.track(ALICE).unwrap();
    // A backfill read the gallery at a revision after the stream's two.
    let held = uri(ALICE, "social.grain.gallery");
    let mut newer = gallery("Newer").unwrap();
    newer["$type"] = "social.grain.gallery".into();
    index.put_rev(&held, CID, &newer, &rev(10)).unwrap();
    let following = tokio::spawn(jetstream::follow(
        index.clone(),
        url,
        fast(Duration::from_secs(5)),
        Duration::from_secs(60),
        None,
    ));
    let profile_uri = uri(ALICE, "social.grain.actor.profile");
    wait_until(|| index.get::<Profile>(&profile_uri).unwrap().is_some()).await;
    let kept = gallery_of(&index, ALICE).unwrap();
    assert_eq!(
        (kept.record.title.as_str(), kept.cid.as_str()),
        ("Newer", CID)
    );
    // One that names no revision is applied as it comes.
    deleting.store(true, Ordering::SeqCst);
    wait_until(|| gallery_of(&index, ALICE).is_none()).await;
    following.abort();
}

#[tokio::test(flavor = "multi_thread")]
async fn accounts_new_or_back_are_queued_for_backfill() {
    let (url, _asks) = stand_in(|n, _| match n {
        0 => Plan::Send(vec![
            account(1, ALICE, true, None),
            account(2, BOB, true, None),
            commit(
                3,
                CAROL,
                "create",
                "social.grain.actor.profile",
                CID,
                profile(),
            ),
        ]),
        _ => Plan::Send(vec![]),
    })
    .await;
    let index = Arc::new(Index::memory().unwrap());
    // Alice's read failed for good, then her host said she was gone; Bob's
    // failed, and his host never said so.
    for did in [ALICE, BOB] {
        index.track(did).unwrap();
        index.backfill_failed(did, "unreachable", None).unwrap();
    }
    index.set_host_status(ALICE, Some("deactivated")).unwrap();
    let following = tokio::spawn(jetstream::follow(
        index.clone(),
        url,
        fast(Duration::from_secs(5)),
        Duration::from_secs(60),
        None,
    ));
    // Her profile is put after she is queued.
    let carols = uri(CAROL, "social.grain.actor.profile");
    wait_until(|| index.get::<Profile>(&carols).unwrap().is_some()).await;
    let alice = index.queued(ALICE).unwrap().unwrap();
    assert_eq!((alice.state.as_str(), alice.retry_count), ("pending", 0));
    assert_eq!(index.host_status(ALICE).unwrap(), None);
    assert_eq!(index.queued(BOB).unwrap().unwrap().state, "failed");
    let carol = index.queued(CAROL).unwrap().unwrap();
    assert_eq!((carol.state.as_str(), carol.retry_after), ("pending", 0));
    following.abort();
}

#[tokio::test(flavor = "multi_thread")]
async fn settings() {
    let vars = |pairs: &'static [(&'static str, &'static str)]| {
        move |name: &str| {
            pairs
                .iter()
                .find(|(k, _)| *k == name)
                .map(|(_, v)| v.to_string())
        }
    };
    let parse = |args: &[&str]| {
        let all = std::iter::once("grain-serve").chain(args.iter().copied());
        let all: Vec<String> = all.map(str::to_string).collect();
        Settings::parse(&all, vars(&[])).unwrap()
    };
    assert_eq!(parse(&[]), Settings::default());
    let off = parse(&["--jetstream", "", "--index", ""]);
    assert_eq!(off, Settings::default());
    let on = parse(&["--jetstream", jetstream::DEFAULT, "--index", "i.db"]);
    assert_eq!(on.jetstream.as_deref(), Some(jetstream::DEFAULT));
    assert_eq!(on.index.as_deref(), Some(std::path::Path::new("i.db")));
    let other = parse(&["--jetstream", "ws://h"]);
    assert_eq!(other.jetstream.as_deref(), Some("ws://h"));
    let ctx = || Ctx::new(Env::from_vars(|_| None));
    let refused = other.follow(&other.app(ctx()).unwrap());
    assert_eq!(
        refused.unwrap_err().to_string(),
        "--jetstream needs --index"
    );
    let bare = Settings::default();
    assert!(!bare.follow(&bare.app(ctx()).unwrap()).unwrap());

    // With both, it follows the Jetstream into the index.
    let (url, mut asks) = stand_in(|_, _| Plan::Send(vec![])).await;
    let dir = tempfile::tempdir().unwrap();
    let both = Settings {
        index: Some(dir.path().join("index.db")),
        jetstream: Some(url),
        ..Settings::default()
    };
    assert!(both.follow(&both.app(ctx()).unwrap()).unwrap());
    assert!(asks.recv().await.unwrap().contains("subscribeEvents"));
}

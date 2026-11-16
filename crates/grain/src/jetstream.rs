//! Jetstream v2 (`network.bsky.jetstream.subscribeEvents`), the firehose
//! re-encoded as JSON and filtered server side: its endpoint, what its
//! frames say, and a reader that follows it from a cursor through
//! dropped connections.
//!
//! Jetstream frames are not signed: a record is what the Jetstream
//! operator says the commit held, the same trust a reader places in the
//! relay it follows.

use futures::{SinkExt, StreamExt};
use serde_json::Value;
use std::time::Duration;
use tokio_tungstenite::tungstenite::Message;
use tokio_tungstenite::tungstenite::client::IntoClientRequest;
use tokio_tungstenite::tungstenite::http::HeaderValue;
use tokio_tungstenite::{MaybeTlsStream, WebSocketStream};

/// The one framing the endpoint speaks.
pub const SUBPROTOCOL: &str = "xrpc.v1.json";

/// The payload `$type`s, after this prefix, name the event kind.
const KIND: &str = "network.bsky.jetstream.subscribeEvents#";

/// What a frame says happened.
#[derive(Debug, Clone, PartialEq)]
pub struct Event {
    pub seq: Option<i64>,
    pub what: What,
}

#[derive(Debug, Clone, PartialEq)]
pub enum What {
    /// A write to a repository.
    Commit { did: String, op: Op },
    /// The account's identity changed: its handle, say, when given.
    Identity { did: String, handle: Option<String> },
    /// What the account's host says of it: active, or why it is not.
    Account {
        did: String,
        active: bool,
        status: Option<String>,
    },
    /// Jetstream telling the reader something: `OutdatedCursor`, say.
    Info {
        name: String,
        message: Option<String>,
    },
    /// Anything else, or a payload missing what its kind needs.
    Other,
}

#[derive(Debug, Clone, PartialEq)]
pub struct Op {
    /// `create`, `update` or `delete`.
    pub action: String,
    pub collection: String,
    pub rkey: String,
    /// The record's CID and the record, as written; neither on a delete.
    pub cid: Option<String>,
    pub record: Option<Value>,
    /// The revision of the repo the commit made.
    pub rev: Option<String>,
}

/// The subscribeEvents endpoint of the Jetstream at `base`, for commits to
/// `collections` and every account's identity and account events, from
/// `cursor`, which it replays inclusively.
pub fn endpoint(base: &str, collections: &[&str], cursor: Option<i64>) -> String {
    let mut url = base.trim_end_matches('/').to_string();
    url.push_str("/xrpc/network.bsky.jetstream.subscribeEvents?");
    for collection in collections {
        url.push_str(&format!("collections={collection}&"));
    }
    url.push_str("kinds=commit&kinds=identity&kinds=account");
    if let Some(c) = cursor {
        url.push_str(&format!("&cursor={c}"));
    }
    url
}

/// Reads a text frame. `None` when it is not a message: an error frame, or
/// not Jetstream at all.
pub fn parse(frame: &str) -> Option<Event> {
    let mut frame: Value = serde_json::from_str(frame).ok()?;
    if frame["$type"] != "message" {
        return None;
    }
    let mut p = frame["payload"].take();
    let kind = p["$type"].as_str()?.strip_prefix(KIND)?.to_string();
    let text = |v: &Value| v.as_str().map(str::to_string);
    let did = text(&p["did"]);
    let what = match (kind.as_str(), did) {
        ("commit", Some(did)) => match (
            text(&p["operation"]),
            text(&p["collection"]),
            text(&p["rkey"]),
        ) {
            (Some(action), Some(collection), Some(rkey)) => What::Commit {
                did,
                op: Op {
                    action,
                    collection,
                    rkey,
                    cid: text(&p["cid"]),
                    record: p.get_mut("record").map(Value::take),
                    rev: text(&p["rev"]),
                },
            },
            _ => What::Other,
        },
        // Their fields under their own names, `identity` and `account`, or
        // beside `did`, as the firehose has them.
        ("identity", Some(did)) => What::Identity {
            handle: text(&p["identity"]["handle"]).or(text(&p["handle"])),
            did,
        },
        ("account", Some(did)) => {
            let field = |name: &str| p["account"].get(name).or(p.get(name)).cloned();
            What::Account {
                active: field("active") == Some(Value::Bool(true)),
                status: field("status").as_ref().and_then(text),
                did,
            }
        }
        ("info", _) => What::Info {
            name: text(&p["name"]).unwrap_or_default(),
            message: text(&p["message"]),
        },
        _ => What::Other,
    };
    Some(Event {
        seq: p["seq"].as_i64(),
        what,
    })
}

/// How [`follow`] waits.
#[derive(Debug, Clone, Copy)]
pub struct Timing {
    /// After a connection ends, and after the first attempt that fails,
    /// doubling with each that fails after it up to `retry_max`.
    pub retry: Duration,
    pub retry_max: Duration,
    /// How long a connection may stay silent before it is pinged, and
    /// then before it is given up on.
    pub idle: Duration,
}

impl Default for Timing {
    fn default() -> Timing {
        Timing {
            retry: Duration::from_millis(500),
            retry_max: Duration::from_secs(60),
            idle: Duration::from_secs(60),
        }
    }
}

/// Of attempts refused in a row while offering a cursor, every this many
/// asks for the live tip instead.
///
/// Jetstream keeps about a day. One offered a cursor older than that may
/// refuse the handshake outright, and a reader that offers the same cursor
/// again is refused forever: nothing is heard, so the cursor never moves.
/// An attempt without one tells a dead cursor from a dead instance, since
/// a live instance always takes it: if it connects, the cursor was the
/// trouble and is given up; if it is refused too, the instance is down and
/// the cursor is kept, however long the outage.
pub const PROBE_EVERY: u32 = 3;

/// What a reader of Jetstream does as [`follow`] connects, hears, and
/// loses the connection.
pub trait Follower {
    /// Where the first connection starts: the last sequence number read
    /// before, which Jetstream replays.
    fn start(&mut self) -> Option<i64>;

    /// Whether an attempt connected.
    fn connected(&mut self, up: bool);

    /// Each event heard.
    fn event(&mut self, event: Event);

    /// Once a connection ends, or is given up as silent.
    fn ended(&mut self);

    /// That `cursor` was given up, as Jetstream no longer keeps it: what
    /// happened after it and before the live tip is not heard.
    fn cursor_lost(&mut self, cursor: i64);
}

/// A connection to Jetstream.
pub type Socket = WebSocketStream<MaybeTlsStream<tokio::net::TcpStream>>;

/// Follows Jetstream at `base` until the task is dropped, handing
/// `follower` each event of `collections`. Each connection starts at the
/// last sequence number heard, so a dropped one misses nothing Jetstream
/// still keeps.
pub async fn follow(
    base: String,
    collections: Vec<&'static str>,
    timing: Timing,
    mut follower: impl Follower,
) {
    let mut cursor = follower.start();
    let mut refused = 0;
    let mut wait = timing.retry;
    loop {
        let probe = refused > 0 && refused % PROBE_EVERY == 0;
        let offered = cursor.filter(|_| !probe);
        let connected = connect(&endpoint(&base, &collections, offered)).await;
        follower.connected(connected.is_some());
        match connected {
            Some(mut ws) => {
                if let Some(lost) = cursor.filter(|_| probe) {
                    follower.cursor_lost(lost);
                    cursor = None;
                }
                (refused, wait) = (0, timing.retry);
                frames(&mut ws, timing.idle, |msg| {
                    if let Message::Text(frame) = msg
                        && let Some(event) = parse(&frame)
                    {
                        cursor = event.seq.or(cursor);
                        follower.event(event);
                    }
                })
                .await;
                follower.ended();
            }
            None => {
                refused += 1;
                wait = (wait * 2).min(timing.retry_max);
            }
        }
        tokio::time::sleep(wait).await;
    }
}

/// Hands `each` the frames of `ws` until it ends, fails, or stays silent
/// through a ping: a connection gone half-open delivers nothing and never
/// ends, so without one a reader waits on it forever.
pub async fn frames(ws: &mut Socket, idle: Duration, mut each: impl FnMut(Message)) {
    let mut pinged = false;
    loop {
        match tokio::time::timeout(idle, ws.next()).await {
            Ok(Some(Ok(msg))) => {
                pinged = false;
                each(msg);
            }
            Ok(_) => return,
            Err(_) if pinged => return,
            // A failed send shows as silence on the next wait.
            Err(_) => {
                pinged = true;
                let _ = ws.send(Message::Ping(Default::default())).await;
            }
        }
    }
}

/// A connection to `url`; `None` when it is refused or cannot be made.
async fn connect(url: &str) -> Option<Socket> {
    let mut request = url.into_client_request().ok()?;
    let protocol = HeaderValue::from_static(SUBPROTOCOL);
    request
        .headers_mut()
        .insert("Sec-WebSocket-Protocol", protocol);
    let (ws, _) = tokio_tungstenite::connect_async(request).await.ok()?;
    Some(ws)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn message(payload: Value) -> String {
        json!({"$type": "message", "payload": payload}).to_string()
    }

    #[test]
    fn frames_say() {
        let created = message(json!({
            "$type": format!("{KIND}commit"), "seq": 42, "did": "did:plc:a", "operation": "create",
            "collection": "social.grain.gallery", "rkey": "k", "cid": "bafy",
            "record": {"$type": "social.grain.gallery", "title": "hi"}, "rev": "3l3qo2vuowo2a",
        }));
        let op = Op {
            action: "create".into(),
            collection: "social.grain.gallery".into(),
            rkey: "k".into(),
            cid: Some("bafy".into()),
            record: Some(json!({"$type": "social.grain.gallery", "title": "hi"})),
            rev: Some("3l3qo2vuowo2a".into()),
        };
        assert_eq!(
            parse(&created),
            Some(Event {
                seq: Some(42),
                what: What::Commit {
                    did: "did:plc:a".into(),
                    op
                }
            })
        );
        let deleted = message(
            json!({"$type": format!("{KIND}commit"), "seq": 43, "did": "did:plc:a",
            "operation": "delete", "collection": "social.grain.gallery", "rkey": "k"}),
        );
        let What::Commit { op, .. } = parse(&deleted).unwrap().what else {
            panic!()
        };
        assert_eq!((op.cid, op.record, op.rev), (None, None, None));
        let no_rkey = message(
            json!({"$type": format!("{KIND}commit"), "seq": 44, "did": "did:plc:a",
            "operation": "create", "collection": "social.grain.gallery"}),
        );
        assert_eq!(
            parse(&no_rkey),
            Some(Event {
                seq: Some(44),
                what: What::Other
            })
        );
        let identity = message(
            json!({"$type": format!("{KIND}identity"), "seq": 5, "did": "did:plc:b",
            "identity": {"did": "did:plc:b", "handle": "b.test"}}),
        );
        let said = What::Identity {
            did: "did:plc:b".into(),
            handle: Some("b.test".into()),
        };
        assert_eq!(parse(&identity).unwrap().what, said);
        let flat = message(
            json!({"$type": format!("{KIND}identity"), "did": "did:plc:b", "handle": "c.test"}),
        );
        let said = What::Identity {
            did: "did:plc:b".into(),
            handle: Some("c.test".into()),
        };
        assert_eq!(
            parse(&flat),
            Some(Event {
                seq: None,
                what: said
            })
        );
        let account = |fields: Value| {
            let mut payload =
                json!({"$type": format!("{KIND}account"), "seq": 6, "did": "did:plc:b"});
            payload
                .as_object_mut()
                .unwrap()
                .extend(fields.as_object().unwrap().clone());
            parse(&message(payload)).unwrap().what
        };
        let said = |active, status: Option<&str>| What::Account {
            did: "did:plc:b".into(),
            active,
            status: status.map(Into::into),
        };
        assert_eq!(
            account(json!({"account": {"active": true}})),
            said(true, None)
        );
        let deleted = account(json!({"account": {"active": false, "status": "deleted"}}));
        assert_eq!(deleted, said(false, Some("deleted")));
        let flat = account(json!({"active": false, "status": "takendown"}));
        assert_eq!(flat, said(false, Some("takendown")));
        let info = message(
            json!({"$type": format!("{KIND}info"), "name": "OutdatedCursor", "message": "from 200"}),
        );
        let said = What::Info {
            name: "OutdatedCursor".into(),
            message: Some("from 200".into()),
        };
        assert_eq!(parse(&info).unwrap().what, said);
        let nameless = message(json!({"$type": format!("{KIND}info")}));
        assert_eq!(
            parse(&nameless).unwrap().what,
            What::Info {
                name: "".into(),
                message: None
            }
        );
        let sync = message(json!({"$type": format!("{KIND}sync"), "seq": 7, "did": "did:plc:b"}));
        assert_eq!(
            parse(&sync),
            Some(Event {
                seq: Some(7),
                what: What::Other
            })
        );
        assert_eq!(
            parse(r#"{"$type":"error","error":"ConsumerTooSlow"}"#),
            None
        );
        assert_eq!(parse(&message(json!({"$type": "app.bsky.x"}))), None);
        assert_eq!(parse(&message(json!({}))), None);
        assert_eq!(parse("not json"), None);
    }

    #[test]
    fn endpoints() {
        let filter =
            "collections=a.b.c&collections=d.e.f&kinds=commit&kinds=identity&kinds=account";
        let path = "/xrpc/network.bsky.jetstream.subscribeEvents";
        assert_eq!(
            endpoint(
                "wss://jetstream.us-west.bsky.network/",
                &["a.b.c", "d.e.f"],
                None
            ),
            format!("wss://jetstream.us-west.bsky.network{path}?{filter}")
        );
        assert_eq!(
            endpoint("ws://h", &["a.b.c", "d.e.f"], Some(3)),
            format!("ws://h{path}?{filter}&cursor=3")
        );
        let timing = Timing::default();
        assert_eq!(
            (timing.retry, timing.idle),
            (Duration::from_millis(500), Duration::from_secs(60))
        );
        assert_eq!(timing.retry_max, Duration::from_secs(60));
    }
}

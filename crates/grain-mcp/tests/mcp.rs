//! grain-mcp driven by an MCP client, as an admin of grain-serve on a port
//! of its own, with service tokens from the reference PDS: everything it
//! does, and that nothing a child-safety report or label is about reaches
//! the client.

#[path = "../../grain/tests/common/mod.rs"]
mod net;

use grain::env::Ctx;
use grain_serve::App;
use grain_serve::index::moderation::NewReport;
use grain_serve::index::{Index, Label};
use rmcp::ServiceExt;
use rmcp::model::CallToolRequestParams;
use serde_json::{Value, json};
use std::sync::{Arc, Mutex};

const NOW: &str = "2026-10-31T12:00:00.000Z";
/// The appview's DID: one of where it serves would name its port, which
/// no atproto DID does.
const AUD: &str = "did:web:grain.test";
/// An account a child-safety report is about, and one with a `csae` label.
const BOB: &str = "did:plc:bob";
const DAVE: &str = "did:plc:dave";
/// An account with nothing about the safety of a child.
const CAROL: &str = "did:plc:carol";
/// What must never reach the client.
const SECRETS: &[&str] = &[
    "the words of the child-safety report",
    "a gallery a child-safety report is about",
    "a gallery of an account labeled csae",
    "a spam report on an account with a child-safety report",
];

struct World {
    base: String,
    index: Arc<Index>,
    dir: tempfile::TempDir,
}

async fn world(admin: &str) -> World {
    let dir = tempfile::tempdir().unwrap();
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let base = format!("http://{}", listener.local_addr().unwrap());
    let index = Arc::new(Index::memory().unwrap());
    let mut app = App::bare(net::ctx(&dir.path().join("serve"), &[]));
    app.index = Some(index.clone());
    app.did = Some(AUD.into());
    app.admins = vec![admin.to_string()];
    tokio::spawn(grain_serve::serve(listener, Arc::new(app)));
    for (did, handle, title) in [
        (BOB, "bob.test", SECRETS[1]),
        (DAVE, "dave.test", SECRETS[2]),
        (CAROL, "carol.test", "Carol's rocks"),
    ] {
        index.track(did).unwrap();
        index.set_handle(did, handle).unwrap();
        let uri = format!("at://{did}/social.grain.gallery/3l3qo2vuowo2a");
        let cid = grain::drisl::cid_text(&grain::drisl::cid(uri.as_bytes()));
        let record = json!({"$type": "social.grain.gallery", "title": title, "createdAt": NOW});
        index.put_at(&uri, &cid, &record, NOW).unwrap();
    }
    World { base, index, dir }
}

impl World {
    /// `account` on this machine, at this appview, logging in by password.
    fn ctx(&self, account: &net::Account) -> Ctx {
        net::ctx(
            &self.dir.path().join(&account.handle),
            &[
                ("GRAIN_APPVIEW", &self.base),
                ("GRAIN_APPVIEW_DID", AUD),
                ("GRAIN_IDENTIFIER", &account.did),
                ("GRAIN_PASSWORD", &account.password),
            ],
        )
    }
}

/// An MCP client of grain-mcp, keeping every text it is given.
struct Client {
    peer: rmcp::service::RunningService<rmcp::RoleClient, ()>,
    seen: Mutex<Vec<String>>,
}

impl Client {
    async fn of(ctx: Ctx) -> Client {
        let (server_io, client_io) = tokio::io::duplex(1 << 20);
        tokio::spawn(async move {
            let running = grain_mcp::Server::new(ctx).serve(server_io).await.unwrap();
            let _ = running.waiting().await;
        });
        let peer = ().serve(client_io).await.unwrap();
        Client {
            peer,
            seen: Mutex::default(),
        }
    }

    /// The tool's text, and whether it was an error.
    async fn call(&self, tool: &str, args: Value) -> (String, bool) {
        let params = CallToolRequestParams::new(tool.to_string())
            .with_arguments(args.as_object().unwrap().clone());
        let res = self.peer.call_tool(params).await.unwrap();
        let text = res.content[0].as_text().unwrap().text.clone();
        self.seen.lock().unwrap().push(text.clone());
        (text, res.is_error == Some(true))
    }

    async fn json(&self, tool: &str, args: Value) -> Value {
        let (text, err) = self.call(tool, args).await;
        assert!(!err, "{tool}: {text}");
        serde_json::from_str(&text).unwrap()
    }

    /// The tool's error.
    async fn refused(&self, tool: &str, args: Value) -> String {
        let (text, err) = self.call(tool, args).await;
        assert!(err, "{tool} was not refused: {text}");
        text
    }
}

#[tokio::test]
async fn an_admin_moderates_and_never_sees_what_child_safety_is_about() {
    let (admin, someone) = (net::account().await, net::account().await);
    let w = world(&admin.did).await;
    w.index
        .label(&Label {
            src: AUD.into(),
            uri: DAVE.into(),
            val: "csae".into(),
            neg: false,
            cts: NOW.into(),
            exp: None,
        })
        .unwrap();

    // Someone reports, by MCP too.
    let theirs = Client::of(w.ctx(&someone)).await;
    let args = json!({"subject": BOB, "reason": "child-safety", "text": SECRETS[0]});
    let csae = theirs.json("report", args).await["id"].as_i64().unwrap();
    let args = json!({"subject": CAROL, "reason": "spam", "text": "ads"});
    let spam = theirs.json("report", args).await["id"].as_i64().unwrap();
    let args = json!({"subject": BOB, "reason": "spam", "text": SECRETS[3]});
    let on_bob = theirs.json("report", args).await["id"].as_i64().unwrap();
    let why = theirs.refused("list_reports", json!({})).await;
    assert!(why.contains("is not an admin of this server"), "{why}");

    let c = Client::of(w.ctx(&admin)).await;

    // The tools say what they withhold.
    let tools = c.peer.list_all_tools().await.unwrap();
    for name in [
        "list_reports",
        "resolve_report",
        "takedown",
        "label",
        "account",
    ] {
        let tool = tools.iter().find(|t| t.name == name).unwrap();
        let about = tool.description.as_deref().unwrap_or_default();
        assert!(about.contains("child-safety"), "{name}: {about}");
        assert!(about.contains("grain command line"), "{name}: {about}");
    }
    let info = c.peer.peer_info().unwrap();
    let said = info.instructions.as_deref().unwrap();
    assert!(said.contains("never shown here"), "{said}");

    // A child-safety report is listed by its ids alone, and so is any
    // other report on its account.
    let listed = c.json("list_reports", json!({})).await;
    assert_eq!(listed["total"], 3);
    let reports = listed["reports"].as_array().unwrap();
    let of = |id: i64| reports.iter().find(|r| r["id"] == id).unwrap().clone();
    let (shown, plain) = (of(csae), of(spam));
    assert_eq!(shown["subject"], BOB);
    assert_eq!(shown["label"], "csae");
    assert_eq!(shown["status"], "open");
    assert_eq!(shown["withheld"], grain_mcp::HUMAN);
    assert!(shown.get("reason").is_none(), "{shown}");
    let beside = of(on_bob);
    assert_eq!(
        (&beside["label"], &beside["subjectDid"]),
        (&json!("spam"), &json!(BOB))
    );
    assert_eq!(beside["withheld"], grain_mcp::HUMAN);
    assert!(beside.get("reason").is_none(), "{beside}");
    assert_eq!(plain["reason"], "ads");
    let only = c
        .json("list_reports", json!({"label": "spam", "limit": 1}))
        .await;
    assert_eq!(only["reports"].as_array().unwrap().len(), 1);

    // An account with a child-safety report, or a csae label, is shown
    // without its records; one with neither, whole.
    for actor in [BOB, DAVE] {
        let account = c.json("account", json!({"actor": actor})).await;
        assert_eq!(account["childSafety"], true, "{account}");
        assert_eq!(account["withheld"], grain_mcp::HUMAN);
        assert!(account.get("records").is_none(), "{account}");
        assert_eq!(account["counts"][0]["count"], 1, "{account}");
    }
    let bob = c.json("account", json!({"actor": BOB})).await;
    let ids: Vec<&Value> = bob["reports"]
        .as_array()
        .unwrap()
        .iter()
        .map(|r| &r["id"])
        .collect();
    assert_eq!(ids.len(), 2, "{bob}");
    assert!(
        ids.contains(&&json!(csae)) && ids.contains(&&json!(on_bob)),
        "{bob}"
    );
    let carol = c.json("account", json!({"actor": CAROL})).await;
    assert_eq!(carol["childSafety"], false);
    assert_eq!(carol["records"][0]["value"]["title"], "Carol's rocks");
    assert_eq!(carol["reports"][0]["reason"], "ads");

    // A report child safety by its reason type alone, whatever label it
    // was filed under, is as much a person's.
    let by_reason = w
        .index
        .file_report(&NewReport {
            subject: DAVE,
            subject_did: DAVE,
            label: "other",
            reason_type: Some("tools.ozone.report.defs#reasonChildSafetyGroom"),
            reason: Some(SECRETS[0]),
            reported_by: &someone.did,
            created_at: NOW,
        })
        .unwrap()
        .id;
    let others = c.json("list_reports", json!({"label": "other"})).await;
    assert_eq!(others["reports"][0]["id"], by_reason);
    assert_eq!(others["reports"][0]["withheld"], grain_mcp::HUMAN);
    let args = json!({"id": by_reason, "action": "dismiss"});
    assert_eq!(c.refused("resolve_report", args).await, grain_mcp::HUMAN);
    assert_eq!(w.index.report(by_reason).unwrap().unwrap().status, "open");

    // Acting on child safety is for a person.
    for (tool, args) in [
        ("resolve_report", json!({"id": csae, "action": "resolve"})),
        ("resolve_report", json!({"id": csae, "action": "dismiss"})),
        ("resolve_report", json!({"id": on_bob, "action": "resolve"})),
        ("takedown", json!({"subject": BOB})),
        ("takedown", json!({"subject": DAVE, "applied": false})),
        (
            "takedown",
            json!({"subject": format!("at://{BOB}/social.grain.gallery/3l3qo2vuowo2a")}),
        ),
        ("label", json!({"subject": BOB, "val": "spam"})),
        ("label", json!({"subject": CAROL, "val": "csae"})),
        (
            "label",
            json!({"subject": DAVE, "val": "csae", "negate": true}),
        ),
    ] {
        assert_eq!(
            c.refused(tool, args.clone()).await,
            grain_mcp::HUMAN,
            "{tool} {args}"
        );
    }
    assert_eq!(w.index.report(csae).unwrap().unwrap().status, "open");

    // Everything else is the model's to do.
    let closed = c
        .json("resolve_report", json!({"id": spam, "action": "resolve"}))
        .await;
    assert_eq!(closed, json!({"id": spam, "status": "resolved"}));
    let why = c
        .refused("resolve_report", json!({"id": spam, "action": "maybe"}))
        .await;
    assert_eq!(why, "action is resolve or dismiss");
    let why = c
        .refused("resolve_report", json!({"id": spam, "action": "dismiss"}))
        .await;
    assert!(why.contains("ReportNotFound"), "{why}");
    // One it cannot read by its id is not closed: it fails closed.
    let why = c
        .refused("resolve_report", json!({"id": 999, "action": "dismiss"}))
        .await;
    assert!(why.starts_with("report 999 could not be read"), "{why}");
    assert!(why.contains("ReportNotFound"), "{why}");
    c.json("takedown", json!({"subject": CAROL})).await;
    let status = c.json("moderation_status", json!({"subject": CAROL})).await;
    assert_eq!(status["takedown"]["applied"], true);
    c.json("takedown", json!({"subject": CAROL, "applied": false}))
        .await;
    let labeled = c
        .json("label", json!({"subject": CAROL, "val": "nudity"}))
        .await;
    assert_eq!(
        labeled,
        json!({"subject": CAROL, "val": "nudity", "neg": false})
    );
    let labels = c.json("query_labels", json!({"patterns": [CAROL]})).await;
    let vals: Vec<&str> = labels["labels"]
        .as_array()
        .unwrap()
        .iter()
        .map(|l| l["val"].as_str().unwrap())
        .collect();
    assert_eq!(vals, ["spam", "nudity"]);
    let defs = c.json("list_label_definitions", json!({})).await;
    assert_eq!(
        defs["definitions"].as_array().unwrap().len(),
        grain::labels::DEFINITIONS.len()
    );

    // Nothing a child-safety report or label is about was ever said.
    let seen = c.seen.lock().unwrap().join("\n") + &theirs.seen.lock().unwrap().join("\n");
    for secret in SECRETS {
        assert!(!seen.contains(secret), "{secret} reached the client");
    }
}

#[tokio::test]
async fn with_no_login_a_tool_says_so() {
    let w = world("did:plc:nobody").await;
    let dir = w.dir.path().join("nobody");
    let c = Client::of(net::ctx(&dir, &[("GRAIN_APPVIEW", &w.base)])).await;
    assert_eq!(
        c.refused("list_label_definitions", json!({})).await,
        "not logged in"
    );
}

#[test]
fn the_binary_takes_no_arguments() {
    let bin = env!("CARGO_BIN_EXE_grain-mcp");
    let out = std::process::Command::new(bin)
        .arg("--nope")
        .output()
        .unwrap();
    assert_eq!(out.status.code(), Some(2));
    assert_eq!(
        String::from_utf8_lossy(&out.stderr).trim(),
        "usage: grain-mcp"
    );
    // With no client on stdin, it ends.
    let out = std::process::Command::new(bin)
        .stdin(std::process::Stdio::null())
        .env("GRAIN_CONFIG_DIR", tempfile::tempdir().unwrap().path())
        .output()
        .unwrap();
    assert_ne!(out.status.code(), Some(2), "{out:?}");
}

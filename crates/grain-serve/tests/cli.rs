//! The `grain` command line against grain-serve: an account logging in
//! and reporting, and an admin, whom `GRAIN_ADMIN_DIDS` names, moderating,
//! each with service tokens from the reference PDS for the appview
//! `GRAIN_APPVIEW` and `GRAIN_APPVIEW_DID` name.

#[path = "../../grain/tests/common/mod.rs"]
mod net;

mod common;

use grain::env::Ctx;
use grain::xrpc::{Auth, Xrpc};
use grain_serve::App;
use grain_serve::index::Index;
use serde_json::{Value, json};
use std::sync::Arc;

const BOB: &str = "did:plc:bob";
/// The appview's DID: one of where it serves would name its port, which
/// no atproto DID does.
const AUD: &str = "did:web:grain.test";

struct World {
    base: String,
    index: Arc<Index>,
    dir: tempfile::TempDir,
}

/// grain-serve on a port of its own, as [`AUD`], `admin` its admin.
async fn world(admin: &str) -> World {
    let dir = tempfile::tempdir().unwrap();
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let base = format!("http://{}", listener.local_addr().unwrap());
    let index = Arc::new(Index::memory().unwrap());
    let mut app = App::bare(net::ctx(&dir.path().join("serve"), &[]));
    app.index = Some(index.clone());
    app.did = Some(AUD.into());
    app.admins = vec![admin.to_string()];
    common::served_on(listener, app);
    index.track(BOB).unwrap();
    index.set_handle(BOB, "bob.test").unwrap();
    World { base, index, dir }
}

impl World {
    /// The command line of someone on this machine, `who`, at this appview.
    fn ctx(&self, who: &str, extra: &[(&str, &str)]) -> Ctx {
        // The first of a name is the one taken.
        let mut vars = extra.to_vec();
        vars.push(("GRAIN_APPVIEW", self.base.as_str()));
        vars.push(("GRAIN_APPVIEW_DID", AUD));
        net::ctx(&self.dir.path().join(who), &vars)
    }
}

/// What `grain <argv>` says, given `stdin`.
async fn grain(ctx: &Ctx, argv: &[&str], stdin: &str) -> anyhow::Result<String> {
    let argv: Vec<String> = argv.iter().map(|a| a.to_string()).collect();
    let mut out = Vec::new();
    grain::cli::run(ctx, &argv, &mut stdin.as_bytes(), &mut out).await?;
    Ok(String::from_utf8(out).unwrap())
}

async fn ok(ctx: &Ctx, argv: &[&str]) -> String {
    match grain(ctx, argv, "").await {
        Ok(said) => said,
        Err(e) => panic!("grain {argv:?}: {e:#}"),
    }
}

async fn failed(ctx: &Ctx, argv: &[&str]) -> String {
    let err = grain(ctx, argv, "").await.unwrap_err();
    grain::cli::failed(&err)
}

/// A gallery `account` puts on its PDS; its URI.
async fn gallery(ctx: &Ctx, account: &net::Account) -> String {
    let me = grain::session::create(ctx, &account.did, &account.password);
    let me = me.await.unwrap();
    let record = json!({"$type": "social.grain.gallery", "title": "Rocks",
        "createdAt": "2026-10-31T12:00:00.000Z"});
    let input = json!({"repo": me.did, "collection": "social.grain.gallery", "record": record});
    let made: Value = Xrpc::new(ctx.http.clone(), &me.service)
        .procedure(
            "com.atproto.repo.createRecord",
            Some(&input),
            Some(&Auth::Bearer(me.access_jwt.clone())),
        )
        .await
        .unwrap();
    made["uri"].as_str().unwrap().to_string()
}

#[tokio::test]
async fn an_account_reports_and_an_admin_moderates() {
    let (admin, someone) = (net::account().await, net::account().await);
    let w = world(&admin.did).await;
    let mine = w.ctx("someone", &[]);
    let login = ["login", &someone.handle, "--password-stdin"];
    let said = grain(&mine, &login, &someone.password).await.unwrap();
    assert_eq!(
        said,
        format!("logged in as {} ({})\n", someone.handle, someone.did)
    );

    // Someone reports an account by its DID, and a record of their own by
    // its URI, which the command line names as its PDS has it now.
    assert_eq!(
        ok(&mine, &["report", BOB, "spam", "ads"]).await,
        "report 1 sent\n"
    );
    let uri = gallery(&mine, &someone).await;
    assert_eq!(
        ok(&mine, &["report", &uri, "nudity"]).await,
        "report 2 sent\n"
    );
    let why = failed(&mine, &["report", BOB, "boring"]).await;
    assert!(why.starts_with("grain: boring: a reason is spam,"), "{why}");
    let why = failed(
        &mine,
        &["report", "at://did:plc:bob/social.grain.gallery", "spam"],
    )
    .await;
    assert!(
        why.contains("a record's URI is at://<account>/<collection>/<key>"),
        "{why}"
    );
    let gone = format!("at://{}/social.grain.gallery/3l3qo2vuowo2z", someone.handle);
    let why = failed(&mine, &["report", &gone, "spam"]).await;
    assert!(why.starts_with(&format!("grain: reading {gone}")), "{why}");

    // Someone is not an admin.
    let why = failed(&mine, &["admin", "reports"]).await;
    assert!(
        why.contains(&format!("{} is not an admin of this server", someone.did)),
        "{why}"
    );

    // The admin logs in by GRAIN_PASSWORD, and sees the reports.
    let theirs = w.ctx("admin", &[("GRAIN_PASSWORD", &admin.password)]);
    let said = ok(&theirs, &["login", &admin.did]).await;
    assert_eq!(
        said,
        format!("logged in as {} ({})\n", admin.handle, admin.did)
    );
    let reports = ok(&theirs, &["admin", "reports"]).await;
    let lines: Vec<&str> = reports.lines().collect();
    assert_eq!(lines.len(), 3, "{reports}");
    assert!(
        lines[0].starts_with(&format!("2\topen\tnudity\t{uri}\t")),
        "{reports}"
    );
    assert!(
        lines[1].starts_with(&format!("1\topen\tspam\t{BOB}\t")),
        "{reports}"
    );
    assert!(lines[1].ends_with("\tads"), "{reports}");
    assert_eq!(lines[2], "2 in all");
    let first = ok(
        &theirs,
        &["admin", "reports", "--label", "spam", "--limit", "1"],
    )
    .await;
    assert_eq!(first.lines().count(), 2, "{first}");
    let page = ok(&theirs, &["admin", "reports", "--limit", "1"]).await;
    let cursor = page.lines().last().unwrap().rsplit(' ').next().unwrap();
    assert!(
        page.ends_with(&format!("2 in all; more with --cursor {cursor}\n")),
        "{page}"
    );
    let next = ok(
        &theirs,
        &["admin", "reports", "--limit", "1", "--cursor", cursor],
    )
    .await;
    assert!(next.starts_with("1\topen\tspam"), "{next}");

    // Resolving gives out the label; dismissing does not.
    assert_eq!(ok(&theirs, &["admin", "resolve", "1"]).await, "resolved\n");
    assert_eq!(ok(&theirs, &["admin", "dismiss", "2"]).await, "dismissed\n");
    let closed = ok(&theirs, &["admin", "reports", "--status", "resolved"]).await;
    assert!(closed.starts_with("1\tresolved\tspam"), "{closed}");
    assert!(w.index.labeled(AUD, BOB, "spam").unwrap());
    let why = failed(&theirs, &["admin", "resolve", "1"]).await;
    assert!(why.contains("ReportNotFound"), "{why}");

    // Takedowns, of an account and of a record, and back.
    assert_eq!(ok(&theirs, &["admin", "status", BOB]).await, "up\n");
    // An account by its handle.
    let by_handle = ok(&theirs, &["admin", "status", &someone.handle]).await;
    assert_eq!(by_handle, "up\n");
    assert_eq!(
        ok(&theirs, &["admin", "takedown", BOB]).await,
        "taken down\n"
    );
    assert_eq!(ok(&theirs, &["admin", "status", BOB]).await, "taken down\n");
    assert_eq!(
        ok(&theirs, &["admin", "takedown", BOB, "--undo"]).await,
        "restored\n"
    );
    assert_eq!(ok(&theirs, &["admin", "status", BOB]).await, "up\n");
    let record = json!({"$type": "social.grain.gallery", "title": "Rocks",
        "createdAt": "2026-10-31T12:00:00.000Z"});
    let cid = record_cid(&theirs, &uri).await;
    w.index.track(&someone.did).unwrap();
    w.index
        .put_at(&uri, &cid, &record, "2026-10-31T12:00:00.000Z")
        .unwrap();
    assert_eq!(
        ok(&theirs, &["admin", "takedown", &uri]).await,
        "taken down\n"
    );
    assert_eq!(
        ok(&theirs, &["admin", "status", &uri]).await,
        "taken down\n"
    );

    // Labels, given and negated.
    assert_eq!(
        ok(&theirs, &["admin", "label", BOB, "gore"]).await,
        "labeled\n"
    );
    assert_eq!(
        ok(&theirs, &["admin", "label", BOB, "gore", "--negate"]).await,
        "negated\n"
    );
    let labels = ok(&theirs, &["admin", "labels"]).await;
    assert!(labels.contains("csae\tChild Safety: "), "{labels}");
    assert_eq!(labels.lines().count(), grain::labels::DEFINITIONS.len());

    // An account's moderation whole.
    let account: Value =
        serde_json::from_str(&ok(&theirs, &["admin", "account", BOB]).await).unwrap();
    assert_eq!(account["did"], BOB);
    assert_eq!(account["childSafety"], false);

    // Wrong words say so.
    for (argv, why) in [
        (&["admin", "reports", "--nope"][..], "unexpected --nope"),
        (
            &["admin", "reports", "--limit", "many"],
            "a limit is a number",
        ),
        (&["admin", "resolve", "one"], "a report's id is a number"),
        (&["admin", "takedown", BOB, "--nope"], "unexpected --nope"),
        (&["admin", "status", BOB, "more"], "unexpected more"),
        (
            &["admin", "label", BOB, "gore", "--nope"],
            "unexpected --nope",
        ),
        (&["admin", "account", BOB, "more"], "unexpected more"),
        (&["admin", "labels", "more"], "unexpected more"),
        (&["admin", "nonsense"], "admin nonsense: no such command"),
    ] {
        let said = failed(&theirs, argv).await;
        assert!(
            said.starts_with(&format!("grain: {why}")),
            "{argv:?}: {said}"
        );
    }

    assert_eq!(ok(&theirs, &["logout", &admin.did]).await, "logged out\n");
    assert_eq!(ok(&theirs, &["logout", &admin.did]).await, "no session\n");
}

/// The CID of `uri` as its PDS has it.
async fn record_cid(ctx: &Ctx, uri: &str) -> String {
    let subject = grain::moderation::subject(ctx, uri).await.unwrap();
    subject["cid"].as_str().unwrap().to_string()
}

#[tokio::test]
async fn an_oauth_login_lets_the_command_line_report() {
    let someone = net::account().await;
    let w = world("did:plc:nobody").await;
    let browser = net::browser(&someone, "");
    let mine = w.ctx("someone", &[("GRAIN_BROWSER", &browser)]);
    let said = ok(&mine, &["login", &someone.handle]).await;
    assert!(
        said.starts_with("approve in your browser, or open "),
        "{said}"
    );
    assert!(
        said.ends_with(&format!(
            "logged in as {} ({})\n",
            someone.handle, someone.did
        )),
        "{said}"
    );
    assert_eq!(
        ok(&mine, &["report", BOB, "child-safety"]).await,
        "report 1 sent\n"
    );
    let filed = w.index.report(1).unwrap().unwrap();
    assert_eq!(filed.label, grain::labels::CSAE);
    assert_eq!(filed.reported_by, someone.did);
}

#[tokio::test]
async fn an_appview_that_is_no_url_is_said() {
    let w = world("did:plc:nobody").await;
    let named = [("GRAIN_APPVIEW", "grain.social"), ("GRAIN_APPVIEW_DID", "")];
    let ctx = w.ctx("someone", &named);
    let why = failed(&ctx, &["report", BOB, "spam"]).await;
    assert!(
        why.starts_with("grain: GRAIN_APPVIEW grain.social"),
        "{why}"
    );
}

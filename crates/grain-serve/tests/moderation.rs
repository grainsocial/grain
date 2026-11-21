//! Moderation, called as the apps and the command line call it: reports
//! with a service token from the reporter's PDS, the reference PDS, and
//! the admin methods with one from an admin's, whom `GRAIN_ADMIN_DIDS` names.
//! Every answer goes through `common`, so `harness/answers.mjs` holds it
//! to its lexicon.

#[path = "../../grain/tests/common/mod.rs"]
mod net;

mod common;

use grain::env::Ctx;
use grain::session::{self, Session};
use grain_serve::App;
use grain_serve::index::Index;
use grain_serve::index::moderation::NewReport;
use serde_json::{Value, json};
use std::sync::Arc;

const AUD: &str = "did:web:grain.test";
const NOW: &str = "2026-10-31T12:00:00.000Z";
const BLOB: &str = "bafkreigh2akiscaildcqabsyg3dfr6chu3fgpregiymsck7e7aqa4s52zy";
const BOB: &str = "did:plc:bob";
const CAROL: &str = "did:plc:carol";

const REPORT: &str = "/xrpc/com.atproto.moderation.createReport";
const LIST: &str = "/xrpc/social.grain.admin.listReports";
const RESOLVE: &str = "/xrpc/social.grain.admin.resolveReport";
const GET: &str = "/xrpc/social.grain.admin.getReport";
const UPDATE: &str = "/xrpc/com.atproto.admin.updateSubjectStatus";
const STATUS: &str = "/xrpc/com.atproto.admin.getSubjectStatus";
const APPLY: &str = "/xrpc/social.grain.admin.applyLabel";
const NEGATE: &str = "/xrpc/social.grain.admin.negateLabel";
const QUERY: &str = "/xrpc/com.atproto.label.queryLabels";
const DEFINITIONS: &str = "/xrpc/social.grain.admin.listLabelDefinitions";
const DESCRIBE: &str = "/xrpc/social.grain.moderation.describeLabels";
const SUBJECT: &str = "/xrpc/social.grain.admin.getReviewSubject";

struct World {
    ctx: Ctx,
    /// An admin, on the reference PDS.
    admin: Session,
    /// Anyone else.
    someone: Session,
    index: Arc<Index>,
    served: common::Served,
    _dir: tempfile::TempDir,
}

async fn world() -> World {
    let dir = tempfile::tempdir().unwrap();
    let ctx = net::ctx(dir.path(), &[]);
    let index = Arc::new(Index::memory().unwrap());
    let mut sessions = Vec::new();
    for _ in 0..2 {
        let account = net::account().await;
        let me = session::create(&ctx, &account.did, &account.password);
        sessions.push(me.await.unwrap());
    }
    let (admin, someone) = (sessions.remove(0), sessions.remove(0));
    let mut app = App::bare(net::ctx(&dir.path().join("serve"), &[]));
    app.index = Some(index.clone());
    app.did = Some(AUD.into());
    app.admins = vec![admin.did.clone()];
    let served = common::served_app(app).await;
    for (did, handle) in [(BOB, "bob.test"), (CAROL, "carol.test")] {
        index.track(did).unwrap();
        index.set_handle(did, handle).unwrap();
    }
    index.track(&someone.did).unwrap();
    index.set_handle(&someone.did, &someone.handle).unwrap();
    World {
        ctx,
        admin,
        someone,
        index,
        served,
        _dir: dir,
    }
}

fn cid(of: &str) -> String {
    atproto::Cid::of_cbor(of.as_bytes()).to_string()
}

fn strong_ref(uri: &str) -> Value {
    json!({"$type": "com.atproto.repo.strongRef", "uri": uri, "cid": cid(uri)})
}

fn repo_ref(did: &str) -> Value {
    json!({"$type": "com.atproto.admin.defs#repoRef", "did": did})
}

impl World {
    /// Puts `record` of `collection` at `did`'s `rkey`; its URI.
    fn put(&self, did: &str, collection: &str, rkey: &str, mut record: Value) -> String {
        let uri = format!("at://{did}/{collection}/{rkey}");
        record["$type"] = collection.into();
        self.index.put_at(&uri, &cid(&uri), &record, NOW).unwrap();
        uri
    }

    fn gallery(&self, did: &str, rkey: &str, title: &str) -> String {
        let record = json!({"title": title, "createdAt": NOW});
        self.put(did, "social.grain.gallery", rkey, record)
    }

    async fn token(&self, who: &Session, path: &str) -> String {
        let nsid = path["/xrpc/".len()..].split('?').next().unwrap();
        grain::auth::service_token(&self.ctx, who, AUD, nsid)
            .await
            .unwrap()
    }

    /// The query `path`, as `who`.
    async fn get(&self, who: &Session, path: &str) -> (u16, Value) {
        let token = self.token(who, path).await;
        self.served.get_with(path, &format!("Bearer {token}")).await
    }

    /// The procedure `path`, as `who`.
    async fn post(&self, who: &Session, path: &str, body: Value) -> (u16, Value) {
        let token = self.token(who, path).await;
        self.served.post_as(path, &token, &body).await
    }

    async fn report(&self, subject: Value, reason_type: &str, reason: Option<&str>) -> Value {
        let mut body = json!({"subject": subject, "reasonType": reason_type});
        if let Some(reason) = reason {
            body["reason"] = reason.into();
        }
        let (status, out) = self.post(&self.someone, REPORT, body).await;
        assert_eq!(status, 200, "{out}");
        out
    }
}

fn ids(out: &Value) -> Vec<i64> {
    let reports = out["reports"].as_array().unwrap();
    reports.iter().map(|r| r["id"].as_i64().unwrap()).collect()
}

#[tokio::test]
async fn reports_are_filed_under_the_label_their_reason_asks_for() {
    let w = world().await;
    let gallery = w.gallery(BOB, "g1", "Fog");
    let spam = w
        .report(
            strong_ref(&gallery),
            "com.atproto.moderation.defs#reasonSpam",
            Some("ads"),
        )
        .await;
    assert_eq!(spam["reasonType"], "com.atproto.moderation.defs#reasonSpam");
    assert_eq!(spam["subject"], strong_ref(&gallery));
    assert_eq!(spam["reportedBy"], w.someone.did);
    assert_eq!(spam["reason"], "ads");
    let groom = "tools.ozone.report.defs#reasonChildSafetyGroom";
    let csae = w.report(repo_ref(CAROL), groom, Some("")).await;
    assert!(csae.get("reason").is_none(), "an empty reason is none");

    let (status, out) = w.get(&w.admin, LIST).await;
    assert_eq!(status, 200, "{out}");
    assert_eq!(out["total"], 2);
    assert_eq!(
        ids(&out),
        [csae["id"].as_i64().unwrap(), spam["id"].as_i64().unwrap()]
    );
    let [newest, oldest] = [&out["reports"][0], &out["reports"][1]];
    assert_eq!(newest["label"], "csae");
    assert_eq!(
        newest["subject"], CAROL,
        "an account's subject is its bare DID"
    );
    assert_eq!(newest["subjectDid"], CAROL);
    assert_eq!(newest["reasonType"], groom);
    assert_eq!(oldest["label"], "spam");
    assert_eq!(oldest["subject"], gallery);
    assert_eq!(oldest["subjectDid"], BOB);
    assert_eq!(oldest["reason"], "ads");
    assert_eq!(oldest["status"], "open");
    assert_eq!(oldest["reportedByHandle"], w.someone.handle);

    // A page at a time, by label, by status.
    let (_, first) = w.get(&w.admin, &format!("{LIST}?limit=1")).await;
    assert_eq!(ids(&first), [csae["id"].as_i64().unwrap()]);
    let cursor = first["cursor"].as_str().unwrap();
    let (_, next) = w
        .get(&w.admin, &format!("{LIST}?limit=1&cursor={cursor}"))
        .await;
    assert_eq!(ids(&next), [spam["id"].as_i64().unwrap()]);
    assert!(next.get("cursor").is_none());
    let (_, spam_only) = w.get(&w.admin, &format!("{LIST}?label=spam")).await;
    assert_eq!((ids(&spam_only).len(), &spam_only["total"]), (1, &json!(1)));
    let (_, resolved) = w.get(&w.admin, &format!("{LIST}?status=resolved")).await;
    assert_eq!(resolved["total"], 0);
    for wrong in ["?cursor=nope", "?limit=0", "?limit=101"] {
        let (status, out) = w.get(&w.admin, &format!("{LIST}{wrong}")).await;
        assert_eq!(
            (status, out["error"].as_str()),
            (400, Some("InvalidRequest")),
            "{wrong}"
        );
    }
}

#[tokio::test]
async fn a_report_says_what_it_is_about_and_why() {
    let w = world().await;
    let gallery = format!("at://{BOB}/social.grain.gallery/g1");
    let spam = "com.atproto.moderation.defs#reasonSpam";
    let refused = [
        json!({"subject": repo_ref(BOB), "reasonType": "boring"}),
        json!({"subject": {"did": BOB}, "reasonType": spam}),
        json!({"subject": {"$type": "com.atproto.admin.defs#repoRef", "did": "bob"}, "reasonType": spam}),
        json!({"subject": {"$type": "com.atproto.repo.strongRef", "uri": gallery, "cid": "x"}, "reasonType": spam}),
        json!({"subject": {"$type": "com.atproto.repo.strongRef", "uri": "at://bob", "cid": cid(&gallery)}, "reasonType": spam}),
        json!({"subject": repo_ref(BOB), "reasonType": spam, "reason": "é".repeat(2001)}),
        json!({"subject": repo_ref(BOB)}),
    ];
    for body in refused {
        let (status, out) = w.post(&w.someone, REPORT, body.clone()).await;
        assert_eq!(
            (status, out["error"].as_str()),
            (400, Some("InvalidRequest")),
            "{body}"
        );
    }
    // Two thousand graphemes are not too many, though they are more bytes.
    let long = json!({"subject": repo_ref(BOB), "reasonType": spam, "reason": "é".repeat(2000)});
    assert_eq!(w.post(&w.someone, REPORT, long).await.0, 200);
    // Only someone signed in reports.
    let (status, out) = w.served.post(REPORT, &json!({})).await;
    assert_eq!(
        (status, out["error"].as_str()),
        (401, Some("AuthenticationRequired"))
    );

    // A classifier's report is the server's, by its DID, the classifier
    // named in its reason, and lists as any other.
    let filed = w.index.file_report_once(&NewReport {
        subject: &gallery,
        subject_did: BOB,
        label: "nudity",
        reason_type: None,
        reason: Some("nsfw: nudity 0.91"),
        reported_by: AUD,
        created_at: NOW,
    });
    let filed = filed.unwrap().unwrap();
    let (_, listed) = w.get(&w.admin, &format!("{LIST}?label=nudity")).await;
    assert_eq!(listed["reports"][0]["id"], filed.id);
    assert_eq!(listed["reports"][0]["reportedBy"], AUD);
    assert_eq!(listed["reports"][0]["reason"], "nsfw: nudity 0.91");
}

#[tokio::test]
async fn only_an_admin_with_a_token_for_the_method_moderates() {
    let w = world().await;
    let calls = [
        (LIST, None),
        (GET, None),
        (STATUS, None),
        (DEFINITIONS, None),
        (SUBJECT, None),
        (RESOLVE, Some(json!({"id": 1, "action": "dismiss"}))),
        (UPDATE, Some(json!({"subject": repo_ref(BOB)}))),
        (APPLY, Some(json!({"uri": BOB, "val": "spam"}))),
        (NEGATE, Some(json!({"uri": BOB, "val": "spam"}))),
    ];
    for (path, body) in calls {
        let (status, out) = match &body {
            None => w.get(&w.someone, path).await,
            Some(body) => w.post(&w.someone, path, body.clone()).await,
        };
        assert_eq!(
            (status, out["error"].as_str()),
            (403, Some("Forbidden")),
            "{path}"
        );
        let said = format!("{} is not an admin of this server", w.someone.did);
        assert_eq!(out["message"], said);
        // No token is no one, the web's cookie or not.
        let (status, out) = match &body {
            None => w.served.get(path).await,
            Some(body) => w.served.post(path, body).await,
        };
        assert_eq!(
            (status, out["error"].as_str()),
            (401, Some("AuthenticationRequired")),
            "{path}"
        );
    }
    // A token for another method lets no one in.
    let token = w.token(&w.admin, LIST).await;
    let (status, out) = w
        .served
        .get_with(DEFINITIONS, &format!("Bearer {token}"))
        .await;
    assert_eq!((status, out["error"].as_str()), (401, Some("InvalidToken")));
    // What an admin reads is for no cache to keep.
    let bearer = format!("Bearer {}", w.token(&w.admin, DEFINITIONS).await);
    let headers = [("authorization", bearer.as_str())];
    let (status, answered, _) = w.served.get_answered(DEFINITIONS, &headers).await;
    assert_eq!(status, 200);
    let unshared = (vec!["authorization", "cookie"], Some("private, no-store"));
    assert_eq!(common::caching(&answered), unshared);
}

#[tokio::test]
async fn resolving_a_report_gives_out_its_label_and_dismissing_it_does_not() {
    let w = world().await;
    let gallery = w.gallery(BOB, "g1", "Fog");
    let spam = w
        .report(
            strong_ref(&gallery),
            "com.atproto.moderation.defs#reasonSpam",
            None,
        )
        .await;
    let nudity = w
        .report(
            repo_ref(CAROL),
            "social.grain.moderation.defs#reasonNudity",
            None,
        )
        .await;
    let resolve = json!({"id": spam["id"], "action": "resolve"});
    let (status, out) = w.post(&w.admin, RESOLVE, resolve.clone()).await;
    assert_eq!((status, &out), (200, &json!({})));
    let given = w.index.labels(&gallery).unwrap();
    assert_eq!(given.len(), 1);
    assert_eq!(
        (given[0].src.as_str(), given[0].val.as_str(), given[0].neg),
        (AUD, "spam", false)
    );
    // Closed, it is not closed again.
    let (status, out) = w.post(&w.admin, RESOLVE, resolve).await;
    assert_eq!(
        (status, out["error"].as_str()),
        (400, Some("ReportNotFound"))
    );
    let dismiss = json!({"id": nudity["id"], "action": "dismiss"});
    assert_eq!(w.post(&w.admin, RESOLVE, dismiss).await.0, 200);
    // A report is read by its id, in any state.
    let (status, got) = w.get(&w.admin, &format!("{GET}?id={}", spam["id"])).await;
    assert_eq!(status, 200);
    assert_eq!(
        (&got["report"]["id"], &got["report"]["status"]),
        (&spam["id"], &json!("resolved"))
    );
    let (status, out) = w.get(&w.admin, &format!("{GET}?id=999")).await;
    assert_eq!(
        (status, out["error"].as_str()),
        (400, Some("ReportNotFound"))
    );
    for wrong in ["", "?id=one"] {
        let (status, out) = w.get(&w.admin, &format!("{GET}{wrong}")).await;
        assert_eq!(
            (status, out["error"].as_str()),
            (400, Some("InvalidRequest")),
            "{wrong}"
        );
    }
    assert!(w.index.labels(CAROL).unwrap().is_empty());
    let none = json!({"id": 999, "action": "dismiss"});
    assert_eq!(
        w.post(&w.admin, RESOLVE, none).await.1["error"],
        "ReportNotFound"
    );
    for wrong in [json!({"id": 1, "action": "ignore"}), json!({"id": "one"})] {
        let (status, out) = w.post(&w.admin, RESOLVE, wrong.clone()).await;
        assert_eq!(
            (status, out["error"].as_str()),
            (400, Some("InvalidRequest")),
            "{wrong}"
        );
    }
    let (_, resolved) = w.get(&w.admin, &format!("{LIST}?status=resolved")).await;
    assert_eq!(resolved["reports"][0]["resolvedBy"], w.admin.did);
    assert!(resolved["reports"][0]["resolvedAt"].is_string());
    let (_, dismissed) = w.get(&w.admin, &format!("{LIST}?status=dismissed")).await;
    assert_eq!(ids(&dismissed), [nudity["id"].as_i64().unwrap()]);
}

#[tokio::test]
async fn accounts_and_records_are_taken_down_and_put_back() {
    let w = world().await;
    let gallery = w.gallery(BOB, "g1", "Fog");
    let status = |q: String| {
        let w = &w;
        async move { w.get(&w.admin, &format!("{STATUS}?{q}")).await }
    };
    let (code, out) = status(format!("did={BOB}")).await;
    assert_eq!(code, 200, "{out}");
    assert_eq!(
        out,
        json!({"subject": repo_ref(BOB), "takedown": {"applied": false}})
    );

    let down = json!({"subject": repo_ref(BOB), "takedown": {"applied": true}});
    let (code, out) = w.post(&w.admin, UPDATE, down.clone()).await;
    assert_eq!((code, &out), (200, &down));
    assert!(w.index.taken_down(BOB).unwrap());
    let said = w.index.labels(BOB).unwrap();
    assert_eq!((said[0].val.as_str(), said[0].neg), ("!takedown", false));
    assert_eq!(
        status(format!("did={BOB}")).await.1["takedown"]["applied"],
        true
    );
    let up = json!({"subject": repo_ref(BOB), "takedown": {"applied": false}});
    assert_eq!(w.post(&w.admin, UPDATE, up).await.0, 200);
    assert!(!w.index.taken_down(BOB).unwrap());
    assert!(
        w.index.labels(BOB).unwrap()[1].neg,
        "the takedown's label is negated"
    );

    // A record is taken down by its label.
    let down = json!({"subject": strong_ref(&gallery), "takedown": {"applied": true}});
    assert_eq!(w.post(&w.admin, UPDATE, down).await.0, 200);
    let (code, out) = status(format!("uri={gallery}")).await;
    assert_eq!(code, 200);
    assert_eq!(
        out,
        json!({"subject": strong_ref(&gallery), "takedown": {"applied": true}})
    );
    assert!(!w.index.taken_down(BOB).unwrap(), "its account is not");
    let up = json!({"subject": strong_ref(&gallery), "takedown": {"applied": false}});
    assert_eq!(w.post(&w.admin, UPDATE, up).await.0, 200);
    assert_eq!(
        status(format!("uri={gallery}")).await.1["takedown"]["applied"],
        false
    );

    // Saying nothing of a takedown changes nothing.
    let nothing = json!({"subject": repo_ref(CAROL)});
    assert_eq!(w.post(&w.admin, UPDATE, nothing.clone()).await.1, nothing);
    let blob = json!({"subject": {"$type": "com.atproto.admin.defs#repoBlobRef", "did": BOB, "cid": BLOB}});
    assert_eq!(w.post(&w.admin, UPDATE, blob).await.0, 400);
    assert_eq!(w.post(&w.admin, UPDATE, json!({})).await.0, 400);
    let gone = format!("at://{BOB}/social.grain.gallery/gone");
    let (code, out) = status(format!("uri={gone}")).await;
    assert_eq!((code, out["error"].as_str()), (400, Some("RecordNotFound")));
    let elsewhere = format!("at://{BOB}/app.bsky.feed.like/3l");
    assert_eq!(
        status(format!("uri={elsewhere}")).await.1["error"],
        "RecordNotFound"
    );
    for wrong in ["did=bob", "uri=bob", "blob=x"] {
        let (code, out) = status(wrong.into()).await;
        assert_eq!(
            (code, out["error"].as_str()),
            (400, Some("InvalidRequest")),
            "{wrong}"
        );
    }
}

#[tokio::test]
async fn labels_are_given_out_negated_and_queried() {
    let w = world().await;
    let gallery = w.gallery(BOB, "g1", "Fog");
    for (path, uri, val) in [
        (APPLY, BOB, "spam"),
        (APPLY, gallery.as_str(), "nudity"),
        (APPLY, gallery.as_str(), "gore"),
        (NEGATE, gallery.as_str(), "gore"),
        (APPLY, CAROL, "!hide"),
    ] {
        let (code, out) = w
            .post(&w.admin, path, json!({"uri": uri, "val": val}))
            .await;
        assert_eq!((code, &out), (200, &json!({})), "{path} {uri} {val}");
    }
    let long = "x".repeat(129);
    for wrong in [
        json!({"uri": format!("at://{BOB}"), "val": "spam"}),
        json!({"uri": "bob.test", "val": "spam"}),
        json!({"uri": BOB, "val": ""}),
        json!({"uri": BOB, "val": long}),
        json!({"uri": BOB}),
        // A takedown is updateSubjectStatus's, which keeps it whole.
        json!({"uri": BOB, "val": "!takedown"}),
    ] {
        let (code, out) = w.post(&w.admin, APPLY, wrong.clone()).await;
        assert_eq!(
            (code, out["error"].as_str()),
            (400, Some("InvalidRequest")),
            "{wrong}"
        );
    }

    // Anyone reads what stands, by subject or by prefix.
    let vals = |out: &Value| -> Vec<String> {
        let labels = out["labels"].as_array().unwrap();
        labels
            .iter()
            .map(|l| {
                format!(
                    "{} {}",
                    l["uri"].as_str().unwrap(),
                    l["val"].as_str().unwrap()
                )
            })
            .collect()
    };
    let (code, out) = w.served.get(&format!("{QUERY}?uriPatterns={BOB}")).await;
    assert_eq!(code, 200, "{out}");
    assert_eq!(vals(&out), [format!("{BOB} spam")]);
    assert_eq!(out["labels"][0]["src"], AUD);
    assert_eq!(out["labels"][0]["ver"], 1);
    let records = format!("{QUERY}?uriPatterns=at://{BOB}/*");
    assert_eq!(
        vals(&w.served.get(&records).await.1),
        [format!("{gallery} nudity")]
    );
    let both = format!("{QUERY}?uriPatterns={BOB}&uriPatterns={CAROL}");
    let (_, out) = w.served.get(&both).await;
    assert_eq!(
        vals(&out),
        [format!("{BOB} spam"), format!("{CAROL} !hide")]
    );
    let (_, first) = w.served.get(&format!("{both}&limit=1")).await;
    assert_eq!(vals(&first), [format!("{BOB} spam")]);
    let cursor = first["cursor"].as_str().unwrap();
    let (_, next) = w
        .served
        .get(&format!("{both}&limit=1&cursor={cursor}"))
        .await;
    assert_eq!(vals(&next), [format!("{CAROL} !hide")]);
    assert!(next.get("cursor").is_none());
    let theirs = format!("{both}&sources=did:web:other.test");
    assert!(vals(&w.served.get(&theirs).await.1).is_empty());
    let ours = format!("{both}&sources={AUD}");
    assert_eq!(vals(&w.served.get(&ours).await.1).len(), 2);
    for wrong in [
        "",
        "?uriPatterns=x&sources=nobody",
        "?uriPatterns=x&cursor=y",
        "?uriPatterns=x&limit=251",
    ] {
        let (code, out) = w.served.get(&format!("{QUERY}{wrong}")).await;
        assert_eq!(
            (code, out["error"].as_str()),
            (400, Some("InvalidRequest")),
            "{wrong}"
        );
    }

    let (code, out) = w.get(&w.admin, DEFINITIONS).await;
    assert_eq!(code, 200, "{out}");
    let names: Vec<&str> = out["definitions"]
        .as_array()
        .unwrap()
        .iter()
        .map(|d| d["identifier"].as_str().unwrap())
        .collect();
    assert!(
        names.contains(&"csae") && names.contains(&"spam"),
        "{names:?}"
    );
}

#[tokio::test]
async fn an_accounts_moderation_is_seen_whole() {
    let w = world().await;
    let gallery = w.gallery(BOB, "g1", "Fog");
    w.gallery(BOB, "g2", "Rain");
    let photo = json!({"photo": {"$type": "blob", "ref": {"$link": BLOB}, "mimeType": "image/jpeg", "size": 1000},
        "alt": "fog", "aspectRatio": {"width": 3, "height": 2}, "createdAt": NOW});
    let p1 = w.put(BOB, "social.grain.photo", "p1", photo);
    let item = json!({"gallery": gallery, "item": p1, "position": 2, "createdAt": NOW});
    w.put(BOB, "social.grain.gallery.item", "i1", item);
    w.post(&w.admin, APPLY, json!({"uri": gallery, "val": "nudity"}))
        .await;
    w.post(&w.admin, APPLY, json!({"uri": BOB, "val": "spam"}))
        .await;
    w.report(
        strong_ref(&gallery),
        "com.atproto.moderation.defs#reasonRude",
        Some("mean"),
    )
    .await;

    let (code, out) = w.get(&w.admin, &format!("{SUBJECT}?did={BOB}")).await;
    assert_eq!(code, 200, "{out}");
    assert_eq!(out["did"], BOB);
    assert_eq!(out["handle"], "bob.test");
    assert_eq!(out["status"], "pending");
    assert_eq!(out["childSafety"], false);
    assert_eq!(
        out["counts"],
        json!([
            {"collection": "social.grain.gallery", "count": 2},
            {"collection": "social.grain.gallery.item", "count": 1},
            {"collection": "social.grain.photo", "count": 1},
        ])
    );
    let records = out["records"].as_array().unwrap();
    assert_eq!(records.len(), 4);
    let i1 = records
        .iter()
        .find(|r| r["collection"] == "social.grain.gallery.item")
        .unwrap();
    assert_eq!(i1["value"]["position"], 2, "an integer is a number");
    let fog = records.iter().find(|r| r["uri"] == gallery).unwrap();
    assert_eq!(
        fog["value"],
        json!({"$type": "social.grain.gallery", "title": "Fog", "createdAt": NOW})
    );
    assert_eq!(fog["labels"][0]["val"], "nudity");
    assert_eq!(fog["cid"], cid(&gallery));
    let p1 = records
        .iter()
        .find(|r| r["collection"] == "social.grain.photo")
        .unwrap();
    assert_eq!(
        p1["value"]["aspectRatio"],
        json!({"width": 3, "height": 2}),
        "JSON is JSON"
    );
    assert!(p1.get("labels").is_none());
    let labels: Vec<&str> = out["labels"]
        .as_array()
        .unwrap()
        .iter()
        .map(|l| l["val"].as_str().unwrap())
        .collect();
    assert_eq!(labels, ["nudity", "spam"]);
    assert_eq!(out["reports"][0]["label"], "harassment");
    assert_eq!(out["reports"][0]["reason"], "mean");

    // A child-safety report against it, or a label of it, in any state,
    // says so.
    let csae = "tools.ozone.report.defs#reasonChildSafetyCSAM";
    let made = w.report(strong_ref(&gallery), csae, None).await;
    w.post(
        &w.admin,
        RESOLVE,
        json!({"id": made["id"], "action": "dismiss"}),
    )
    .await;
    assert_eq!(
        w.get(&w.admin, &format!("{SUBJECT}?did={BOB}")).await.1["childSafety"],
        true
    );
    w.post(&w.admin, APPLY, json!({"uri": CAROL, "val": "csae"}))
        .await;
    w.post(&w.admin, NEGATE, json!({"uri": CAROL, "val": "csae"}))
        .await;
    let (_, carol) = w.get(&w.admin, &format!("{SUBJECT}?did={CAROL}")).await;
    assert_eq!(carol["childSafety"], true);
    assert_eq!(carol["labels"], json!([]), "a negated label does not stand");
    assert_eq!(carol["records"], json!([]));
    // Or its author's own label of it.
    let (_, before) = w
        .get(&w.admin, &format!("{SUBJECT}?did={}", w.someone.did))
        .await;
    assert_eq!(before["childSafety"], false);
    let labeled = json!({"title": "Mine", "createdAt": NOW, "labels": {
        "$type": "com.atproto.label.defs#selfLabels", "values": [{"val": "csae"}]}});
    w.put(
        &w.someone.did,
        "social.grain.gallery",
        "3l3qo2vuowo2c",
        labeled,
    );
    let (_, after) = w
        .get(&w.admin, &format!("{SUBJECT}?did={}", w.someone.did))
        .await;
    assert_eq!(after["childSafety"], true);

    // Taken down, it says so over what backfill says; an account the
    // index does not track says nothing of it.
    let down = json!({"subject": repo_ref(BOB), "takedown": {"applied": true}});
    w.post(&w.admin, UPDATE, down).await;
    assert_eq!(
        w.get(&w.admin, &format!("{SUBJECT}?did={BOB}")).await.1["status"],
        "takendown"
    );
    w.index.set_host_status(CAROL, Some("deactivated")).unwrap();
    assert_eq!(
        w.get(&w.admin, &format!("{SUBJECT}?did={CAROL}")).await.1["status"],
        "deactivated"
    );
    let (_, stranger) = w
        .get(&w.admin, &format!("{SUBJECT}?did=did:plc:stranger"))
        .await;
    assert!(stranger.get("status").is_none() && stranger.get("handle").is_none());
    for wrong in ["", "?did=bob"] {
        let (code, out) = w.get(&w.admin, &format!("{SUBJECT}{wrong}")).await;
        assert_eq!(
            (code, out["error"].as_str()),
            (400, Some("InvalidRequest")),
            "{wrong}"
        );
    }
}

#[tokio::test]
async fn a_server_with_no_index_moderates_nothing() {
    let served = common::served().await;
    for path in [LIST, STATUS, DEFINITIONS, SUBJECT, QUERY] {
        let (code, out) = served.get(path).await;
        if path == DEFINITIONS {
            assert_eq!(
                code, 401,
                "{path}: it keeps nothing to read, but asks who is asking"
            );
            continue;
        }
        assert_eq!(
            (code, out["error"].as_str()),
            (501, Some("MethodNotImplemented")),
            "{path}"
        );
    }
    for path in [REPORT, RESOLVE, UPDATE, APPLY, NEGATE] {
        let (code, out) = served.post(path, &json!({})).await;
        assert_eq!(
            (code, out["error"].as_str()),
            (501, Some("MethodNotImplemented")),
            "{path}"
        );
    }
}

#[tokio::test]
async fn anyone_reads_what_each_label_means() {
    let w = world().await;
    let (status, answered, out) = w.served.get_answered(DESCRIBE, &[]).await;
    assert_eq!(status, 200, "{out}");
    assert_eq!(out["did"], AUD);
    // Shared alike by every asker.
    assert_eq!(common::caching(&answered).1, None);
    let values: Vec<&str> = out["policies"]["labelValues"]
        .as_array()
        .unwrap()
        .iter()
        .map(|v| v.as_str().unwrap())
        .collect();
    let defined = out["policies"]["labelValueDefinitions"].as_array().unwrap();
    assert_eq!(values.len(), defined.len() + 1, "{values:?}");
    assert_eq!(values[0], "!takedown");
    for (value, definition) in values[1..].iter().zip(defined) {
        assert_eq!(definition["identifier"], *value);
    }
    // Every label an admin may give out of grain's own.
    let (_, listed) = w.get(&w.admin, DEFINITIONS).await;
    assert_eq!(listed["definitions"].as_array().unwrap(), defined);
    assert!(values.contains(&"csae") && values.contains(&"nudity"));

    // A server with no DID says what its labels mean, under no name.
    let (status, out) = common::served().await.get(DESCRIBE).await;
    assert_eq!(status, 200, "{out}");
    assert!(out.get("did").is_none(), "{out}");
    let described = out["policies"]["labelValueDefinitions"].as_array();
    assert_eq!(described.unwrap(), defined);
}

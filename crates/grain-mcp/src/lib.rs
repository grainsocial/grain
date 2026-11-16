//! An MCP server for grain's moderation: reporting, and, for an admin of
//! grain's appview, its reports, takedowns and labels
//! ([`grain::moderation`]), as the account `grain login` last logged in,
//! or `GRAIN_IDENTIFIER`.
//!
//! What a report or label about the safety of children is about is never
//! sent to a model. An account is child safety when grain's appview says
//! so (`childSafety`: a child-safety report on it or its records, by label
//! or reason type, in any state, or a `csae` label, negated or not, or its
//! author's own), or does not say. Every report on such an account or its
//! records, and every child-safety report ([`grain::labels::child_safety`]),
//! is answered by its ids and dates alone, never its text; the account is
//! answered without its records; and acting on any of it is refused, for a
//! person to do with the `grain` command line ([`HUMAN`]). Each answer is built from the fields it may carry
//! ([`REPORT_FIELDS`], [`ACCOUNT_FIELDS`]), so a field the appview adds is
//! left out until it is named here.

use grain::env::Ctx;
use grain::labels;
use grain::moderation::{self, Appview};
use rmcp::handler::server::wrapper::Parameters;
use rmcp::model::{CallToolResult, ContentBlock};
use rmcp::{ErrorData as McpError, ServerHandler, schemars, tool, tool_handler, tool_router};
use serde::Deserialize;
use serde_json::{Map, Value, json};
use std::collections::HashSet;

/// What a tool says in place of what concerns the safety of a child.
pub const HUMAN: &str = "This concerns the safety of a child. What it is about is never shown to a model, and acting on it is for a person: an admin handles it with the grain command line, `grain admin reports --label csae` and `grain admin account <did>`.";

/// What a tool says of a child-safety report, besides its ids and dates.
pub const REPORT_FIELDS: &[&str] = &[
    "id",
    "subject",
    "subjectDid",
    "label",
    "reasonType",
    "reportedBy",
    "status",
    "resolvedBy",
    "resolvedAt",
    "createdAt",
];

/// What a tool says of an account with a child-safety report or label
/// ([`REPORT_FIELDS`] of each report).
pub const ACCOUNT_FIELDS: &[&str] = &["did", "handle", "status", "counts", "labels", "childSafety"];

/// `value` with only the fields `kept` names.
fn only(value: &Value, kept: &[&str]) -> Value {
    let all = value.as_object().cloned().unwrap_or_default();
    let kept: Map<String, Value> = all
        .into_iter()
        .filter(|(k, _)| kept.contains(&k.as_str()))
        .collect();
    Value::Object(kept)
}

/// Whether `report`, a `social.grain.admin.defs#reportView`, is about the
/// safety of a child.
pub fn child_safety(report: &Value) -> bool {
    let label = report["label"].as_str().unwrap_or_default();
    labels::child_safety(label, report["reasonType"].as_str())
}

/// `report` as a model may see it: whole, or for a child-safety one, or
/// one on an account that is (`on_child_safety`), its ids and dates and
/// why the rest is withheld.
pub fn shown_report(report: &Value, on_child_safety: bool) -> Value {
    if !on_child_safety && !child_safety(report) {
        return report.clone();
    }
    let mut shown = only(report, REPORT_FIELDS);
    shown["withheld"] = HUMAN.into();
    shown
}

/// `listReports`'s answer as a model may see it ([`shown_report`]), the
/// accounts in `clear` alone not child safety: a report naming no account
/// is taken to be on one that is.
pub fn shown_reports(found: &Value, clear: &HashSet<String>) -> Value {
    let mut shown = found.clone();
    if let Some(reports) = shown["reports"].as_array_mut() {
        for report in reports {
            let did = report["subjectDid"].as_str().unwrap_or_default();
            *report = shown_report(report, !clear.contains(did));
        }
    }
    shown
}

/// The accounts `found`, a `listReports` answer, names that grain's
/// appview says are not child safety ([`clear`]).
async fn cleared(appview: &Appview, found: &Value) -> HashSet<String> {
    let reports = found["reports"].as_array().into_iter().flatten();
    let dids: HashSet<&str> = reports.filter_map(|r| r["subjectDid"].as_str()).collect();
    let mut cleared = HashSet::new();
    for did in dids {
        if clear(appview, did).await {
            cleared.insert(did.to_string());
        }
    }
    cleared
}

/// `getReviewSubject`'s answer as a model may see it: whole, or for an
/// account with a child-safety report or label, without its records or
/// any report's text.
pub fn shown_account(found: &Value) -> Value {
    if found["childSafety"].as_bool() == Some(false) {
        return found.clone();
    }
    let mut shown = only(found, ACCOUNT_FIELDS);
    let reports = found["reports"].as_array().into_iter().flatten();
    let reports = reports.map(|r| {
        let mut r = only(r, REPORT_FIELDS);
        r["withheld"] = HUMAN.into();
        r
    });
    shown["reports"] = reports.collect::<Vec<_>>().into();
    shown["childSafety"] = true.into();
    shown["withheld"] = HUMAN.into();
    shown
}

/// A tool's answer: JSON, or an error the model can read and act on.
fn answer(res: anyhow::Result<Value>) -> Result<CallToolResult, McpError> {
    Ok(match res {
        Ok(value) => CallToolResult::success(vec![ContentBlock::text(value.to_string())]),
        Err(err) => CallToolResult::error(vec![ContentBlock::text(failed(&err))]),
    })
}

/// What a tool says of `err`: with, for a PDS refusing a call for want of
/// scope, how the user grants it.
fn failed(err: &anyhow::Error) -> String {
    let said = format!("{err:#}");
    match grain::oauth::out_of_scope(&said) {
        true => format!("{said}\n\n{LOG_IN_AGAIN}"),
        false => said,
    }
}

/// How the user grants what their login lacks, said to the model.
const LOG_IN_AGAIN: &str = "The PDS refused this because the login grain acts with is older than what grain asks for now. Ask the user to run `grain login <handle>` in a terminal to allow it.";

#[derive(Deserialize, schemars::JsonSchema)]
pub struct Report {
    /// An account (its handle or DID) or a record (its at:// URI).
    pub subject: String,
    /// spam, misleading, sexual, rude, violation, other, copyright, nudity
    /// or child-safety, or a com.atproto.moderation.defs#reasonType.
    pub reason: String,
    /// What the moderators should know.
    pub text: Option<String>,
}

#[derive(Deserialize, schemars::JsonSchema)]
pub struct Reports {
    /// open (the default), resolved or dismissed.
    pub status: Option<String>,
    /// Only reports asking for this label.
    pub label: Option<String>,
    /// How many, newest first: 50 by default, 100 at most.
    pub limit: Option<usize>,
    /// The cursor the last page gave, for the next.
    pub cursor: Option<String>,
}

#[derive(Deserialize, schemars::JsonSchema)]
pub struct Resolve {
    /// The report's id.
    pub id: i64,
    /// resolve (giving out the label it asks for) or dismiss.
    pub action: String,
}

#[derive(Deserialize, schemars::JsonSchema)]
pub struct Takedown {
    /// An account (its handle or DID) or a record (its at:// URI).
    pub subject: String,
    /// false puts it back; true, the default, takes it down.
    pub applied: Option<bool>,
}

#[derive(Deserialize, schemars::JsonSchema)]
pub struct Subject {
    /// An account (its handle or DID) or a record (its at:// URI).
    pub subject: String,
}

#[derive(Deserialize, schemars::JsonSchema)]
pub struct Label {
    /// An account (its handle or DID) or a record (its at:// URI).
    pub subject: String,
    /// The label, one of list_label_definitions'.
    pub val: String,
    /// true negates it.
    pub negate: Option<bool>,
}

#[derive(Deserialize, schemars::JsonSchema)]
pub struct Account {
    /// A handle or DID.
    pub actor: String,
}

#[derive(Deserialize, schemars::JsonSchema)]
pub struct QueryLabels {
    /// Subjects (bare DIDs or at:// URIs), or prefixes ending in `*`.
    pub patterns: Vec<String>,
}

/// Whether grain's appview says the account `did` is not child safety;
/// not, when it cannot say.
async fn clear(appview: &Appview, did: &str) -> bool {
    let found = appview.account(did).await;
    found.is_ok_and(|a| a["childSafety"].as_bool() == Some(false))
}

#[derive(Clone)]
pub struct Server {
    ctx: Ctx,
}

impl Server {
    pub fn new(ctx: Ctx) -> Server {
        Server { ctx }
    }

    async fn appview(&self) -> anyhow::Result<Appview> {
        Appview::new(&self.ctx).await
    }

    /// Refuses, for a person, acting on `target`'s account when grain's
    /// appview has had a child-safety report about it or a `csae` label on
    /// it ([`HUMAN`]).
    async fn not_child_safety(&self, appview: &Appview, target: &str) -> anyhow::Result<()> {
        let target = target.trim().trim_start_matches('@');
        let authority = match target.strip_prefix("at://") {
            Some(path) => path.split('/').next().unwrap_or_default(),
            None => target,
        };
        let did = moderation::account(&self.ctx, authority).await?;
        if !clear(appview, &did).await {
            anyhow::bail!("{HUMAN}");
        }
        Ok(())
    }

    /// Refuses, for a person, closing a child-safety report
    /// ([`child_safety`], by its label or its reason type), or any report
    /// on an account that is child safety; and, failing closed, any report
    /// it cannot read by its id or judge.
    async fn not_a_child_safety_report(&self, appview: &Appview, id: i64) -> anyhow::Result<()> {
        let report = appview.report_by_id(id).await.map_err(|e| {
            anyhow::anyhow!("report {id} could not be read, so it is not closed here: {e:#}")
        })?;
        let did = report["subjectDid"].as_str();
        if report["id"].as_i64() != Some(id) || did.is_none() || child_safety(&report) {
            anyhow::bail!("{HUMAN}");
        }
        if !clear(appview, did.unwrap_or_default()).await {
            anyhow::bail!("{HUMAN}");
        }
        Ok(())
    }
}

#[tool_router]
impl Server {
    #[tool(
        description = "Report an account or a record to grain's moderators, as the account grain is logged in as. Answers the report's id."
    )]
    async fn report(&self, Parameters(p): Parameters<Report>) -> Result<CallToolResult, McpError> {
        answer(
            async {
                let appview = self.appview().await?;
                let made = appview.report(&p.subject, &p.reason, p.text.as_deref());
                Ok(json!({"id": made.await?["id"]}))
            }
            .await,
        )
    }

    #[tool(
        description = "As an admin of grain's appview (an account its GRAIN_ADMIN_DIDS names), the reports, newest first, open ones unless status says otherwise. A child-safety report (label csae, or a child-safety reason type), and every report on an account with any child-safety report or label, is answered by its ids, label and dates alone: its text is never shown to a model, and it is for a person to handle with the grain command line."
    )]
    async fn list_reports(
        &self,
        Parameters(p): Parameters<Reports>,
    ) -> Result<CallToolResult, McpError> {
        answer(
            async {
                let appview = self.appview().await?;
                let (status, label) = (p.status.as_deref(), p.label.as_deref());
                let limit = p.limit.unwrap_or(50);
                let found = appview.reports(status, label, limit, p.cursor.as_deref());
                let found = found.await?;
                let clear = cleared(&appview, &found).await;
                Ok(shown_reports(&found, &clear))
            }
            .await,
        )
    }

    #[tool(
        description = "As an admin, close an open report: resolve gives out the label it asks for on its subject, dismiss gives out nothing. A child-safety report, or any report on an account with a child-safety report or label, is refused: a person closes it with the grain command line."
    )]
    async fn resolve_report(
        &self,
        Parameters(p): Parameters<Resolve>,
    ) -> Result<CallToolResult, McpError> {
        answer(
            async {
                let resolve = match p.action.as_str() {
                    "resolve" => true,
                    "dismiss" => false,
                    _ => anyhow::bail!("action is resolve or dismiss"),
                };
                let appview = self.appview().await?;
                self.not_a_child_safety_report(&appview, p.id).await?;
                appview.close(p.id, resolve).await?;
                Ok(json!({"id": p.id, "status": if resolve { "resolved" } else { "dismissed" }}))
            }
            .await,
        )
    }

    #[tool(
        description = "As an admin, take an account or a record down, or put it back (applied false). Refused for an account with a child-safety report or label, or a record of one: a person acts on it with the grain command line."
    )]
    async fn takedown(
        &self,
        Parameters(p): Parameters<Takedown>,
    ) -> Result<CallToolResult, McpError> {
        answer(
            async {
                let appview = self.appview().await?;
                self.not_child_safety(&appview, &p.subject).await?;
                let applied = p.applied.unwrap_or(true);
                appview.takedown(&p.subject, applied).await
            }
            .await,
        )
    }

    #[tool(description = "As an admin, whether an account or a record is taken down.")]
    async fn moderation_status(
        &self,
        Parameters(p): Parameters<Subject>,
    ) -> Result<CallToolResult, McpError> {
        answer(async { self.appview().await?.status(&p.subject).await }.await)
    }

    #[tool(
        description = "As an admin, give out a label on an account or a record as grain's labeler, or negate it. The csae label, and any label on an account with a child-safety report or label, are refused: a person gives those with the grain command line. A takedown is the takedown tool's."
    )]
    async fn label(&self, Parameters(p): Parameters<Label>) -> Result<CallToolResult, McpError> {
        answer(
            async {
                if p.val == labels::CSAE {
                    anyhow::bail!("{HUMAN}");
                }
                let appview = self.appview().await?;
                self.not_child_safety(&appview, &p.subject).await?;
                let negate = p.negate.unwrap_or(false);
                appview.label(&p.subject, &p.val, negate).await?;
                Ok(json!({"subject": p.subject, "val": p.val, "neg": negate}))
            }
            .await,
        )
    }

    #[tool(
        description = "As an admin, an account's moderation whole: whether it is taken down, the labels on it and its records, every report about them, and its newest records of each kind with their counts. For an account with a child-safety report or label (childSafety true), only its ids, status, counts and labels, and its reports' ids and dates: its records and any report's text are never shown to a model, and it is for a person to review with the grain command line."
    )]
    async fn account(
        &self,
        Parameters(p): Parameters<Account>,
    ) -> Result<CallToolResult, McpError> {
        answer(
            async {
                Ok(shown_account(
                    &self.appview().await?.account(&p.actor).await?,
                ))
            }
            .await,
        )
    }

    #[tool(description = "As an admin, the labels grain's labeler gives out, and what each means.")]
    async fn list_label_definitions(&self) -> Result<CallToolResult, McpError> {
        answer(async { self.appview().await?.definitions().await }.await)
    }

    #[tool(
        description = "The labels standing on subjects (bare DIDs or at:// URIs) or on prefixes ending in *. Anyone may ask."
    )]
    async fn query_labels(
        &self,
        Parameters(p): Parameters<QueryLabels>,
    ) -> Result<CallToolResult, McpError> {
        answer(
            async {
                let patterns: Vec<&str> = p.patterns.iter().map(String::as_str).collect();
                self.appview().await?.query_labels(&patterns).await
            }
            .await,
        )
    }
}

#[tool_handler(
    name = "grain",
    instructions = "Moderation of grain, a photo sharing app on atproto. Report an account or record with report. An admin of grain's appview (an account its GRAIN_ADMIN_DIDS names) reads reports with list_reports and an account's moderation with account, closes reports with resolve_report, takes accounts and records down or puts them back with takedown (see moderation_status), and gives out or negates labels with label (see list_label_definitions and query_labels). Anything about the safety of a child (a child-safety report, or the csae label) is never shown here: such a report or account is answered by its ids and dates alone, and acting on it is refused, for a person to handle with the grain command line (`grain admin reports --label csae`, `grain admin account <did>`). Do not try to work around this: tell the user it needs them."
)]
impl ServerHandler for Server {}

/// Serves MCP over stdin and stdout until the client hangs up.
pub async fn serve_stdio(ctx: Ctx) -> anyhow::Result<()> {
    use rmcp::ServiceExt;
    let running = Server::new(ctx).serve(rmcp::transport::stdio()).await?;
    running.waiting().await?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    const SECRET: &str = "what the child-safety report said";

    fn csae_report() -> Value {
        json!({"id": 3, "subject": "at://did:plc:b/social.grain.gallery/x", "subjectDid": "did:plc:b",
            "label": "csae", "reason": SECRET, "reportedBy": "did:plc:a",
            "reportedByHandle": "a.test", "status": "open", "createdAt": "2026-10-31T00:00:00Z",
            "somethingNew": SECRET})
    }

    #[test]
    fn a_child_safety_report_is_shown_by_its_ids_alone() {
        let shown = shown_report(&csae_report(), false);
        assert!(!shown.to_string().contains(SECRET), "{shown}");
        assert_eq!(shown["id"], 3);
        assert_eq!(shown["subjectDid"], "did:plc:b");
        assert_eq!(shown["withheld"], HUMAN);
        // By its reason type, whatever its label.
        let mut by_reason = csae_report();
        by_reason["label"] = "other".into();
        by_reason["reasonType"] = "tools.ozone.report.defs#reasonChildSafetyGroom".into();
        assert!(!shown_report(&by_reason, false).to_string().contains(SECRET));
        let spam = json!({"id": 4, "subjectDid": "did:plc:c", "label": "spam", "reason": "ads"});
        assert_eq!(shown_report(&spam, false), spam);
        // Any report on an account that is child safety, whatever it asks.
        let on_b = json!({"id": 5, "subjectDid": "did:plc:b", "label": "spam", "reason": SECRET});
        let shown = shown_report(&on_b, true);
        assert_eq!(
            (shown["id"].clone(), shown["withheld"].clone()),
            (json!(5), json!(HUMAN))
        );
        assert!(!shown.to_string().contains(SECRET), "{shown}");
        let all = json!({"reports": [csae_report(), spam, on_b, {"id": 6, "reason": SECRET}], "total": 4});
        let clear = HashSet::from(["did:plc:c".to_string()]);
        let listed = shown_reports(&all, &clear);
        assert!(!listed.to_string().contains(SECRET), "{listed}");
        assert_eq!(listed["reports"][1]["reason"], "ads");
        assert_eq!(listed["total"], 4);
    }

    #[test]
    fn an_account_with_child_safety_is_shown_without_its_records() {
        let found = json!({"did": "did:plc:b", "handle": "b.test", "status": "active",
            "counts": [{"collection": "social.grain.gallery", "count": 1}],
            "labels": [{"val": "csae"}], "childSafety": true,
            "records": [{"value": {"title": SECRET}}], "reports": [csae_report()]});
        let shown = shown_account(&found);
        assert!(!shown.to_string().contains(SECRET), "{shown}");
        assert_eq!(shown["reports"][0]["id"], 3);
        assert_eq!(shown["counts"], found["counts"]);
        assert_eq!(shown["withheld"], HUMAN);
        assert!(shown.get("records").is_none());
        // An answer that does not say is taken to have it.
        let unsaid = json!({"did": "did:plc:b", "records": [{"value": {"title": SECRET}}]});
        assert!(!shown_account(&unsaid).to_string().contains(SECRET));
        let clean = json!({"did": "did:plc:c", "childSafety": false, "records": []});
        assert_eq!(shown_account(&clean), clean);
    }

    #[test]
    fn refusals_for_want_of_scope_say_how_to_log_in_again() {
        let said = failed(&anyhow::anyhow!(
            "InvalidToken (403): Scope does not permit it"
        ));
        assert!(said.ends_with(LOG_IN_AGAIN), "{said}");
        assert_eq!(failed(&anyhow::anyhow!("no")), "no");
    }
}

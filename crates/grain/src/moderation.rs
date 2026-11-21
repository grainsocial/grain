//! Moderation from the command line and MCP: reporting to grain, and, for
//! its admins, what grain-serve's moderation methods do
//! (`grain-serve`'s `moderation`).
//!
//! Each call is made as the account this machine acts as
//! ([`session::me`]), with a service token from its PDS for the method,
//! naming the appview `GRAIN_APPVIEW` by its DID: `GRAIN_APPVIEW_DID`, or
//! the `did:web` of its host ([`identity::service_did`]).
//! The appview lets an admin's calls in only from the accounts it names
//! in `GRAIN_ADMIN_DIDS`.

use crate::auth;
use crate::env::Ctx;
use crate::identity;
use crate::session::{self, Session};
use crate::xrpc::{Auth, Xrpc};
use anyhow::{Context, Result, bail};
use serde_json::{Value, json};

pub const CREATE_REPORT: &str = "com.atproto.moderation.createReport";
pub const QUERY_LABELS: &str = "com.atproto.label.queryLabels";
pub const UPDATE_STATUS: &str = "com.atproto.admin.updateSubjectStatus";
pub const GET_STATUS: &str = "com.atproto.admin.getSubjectStatus";
pub const LIST_REPORTS: &str = "social.grain.admin.listReports";
pub const RESOLVE_REPORT: &str = "social.grain.admin.resolveReport";
pub const GET_REPORT: &str = "social.grain.admin.getReport";
pub const APPLY_LABEL: &str = "social.grain.admin.applyLabel";
pub const NEGATE_LABEL: &str = "social.grain.admin.negateLabel";
pub const LIST_DEFINITIONS: &str = "social.grain.admin.listLabelDefinitions";
pub const GET_SUBJECT: &str = "social.grain.admin.getReviewSubject";
pub const DESCRIBE_LABELS: &str = "social.grain.moderation.describeLabels";

/// The methods the command line and MCP call with a service token, which
/// an OAuth login asks to be let call ([`crate::oauth::loopback_scope`]).
pub const CALLED: &[&str] = &[
    CREATE_REPORT,
    UPDATE_STATUS,
    GET_STATUS,
    LIST_REPORTS,
    RESOLVE_REPORT,
    GET_REPORT,
    APPLY_LABEL,
    NEGATE_LABEL,
    LIST_DEFINITIONS,
    GET_SUBJECT,
];

/// The reasons a report gives by a short name, and the `reasonType` each
/// is.
pub const REASONS: &[(&str, &str)] = &[
    ("spam", "com.atproto.moderation.defs#reasonSpam"),
    ("misleading", "com.atproto.moderation.defs#reasonMisleading"),
    ("sexual", "com.atproto.moderation.defs#reasonSexual"),
    ("rude", "com.atproto.moderation.defs#reasonRude"),
    ("violation", "com.atproto.moderation.defs#reasonViolation"),
    ("other", "com.atproto.moderation.defs#reasonOther"),
    ("copyright", "social.grain.moderation.defs#reasonCopyright"),
    ("nudity", "social.grain.moderation.defs#reasonNudity"),
    (
        "child-safety",
        "tools.ozone.report.defs#reasonChildSafetyOther",
    ),
];

/// The `reasonType` of `reason`: a short name of [`REASONS`], or a
/// `reasonType` grain files under a label ([`crate::labels::label_for`]).
pub fn reason_type(reason: &str) -> Result<String> {
    if let Some((_, full)) = REASONS.iter().find(|(short, _)| *short == reason) {
        return Ok(full.to_string());
    }
    if crate::labels::label_for(reason).is_some() {
        return Ok(reason.to_string());
    }
    let names: Vec<&str> = REASONS.iter().map(|(short, _)| *short).collect();
    bail!(
        "{reason}: a reason is {}, or a reasonType",
        names.join(", ")
    )
}

/// What a report or takedown is about, as atproto names it: an account
/// (`com.atproto.admin.defs#repoRef`) by its handle or DID, or a record as
/// its PDS has it now (`com.atproto.repo.strongRef`) by its `at://` URI.
/// A DID is taken as it is, so an account gone from its host can still be
/// named.
pub async fn subject(ctx: &Ctx, target: &str) -> Result<Value> {
    let target = target.trim().trim_start_matches('@');
    let Some(path) = target.strip_prefix("at://") else {
        let did = account(ctx, target).await?;
        return Ok(json!({"$type": "com.atproto.admin.defs#repoRef", "did": did}));
    };
    let mut parts = path.split('/');
    let (Some(authority), Some(collection), Some(rkey), None) =
        (parts.next(), parts.next(), parts.next(), parts.next())
    else {
        bail!("{target}: a record's URI is at://<account>/<collection>/<key>");
    };
    let did = account(ctx, authority).await?;
    let pds = identity::resolve(ctx, &did).await?.pds;
    #[derive(serde::Deserialize)]
    struct Found {
        uri: String,
        cid: String,
    }
    let found: Found = Xrpc::new(ctx.guarded.clone(), &pds)
        .query(
            "com.atproto.repo.getRecord",
            &[("repo", &did), ("collection", collection), ("rkey", rkey)],
            None,
        )
        .await
        .with_context(|| format!("reading {target}"))?;
    Ok(json!({"$type": "com.atproto.repo.strongRef", "uri": found.uri, "cid": found.cid}))
}

/// The DID of `account`, a DID or a handle.
pub async fn account(ctx: &Ctx, account: &str) -> Result<String> {
    let account = account.trim_start_matches('@');
    if atproto::syntax::is_did(account) {
        return Ok(account.to_string());
    }
    Ok(identity::resolve(ctx, account).await?.did)
}

/// The account or record a subject names: an account's bare DID, or a
/// record's AT-URI, as grain's reports and labels name them.
pub fn subject_key(subject: &Value) -> &str {
    subject["did"]
        .as_str()
        .or(subject["uri"].as_str())
        .unwrap_or_default()
}

/// grain's appview, called as the account this machine acts as.
pub struct Appview {
    ctx: Ctx,
    xrpc: Xrpc,
    me: Session,
    /// The appview's DID, which its service tokens are for.
    pub did: String,
}

impl Appview {
    pub async fn new(ctx: &Ctx) -> Result<Appview> {
        let did = match &ctx.env.appview_did {
            Some(did) => did.clone(),
            None => identity::service_did(&ctx.env.appview)
                .with_context(|| format!("GRAIN_APPVIEW {}", ctx.env.appview))?,
        };
        let me = session::me(ctx).await?;
        Ok(Appview {
            ctx: ctx.clone(),
            xrpc: Xrpc::new(ctx.http.clone(), &ctx.env.appview),
            me,
            did,
        })
    }

    async fn auth(&self, lxm: &str) -> Result<Auth> {
        let token = auth::service_token(&self.ctx, &self.me, &self.did, lxm).await?;
        Ok(Auth::Bearer(token))
    }

    async fn query(&self, lxm: &str, params: &[(&str, &str)]) -> Result<Value> {
        let auth = self.auth(lxm).await?;
        self.xrpc.query(lxm, params, Some(&auth)).await
    }

    async fn procedure(&self, lxm: &str, body: Value) -> Result<Value> {
        let auth = self.auth(lxm).await?;
        self.xrpc.procedure(lxm, Some(&body), Some(&auth)).await
    }

    /// Reports `target` ([`subject`]) for `reason` ([`reason_type`]).
    pub async fn report(&self, target: &str, reason: &str, text: Option<&str>) -> Result<Value> {
        let reason_type = reason_type(reason)?;
        let subject = subject(&self.ctx, target).await?;
        let mut body = json!({"reasonType": reason_type, "subject": subject});
        if let Some(text) = text {
            body["reason"] = text.into();
        }
        self.procedure(CREATE_REPORT, body).await
    }

    /// Reports, newest first: open ones unless `status` names another,
    /// asking for `label` if given, past `cursor`.
    pub async fn reports(
        &self,
        status: Option<&str>,
        label: Option<&str>,
        limit: usize,
        cursor: Option<&str>,
    ) -> Result<Value> {
        let limit = limit.to_string();
        let mut params = vec![("limit", limit.as_str())];
        let named = [("status", status), ("label", label), ("cursor", cursor)];
        params.extend(named.into_iter().filter_map(|(k, v)| Some((k, v?))));
        self.query(LIST_REPORTS, &params).await
    }

    /// The report `id`, in any state.
    pub async fn report_by_id(&self, id: i64) -> Result<Value> {
        let id = id.to_string();
        let found = self.query(GET_REPORT, &[("id", &id)]).await?;
        Ok(found["report"].clone())
    }

    /// Closes the open report `id`: resolving it gives out the label it
    /// asked for, dismissing it does not.
    pub async fn close(&self, id: i64, resolve: bool) -> Result<()> {
        let action = if resolve { "resolve" } else { "dismiss" };
        let body = json!({"id": id, "action": action});
        self.procedure(RESOLVE_REPORT, body).await?;
        Ok(())
    }

    /// Takes `target` ([`subject`]) down, or puts it back.
    pub async fn takedown(&self, target: &str, applied: bool) -> Result<Value> {
        let subject = subject(&self.ctx, target).await?;
        let body = json!({"subject": subject, "takedown": {"applied": applied}});
        self.procedure(UPDATE_STATUS, body).await
    }

    /// Whether `target` ([`subject`]) is taken down.
    pub async fn status(&self, target: &str) -> Result<Value> {
        let subject = subject(&self.ctx, target).await?;
        let key = subject_key(&subject);
        let param = if subject["did"].is_string() {
            "did"
        } else {
            "uri"
        };
        self.query(GET_STATUS, &[(param, key)]).await
    }

    /// Gives out the label `val` on `target` ([`subject`]), or negates it.
    pub async fn label(&self, target: &str, val: &str, negate: bool) -> Result<()> {
        let subject = subject(&self.ctx, target).await?;
        let body = json!({"uri": subject_key(&subject), "val": val});
        let lxm = if negate { NEGATE_LABEL } else { APPLY_LABEL };
        self.procedure(lxm, body).await?;
        Ok(())
    }

    /// The labels grain gives out.
    pub async fn definitions(&self) -> Result<Value> {
        self.query(LIST_DEFINITIONS, &[]).await
    }

    /// What the moderation of `account`, a handle or DID, stands at.
    pub async fn account(&self, who: &str) -> Result<Value> {
        let did = account(&self.ctx, who).await?;
        self.query(GET_SUBJECT, &[("did", &did)]).await
    }

    /// The labels standing on `patterns`, each a subject or a prefix
    /// ending in `*`. Anyone may ask.
    pub async fn query_labels(&self, patterns: &[&str]) -> Result<Value> {
        let params: Vec<(&str, &str)> = patterns.iter().map(|p| ("uriPatterns", *p)).collect();
        self.xrpc.query(QUERY_LABELS, &params, None).await
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reasons_by_name_or_in_full() {
        assert_eq!(
            reason_type("spam").unwrap(),
            "com.atproto.moderation.defs#reasonSpam"
        );
        for (short, full) in REASONS {
            assert_eq!(reason_type(short).unwrap(), *full);
            assert!(crate::labels::label_for(full).is_some(), "{full}");
        }
        let ozone = "tools.ozone.report.defs#reasonChildSafetyCSAM";
        assert_eq!(reason_type(ozone).unwrap(), ozone);
        let why = reason_type("boring").unwrap_err().to_string();
        assert!(
            why.starts_with("boring: a reason is spam, misleading"),
            "{why}"
        );
    }

    #[test]
    fn a_subjects_key_is_its_did_or_its_uri() {
        let did = json!({"$type": "com.atproto.admin.defs#repoRef", "did": "did:plc:a"});
        assert_eq!(subject_key(&did), "did:plc:a");
        let uri = json!({"uri": "at://did:plc:a/x.y/z", "cid": "c"});
        assert_eq!(subject_key(&uri), "at://did:plc:a/x.y/z");
        assert_eq!(subject_key(&json!({})), "");
    }
}

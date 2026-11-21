//! Moderation, as atproto has it: reports in, labels and takedowns out.
//!
//! Anyone signed in reports an account or a record
//! (`com.atproto.moderation.createReport`), with a service token from
//! their PDS or the web's cookie; the report is filed under the label its
//! reason asks for ([`grain::labels::label_for`]). Anyone reads the labels
//! grain gives out (`com.atproto.label.queryLabels`), and what each of them
//! means (`social.grain.moderation.describeLabels`), as a Bluesky labeler's
//! service record says. An account's labels name it by its bare DID, never
//! `at://<did>`, as Bluesky's do.
//!
//! The admins, the accounts `GRAIN_ADMIN_DIDS` names, each calling with a
//! service token for the method from their own PDS, and only so:
//!
//! - list reports and close them (`social.grain.admin.listReports`,
//!   `resolveReport`), resolving one giving out the label it asked for;
//! - take an account or a record down and put it back
//!   (`com.atproto.admin.updateSubjectStatus`, `getSubjectStatus`): an
//!   account by `takedown`, which every read leaves out, and a `!takedown`
//!   label on it; a record by the `!takedown` label alone, which reads
//!   leave out as they leave out every label that hides;
//! - give out labels and negate them (`social.grain.admin.applyLabel`,
//!   `negateLabel`), of the ones grain defines
//!   (`social.grain.admin.listLabelDefinitions`) or atproto's own;
//! - see what an account's moderation stands at
//!   (`social.grain.admin.getReviewSubject`): its labels and its records',
//!   the reports against them, a sample of its records, and whether any of
//!   it touches the safety of children.

use crate::App;
use crate::index::moderation::{Filter, NewReport, Report, TAKEDOWN};
use crate::index::{Index, Label, record_uri};
use crate::read::Params;
use crate::xrpc::Failure;
use axum::body::Bytes;
use axum::extract::State;
use axum::http::{HeaderMap, StatusCode, Uri};
use axum::routing::{get, post};
use axum::{Json, Router};
use grain::{labels, lexicon};
use serde::Deserialize;
use serde_json::{Value, json};
use std::sync::Arc;
use unicode_segmentation::UnicodeSegmentation;

pub use grain::moderation::{
    APPLY_LABEL, CREATE_REPORT, DESCRIBE_LABELS, GET_REPORT, GET_STATUS, GET_SUBJECT,
    LIST_DEFINITIONS, LIST_REPORTS, NEGATE_LABEL, QUERY_LABELS, RESOLVE_REPORT, UPDATE_STATUS,
};

const REPO_REF: &str = "com.atproto.admin.defs#repoRef";
const STRONG_REF: &str = "com.atproto.repo.strongRef";

/// How many of each collection's records `getReviewSubject` samples.
const SAMPLED: usize = 6;
/// The most graphemes a report's `reason` holds, as its lexicon bounds it.
const REASON_GRAPHEMES: usize = 2000;
/// The longest a label's value may be, as `applyLabel` bounds it.
const LABEL_LENGTH: usize = 128;

/// `router` with the moderation methods.
pub fn routes(router: Router<Arc<App>>) -> Router<Arc<App>> {
    let at = |nsid: &str| format!("/xrpc/{nsid}");
    router
        .route(&at(CREATE_REPORT), post(create_report))
        .route(&at(QUERY_LABELS), get(query_labels))
        .route(&at(DESCRIBE_LABELS), get(describe_labels))
        .route(&at(UPDATE_STATUS), post(update_subject_status))
        .route(&at(GET_STATUS), get(get_subject_status))
        .route(&at(LIST_REPORTS), get(list_reports))
        .route(&at(GET_REPORT), get(get_report))
        .route(&at(RESOLVE_REPORT), post(resolve_report))
        .route(&at(APPLY_LABEL), post(apply_label))
        .route(&at(NEGATE_LABEL), post(negate_label))
        .route(&at(LIST_DEFINITIONS), get(list_definitions))
        .route(&at(GET_SUBJECT), get(get_review_subject))
}

fn index(app: &App) -> Result<&Index, Failure> {
    let why = "this server keeps no index";
    let none = || Failure::new(StatusCode::NOT_IMPLEMENTED, "MethodNotImplemented", why);
    app.index.as_deref().ok_or_else(none)
}

fn parse<T: serde::de::DeserializeOwned>(body: &[u8]) -> Result<T, Failure> {
    serde_json::from_slice(body).map_err(|e| Failure::invalid(format!("the input: {e}")))
}

/// The admin calling `lxm`, with a service token for it from their PDS,
/// and the DID this server gives out labels as: its own. A caller who is
/// not an admin is refused, as is one who sends no token: the web's
/// cookie does not reach these methods.
async fn admin<'a>(
    app: &'a App,
    headers: &HeaderMap,
    lxm: &str,
) -> Result<(String, &'a str), Failure> {
    if !headers.contains_key(axum::http::header::AUTHORIZATION) {
        return Err(Failure::authentication_required());
    }
    let did = crate::viewer::viewer(app, headers, lxm).await?;
    let did = did.ok_or_else(Failure::authentication_required)?;
    if !app.admins.contains(&did) {
        let why = format!("{did} is not an admin of this server");
        return Err(Failure::new(StatusCode::FORBIDDEN, "Forbidden", why));
    }
    // What an admin reads (reports, who made them, a subject's status) is
    // for no cache to keep.
    crate::viewer::unshared();
    // A token for this server names its DID, so an admin's call has one.
    let src = app.did.as_deref().unwrap_or_default();
    Ok((did, src))
}

/// What a report or takedown is about, as its input names it: an account
/// (`repoRef`) or a record (`strongRef`); as `(subject, its account)`,
/// the subject an account's bare DID or a record's AT-URI.
fn subject(subject: &Value) -> Result<(String, String), Failure> {
    let wrong = || Failure::invalid(format!("a subject is a {REPO_REF} or a {STRONG_REF}"));
    match subject["$type"].as_str() {
        Some(REPO_REF) => {
            let did = subject["did"]
                .as_str()
                .filter(|d| atproto::syntax::is_did(d));
            let did = did.ok_or_else(|| Failure::invalid("a repoRef names a valid did"))?;
            Ok((did.to_string(), did.to_string()))
        }
        Some(STRONG_REF) => {
            let uri = subject["uri"].as_str().unwrap_or_default();
            let (did, _, _) = record_uri(uri)
                .ok_or_else(|| Failure::invalid("a strongRef names a record's at-uri"))?;
            let cid = subject["cid"]
                .as_str()
                .filter(|c| atproto::lexicon::is_cid_string(c));
            cid.ok_or_else(|| Failure::invalid("a strongRef names a valid cid"))?;
            Ok((uri.to_string(), did.to_string()))
        }
        _ => Err(wrong()),
    }
}

/// `report` as `social.grain.admin.defs#reportView`.
pub fn report_view(report: &Report) -> Value {
    let mut view = json!({
        "id": report.id,
        "subject": report.subject,
        "subjectDid": report.subject_did,
        "label": report.label,
        "reportedBy": report.reported_by,
        "status": report.status,
        "createdAt": report.created_at,
    });
    let optional = [
        ("reasonType", &report.reason_type),
        ("reason", &report.reason),
        ("reportedByHandle", &report.reported_by_handle),
        ("resolvedBy", &report.resolved_by),
        ("resolvedAt", &report.resolved_at),
    ];
    for (name, value) in optional {
        if let Some(value) = value {
            view[name] = value.as_str().into();
        }
    }
    view
}

/// `label` as `com.atproto.label.defs#label`, unsigned.
pub fn label_view(label: &Label) -> Value {
    let mut view = json!({
        "ver": 1,
        "src": label.src,
        "uri": label.uri,
        "val": label.val,
        "neg": label.neg,
        "cts": label.cts,
    });
    if let Some(exp) = &label.exp {
        view["exp"] = exp.as_str().into();
    }
    view
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ReportInput {
    reason_type: String,
    reason: Option<String>,
    subject: Value,
}

/// `com.atproto.moderation.createReport`: a report from the caller, open.
pub async fn create_report(
    State(app): State<Arc<App>>,
    headers: HeaderMap,
    body: Bytes,
) -> Result<Json<Value>, Failure> {
    let index = index(&app)?;
    let by = crate::viewer::writer(&app, &headers, CREATE_REPORT).await?;
    let input: ReportInput = parse(&body)?;
    let (subject_key, subject_did) = subject(&input.subject)?;
    let label = labels::label_for(&input.reason_type).ok_or_else(|| {
        let why = format!("{} is not a reasonType grain takes", input.reason_type);
        Failure::invalid(why)
    })?;
    let reason = input.reason.as_deref().filter(|r| !r.is_empty());
    if reason.is_some_and(|r| r.graphemes(true).count() > REASON_GRAPHEMES) {
        let why = format!("a reason is {REASON_GRAPHEMES} graphemes at most");
        return Err(Failure::invalid(why));
    }
    let created_at = grain::keys::now_iso();
    let filed = index.file_report(&NewReport {
        subject: &subject_key,
        subject_did: &subject_did,
        label,
        reason_type: Some(&input.reason_type),
        reason,
        reported_by: &by,
        created_at: &created_at,
    })?;
    let mut out = json!({
        "id": filed.id,
        "reasonType": input.reason_type,
        "subject": input.subject,
        "reportedBy": by,
        "createdAt": created_at,
    });
    if let Some(reason) = reason {
        out["reason"] = reason.into();
    }
    Ok(Json(out))
}

/// The parameters `uri` gives, as the queries read them.
fn params(uri: &Uri) -> Params {
    let query = axum::extract::Query::<Vec<(String, String)>>::try_from_uri(uri);
    Params(query.map(|q| q.0).unwrap_or_default())
}

/// A cursor naming the id of the last row a page held.
fn cursor(params: &Params) -> Result<Option<i64>, Failure> {
    let parsed = params.get("cursor").map(str::parse::<i64>).transpose();
    parsed.map_err(|_| Failure::invalid("malformed cursor"))
}

/// `com.atproto.label.queryLabels`: the labels standing on the subjects
/// `uriPatterns` names, each a subject or a prefix ending in `*`, oldest
/// first. Anyone may ask.
pub async fn query_labels(State(app): State<Arc<App>>, uri: Uri) -> Result<Json<Value>, Failure> {
    let index = index(&app)?;
    let params = params(&uri);
    let named = |name: &str| -> Vec<&str> {
        let each = params.0.iter().filter(|(k, _)| k == name);
        each.map(|(_, v)| v.as_str()).collect()
    };
    let (patterns, sources) = (named("uriPatterns"), named("sources"));
    if patterns.is_empty() {
        return Err(Failure::invalid(
            "Params must have the property \"uriPatterns\"",
        ));
    }
    if let Some(wrong) = sources.iter().find(|s| !atproto::syntax::is_did(s)) {
        return Err(Failure::invalid(format!("{wrong}: a source is a did")));
    }
    let limit = params.limit(50, 250)?;
    let after = cursor(&params)?.unwrap_or(0);
    let mut found = index.query_labels(&patterns, &sources, after, limit + 1)?;
    let more = found.len() > limit;
    found.truncate(limit);
    let labels: Vec<Value> = found.iter().map(|(_, l)| label_view(l)).collect();
    let mut out = json!({ "labels": labels });
    if more {
        out["cursor"] = found.last().map(|(id, _)| id.to_string()).into();
    }
    Ok(Json(out))
}

#[derive(Deserialize)]
struct StatusInput {
    subject: Value,
    takedown: Option<StatusAttr>,
}

#[derive(Deserialize)]
struct StatusAttr {
    applied: bool,
}

/// `com.atproto.admin.updateSubjectStatus`: an account or a record taken
/// down, or put back. A blob, or an account's deactivation, is not grain's
/// to change.
pub async fn update_subject_status(
    State(app): State<Arc<App>>,
    headers: HeaderMap,
    body: Bytes,
) -> Result<Json<Value>, Failure> {
    let index = index(&app)?;
    let (_, src) = admin(&app, &headers, UPDATE_STATUS).await?;
    let input: StatusInput = parse(&body)?;
    let (key, did) = subject(&input.subject)?;
    let mut out = json!({ "subject": input.subject });
    if let Some(takedown) = input.takedown {
        let now = grain::keys::now_iso();
        match key == did {
            true => index.set_takedown(src, &did, takedown.applied, &now)?,
            false => {
                index.label(&Label {
                    src: src.into(),
                    uri: key,
                    val: TAKEDOWN.into(),
                    neg: !takedown.applied,
                    cts: now,
                    exp: None,
                })?;
            }
        }
        out["takedown"] = json!({ "applied": takedown.applied });
    }
    Ok(Json(out))
}

/// `com.atproto.admin.getSubjectStatus`: whether an account (`did`) or a
/// record (`uri`) is taken down.
pub async fn get_subject_status(
    State(app): State<Arc<App>>,
    headers: HeaderMap,
    uri: Uri,
) -> Result<Json<Value>, Failure> {
    let index = index(&app)?;
    let (_, src) = admin(&app, &headers, GET_STATUS).await?;
    let params = params(&uri);
    let (subject, applied) = match (params.get("did"), params.get("uri")) {
        (Some(did), _) => {
            if !atproto::syntax::is_did(did) {
                return Err(Failure::invalid("did must be a valid did"));
            }
            let subject = json!({"$type": REPO_REF, "did": did});
            (subject, index.taken_down(did)?)
        }
        (None, Some(_)) => {
            let uri = params.at_uri("uri")?;
            let cid = index.record_cid(uri)?.ok_or_else(|| {
                let why = format!("the index holds no record at {uri}");
                Failure::new(StatusCode::BAD_REQUEST, "RecordNotFound", why)
            })?;
            let subject = json!({"$type": STRONG_REF, "uri": uri, "cid": cid});
            (subject, index.labeled(src, uri, TAKEDOWN)?)
        }
        (None, None) => {
            return Err(Failure::invalid(format!(
                "{GET_STATUS} takes a did or a uri"
            )));
        }
    };
    Ok(Json(
        json!({ "subject": subject, "takedown": { "applied": applied } }),
    ))
}

/// `social.grain.admin.listReports`: reports, newest first, open ones
/// unless `status` names another.
pub async fn list_reports(
    State(app): State<Arc<App>>,
    headers: HeaderMap,
    uri: Uri,
) -> Result<Json<Value>, Failure> {
    let index = index(&app)?;
    admin(&app, &headers, LIST_REPORTS).await?;
    let params = params(&uri);
    let filter = Filter {
        status: Some(params.get("status").unwrap_or("open")),
        label: params.get("label"),
    };
    let limit = params.limit(50, 100)?;
    let (mut reports, total) = index.reports(filter, cursor(&params)?, limit + 1)?;
    let more = reports.len() > limit;
    reports.truncate(limit);
    let mut out = json!({
        "reports": reports.iter().map(report_view).collect::<Vec<_>>(),
        "total": total,
    });
    if more {
        out["cursor"] = reports.last().map(|r| r.id.to_string()).into();
    }
    Ok(Json(out))
}

/// `social.grain.admin.getReport`: a report by its id, in any state.
pub async fn get_report(
    State(app): State<Arc<App>>,
    headers: HeaderMap,
    uri: Uri,
) -> Result<Json<Value>, Failure> {
    let index = index(&app)?;
    admin(&app, &headers, GET_REPORT).await?;
    let params = params(&uri);
    let id = params.get("id").map(str::parse::<i64>);
    let Some(Ok(id)) = id else {
        return Err(Failure::invalid("id is a report's id"));
    };
    match index.report(id)? {
        Some(report) => Ok(Json(json!({ "report": report_view(&report) }))),
        None => Err(Failure::new(
            StatusCode::BAD_REQUEST,
            "ReportNotFound",
            format!("no report {id}"),
        )),
    }
}

#[derive(Deserialize)]
struct Resolution {
    id: i64,
    action: String,
}

/// `social.grain.admin.resolveReport`: an open report closed, resolving it
/// giving out the label it asked for on its subject, dismissing it not.
pub async fn resolve_report(
    State(app): State<Arc<App>>,
    headers: HeaderMap,
    body: Bytes,
) -> Result<Json<Value>, Failure> {
    let index = index(&app)?;
    let (by, src) = admin(&app, &headers, RESOLVE_REPORT).await?;
    let input: Resolution = parse(&body)?;
    let status = match input.action.as_str() {
        "resolve" => "resolved",
        "dismiss" => "dismissed",
        _ => return Err(Failure::invalid("action is resolve or dismiss")),
    };
    let now = grain::keys::now_iso();
    let label = index.report(input.id)?.map(|r| Label {
        src: src.into(),
        uri: r.subject,
        val: r.label,
        neg: false,
        cts: now.clone(),
        exp: None,
    });
    let label = label.filter(|_| status == "resolved");
    match index.close_report(input.id, status, &by, &now, label.as_ref())? {
        Some(_) => Ok(Json(json!({}))),
        None => Err(Failure::new(
            StatusCode::BAD_REQUEST,
            "ReportNotFound",
            format!("no open report {}", input.id),
        )),
    }
}

#[derive(Deserialize)]
struct Labeling {
    uri: String,
    val: String,
}

/// `social.grain.admin.applyLabel`.
pub async fn apply_label(
    State(app): State<Arc<App>>,
    headers: HeaderMap,
    body: Bytes,
) -> Result<Json<Value>, Failure> {
    labeled(&app, &headers, &body, APPLY_LABEL, false).await
}

/// `social.grain.admin.negateLabel`.
pub async fn negate_label(
    State(app): State<Arc<App>>,
    headers: HeaderMap,
    body: Bytes,
) -> Result<Json<Value>, Failure> {
    labeled(&app, &headers, &body, NEGATE_LABEL, true).await
}

/// A label given out on an account (its bare DID) or a record (its
/// AT-URI) as this server, or negated.
async fn labeled(
    app: &App,
    headers: &HeaderMap,
    body: &[u8],
    lxm: &str,
    neg: bool,
) -> Result<Json<Value>, Failure> {
    let index = index(app)?;
    let (_, src) = admin(app, headers, lxm).await?;
    let input: Labeling = parse(body)?;
    if !(atproto::syntax::is_did(&input.uri) || record_uri(&input.uri).is_some()) {
        let why = "uri is an account's bare did or a record's at-uri";
        return Err(Failure::invalid(why));
    }
    if input.val.is_empty() || input.val.len() > LABEL_LENGTH {
        let why = format!("val is from 1 to {LABEL_LENGTH} characters");
        return Err(Failure::invalid(why));
    }
    if input.val == TAKEDOWN {
        let why =
            format!("{TAKEDOWN} is given by {UPDATE_STATUS}, which takes an account down whole");
        return Err(Failure::invalid(why));
    }
    index.label(&Label {
        src: src.into(),
        uri: input.uri,
        val: input.val,
        neg,
        cts: grain::keys::now_iso(),
        exp: None,
    })?;
    Ok(Json(json!({})))
}

/// `social.grain.moderation.describeLabels`: the labels this server gives
/// out and what each means, as `app.bsky.labeler.defs#labelerPolicies`
/// has them, under the DID they name it by in `src`. Anyone may ask: each
/// can stand on what anyone reads, with `queryLabels`, so a client needs
/// every one to show what it means. The values are its definitions' and
/// `!takedown`, which atproto defines.
pub async fn describe_labels(State(app): State<Arc<App>>) -> Json<Value> {
    let defined = labels::DEFINITIONS.iter();
    let values = std::iter::once(TAKEDOWN).chain(defined.clone().map(|d| d.identifier));
    let definitions: Vec<Value> = defined.map(|d| d.json()).collect();
    let mut out = json!({
        "policies": {
            "labelValues": values.collect::<Vec<_>>(),
            "labelValueDefinitions": definitions,
        },
    });
    if let Some(did) = &app.did {
        out["did"] = did.as_str().into();
    }
    Json(out)
}

/// `social.grain.admin.listLabelDefinitions`: the labels grain defines.
pub async fn list_definitions(
    State(app): State<Arc<App>>,
    headers: HeaderMap,
) -> Result<Json<Value>, Failure> {
    admin(&app, &headers, LIST_DEFINITIONS).await?;
    let definitions: Vec<Value> = labels::DEFINITIONS.iter().map(|d| d.json()).collect();
    Ok(Json(json!({ "definitions": definitions })))
}

/// `social.grain.admin.getReviewSubject`: what an account's moderation
/// stands at.
pub async fn get_review_subject(
    State(app): State<Arc<App>>,
    headers: HeaderMap,
    uri: Uri,
) -> Result<Json<Value>, Failure> {
    let index = index(&app)?;
    admin(&app, &headers, GET_SUBJECT).await?;
    let params = params(&uri);
    let did = params.required("did")?;
    if !atproto::syntax::is_did(did) {
        return Err(Failure::invalid("did must be a valid did"));
    }
    let labels = index.labels_on(did)?;
    let (sampled, counts) = index.records_of(did, SAMPLED)?;
    let records: Vec<Value> = sampled
        .iter()
        .map(|r| {
            let on: Vec<Value> = labels
                .iter()
                .filter(|l| l.uri == r.uri)
                .map(label_view)
                .collect();
            let mut view = json!({
                "uri": r.uri,
                "cid": r.cid,
                "did": did,
                "collection": r.collection,
                "value": r.value,
                "indexedAt": r.indexed_at,
            });
            if !on.is_empty() {
                view["labels"] = on.into();
            }
            view
        })
        .collect();
    let counts: Vec<Value> = counts
        .iter()
        .map(|(collection, count)| json!({"collection": collection, "count": count}))
        .collect();
    let mut out = json!({
        "did": did,
        "records": records,
        "counts": counts,
        "labels": labels.iter().map(label_view).collect::<Vec<_>>(),
        "reports": index.reports_on(did)?.iter().map(report_view).collect::<Vec<_>>(),
        "childSafety": index.child_safety(did)?,
    });
    if let Some((handle, state)) = index.repo(did)? {
        if let Some(handle) = handle.filter(|h| lexicon::valid_handle(h)) {
            out["handle"] = handle.into();
        }
        out["status"] = state.into();
    }
    if let Some(host) = index.host_status(did)? {
        out["status"] = host.into();
    }
    if index.taken_down(did)? {
        out["status"] = "takendown".into();
    }
    Ok(Json(out))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn subjects_are_an_account_or_a_record() {
        let did = "did:plc:alice";
        let repo = json!({"$type": REPO_REF, "did": did});
        assert_eq!(subject(&repo).unwrap(), (did.into(), did.into()));
        let uri = format!("at://{did}/social.grain.gallery/3kabc");
        let cid = "bafyreigh2akiscaildcqabsyg3dfr6chu3fgpregiymsck7e7aqa4s52zy";
        let record = json!({"$type": STRONG_REF, "uri": uri, "cid": cid});
        assert_eq!(subject(&record).unwrap(), (uri.clone(), did.into()));
        for wrong in [
            json!({"did": did}),
            json!({"$type": REPO_REF, "did": "alice"}),
            json!({"$type": STRONG_REF, "uri": "at://did:plc:alice", "cid": cid}),
            json!({"$type": STRONG_REF, "uri": uri, "cid": "nope"}),
        ] {
            assert_eq!(
                subject(&wrong).unwrap_err().error,
                "InvalidRequest",
                "{wrong}"
            );
        }
    }
}

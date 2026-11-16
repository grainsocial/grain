//! The `grain` command line: logging in, reporting to grain, and, for its
//! admins, moderating it ([`crate::moderation`]).
//!
//! Everything it does is as the account this machine last logged in as,
//! or `GRAIN_IDENTIFIER`, at the appview `GRAIN_APPVIEW` names. It is where
//! a person moderates what a model must not see: what a child-safety
//! report or label is about is shown here in full, and only here.

use crate::env::{Ctx, Env};
use crate::moderation::Appview;
use crate::{oauth, session};
use anyhow::{Context, Result, bail};
use serde_json::Value;
use std::io::Write;

pub const USAGE: &str = "usage: grain <command>

  --version
  login <handle> [--password-stdin]   log in with OAuth in a browser, or with
                                        an app password (or GRAIN_PASSWORD)
  logout <handle>
  report <subject> <reason> [<text>]  report an account (its handle or DID) or
                                        a record (its at:// URI) to grain; a
                                        reason is spam, misleading, sexual, rude,
                                        violation, other, copyright, nudity,
                                        child-safety, or a reasonType

as an admin, an account grain's appview names in GRAIN_ADMIN_DIDS:

  admin reports [--status open|resolved|dismissed] [--label <label>]
                [--limit <n>] [--cursor <cursor>]
                                       reports, newest first, open ones unless
                                        --status says otherwise
  admin resolve <id>                   close a report, giving out its label
  admin dismiss <id>                   close a report, giving out nothing
  admin takedown <subject> [--undo]    take an account or a record down, or put
                                        it back
  admin status <subject>               whether it is taken down
  admin label <subject> <label> [--negate]
                                       give out a label, or negate it
  admin account <handle or DID>        its moderation whole: status, labels,
                                        reports and its newest records
  admin labels                         the labels grain gives out

GRAIN_APPVIEW names the appview, https://grain.social unless it is set.";

/// `grain`, of its arguments: its exit code.
pub fn main(args: Vec<String>) -> i32 {
    if args == ["--version"] {
        println!("grain {}", env!("CARGO_PKG_VERSION"));
        return 0;
    }
    if args.is_empty() || matches!(args[0].as_str(), "help" | "--help" | "-h") {
        eprintln!("{USAGE}");
        return 2;
    }
    let ctx = Ctx::new(Env::from_process());
    let runtime = tokio::runtime::Builder::new_current_thread()
        .enable_all()
        .build()
        .expect("a current-thread runtime always builds");
    let mut stdin = std::io::stdin();
    let mut stdout = std::io::stdout();
    let res = runtime.block_on(run(&ctx, &args, &mut stdin, &mut stdout));
    match res {
        Ok(()) => 0,
        Err(err) => {
            eprintln!("{}", failed(&err));
            1
        }
    }
}

/// What `grain` adds to a refusal for want of scope.
const RELOGIN: &str =
    "your login is older than what grain asks for now: run `grain login` again to allow this";

/// What `grain` says of `err`: with, for a PDS refusing a call for want of
/// scope, how to grant it.
pub fn failed(err: &anyhow::Error) -> String {
    let said = format!("grain: {err:#}");
    match oauth::out_of_scope(&said) {
        true => format!("{said}\ngrain: {RELOGIN}"),
        false => said,
    }
}

/// The arguments left to read.
struct Args<'a> {
    rest: std::slice::Iter<'a, String>,
}

impl<'a> Args<'a> {
    /// The next argument, which the command needs: `what` names it.
    fn next(&mut self, what: &str) -> Result<&'a str> {
        match self.rest.next() {
            Some(arg) => Ok(arg),
            None => bail!("missing {what}\n{USAGE}"),
        }
    }

    /// That nothing is left.
    fn done(&mut self) -> Result<()> {
        match self.rest.next() {
            Some(extra) => bail!("unexpected {extra}"),
            None => Ok(()),
        }
    }
}

/// Runs the command `argv` names, reading `stdin` where it asks to and
/// saying what it did to `out`.
pub async fn run(
    ctx: &Ctx,
    argv: &[String],
    stdin: &mut dyn std::io::Read,
    out: &mut dyn Write,
) -> Result<()> {
    let mut args = Args { rest: argv.iter() };
    match args.next("a command")? {
        "login" => {
            let identifier = args.next("<handle>")?;
            let password = match args.rest.next().map(String::as_str) {
                Some("--password-stdin") => {
                    let mut text = String::new();
                    stdin.read_to_string(&mut text)?;
                    Some(text.trim().to_string())
                }
                Some(other) => bail!("unexpected {other}"),
                None => ctx.env.password.clone(),
            };
            let me = match password {
                Some(password) => session::login(ctx, identifier, &password).await?,
                None => {
                    let pending = oauth::start(ctx, identifier).await?;
                    writeln!(out, "approve in your browser, or open {}", pending.url)?;
                    out.flush()?;
                    oauth::open(ctx, &pending.url);
                    pending.finish(ctx).await?
                }
            };
            session::remember(ctx, &me)?;
            writeln!(out, "logged in as {} ({})", me.handle, me.did)?;
        }
        "logout" => {
            let identifier = args.next("<handle>")?;
            args.done()?;
            let removed = session::logout(ctx, identifier).await?;
            writeln!(out, "{}", if removed { "logged out" } else { "no session" })?;
        }
        "report" => {
            let target = args.next("<subject>")?;
            let reason = args.next("<reason>")?;
            let text = args.rest.next().map(String::as_str);
            args.done()?;
            let made = Appview::new(ctx)
                .await?
                .report(target, reason, text)
                .await?;
            writeln!(out, "report {} sent", made["id"])?;
        }
        "admin" => admin(ctx, &mut args, out).await?,
        other => bail!("{other}: no such command\n{USAGE}"),
    }
    Ok(())
}

async fn admin(ctx: &Ctx, args: &mut Args<'_>, out: &mut dyn Write) -> Result<()> {
    let what =
        args.next("reports, resolve, dismiss, takedown, status, label, account or labels")?;
    let appview = Appview::new(ctx).await?;
    match what {
        "reports" => {
            let (mut status, mut label, mut limit, mut cursor) = (None, None, 50, None);
            while let Some(flag) = args.rest.next() {
                match flag.as_str() {
                    "--status" => status = Some(args.next("<status>")?),
                    "--label" => label = Some(args.next("<label>")?),
                    "--limit" => {
                        limit = args.next("<n>")?.parse().context("a limit is a number")?
                    }
                    "--cursor" => cursor = Some(args.next("<cursor>")?),
                    other => bail!("unexpected {other}"),
                }
            }
            let found = appview.reports(status, label, limit, cursor).await?;
            for report in found["reports"].as_array().into_iter().flatten() {
                writeln!(out, "{}", report_line(report))?;
            }
            let total = &found["total"];
            match found["cursor"].as_str() {
                Some(next) => writeln!(out, "{total} in all; more with --cursor {next}")?,
                None => writeln!(out, "{total} in all")?,
            }
        }
        verb @ ("resolve" | "dismiss") => {
            let id = args
                .next("<id>")?
                .parse()
                .context("a report's id is a number")?;
            args.done()?;
            appview.close(id, verb == "resolve").await?;
            writeln!(
                out,
                "{}",
                if verb == "resolve" {
                    "resolved"
                } else {
                    "dismissed"
                }
            )?;
        }
        "takedown" => {
            let target = args.next("<subject>")?;
            let applied = match args.rest.next().map(String::as_str) {
                Some("--undo") => false,
                Some(other) => bail!("unexpected {other}"),
                None => true,
            };
            appview.takedown(target, applied).await?;
            writeln!(out, "{}", if applied { "taken down" } else { "restored" })?;
        }
        "status" => {
            let status = appview.status(args.next("<subject>")?).await?;
            args.done()?;
            let down = status["takedown"]["applied"].as_bool() == Some(true);
            writeln!(out, "{}", if down { "taken down" } else { "up" })?;
        }
        "label" => {
            let target = args.next("<subject>")?;
            let val = args.next("<label>")?;
            let negate = match args.rest.next().map(String::as_str) {
                Some("--negate") => true,
                Some(other) => bail!("unexpected {other}"),
                None => false,
            };
            appview.label(target, val, negate).await?;
            writeln!(out, "{}", if negate { "negated" } else { "labeled" })?;
        }
        "account" => {
            let found = appview.account(args.next("<handle or DID>")?).await?;
            args.done()?;
            writeln!(out, "{}", serde_json::to_string_pretty(&found)?)?;
        }
        "labels" => {
            args.done()?;
            let found = appview.definitions().await?;
            for d in found["definitions"].as_array().into_iter().flatten() {
                let locale = &d["locales"][0];
                let (name, about) = (text(&locale["name"]), text(&locale["description"]));
                writeln!(out, "{}\t{name}: {about}", text(&d["identifier"]))?;
            }
        }
        other => bail!("admin {other}: no such command\n{USAGE}"),
    }
    Ok(())
}

fn text(v: &Value) -> &str {
    v.as_str().unwrap_or_default()
}

/// A report on a line: its id, status, label, subject, reporter and
/// reason, tab-separated.
fn report_line(r: &Value) -> String {
    let by = r["reportedByHandle"].as_str().or(r["reportedBy"].as_str());
    format!(
        "{}\t{}\t{}\t{}\t{}\t{}",
        r["id"],
        text(&r["status"]),
        text(&r["label"]),
        text(&r["subject"]),
        by.unwrap_or_default(),
        text(&r["reason"]),
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn a_report_is_a_line() {
        let r = json!({"id": 4, "status": "open", "label": "spam", "subject": "did:plc:b",
            "reportedBy": "did:plc:a", "reportedByHandle": "a.test", "reason": "ads"});
        assert_eq!(report_line(&r), "4\topen\tspam\tdid:plc:b\ta.test\tads");
        let bare = json!({"id": 5, "reportedBy": "did:plc:a"});
        assert_eq!(report_line(&bare), "5\t\t\t\tdid:plc:a\t");
    }

    #[test]
    fn a_refusal_for_want_of_scope_says_to_log_in_again() {
        let said = failed(&anyhow::anyhow!(
            "InvalidToken (403): Scope does not permit it"
        ));
        assert!(
            said.ends_with("run `grain login` again to allow this"),
            "{said}"
        );
        assert_eq!(failed(&anyhow::anyhow!("no")), "grain: no");
    }

    #[tokio::test]
    async fn commands_say_what_they_need() {
        let dir = tempfile::tempdir().unwrap();
        let config = dir.path().display().to_string();
        let ctx = Ctx::new(Env::from_vars(|k| {
            (k == "GRAIN_CONFIG_DIR").then(|| config.clone())
        }));
        let said = |argv: &[&str]| {
            let argv: Vec<String> = argv.iter().map(|s| s.to_string()).collect();
            let ctx = ctx.clone();
            async move {
                let mut out = Vec::new();
                let res = run(&ctx, &argv, &mut std::io::empty(), &mut out).await;
                format!("{:#}", res.unwrap_err())
            }
        };
        assert!(said(&[]).await.starts_with("missing a command\n"));
        assert!(
            said(&["nonsense"])
                .await
                .starts_with("nonsense: no such command")
        );
        assert!(said(&["login"]).await.starts_with("missing <handle>"));
        assert_eq!(
            said(&["login", "a.test", "--nope"]).await,
            "unexpected --nope"
        );
        assert_eq!(
            said(&["logout", "a.test", "b.test"]).await,
            "unexpected b.test"
        );
        assert_eq!(
            said(&["report", "a.test", "spam", "why", "more"]).await,
            "unexpected more"
        );
        assert!(
            said(&["admin"])
                .await
                .starts_with("missing reports, resolve")
        );
        // An admin command needs a login before anything else.
        assert_eq!(said(&["admin", "reports"]).await, "not logged in");
    }
}

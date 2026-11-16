//! The index fed from Jetstream: commits to the collections it keeps, by
//! the accounts it tracks, and what hosts say of those accounts.
//!
//! An account is tracked once it writes a grain profile
//! or a group declaration (the signal collections), and the stream's other
//! records are kept only of tracked accounts, so the Bluesky posts of the
//! whole network pass by. A record that does not fit its lexicon is
//! skipped, not fatal. So is an event the index fails to apply: it is
//! logged and the stream goes on past it, and once the cursor is saved
//! that event is not heard again.
//!
//! A commit is written at its revision ([`Index::put_rev`]), so that a
//! stream write and a backfill's read of the same repo leave the later of
//! the two. An account newly tracked, or back after its host said it was
//! gone, is queued for backfill ([`Index::resync`]) to be read whole.
//! A record new to the index is pushed ([`Index::arrived`]). An account
//! its host says was deleted goes, records and all, once the host its
//! identity names now says it has no such account
//! ([`crate::accounts::deletions`]): one that moved stays.
//!
//! Where it was read to is kept in the index, under `jetstream:<url>`,
//! and a restart resumes there. A cursor
//! Jetstream no longer keeps is given up for the live tip
//! ([`grain::jetstream::PROBE_EVERY`]).

use crate::accounts;
use crate::backfill::SIGNALS;
use crate::index::{Applied, Index, PutError, records};
use grain::env::Ctx;
use grain::jetstream::{Event, Follower, Timing, What};
use std::sync::Arc;
use std::time::{Duration, Instant};

/// The Jetstream grain follows unless told another.
pub const DEFAULT: &str = "wss://jetstream.us-west.bsky.network";

/// The feed's name, as `/_status` tells of it.
pub const NAME: &str = "jetstream";

/// How often where the stream was read to is saved, at most.
pub const SAVE: Duration = Duration::from_secs(5);

/// The cursor's key in the index for the Jetstream at `url`: its own, as
/// one instance's sequence numbers mean nothing on another.
pub fn source(url: &str) -> String {
    format!("jetstream:{url}")
}

/// Follows the Jetstream at `url` into `index` until the task is dropped,
/// saving where it was read to at most every `save`. An account the
/// stream says was deleted is asked after with `asking`
/// ([`crate::accounts::deletions`]), or with none taken at its word.
pub async fn follow(
    index: Arc<Index>,
    url: String,
    timing: Timing,
    save: Duration,
    asking: Option<Ctx>,
) {
    let (to, told) = tokio::sync::mpsc::unbounded_channel();
    let asked = asking.map(|ctx| {
        tokio::spawn(accounts::deletions(
            index.clone(),
            ctx,
            told,
            Default::default(),
        ))
    });
    let deletions = asked.is_some().then_some(to);
    let collections = records::COLLECTIONS.iter().map(|(nsid, _)| *nsid).collect();
    index.feeds.follows(NAME, &url);
    let feed = Feed {
        source: source(&url),
        index,
        seq: None,
        saved: None,
        save,
        deletions,
    };
    grain::jetstream::follow(url, collections, timing, feed).await
}

/// Where an account the stream says was deleted is sent, for its host to
/// be asked.
pub type Deletions = tokio::sync::mpsc::UnboundedSender<String>;

struct Feed {
    index: Arc<Index>,
    source: String,
    /// The last sequence number heard.
    seq: Option<i64>,
    saved: Option<Instant>,
    save: Duration,
    deletions: Option<Deletions>,
}

impl Feed {
    fn save(&mut self) -> rusqlite::Result<()> {
        if let Some(seq) = self.seq {
            self.index.set_cursor(&self.source, seq)?;
            self.saved = Some(Instant::now());
        }
        Ok(())
    }
}

/// Logs an index that failed: the stream goes on.
fn logged(done: rusqlite::Result<()>) {
    if let Err(e) = done {
        tracing::error!(error = %e, "jetstream: the index failed");
    }
}

impl Follower for Feed {
    fn start(&mut self) -> Option<i64> {
        self.seq = self.index.cursor(&self.source).ok().flatten();
        tracing::info!(cursor = ?self.seq, source = %self.source, "jetstream: following");
        self.seq
    }

    fn connected(&mut self, up: bool) {
        tracing::info!(up, source = %self.source, "jetstream: connecting");
        self.index.feeds.connected(NAME, up);
    }

    fn event(&mut self, event: Event) {
        self.seq = event.seq.or(self.seq);
        self.index.feeds.heard(NAME, event.seq);
        logged(apply_with(&self.index, event, self.deletions.as_ref()));
        if self.saved.is_none_or(|at| at.elapsed() >= self.save) {
            logged(self.save());
        }
    }

    fn ended(&mut self) {
        logged(self.save());
    }

    fn cursor_lost(&mut self, cursor: i64) {
        self.seq = None;
        logged(self.index.forget_cursor(&self.source));
        tracing::warn!(cursor, source = %self.source,
            "jetstream: the cursor is past what Jetstream keeps; following from the live tip, \
             and what came between is not heard");
    }
}

/// What `event` says, applied to `index`, an account deleted taken at its
/// word.
pub fn apply(index: &Index, event: Event) -> rusqlite::Result<()> {
    apply_with(index, event, None)
}

/// [`apply`], an account deleted sent to `deletions` where there is one,
/// for its host to be asked first.
pub fn apply_with(
    index: &Index,
    event: Event,
    deletions: Option<&Deletions>,
) -> rusqlite::Result<()> {
    match event.what {
        What::Commit { did, op } => {
            if records::table_of(&op.collection).is_none() {
                return Ok(());
            }
            // An account newly tracked is read whole by backfill.
            if SIGNALS.contains(&op.collection.as_str()) && index.track(&did)? {
                index.resync(&did)?;
            }
            if !index.tracks(&did) {
                return Ok(());
            }
            let uri = format!("at://{did}/{}/{}", op.collection, op.rkey);
            // Written at the commit's revision, so that neither this nor a
            // backfill's read of the repo undoes a later one.
            let rev = op.rev.as_deref();
            match (op.action.as_str(), op.cid, op.record) {
                ("delete", _, _) => {
                    match rev {
                        Some(rev) => index.delete_rev(&uri, rev)?,
                        None => index.delete(&uri)?,
                    };
                }
                ("create" | "update", Some(cid), Some(record)) => {
                    let put = match rev {
                        Some(rev) => index.put_rev(&uri, &cid, &record, rev),
                        None => index.put(&uri, &cid, &record),
                    };
                    match put {
                        Ok(Applied::Created) => index.arrived(&uri),
                        Ok(_) => {}
                        Err(PutError::Refused(why)) => {
                            tracing::info!(%uri, %why, "jetstream: skipped a record");
                        }
                        Err(PutError::Db(e)) => return Err(e),
                    }
                }
                _ => {}
            }
        }
        What::Identity { did, handle } => {
            if let Some(handle) = handle.filter(|_| index.tracks(&did)) {
                index.set_handle(&did, &handle)?;
            }
        }
        What::Account {
            did,
            active,
            status,
        } if index.tracks(&did) => match (active, status.as_deref()) {
            // Back from being gone, it may have changed while it was: it is
            // read whole again.
            (true, _) => {
                let returned = index.host_status(&did)?.is_some();
                index.set_host_status(&did, None)?;
                if returned {
                    index.resync(&did)?;
                }
            }
            (false, Some("deleted")) => match deletions {
                Some(to) => {
                    let _ = to.send(did);
                }
                None => accounts::deleted(index, &did)?,
            },
            // Its host says it is not there for now: its records stay,
            // unread, for when it is back.
            (false, Some(status @ ("deactivated" | "suspended" | "takendown"))) => {
                index.set_host_status(&did, Some(status))?;
            }
            // `desynchronized`, `throttled` and the like say nothing of
            // the account itself.
            _ => {}
        },
        What::Info { name, message } => {
            tracing::warn!(%name, message = message.unwrap_or_default(), "jetstream says");
        }
        _ => {}
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use grain::jetstream::What;

    #[test]
    fn an_account_deleted_is_asked_after_where_its_host_can_be() {
        let index = Index::memory().unwrap();
        let did = "did:plc:alice";
        index.track(did).unwrap();
        let deleted = || Event {
            seq: Some(1),
            what: What::Account {
                did: did.into(),
                active: false,
                status: Some("deleted".into()),
            },
        };
        let (to, mut told) = tokio::sync::mpsc::unbounded_channel();
        apply_with(&index, deleted(), Some(&to)).unwrap();
        assert_eq!(told.try_recv().ok().as_deref(), Some(did));
        assert_eq!(index.host_status(did).unwrap(), None, "not yet");
        // With no host to ask, the event is taken at its word.
        apply(&index, deleted()).unwrap();
        assert_eq!(index.host_status(did).unwrap().as_deref(), Some("deleted"));
    }
}

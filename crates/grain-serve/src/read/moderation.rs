//! What reads leave out, written once: every query a read runs builds its
//! filters from these.
//!
//! - An account an admin took down, or whose host says it is gone, is
//!   shown to no one ([`shown`]).
//! - A record carrying a label that hides ([`HIDDEN_LABELS`]) is left out
//!   of lists, from grain's labeler ([`unhidden`]) or its author
//!   ([`unhidden_by_author`]), though one asked for by its URI still
//!   answers, with its labels, for the client to warn of.
//! - Accounts that block each other see nothing of one another
//!   ([`unblocked`]), and one the viewer muted is left out of feeds and
//!   lists of content ([`unmuted`]), but not of lists of who follows or
//!   favorited whom: a mute hides what someone says, not that they are
//!   there.
//!
//! The viewer is a parameter, bound as NULL for no one: `did = NULL` holds
//! for no row, so the same SQL leaves out nothing for a caller who did not
//! say who they are.

pub use crate::index::schema::{HIDDEN_LABELS, shown, unhidden};

/// SQL that holds where neither the account `did` nor `viewer` blocks
/// the other.
pub fn unblocked(did: &str, viewer: &str) -> String {
    format!(
        "NOT EXISTS (SELECT 1 FROM block WHERE did = {viewer} AND subject = {did})
         AND NOT EXISTS (SELECT 1 FROM block WHERE did = {did} AND subject = {viewer})"
    )
}

/// SQL that holds where `viewer` has not muted the account `did`.
pub fn unmuted(did: &str, viewer: &str) -> String {
    format!("NOT EXISTS (SELECT 1 FROM mute WHERE did = {viewer} AND subject = {did})")
}

/// SQL that holds where the record `uri`'s author gave it no self-label
/// that hides.
pub fn unhidden_by_author(uri: &str) -> String {
    format!(
        "NOT EXISTS (SELECT 1 FROM self_label WHERE uri = {uri} AND val IN ({}))",
        hidden_list()
    )
}

/// SQL that holds where the comment `c` answers no comment since deleted.
pub fn not_orphaned(c: &str) -> String {
    format!("({c}.reply_to IS NULL OR EXISTS (SELECT 1 FROM comment p WHERE p.uri = {c}.reply_to))")
}

fn hidden_list() -> String {
    HIDDEN_LABELS.map(|v| format!("'{v}'")).join(",")
}

/// SQL that holds where no label of grain's stands on the subject `uri`,
/// whatever it says: for what can neither blur nor warn, such as a card.
pub fn unlabeled(uri: &str) -> String {
    format!(
        "NOT EXISTS (SELECT 1 FROM label l WHERE l.uri = {uri} AND l.neg = 0
           AND (l.exp IS NULL OR l.exp > strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
           AND NOT EXISTS (SELECT 1 FROM label n WHERE n.uri = l.uri AND n.val = l.val
             AND (n.cts > l.cts OR (n.cts = l.cts AND n.id > l.id))))"
    )
}

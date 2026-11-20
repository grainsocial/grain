//! An account's preferences as the index keeps them: `preference`, a JSON
//! value by key, and `notification_pref`, a row for each kind of
//! notification set apart from the default. Neither is rebuilt from the
//! network.

use super::Index;
use rusqlite::{Connection, params};

/// How a kind of notification reaches an account, as `notification_pref`
/// keeps it.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct NotificationPref {
    pub kind: String,
    pub push: bool,
    pub in_app: bool,
    /// Only from accounts it follows.
    pub from_follows: bool,
}

/// An account's preferences.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct Preferences {
    /// Each `preference` key it set, and its value as JSON.
    pub values: Vec<(String, String)>,
    pub notifications: Vec<NotificationPref>,
}

impl Index {
    /// `did`'s preferences of `keys`, and how each kind of notification
    /// reaches it, by key and kind.
    pub fn preferences(&self, did: &str, keys: &[&str]) -> rusqlite::Result<Preferences> {
        read(&self.db.lock().unwrap(), did, keys)
    }

    /// Sets `did`'s preferences of `keys` to `to`, as of `now`, at once:
    /// a key of `keys` that `to` leaves out is unset, and so is a kind of
    /// notification. Keys outside `keys` are left as they are.
    pub fn put_preferences(
        &self,
        did: &str,
        keys: &[&str],
        to: &Preferences,
        now: &str,
    ) -> rusqlite::Result<()> {
        let mut db = self.db.lock().unwrap();
        let tx = db.transaction()?;
        replace(&tx, did, keys, true, to, now)?;
        tx.commit()
    }

    /// Sets one kind of `did`'s preferences to `to`, as of `now`: its
    /// `keys`, and with `notifications` how each kind of notification
    /// reaches it, as [`Index::put_preferences`] sets them, leaving every
    /// other key and, without `notifications`, `notification_pref` as
    /// they are. Answers `did`'s preferences of `all` after, read in the
    /// same transaction, so a kind set at once beside it is never lost
    /// nor answered half set.
    pub fn set_preference(
        &self,
        did: &str,
        keys: &[&str],
        notifications: bool,
        to: &Preferences,
        all: &[&str],
        now: &str,
    ) -> rusqlite::Result<Preferences> {
        let mut db = self.db.lock().unwrap();
        let tx = db.transaction()?;
        replace(&tx, did, keys, notifications, to, now)?;
        let after = read(&tx, did, all)?;
        tx.commit()?;
        Ok(after)
    }
}

/// `did`'s preferences of `keys` in `db`, as [`Index::preferences`].
fn read(db: &Connection, did: &str, keys: &[&str]) -> rusqlite::Result<Preferences> {
    let mut stmt = db.prepare(
        "SELECT key, value FROM preference WHERE did = ?1
         AND key IN (SELECT value FROM json_each(?2)) ORDER BY key",
    )?;
    let keys = serde_json::to_string(keys).expect("keys serialize");
    let values = stmt.query_map(params![did, keys], |r| Ok((r.get(0)?, r.get(1)?)))?;
    let values = values.collect::<rusqlite::Result<_>>()?;
    let mut stmt = db.prepare(
        "SELECT kind, push, in_app, from_follows FROM notification_pref
         WHERE did = ?1 ORDER BY kind",
    )?;
    let notifications = stmt.query_map([did], |r| {
        Ok(NotificationPref {
            kind: r.get(0)?,
            push: r.get(1)?,
            in_app: r.get(2)?,
            from_follows: r.get(3)?,
        })
    })?;
    let notifications = notifications.collect::<rusqlite::Result<_>>()?;
    Ok(Preferences {
        values,
        notifications,
    })
}

/// Sets `did`'s preferences of `keys`, and with `notifications` its
/// `notification_pref`, to `to` in `db`, as of `now`.
fn replace(
    db: &Connection,
    did: &str,
    keys: &[&str],
    notifications: bool,
    to: &Preferences,
    now: &str,
) -> rusqlite::Result<()> {
    let all = serde_json::to_string(keys).expect("keys serialize");
    db.execute(
        "DELETE FROM preference WHERE did = ?1
         AND key IN (SELECT value FROM json_each(?2))",
        params![did, all],
    )?;
    if notifications {
        db.execute("DELETE FROM notification_pref WHERE did = ?1", [did])?;
    }
    for (key, value) in &to.values {
        db.execute(
            "INSERT INTO preference (did, key, value, updated_at) VALUES (?1, ?2, ?3, ?4)",
            params![did, key, value, now],
        )?;
    }
    for n in &to.notifications {
        db.execute(
            "INSERT INTO notification_pref (did, kind, push, in_app, from_follows)
             VALUES (?1, ?2, ?3, ?4, ?5)",
            params![did, n.kind, n.push, n.in_app, n.from_follows],
        )?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn preferences_are_set_all_at_once() {
        let index = Index::memory().unwrap();
        let keys = ["theme", "pinnedFeeds"];
        assert_eq!(
            index.preferences("did:plc:a", &keys).unwrap(),
            Preferences::default()
        );
        let db = || index.db.lock().unwrap();
        db().execute(
            "INSERT INTO preference VALUES ('did:plc:a', 'other', '1', 'x')",
            [],
        )
        .unwrap();
        let follows = NotificationPref {
            kind: "follows".into(),
            push: false,
            in_app: true,
            from_follows: true,
        };
        let to = Preferences {
            values: vec![("theme".into(), r#""dark""#.into())],
            notifications: vec![follows.clone()],
        };
        index
            .put_preferences("did:plc:a", &keys, &to, "now")
            .unwrap();
        assert_eq!(index.preferences("did:plc:a", &keys).unwrap(), to);
        index
            .put_preferences("did:plc:a", &keys, &Preferences::default(), "later")
            .unwrap();
        assert_eq!(
            index.preferences("did:plc:a", &keys).unwrap(),
            Preferences::default()
        );
        // A key it does not set is its own.
        let other = index.preferences("did:plc:a", &["other"]).unwrap();
        assert_eq!(other.values, [("other".to_string(), "1".to_string())]);
    }

    #[test]
    fn one_kind_is_set_beside_the_others() {
        let index = Index::memory().unwrap();
        let all = ["theme", "pinnedFeeds"];
        let follows = NotificationPref {
            kind: "follows".into(),
            push: false,
            in_app: true,
            from_follows: true,
        };
        let to = Preferences {
            values: vec![("theme".into(), r#""dark""#.into())],
            notifications: vec![follows.clone()],
        };
        index
            .put_preferences("did:plc:a", &all, &to, "now")
            .unwrap();
        let feeds = Preferences {
            values: vec![("pinnedFeeds".into(), "[]".into())],
            notifications: Vec::new(),
        };
        let after = index
            .set_preference("did:plc:a", &["pinnedFeeds"], false, &feeds, &all, "later")
            .unwrap();
        let both = vec![
            ("pinnedFeeds".to_string(), "[]".to_string()),
            ("theme".to_string(), r#""dark""#.to_string()),
        ];
        assert_eq!(after.values, both);
        assert_eq!(after.notifications, [follows]);
        let none = index
            .set_preference(
                "did:plc:a",
                &[],
                true,
                &Preferences::default(),
                &all,
                "later",
            )
            .unwrap();
        assert_eq!((none.values, none.notifications), (both, Vec::new()));
    }
}

//! Small JSON files under the config and cache directories.

use anyhow::{Context, Result};
use serde::Serialize;
use serde::de::DeserializeOwned;
use std::path::{Path, PathBuf};
use std::time::Duration;

/// The file's contents, or `None` when it is missing or unreadable: every
/// file here is a cache or can be recreated by logging in again.
pub fn read<T: DeserializeOwned>(path: &Path) -> Option<T> {
    let bytes = std::fs::read(path).ok()?;
    serde_json::from_slice(&bytes).ok()
}

/// Writes through a temporary file and a rename, so a reader never sees half
/// a file. `private` restricts it to the owner.
pub fn write<T: Serialize>(path: &Path, value: &T, private: bool) -> Result<()> {
    write_bytes(path, &serde_json::to_vec_pretty(value)?, private)
}

pub fn write_bytes(path: &Path, bytes: &[u8], private: bool) -> Result<()> {
    let dir = path.parent().context("a store path has a parent")?;
    std::fs::create_dir_all(dir).with_context(|| format!("creating {}", dir.display()))?;
    let tmp = dir.join(format!(
        ".{}.{}.tmp",
        path.file_name().and_then(|n| n.to_str()).unwrap_or("store"),
        crate::keys::tid()
    ));
    std::fs::write(&tmp, bytes).with_context(|| format!("writing {}", tmp.display()))?;
    #[cfg(unix)]
    if private {
        use std::os::unix::fs::PermissionsExt;
        std::fs::set_permissions(&tmp, std::fs::Permissions::from_mode(0o600))?;
    }
    #[cfg(not(unix))]
    let _ = private;
    std::fs::rename(&tmp, path).with_context(|| format!("writing {}", path.display()))?;
    Ok(())
}

/// An exclusive lock on the file at `path`, held until dropped: for
/// processes that take turns at a file, as refreshing a session.
pub struct Lock {
    _file: std::fs::File,
}

impl Lock {
    /// Waits for the lock, making the file (and its directory) if need be.
    pub async fn acquire(path: PathBuf) -> Result<Lock> {
        if let Some(dir) = path.parent() {
            std::fs::create_dir_all(dir).with_context(|| format!("creating {}", dir.display()))?;
        }
        let file = std::fs::OpenOptions::new()
            .write(true)
            .create(true)
            .truncate(false)
            .open(&path)
            .with_context(|| format!("opening {}", path.display()))?;
        loop {
            match file.try_lock() {
                Err(std::fs::TryLockError::WouldBlock) => {
                    tokio::time::sleep(Duration::from_millis(10)).await;
                }
                done => return Ok(done.map(|()| Lock { _file: file })?),
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::BTreeMap;

    #[test]
    fn round_trip_and_failures() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("a/b.json");
        assert_eq!(read::<BTreeMap<String, u8>>(&path), None);
        let mut m = BTreeMap::new();
        m.insert("x".to_string(), 1u8);
        write(&path, &m, true).unwrap();
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let mode = std::fs::metadata(&path).unwrap().permissions().mode();
            assert_eq!(mode & 0o777, 0o600);
        }
        write(&path, &m, false).unwrap();
        assert_eq!(read::<BTreeMap<String, u8>>(&path), Some(m.clone()));
        std::fs::write(&path, b"{").unwrap();
        assert_eq!(read::<BTreeMap<String, u8>>(&path), None);
        assert!(write(Path::new("/"), &m, false).is_err());
        let blocked = dir.path().join("file");
        std::fs::write(&blocked, b"").unwrap();
        assert!(write(&blocked.join("x.json"), &m, false).is_err());
        // A directory where the file should go: the rename fails.
        let occupied = dir.path().join("occupied");
        std::fs::create_dir_all(occupied.join("inside")).unwrap();
        assert!(write(&occupied, &m, false).is_err());
        // A name too long for the file system: writing the copy fails.
        assert!(write(&dir.path().join("n".repeat(300)), &m, false).is_err());
    }

    #[tokio::test]
    async fn locks_take_turns() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("sessions/a.lock");
        let held = Lock::acquire(path.clone()).await.unwrap();
        let waiter = tokio::spawn(Lock::acquire(path.clone()));
        tokio::time::sleep(Duration::from_millis(50)).await;
        assert!(!waiter.is_finished());
        drop(held);
        waiter.await.unwrap().unwrap();
        // A directory where the file should be cannot be locked.
        assert!(Lock::acquire(dir.path().to_path_buf()).await.is_err());
    }
}

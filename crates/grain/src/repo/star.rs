//! STAR-lite, version 0: microcosm's export of a whole repo, every record
//! in key order after its commit, with no tree. The tree's root is rebuilt
//! from the records as they stream past ([`super::mst::RootBuilder`]) and
//! must come out as the root the commit signed.
//!
//! ```text
//! *l\0 | root CID (36 bytes) | len | commit less `data` | (len | key | len | record)*
//! ```
//!
//! The format: <https://tangled.org/microcosm.blue/star/tree/main/v0-star/star-lite>.
//! Its frames are knotless's STAR v1's (`space_sync.rs` there), whose magic
//! is `*l\x01\x00` and whose records hash to a set rather than a tree.

use super::mst::RootBuilder;
use super::{Commit, Frames, MAX_COMMIT, MAX_KEY, MAX_RECORD, Record, varint, verify_commit};
use crate::crypto::PublicKey;
use crate::drisl;
use anyhow::{Context, Result, ensure};
use ciborium::Value as V;
use std::io::{Read, Write};

/// `*l\0`: STAR, lite, version 0.
pub const MAGIC: [u8; 3] = [0x2a, 0x6c, 0x00];

/// The media type hubble serves it as.
pub const MEDIA_TYPE: &str = "application/x.microcosm.star-lite";

/// A STAR-lite archive being read.
pub struct StarLite<R> {
    frames: Frames<R>,
    commit: Commit,
    tree: RootBuilder,
}

impl<R: Read> StarLite<R> {
    /// Reads the header of `did`'s archive from `r`, and checks that `key`
    /// signed its commit, with the root it opens with as the commit's
    /// `data`.
    pub fn open(r: R, did: &str, key: &PublicKey) -> Result<StarLite<R>> {
        let mut frames = Frames::new(r);
        let magic = frames.exact(MAGIC.len(), "its magic")?;
        ensure!(magic == MAGIC, "not a STAR-lite archive");
        let root = frames.exact(36, "its root")?;
        ensure!(
            root.starts_with(&drisl::CID_PREFIX),
            "a root that is not a tree's CID"
        );
        let commit = frames.frame(MAX_COMMIT, "a commit")?.unwrap_or_default();
        ensure!(
            !commit.is_empty(),
            "no commit, so nothing to check it against"
        );
        let commit: V = ciborium::from_reader(&commit[..]).context("a commit that is not CBOR")?;
        let mut commit = commit
            .into_map()
            .ok()
            .context("a commit that is not a map")?;
        ensure!(
            commit.iter().all(|(k, _)| k.as_text() != Some("data")),
            "a commit naming a tree of its own"
        );
        commit.push((V::Text("data".into()), drisl::link_to(&root)));
        Ok(StarLite {
            frames,
            commit: verify_commit(V::Map(commit), did, key)?,
            tree: RootBuilder::new(),
        })
    }

    pub fn commit(&self) -> &Commit {
        &self.commit
    }

    /// The next record, its key and its DRISL; none at the end.
    pub fn record(&mut self) -> Result<Option<Record>> {
        let Some(key) = self.frames.frame(MAX_KEY, "a key")? else {
            return Ok(None);
        };
        let key = String::from_utf8(key).context("a key that is not text")?;
        let record = self.frames.frame(MAX_RECORD, "a record")?;
        let record = record.with_context(|| format!("{key} with no record"))?;
        self.tree.add(&key, &record)?;
        Ok(Some((key, record)))
    }

    /// The commit, once the records read make the tree it signed.
    pub fn finish(self) -> Result<Commit> {
        let root = self.tree.root();
        ensure!(
            root == self.commit.data,
            "the records do not make the tree the commit signed"
        );
        Ok(self.commit)
    }
}

/// Writes `commit`'s repo as STAR-lite to `out`, from `records`, its keys
/// and DRISL in key order.
pub fn write(
    out: &mut impl Write,
    commit: &Commit,
    records: impl IntoIterator<Item = Record>,
) -> std::io::Result<()> {
    out.write_all(&MAGIC)?;
    out.write_all(&commit.data)?;
    frame(out, &drisl::encode(&commit.partial))?;
    for (key, record) in records {
        frame(out, key.as_bytes())?;
        frame(out, &record)?;
    }
    Ok(())
}

/// Writes `bytes` to `out` as a frame: its length, then it.
pub fn frame(out: &mut impl Write, bytes: &[u8]) -> std::io::Result<()> {
    out.write_all(&varint(bytes.len()))?;
    out.write_all(bytes)
}

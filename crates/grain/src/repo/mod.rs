//! A whole repo, read as an export and checked as it is read: every record
//! of it in key order, the tree's root rebuilt from them and held to the
//! root the account's commit names, and the commit held to the account's
//! signing key.
//!
//! An export is STAR-lite ([`star`]), as microcosm's hubble serves it, or
//! a CAR ([`car`]), as any PDS's `com.atproto.sync.getRepo` does; zstd it
//! may come in. [`open`] tells which by its first bytes. STAR-lite streams:
//! a record at a time, nothing of the repo held but one tree node a layer.
//! A CAR's blocks come in no order a reader can rely on, so they are kept
//! in a spill file, a few bytes each held in memory, and walked from its
//! commit once all are in.
//!
//! The parts are grain's own and depend on nothing of the rest of it but
//! [`crate::drisl`] and [`crate::crypto`], for knotless to take back.

pub mod car;
pub mod mst;
pub mod star;

use crate::crypto::PublicKey;
use crate::drisl;
use anyhow::{Context, Result, anyhow, ensure};
use ciborium::Value as V;
use std::io::{BufReader, Read, Seek, Write};

/// The most a record's key may be: a collection's 317 bytes, a slash and
/// a record key's 512.
pub const MAX_KEY: usize = 830;
/// The most a record may be, as atproto recommends.
pub const MAX_RECORD: usize = 1_048_576;
/// The most a commit may be.
pub const MAX_COMMIT: usize = 4096;

/// The bytes a zstd frame starts with.
pub const ZSTD: [u8; 4] = [0x28, 0xb5, 0x2f, 0xfd];

/// A record as a repo gives it out: its key, `collection/rkey`, and its
/// DRISL.
pub type Record = (String, Vec<u8>);

/// An account's commit, checked: whose repo it is, at which revision, and
/// the root of the tree it signed.
#[derive(Debug, Clone, PartialEq)]
pub struct Commit {
    pub did: String,
    pub rev: String,
    /// The tree's root, a CID as bytes.
    pub data: Vec<u8>,
    /// The commit as signed, less `data`: as STAR-lite carries it.
    pub partial: V,
}

/// `commit`, a commit's DRISL map, if it is `did`'s and `key` signed it.
pub fn verify_commit(commit: V, did: &str, key: &PublicKey) -> Result<Commit> {
    let V::Map(mut fields) = commit else {
        return Err(anyhow!("a commit that is not a map"));
    };
    let at =
        |fields: &[(V, V)], name: &str| fields.iter().position(|(k, _)| k.as_text() == Some(name));
    let sig = at(&fields, "sig").map(|i| fields.remove(i).1);
    let sig = sig
        .and_then(|s| s.into_bytes().ok())
        .context("a commit with no signature")?;
    let text = |name: &str| {
        at(&fields, name)
            .and_then(|i| fields[i].1.as_text())
            .map(str::to_string)
    };
    let theirs = text("did").context("a commit with no DID")?;
    ensure!(theirs == did, "a commit for {theirs}, not {did}");
    let rev = text("rev").filter(|r| crate::lexicon::valid_tid(r));
    let rev = rev.context("a commit with no revision")?;
    let data = at(&fields, "data").and_then(|i| drisl::link(&fields[i].1).map(<[u8]>::to_vec));
    let data = data.context("a commit with no tree")?;
    let signed = drisl::encode(&V::Map(fields.clone()));
    key.verify(&signed, &sig)
        .context("a commit the account's key did not sign")?;
    fields.retain(|(k, _)| k.as_text() != Some("data"));
    fields.push((V::Text("sig".into()), V::Bytes(sig)));
    Ok(Commit {
        did: theirs,
        rev,
        data,
        partial: V::Map(fields),
    })
}

/// A stream of frames, each an unsigned varint length and that many
/// bytes, as STAR-lite and CAR both write them (and knotless's STAR v1).
pub struct Frames<R> {
    r: BufReader<R>,
}

impl<R: Read> Frames<R> {
    pub fn new(r: R) -> Frames<R> {
        Frames {
            r: BufReader::new(r),
        }
    }

    /// The next length, in its shortest form: seven bits a byte, least
    /// significant first, the high bit set on all but the last. None
    /// where the stream ends before it.
    pub fn length(&mut self) -> Result<Option<usize>> {
        let (mut length, mut i) = (0, 0);
        loop {
            ensure!(i < 6, "a length too long");
            let Some(byte) = self.r.by_ref().bytes().next().transpose()? else {
                ensure!(i == 0, "it ends inside a length");
                return Ok(None);
            };
            length += usize::from(byte & 0x7f) << (7 * i);
            if byte < 0x80 {
                ensure!(byte != 0 || i == 0, "a length not in its shortest form");
                return Ok(Some(length));
            }
            i += 1;
        }
    }

    /// Exactly `n` bytes, of `what`.
    pub fn exact(&mut self, n: usize, what: &str) -> Result<Vec<u8>> {
        let mut bytes = vec![0; n];
        self.r.read_exact(&mut bytes).map_err(|e| match e.kind() {
            std::io::ErrorKind::UnexpectedEof => anyhow!("it ends inside {what}"),
            _ => e.into(),
        })?;
        Ok(bytes)
    }

    /// The next frame, of `what`, at most `max` bytes; none at the end.
    pub fn frame(&mut self, max: usize, what: &str) -> Result<Option<Vec<u8>>> {
        let Some(length) = self.length()? else {
            return Ok(None);
        };
        ensure!(length <= max, "{what} of more than {max} bytes");
        self.exact(length, what).map(Some)
    }
}

/// An unsigned varint, as [`Frames::length`] reads it.
pub fn varint(mut n: usize) -> Vec<u8> {
    let mut out = Vec::new();
    while n >= 0x80 {
        out.push((n as u8 & 0x7f) | 0x80);
        n >>= 7;
    }
    out.push(n as u8);
    out
}

/// Where a CAR's blocks are kept while it is read: a file, or for tests
/// memory.
pub trait Spill: Read + Write + Seek + Send {}

impl<T: Read + Write + Seek + Send> Spill for T {}

/// A body read from.
pub type Body = Box<dyn Read + Send>;

/// A repo export being read: its commit, checked, then its records in key
/// order, then its tree's root checked by [`Archive::finish`]. Until then
/// nothing read from it is proven, so nothing is to be kept for good.
pub enum Archive {
    Star(star::StarLite<Body>),
    Car(car::Car),
}

impl Archive {
    /// The commit, its signature checked.
    pub fn commit(&self) -> &Commit {
        match self {
            Archive::Star(s) => s.commit(),
            Archive::Car(c) => c.commit(),
        }
    }

    /// The next record: its key, `<collection>/<rkey>`, and its DRISL.
    pub fn record(&mut self) -> Result<Option<Record>> {
        match self {
            Archive::Star(s) => s.record(),
            Archive::Car(c) => c.record(),
        }
    }

    /// The commit, once every record has been read and they make the tree
    /// it signed.
    pub fn finish(self) -> Result<Commit> {
        match self {
            Archive::Star(s) => s.finish(),
            Archive::Car(c) => c.finish(),
        }
    }
}

/// `did`'s repo, from `body`, a STAR-lite archive or a CAR, zstd'd or not,
/// its commit checked against `key`. A CAR's blocks go to `spill`.
pub fn open(
    body: impl Read + Send + 'static,
    did: &str,
    key: &PublicKey,
    spill: Box<dyn Spill>,
) -> Result<Archive> {
    let (head, body) = peek(Box::new(body))?;
    let body: Body = if head.starts_with(&ZSTD) {
        Box::new(zstd::stream::read::Decoder::new(body)?)
    } else {
        body
    };
    let (head, body) = peek(body)?;
    Ok(if head.starts_with(&star::MAGIC) {
        Archive::Star(star::StarLite::open(body, did, key)?)
    } else {
        Archive::Car(car::Car::read(body, did, key, spill)?)
    })
}

/// The first bytes of `body`, and `body` as it was.
fn peek(body: Body) -> Result<(Vec<u8>, Body)> {
    let mut head = Vec::new();
    let mut body = body;
    body.by_ref().take(4).read_to_end(&mut head)?;
    let again = std::io::Cursor::new(head.clone()).chain(body);
    Ok((head, Box::new(again)))
}

#[cfg(test)]
pub(crate) mod tests;

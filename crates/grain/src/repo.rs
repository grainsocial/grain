//! A whole repo, read as an export and checked as it is read, by the
//! `atproto` crate's readers: every record of it in key order, the tree's
//! root rebuilt from them and held to the root the account's commit names,
//! and the commit held to the account's signing key.
//!
//! An export is STAR-lite (`atproto::star_lite`), as microcosm's hubble
//! serves it, or a CAR (`atproto::car`), as any PDS's
//! `com.atproto.sync.getRepo` does; zstd it may come in. [`open`] tells
//! which by its first bytes. What is grain's here is the reading: the body
//! read a piece at a time and fed to the crate, and a CAR's blocks kept in
//! a spill file, a few bytes of each held in memory, until its tree is
//! walked from its commit (`atproto::mst::Walk`).

use crate::crypto::PublicKey;
use anyhow::{Context, Result, ensure};
use atproto::car::{self, Item};
use atproto::mst::{Step, Walk};
use atproto::star_lite::{self, MAX_RECORD};
use atproto::{Cid, Commit};
use std::collections::HashMap;
use std::io::{BufWriter, Read, Seek, SeekFrom, Write};

/// A record as a repo gives it out: its key, `collection/rkey`, and its
/// DRISL.
pub type Record = (String, Vec<u8>);

/// The bytes a zstd frame starts with.
pub const ZSTD: [u8; 4] = [0x28, 0xb5, 0x2f, 0xfd];

/// The most a CAR's blocks may come to in all, spilled: past any repo
/// the network has.
pub const MAX_CAR: u64 = 16 << 30;

/// How much of a body is read at a time.
const CHUNK: usize = 64 * 1024;

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
    Star(Box<Star>),
    Car(Box<Car>),
}

impl Archive {
    /// The commit, its signature checked.
    pub fn commit(&self) -> &Commit {
        match self {
            Archive::Star(s) => &s.commit,
            Archive::Car(c) => &c.commit,
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
            Archive::Star(s) => Ok(s.reader.finish()?),
            Archive::Car(c) => {
                c.walk.finish()?;
                Ok(c.commit)
            }
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
    Ok(if head.starts_with(&star_lite::MAGIC) {
        Archive::Star(Box::new(Star::open(body, did, key)?))
    } else {
        Archive::Car(Box::new(Car::read(body, did, key, spill)?))
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

/// A STAR-lite archive being read: `atproto::star_lite::Reader` fed from
/// the body as it asks.
pub struct Star {
    body: Body,
    reader: star_lite::Reader,
    commit: Commit,
    /// The record read with the header, given out first.
    first: Option<Record>,
}

impl Star {
    /// Reads the body until the archive's commit is in and checked.
    fn open(mut body: Body, did: &str, key: &PublicKey) -> Result<Star> {
        let mut reader = star_lite::Reader::new(did, key);
        let mut buf = vec![0; CHUNK];
        let first = loop {
            let record = reader.record()?;
            if record.is_some() || reader.commit().is_some() {
                break record;
            }
            let n = body.read(&mut buf)?;
            if n == 0 {
                // Ended before its commit: finishing says why.
                return Err(reader.finish().expect_err("no commit yet").into());
            }
            reader.feed(&buf[..n]);
        };
        let commit = reader.commit().cloned().expect("a commit read");
        Ok(Star {
            body,
            reader,
            commit,
            first,
        })
    }

    fn record(&mut self) -> Result<Option<Record>> {
        if let Some(first) = self.first.take() {
            return Ok(Some(first));
        }
        let mut buf = vec![0; CHUNK];
        loop {
            if let Some(record) = self.reader.record()? {
                return Ok(Some(record));
            }
            let n = self.body.read(&mut buf)?;
            if n == 0 {
                return Ok(None);
            }
            self.reader.feed(&buf[..n]);
        }
    }
}

/// A CAR's blocks, in the spill, by CID: where each starts and how long.
struct Blocks {
    spill: Box<dyn Spill>,
    at: HashMap<Cid, (u64, usize)>,
}

impl Blocks {
    fn get(&mut self, cid: &Cid) -> Result<Vec<u8>> {
        let what = || format!("a CAR without the block {cid}");
        let &(from, length) = self.at.get(cid).with_context(what)?;
        self.spill.seek(SeekFrom::Start(from))?;
        let mut block = vec![0; length];
        self.spill.read_exact(&mut block)?;
        Ok(block)
    }
}

/// A CAR being read: its blocks spilled as `atproto::car::Stream` gives
/// them out, then its tree walked from its commit.
pub struct Car {
    blocks: Blocks,
    commit: Commit,
    walk: Walk,
}

impl Car {
    /// Reads `did`'s CAR from `body`, its blocks into `spill`, and checks
    /// that `key` signed the commit it names.
    fn read(mut body: Body, did: &str, key: &PublicKey, spill: Box<dyn Spill>) -> Result<Car> {
        let mut stream = car::Stream::new(MAX_RECORD + 36);
        let mut spill = BufWriter::new(spill);
        let (mut at, mut end, mut root) = (HashMap::new(), 0, None);
        let mut buf = vec![0; CHUNK];
        loop {
            while let Some(item) = stream.item()? {
                match item {
                    Item::Roots(roots) => {
                        root = Some(*roots.first().context("a CAR with no root")?);
                    }
                    Item::Block(cid, bytes) => {
                        end += bytes.len() as u64;
                        ensure!(end <= MAX_CAR, "a CAR of more than {MAX_CAR} bytes");
                        spill.write_all(&bytes)?;
                        at.insert(cid, (end - bytes.len() as u64, bytes.len()));
                    }
                }
            }
            let n = body.read(&mut buf)?;
            if n == 0 {
                break;
            }
            stream.feed(&buf[..n]);
        }
        stream.finish()?;
        let root = root.context("a CAR with no root")?;
        let spill = spill.into_inner().map_err(|e| e.into_error())?;
        let mut blocks = Blocks { spill, at };
        let commit = Commit::verified(&blocks.get(&root)?, did, key)?;
        Ok(Car {
            blocks,
            walk: Walk::new(commit.data),
            commit,
        })
    }

    fn record(&mut self) -> Result<Option<Record>> {
        loop {
            match self.walk.step()? {
                Step::Node(cid) => {
                    let node = self.blocks.get(&cid)?;
                    self.walk.node(&node)?;
                }
                Step::Leaf(key, cid) => return Ok(Some((key, self.blocks.get(&cid)?))),
                Step::Done => return Ok(None),
            }
        }
    }
}

#[cfg(test)]
mod tests {
    //! Repos made and signed here, read back as STAR-lite and as CARs,
    //! plain and zstd'd: what is grain's in reading them. The checks
    //! themselves are the `atproto` crate's, tested there; `tests/repo.rs`
    //! reads the reference PDS's.

    use super::*;
    use atproto::drisl::{self, Value};
    use atproto::mst::Tree;
    use atproto::{Curve, Keypair};
    use std::collections::BTreeMap;
    use std::io::Cursor;

    const DID: &str = "did:plc:repotest00000000000000000";
    const REV: &str = "3l3qo2vuowo2a";

    /// A repo of `n` records, signed by a key of its own.
    struct Repo {
        key: Keypair,
        records: Vec<Record>,
        tree: Tree,
        commit: Commit,
    }

    fn repo(n: usize) -> Repo {
        let key = Keypair::generate(Curve::K256);
        let records: Vec<Record> = (0..n)
            .map(|i| {
                let record = Value::Map(BTreeMap::from([("n".into(), Value::Integer(i as i64))]));
                (format!("app.x/{i:04}"), drisl::encode(&record))
            })
            .collect();
        let cids = records.iter().map(|(k, r)| (k.clone(), Cid::of_cbor(r)));
        let tree = Tree::build(&cids.collect());
        let commit = Commit::sign(DID, tree.root(), REV, &key);
        Repo {
            key,
            records,
            tree,
            commit,
        }
    }

    impl Repo {
        fn star(&self) -> Vec<u8> {
            let records = self.records.iter().map(|(k, r)| (k.as_str(), &r[..]));
            star_lite::write(&self.commit, records)
        }

        /// The repo as a CAR naming `commit`, its blocks less any named in
        /// `less`.
        fn car(&self, commit: &Commit, less: &[Cid]) -> Vec<u8> {
            let mut blocks: Vec<(Cid, Vec<u8>)> = vec![(commit.cid(), commit.to_bytes())];
            blocks.extend(self.tree.blocks());
            let records = self
                .records
                .iter()
                .map(|(_, r)| (Cid::of_cbor(r), r.clone()));
            blocks.extend(records);
            blocks.retain(|(cid, _)| !less.contains(cid));
            let blocks = blocks.iter().map(|(c, b)| (c, b.as_slice()));
            car::write(&[commit.cid()], blocks)
        }
    }

    /// Reads `bytes` whole, as `DID`'s repo, its commit checked against
    /// `key`.
    fn read(bytes: impl Read + Send + 'static, key: &PublicKey) -> Result<(Commit, Vec<Record>)> {
        let spill = Box::new(std::io::Cursor::new(Vec::new()));
        let mut archive = open(bytes, DID, key, spill)?;
        assert_eq!(archive.commit().did, DID);
        let mut records = Vec::new();
        while let Some(record) = archive.record()? {
            records.push(record);
        }
        Ok((archive.finish()?, records))
    }

    fn error(result: Result<impl Sized>) -> String {
        result.err().expect("an error").to_string()
    }

    /// A body that gives at most a few bytes a read, as a slow network does.
    struct Trickle(Cursor<Vec<u8>>);

    impl Read for Trickle {
        fn read(&mut self, buf: &mut [u8]) -> std::io::Result<usize> {
            let n = buf.len().min(7);
            self.0.read(&mut buf[..n])
        }
    }

    #[test]
    fn star_lite_and_cars_read_plain_and_zstd() {
        for n in [0, 1, 300] {
            let repo = repo(n);
            let public = repo.key.public();
            for bytes in [repo.star(), repo.car(&repo.commit, &[])] {
                let zstd = zstd::encode_all(&bytes[..], 3).unwrap();
                for bytes in [bytes, zstd] {
                    let (commit, records) = read(Cursor::new(bytes.clone()), &public).unwrap();
                    assert_eq!(commit, repo.commit);
                    assert_eq!(records, repo.records, "{n} records");
                    let trickled = read(Trickle(Cursor::new(bytes)), &public).unwrap();
                    assert_eq!(
                        trickled.1, repo.records,
                        "{n} records, a few bytes at a time"
                    );
                }
            }
        }
    }

    #[test]
    fn what_the_crate_refuses_is_refused() {
        let repo = repo(3);
        let public = repo.key.public();
        let read = |bytes: Vec<u8>| error(read(Cursor::new(bytes), &public));
        let star = repo.star();
        assert_eq!(
            read(star[..10].to_vec()),
            "the archive ends inside its header"
        );
        let mut forged = star.clone();
        *forged.last_mut().unwrap() ^= 1;
        assert_eq!(
            read(forged),
            "the records do not make the tree the commit signed"
        );
        assert_eq!(
            read(star[..star.len() - 1].to_vec()),
            "the archive ends inside a record"
        );
        let car = repo.car(&repo.commit, &[]);
        assert_eq!(
            read(car[..car.len() - 1].to_vec()),
            "the file ends in the middle of a block"
        );
        let header = drisl::encode(&Value::Map(BTreeMap::from([
            ("roots".into(), Value::Array(vec![])),
            ("version".into(), Value::Integer(1)),
        ])));
        let mut no_root = Vec::new();
        car::varint(header.len() as u64, &mut no_root);
        no_root.extend(header);
        assert_eq!(read(no_root), "a CAR with no root");
    }

    #[test]
    fn a_cars_commit_is_the_accounts() {
        let repo = repo(3);
        let public = repo.key.public();
        let read = |car: Vec<u8>| error(read(Cursor::new(car), &public));
        let theirs = Commit::sign("did:plc:someoneelse", repo.commit.data, REV, &repo.key);
        assert_eq!(read(repo.car(&theirs, &[])), "a commit for another account");
        let no_tid = Commit::sign(DID, repo.commit.data, "not-a-tid", &repo.key);
        assert_eq!(
            read(repo.car(&no_tid, &[])),
            "a commit whose rev is not a TID"
        );
        let other = Keypair::generate(Curve::K256);
        let forged = Commit::sign(DID, repo.commit.data, REV, &other);
        assert_eq!(
            read(repo.car(&forged, &[])),
            "a commit the account's key did not sign"
        );
        let missing = Cid::of_cbor(&repo.records[1].1);
        assert_eq!(
            read(repo.car(&repo.commit, &[missing])),
            format!("a CAR without the block {missing}")
        );
    }

    /// A body that gives `bytes`, then fails.
    struct Fails(std::io::Cursor<Vec<u8>>);

    impl Read for Fails {
        fn read(&mut self, buf: &mut [u8]) -> std::io::Result<usize> {
            match self.0.read(buf)? {
                0 => Err(std::io::Error::other("went quiet")),
                n => Ok(n),
            }
        }
    }

    #[test]
    fn a_body_that_fails_fails_the_read() {
        let repo = repo(300);
        let public = repo.key.public();
        for whole in [repo.star(), repo.car(&repo.commit, &[])] {
            for cut in [20, whole.len() - 2, whole.len()] {
                let body = Fails(std::io::Cursor::new(whole[..cut].to_vec()));
                assert_eq!(error(read(body, &public)), "went quiet", "cut at {cut}");
            }
        }
    }
}

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
//!
//! One record is proved by the CAR `com.atproto.sync.getRecord` answers
//! ([`prove`]): its commit, and the tree's nodes from the root the commit
//! signed down to where the record's key is, or would be.

use crate::crypto::PublicKey;
use anyhow::{Context, Result, ensure};
use atproto::car::{self, Item};
use atproto::drisl::{self, Value};
use atproto::mst::{self, Step, Walk};
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

/// The most a record's proof may be: the record, its commit and the few
/// nodes above it.
pub const MAX_PROOF: usize = 2 * MAX_RECORD;

/// One record of a repo, as its commit proves it.
#[derive(Debug, Clone, PartialEq)]
pub struct Proved {
    /// The commit, checked: the repo at its revision.
    pub commit: Commit,
    /// The record at the key, its CID and its DRISL; none where the repo
    /// has no record there.
    pub record: Option<(Cid, Vec<u8>)>,
}

/// The record at `key`, `collection/rkey`, in `did`'s repo, from `proof`,
/// a CAR naming a commit `signer` signed, as `com.atproto.sync.getRecord`
/// answers. Each node on the way down is held to the CID the one above
/// names, from the root the commit signed, its keys in order and each at
/// its layer, below the layer above: the record found at its key is the
/// one the repo has at that revision, and a key the walk finds no entry
/// for is one the repo does not have. A node the walk needs and the proof
/// lacks fails it, never answers that there is none.
pub fn prove(proof: &[u8], did: &str, signer: &PublicKey, key: &str) -> Result<Proved> {
    ensure!(
        proof.len() <= MAX_PROOF,
        "a proof of more than {MAX_PROOF} bytes"
    );
    let car = car::read(proof)?;
    let get = |cid: &Cid| {
        let what = || format!("a proof without the block {cid}");
        car.blocks.get(cid).with_context(what)
    };
    let root = car.roots.first().context("a CAR with no root")?;
    let commit = Commit::verified(get(root)?, did, signer)?;
    let (mut at, mut above) = (commit.data, u32::MAX);
    let record = loop {
        let (left, entries) =
            node(get(&at)?).with_context(|| format!("{at} is not a tree node"))?;
        ensure!(
            entries.windows(2).all(|w| w[0].0 < w[1].0),
            "a tree node whose keys are out of order"
        );
        if let Some((first, _, _)) = entries.first() {
            let layer = mst::depth(first.as_bytes());
            let held = entries
                .iter()
                .all(|(k, _, _)| mst::depth(k.as_bytes()) == layer);
            ensure!(
                held && layer < above,
                "a tree node of keys out of their layer"
            );
            above = layer;
        }
        let i = entries.partition_point(|(k, _, _)| k.as_str() < key);
        if let Some((_, value, _)) = entries.get(i).filter(|(k, _, _)| k == key) {
            break Some((*value, get(value)?.clone()));
        }
        let below = match i {
            0 => left,
            _ => entries[i - 1].2,
        };
        match below {
            Some(cid) => at = cid,
            None => break None,
        }
    };
    Ok(Proved { commit, record })
}

/// A tree node's keys, each with its record's CID and the subtree right of
/// it.
type Entries = Vec<(String, Cid, Option<Cid>)>;

/// The node `bytes` hold: the subtree left of its first key, and its keys,
/// each written as how much of the key before it it shares and the rest.
fn node(bytes: &[u8]) -> Option<(Option<Cid>, Entries)> {
    let link = |v: &Value| match v {
        Value::Null => Some(None),
        Value::Link(cid) => Some(Some(*cid)),
        _ => None,
    };
    let Value::Map(map) = drisl::decode(bytes).ok()? else {
        return None;
    };
    let (Value::Array(written), left) = (map.get("e")?, link(map.get("l")?)?) else {
        return None;
    };
    let (mut entries, mut last) = (Vec::with_capacity(written.len()), Vec::new());
    for entry in written {
        let Value::Map(e) = entry else {
            return None;
        };
        let (Value::Integer(shared), Value::Bytes(rest), Value::Link(value)) =
            (e.get("p")?, e.get("k")?, e.get("v")?)
        else {
            return None;
        };
        let shared = usize::try_from(*shared).ok().filter(|&n| n <= last.len())?;
        last.truncate(shared);
        last.extend_from_slice(rest);
        let key = String::from_utf8(last.clone()).ok()?;
        entries.push((key, *value, link(e.get("t")?)?));
    }
    Some((left, entries))
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

    /// A CAR naming `commit`, its block first, then `blocks`, as a PDS's
    /// `com.atproto.sync.getRecord` answers.
    fn proof_car(commit: &Commit, blocks: impl IntoIterator<Item = (Cid, Vec<u8>)>) -> Vec<u8> {
        let mut all = vec![(commit.cid(), commit.to_bytes())];
        all.extend(blocks);
        car::write(&[commit.cid()], all.iter().map(|(c, b)| (c, b.as_slice())))
    }

    impl Repo {
        /// `key`'s proof, as a PDS answers it, less the blocks in `less`.
        fn proof(&self, key: &str, less: &[Cid]) -> Vec<u8> {
            let mut blocks: Vec<(Cid, Vec<u8>)> =
                self.tree.covering_proof(key).into_iter().collect();
            let record = self.records.iter().filter(|(k, _)| k == key);
            blocks.extend(record.map(|(_, r)| (Cid::of_cbor(r), r.clone())));
            blocks.retain(|(cid, _)| !less.contains(cid));
            proof_car(&self.commit, blocks)
        }
    }

    /// A tree node of `keys`, each written whole, with `value` as each
    /// one's record, and no subtrees.
    fn node_of(keys: &[&str], value: Cid) -> Vec<u8> {
        let entry = |key: &&str| {
            Value::Map(BTreeMap::from([
                ("k".into(), Value::Bytes(key.as_bytes().to_vec())),
                ("p".into(), Value::Integer(0)),
                ("t".into(), Value::Null),
                ("v".into(), Value::Link(value)),
            ]))
        };
        drisl::encode(&Value::Map(BTreeMap::from([
            ("e".into(), Value::Array(keys.iter().map(entry).collect())),
            ("l".into(), Value::Null),
        ])))
    }

    #[test]
    fn a_record_is_proved_where_it_is_and_where_it_is_not() {
        let empty = repo(0);
        let repo = repo(300);
        let public = repo.key.public();
        for (key, record) in &repo.records {
            let proved = prove(&repo.proof(key, &[]), DID, &public, key).unwrap();
            assert_eq!(proved.commit, repo.commit);
            let found = Some((Cid::of_cbor(record), record.clone()));
            assert_eq!(proved.record, found, "{key}");
        }
        // Keys it has not: before, between and after the ones it has.
        for key in [
            "app.a/0",
            "app.x/0000a",
            "app.x/0150a",
            "app.x/9999",
            "app.z/0",
        ] {
            let proved = prove(&repo.proof(key, &[]), DID, &public, key).unwrap();
            assert_eq!(proved.record, None, "{key}");
        }
        // A repo with no records: its root alone says so.
        let proved = prove(
            &empty.proof("app.x/0", &[]),
            DID,
            &empty.key.public(),
            "app.x/0",
        );
        assert_eq!(proved.unwrap().record, None);
    }

    #[test]
    fn a_proof_that_does_not_hold_is_refused() {
        let repo = repo(300);
        let public = repo.key.public();
        let refused = |proof: Vec<u8>, key: &str| error(prove(&proof, DID, &public, key));
        let (key, record) = &repo.records[150];
        // A block on the way left out: the record, or a node.
        let held = Cid::of_cbor(record);
        let root = repo.tree.root();
        for less in [held, root] {
            assert_eq!(
                refused(repo.proof(key, &[less]), key),
                format!("a proof without the block {less}")
            );
        }
        // A commit the account's key did not sign, or with no tree.
        let other = Keypair::generate(Curve::K256);
        let forged = Commit::sign(DID, root, REV, &other);
        let blocks = repo.tree.covering_proof(key);
        assert_eq!(
            refused(proof_car(&forged, blocks), key),
            "a commit the account's key did not sign"
        );
        let no_tree = Commit::sign(DID, held, REV, &repo.key);
        assert_eq!(
            refused(proof_car(&no_tree, [(held, record.clone())]), key),
            format!("{held} is not a tree node")
        );
        // A node whose keys go backwards, or sit at other layers.
        let depth = |k: &str| mst::depth(k.as_bytes());
        let mut low = repo
            .records
            .iter()
            .map(|(k, _)| k.as_str())
            .filter(|k| depth(k) == 0);
        let (first, second) = (low.next().unwrap(), low.next().unwrap());
        let high = repo
            .records
            .iter()
            .map(|(k, _)| k.as_str())
            .find(|k| depth(k) > 0);
        let mut mixed = [first, high.unwrap()];
        mixed.sort();
        for (keys, why) in [
            ([second, first], "a tree node whose keys are out of order"),
            (mixed, "a tree node of keys out of their layer"),
        ] {
            let node = node_of(&keys, held);
            let commit = Commit::sign(DID, Cid::of_cbor(&node), REV, &repo.key);
            let proof = proof_car(&commit, [(Cid::of_cbor(&node), node)]);
            assert_eq!(refused(proof, first), why);
        }
        assert_eq!(
            refused(vec![0; MAX_PROOF + 1], key),
            format!("a proof of more than {MAX_PROOF} bytes")
        );
    }

    #[test]
    fn what_is_not_a_tree_node_is_not_read_as_one() {
        let cid = Cid::of_cbor(b"\xa0");
        let map = |pairs: Vec<(&str, Value)>| {
            Value::Map(pairs.into_iter().map(|(k, v)| (k.into(), v)).collect())
        };
        let entry = |p: i64, k: &[u8]| {
            map(vec![
                ("k", Value::Bytes(k.to_vec())),
                ("p", Value::Integer(p)),
                ("t", Value::Null),
                ("v", Value::Link(cid)),
            ])
        };
        let with = |e: Value, l: Value| drisl::encode(&map(vec![("e", e), ("l", l)]));
        let entries = |e: Vec<Value>| with(Value::Array(e), Value::Null);
        let read = entries(vec![entry(0, &b"a/b"[..]), entry(2, &b"c"[..])]);
        let both = vec![("a/b".into(), cid, None), ("a/c".into(), cid, None)];
        assert_eq!(node(&read), Some((None, both)));
        for bad in [
            b"\xff".to_vec(),
            drisl::encode(&Value::Array(vec![])),
            with(Value::Array(vec![]), Value::Integer(1)),
            with(Value::Null, Value::Null),
            entries(vec![Value::Null]),
            entries(vec![map(vec![("k", Value::Null)])]),
            entries(vec![entry(1, &b"a"[..])]),
            entries(vec![entry(0, &b"\xff"[..])]),
        ] {
            assert_eq!(node(&bad), None, "{bad:?}");
        }
    }
}

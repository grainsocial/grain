//! A repo as a CAR (CARv1), as a PDS's `com.atproto.sync.getRepo` answers:
//! a header naming the commit's block, then blocks, each its CID and its
//! bytes, in whatever order the PDS wrote them.
//!
//! Each block is held to its CID as it comes, and kept in a spill file,
//! only where each is held in memory. Once all are in, the commit's
//! signature is checked, and its tree walked from the root in key order,
//! each record given out as [`super::star::StarLite`] gives them out and
//! rebuilt into a root of its own the same way: a tree a PDS shaped other
//! than atproto would is refused, whatever its blocks hash to.

use super::mst::{Node, RootBuilder};
use super::{Commit, Frames, MAX_RECORD, Record, Spill, verify_commit};
use crate::crypto::PublicKey;
use crate::drisl;
use anyhow::{Context, Result, ensure};
use ciborium::Value as V;
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::io::{BufWriter, Read, Seek, SeekFrom, Write};

/// The most a CAR's header may be.
const MAX_HEADER: usize = 4096;

/// The most a CAR's blocks may come to in all, spilled: past any repo
/// the network has.
pub const MAX_CAR: u64 = 16 << 30;

/// The CAR's blocks, in the spill, by CID: where each starts and how long.
struct Blocks {
    spill: Box<dyn Spill>,
    at: HashMap<Vec<u8>, (u64, usize)>,
}

impl Blocks {
    fn get(&mut self, cid: &[u8]) -> Result<Vec<u8>> {
        let what = || format!("a CAR without the block {}", drisl::cid_text(cid));
        let &(from, length) = self.at.get(cid).with_context(what)?;
        self.spill.seek(SeekFrom::Start(from))?;
        let mut block = vec![0; length];
        self.spill.read_exact(&mut block)?;
        Ok(block)
    }
}

/// What is left of the tree to walk, last first.
enum Next {
    Node(Vec<u8>),
    Record(String, Vec<u8>),
}

/// A CAR being read.
pub struct Car {
    blocks: Blocks,
    commit: Commit,
    walk: Vec<Next>,
    tree: RootBuilder,
}

impl Car {
    /// Reads `did`'s CAR from `r`, its blocks into `spill`, and checks that
    /// `key` signed the commit it names.
    pub fn read(r: impl Read, did: &str, key: &PublicKey, spill: Box<dyn Spill>) -> Result<Car> {
        let mut frames = Frames::new(r);
        let header = frames
            .frame(MAX_HEADER, "a CAR header")?
            .unwrap_or_default();
        let header: V = ciborium::from_reader(&header[..]).context("not a CAR")?;
        let field = |name: &str| {
            let pairs = header.as_map()?;
            pairs
                .iter()
                .find(|(k, _)| k.as_text() == Some(name))
                .map(|(_, v)| v)
        };
        let version = field("version").and_then(V::as_integer);
        ensure!(version == Some(1.into()), "not a CAR of version 1");
        let root = field("roots").and_then(|r| drisl::link(r.as_array()?.first()?));
        let root = root.context("a CAR with no root")?.to_vec();
        let mut spill = BufWriter::new(spill);
        let (mut at, mut end) = (HashMap::new(), 0);
        while let Some(block) = frames.frame(MAX_RECORD + 36, "a CAR block")? {
            ensure!(
                block.len() >= 36
                    && block[0] == 1
                    && [0x71, 0x55].contains(&block[1])
                    && block[2..4] == [0x12, 0x20],
                "a CAR block whose CID is not atproto's"
            );
            let (cid, bytes) = block.split_at(36);
            ensure!(
                Sha256::digest(bytes)[..] == cid[4..],
                "a CAR block that is not what its CID says"
            );
            ensure!(
                end + bytes.len() as u64 <= MAX_CAR,
                "a CAR of more than {MAX_CAR} bytes"
            );
            spill.write_all(bytes)?;
            at.insert(cid.to_vec(), (end, bytes.len()));
            end += bytes.len() as u64;
        }
        let spill = spill.into_inner().map_err(|e| e.into_error())?;
        let mut blocks = Blocks { spill, at };
        let commit: V =
            ciborium::from_reader(&blocks.get(&root)?[..]).context("a commit that is not CBOR")?;
        let commit = verify_commit(commit, did, key)?;
        Ok(Car {
            blocks,
            walk: vec![Next::Node(commit.data.clone())],
            commit,
            tree: RootBuilder::new(),
        })
    }

    pub fn commit(&self) -> &Commit {
        &self.commit
    }

    /// The next record, its key and its DRISL; none at the end.
    pub fn record(&mut self) -> Result<Option<Record>> {
        while let Some(next) = self.walk.pop() {
            match next {
                Next::Node(cid) => {
                    let node = Node::decode(&self.blocks.get(&cid)?)?;
                    for entry in node.entries.into_iter().rev() {
                        self.walk.extend(entry.right.map(Next::Node));
                        self.walk.push(Next::Record(entry.key, entry.value));
                    }
                    self.walk.extend(node.left.map(Next::Node));
                }
                Next::Record(key, cid) => {
                    let record = self.blocks.get(&cid)?;
                    self.tree.add(&key, &record)?;
                    return Ok(Some((key, record)));
                }
            }
        }
        Ok(None)
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

/// Writes a CAR of `blocks` naming `root` to `out`, each block's CID
/// worked out from it as DRISL.
pub fn write(out: &mut impl Write, root: &[u8], blocks: &[Vec<u8>]) -> std::io::Result<()> {
    let header = V::Map(vec![
        (
            V::Text("roots".into()),
            V::Array(vec![drisl::link_to(root)]),
        ),
        (V::Text("version".into()), V::Integer(1.into())),
    ]);
    super::star::frame(out, &drisl::encode(&header))?;
    for block in blocks {
        super::star::frame(out, &[drisl::cid(block), block.clone()].concat())?;
    }
    Ok(())
}

//! A repo's Merkle Search Tree: its root rebuilt from the keys and records
//! in key order, holding one node a layer at a time, and its nodes read
//! back from their blocks. As opensocial's `RootBuilder`
//! (`packages/group-sites/src/repoArchive.ts`), after STAR-lite's
//! reference algorithm.

use crate::drisl;
use anyhow::{Context, Result, ensure};
use ciborium::Value as V;
use sha2::{Digest, Sha256};

/// How many layers up the tree `key` sits: its SHA-256's leading zero
/// bits, two to a layer, as atproto's fanout of four puts it.
pub fn layer(key: &[u8]) -> u32 {
    let mut zeros = 0;
    for byte in Sha256::digest(key) {
        zeros += byte.leading_zeros();
        if byte != 0 {
            break;
        }
    }
    zeros / 2
}

/// A node's entry: a key, its record's CID, and the subtree right of it.
#[derive(Debug, Clone, PartialEq)]
pub struct Entry {
    pub key: String,
    pub value: Vec<u8>,
    pub right: Option<Vec<u8>>,
}

/// A tree node: the subtree left of its first entry, and its entries.
#[derive(Debug, Clone, Default, PartialEq)]
pub struct Node {
    pub left: Option<Vec<u8>>,
    pub entries: Vec<Entry>,
}

impl Node {
    fn is_empty(&self) -> bool {
        self.left.is_none() && self.entries.is_empty()
    }

    /// The node as atproto writes it: each key after the first as how much
    /// of the key before it it shares, and the rest.
    pub fn encode(&self) -> Vec<u8> {
        let link = |cid: &Option<Vec<u8>>| cid.as_deref().map_or(V::Null, drisl::link_to);
        let mut last: &[u8] = &[];
        let entries = self.entries.iter().map(|e| {
            let key = e.key.as_bytes();
            let shared = last.iter().zip(key).take_while(|(a, b)| a == b).count();
            last = key;
            V::Map(vec![
                (V::Text("k".into()), V::Bytes(key[shared..].to_vec())),
                (V::Text("p".into()), V::Integer((shared as u64).into())),
                (V::Text("t".into()), link(&e.right)),
                (V::Text("v".into()), drisl::link_to(&e.value)),
            ])
        });
        let node = V::Map(vec![
            (V::Text("e".into()), V::Array(entries.collect())),
            (V::Text("l".into()), link(&self.left)),
        ]);
        drisl::encode(&node)
    }

    /// A node from its block, its keys made whole again.
    pub fn decode(block: &[u8]) -> Result<Node> {
        let node: V = ciborium::from_reader(block).context("a tree node that is not CBOR")?;
        let field = |map: &V, name: &str| {
            let pairs = map.as_map()?;
            pairs
                .iter()
                .find(|(k, _)| k.as_text() == Some(name))
                .map(|(_, v)| v.clone())
        };
        let link = |v: Option<V>| v.as_ref().and_then(drisl::link).map(<[u8]>::to_vec);
        let entries = field(&node, "e").and_then(|e| e.into_array().ok());
        let entries = entries.context("a tree node with no entries")?;
        let mut last = Vec::new();
        let mut node = Node {
            left: link(field(&node, "l")),
            entries: Vec::with_capacity(entries.len()),
        };
        for e in &entries {
            let shared =
                field(e, "p").and_then(|p| usize::try_from(i128::from(p.as_integer()?)).ok());
            let suffix = field(e, "k").and_then(|k| k.into_bytes().ok());
            let (shared, suffix) = shared.zip(suffix).context("a tree entry with no key")?;
            ensure!(
                shared <= last.len(),
                "a tree key sharing more than the key before it"
            );
            last.truncate(shared);
            last.extend(suffix);
            node.entries.push(Entry {
                key: String::from_utf8(last.clone()).context("a tree key that is not text")?,
                value: link(field(e, "v")).context("a tree entry with no record")?,
                right: link(field(e, "t")),
            });
        }
        Ok(node)
    }
}

/// The tree's root, rebuilt from its keys and records in order. What is
/// left of the stack is finished, so only one node a layer is held.
#[derive(Default)]
pub struct RootBuilder {
    stack: Vec<Node>,
    prev: Option<u32>,
    last: String,
}

impl RootBuilder {
    pub fn new() -> RootBuilder {
        RootBuilder::default()
    }

    /// Adds the record `record` at `key`, which must come after the last.
    pub fn add(&mut self, key: &str, record: &[u8]) -> Result<()> {
        ensure!(key > self.last.as_str(), "keys out of order at {key}");
        self.last = key.to_string();
        let layer = layer(key.as_bytes());
        let at = layer as usize;
        if self.stack.len() <= at {
            self.stack.resize_with(at + 1, Node::default);
        }
        if self.prev.is_none_or(|prev| layer > prev) {
            self.fold(at);
        }
        self.stack[at].entries.push(Entry {
            key: key.to_string(),
            value: drisl::cid(record),
            right: None,
        });
        self.prev = Some(layer);
        Ok(())
    }

    /// Finishes every node below `layer`, each hung under the one above:
    /// as its left subtree, or right of its last entry.
    fn fold(&mut self, layer: usize) {
        for i in 0..layer {
            let node = std::mem::take(&mut self.stack[i]);
            if node.is_empty() {
                continue;
            }
            let cid = drisl::cid(&node.encode());
            let parent = &mut self.stack[i + 1];
            match parent.entries.last_mut() {
                Some(last) => last.right = Some(cid),
                None => parent.left = Some(cid),
            }
        }
    }

    /// The root's CID: of one empty node when no key was added, as
    /// atproto writes an empty repo.
    pub fn root(mut self) -> Vec<u8> {
        let top = self.stack.len().saturating_sub(1);
        self.fold(top);
        drisl::cid(&self.stack.pop().unwrap_or_default().encode())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn layers() {
        // atproto's interop vectors for the fanout of four.
        assert_eq!(layer(b""), 0);
        assert_eq!(layer(b"asdf"), 0);
        assert_eq!(layer(b"blue"), 1);
        assert_eq!(layer(b"2653ae71"), 0);
        assert_eq!(layer(b"88bfafc7"), 2);
        assert_eq!(layer(b"2a92d355"), 4);
        assert_eq!(layer(b"884976f5"), 6);
        assert_eq!(layer(b"app.bsky.feed.post/454397e440ec"), 4);
        assert_eq!(layer(b"app.bsky.feed.post/9adeb165882c"), 8);
    }

    #[test]
    fn the_empty_tree() {
        let root = drisl::cid_text(&RootBuilder::new().root());
        assert_eq!(
            root,
            "bafyreie5737gdxlw5i64vzichcalba3z2v5n6icifvx5xytvske7mr3hpm"
        );
    }

    /// The root of a tree of one key, worked by hand: a node of one entry.
    /// Deeper trees are checked against the reference PDS's.
    #[test]
    fn known_roots() {
        let record = drisl::encode(&V::Map(vec![(
            V::Text("name".into()),
            V::Text("value".into()),
        )]));
        let one = |keys: &[&str]| {
            let mut tree = RootBuilder::new();
            for key in keys {
                tree.add(key, &record).unwrap();
            }
            drisl::cid_text(&tree.root())
        };
        assert_eq!(
            one(&["com.example.record/3jqfcqzm3fo2j"]),
            "bafyreidgbec6p2odwcdq6phvbl2mwo66e63aurdl5z6bnfhgiilqlzlyx4"
        );
    }

    #[test]
    fn nodes_round_trip() {
        let mut tree = RootBuilder::new();
        tree.add("a/1", &[0xa0]).unwrap();
        assert!(tree.add("a/1", &[0xa0]).is_err(), "a key again");
        assert!(tree.add("a/0", &[0xa0]).is_err(), "a key before the last");
        let node = Node {
            left: Some(drisl::cid(b"l")),
            entries: vec![
                Entry {
                    key: "app.x/abc".into(),
                    value: drisl::cid(b"1"),
                    right: None,
                },
                Entry {
                    key: "app.x/abd".into(),
                    value: drisl::cid(b"2"),
                    right: Some(drisl::cid(b"r")),
                },
            ],
        };
        assert_eq!(Node::decode(&node.encode()).unwrap(), node);
        let bad = |node: V| Node::decode(&drisl::encode(&node)).unwrap_err().to_string();
        let entry = |p: i64, k: &[u8], v: V| {
            V::Map(vec![
                (V::Text("k".into()), V::Bytes(k.to_vec())),
                (V::Text("p".into()), V::Integer(p.into())),
                (V::Text("v".into()), v),
            ])
        };
        let node = |entries: Vec<V>| V::Map(vec![(V::Text("e".into()), V::Array(entries))]);
        let v = drisl::link_to(&drisl::cid(b"1"));
        assert_eq!(bad(V::Null), "a tree node with no entries");
        assert_eq!(bad(node(vec![V::Null])), "a tree entry with no key");
        assert_eq!(
            bad(node(vec![entry(1, b"a", v.clone())])),
            "a tree key sharing more than the key before it"
        );
        assert_eq!(
            bad(node(vec![entry(0, b"\xff", v)])),
            "a tree key that is not text"
        );
        assert_eq!(
            bad(node(vec![entry(0, b"a", V::Null)])),
            "a tree entry with no record"
        );
        assert!(Node::decode(b"\xff").is_err());
    }
}

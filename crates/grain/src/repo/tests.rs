//! Repos made and signed here, read back as STAR-lite and as CARs, whole
//! and tampered with. `tests/repo.rs` reads the reference PDS's.

use super::mst::{Entry, Node, RootBuilder};
use super::*;
use k256::ecdsa::signature::Signer;

/// A repo, signed: its account's key, and its records in key order.
pub(crate) struct Signed {
    pub key: k256::ecdsa::SigningKey,
    pub public: PublicKey,
    pub did: String,
    pub records: Vec<Record>,
    pub commit: Commit,
}

pub(crate) const DID: &str = "did:plc:repotest00000000000000000";

/// A record's DRISL.
pub(crate) fn record(json: serde_json::Value) -> Vec<u8> {
    drisl::encode(&V::serialized(&json).unwrap())
}

/// The DRISL of the commit `fields` make, signed by `key`.
pub(crate) fn signed(fields: Vec<(&str, V)>, key: &k256::ecdsa::SigningKey) -> V {
    let mut fields: Vec<(V, V)> = fields
        .into_iter()
        .map(|(k, v)| (V::Text(k.into()), v))
        .collect();
    let sig: k256::ecdsa::Signature = key.sign(&drisl::encode(&V::Map(fields.clone())));
    let sig = sig.normalize_s().unwrap_or(sig);
    fields.push((V::Text("sig".into()), V::Bytes(sig.to_bytes().to_vec())));
    V::Map(fields)
}

/// A commit's fields, for `did` at `rev`, signing the tree `data`.
pub(crate) fn fields(did: &str, rev: &str, data: &[u8]) -> Vec<(&'static str, V)> {
    vec![
        ("did", V::Text(did.into())),
        ("rev", V::Text(rev.into())),
        ("version", V::Integer(3.into())),
        ("prev", V::Null),
        ("data", drisl::link_to(data)),
    ]
}

/// A repo of `keys`, each with a record of its own, at revision `rev`.
pub(crate) fn repo(keys: &[&str], rev: &str) -> Signed {
    let key = k256::ecdsa::SigningKey::random(&mut rand_core::OsRng);
    let public = PublicKey::K256(*key.verifying_key());
    let mut keys = keys.to_vec();
    keys.sort();
    let records: Vec<_> = keys
        .iter()
        .map(|k| {
            (
                k.to_string(),
                record(serde_json::json!({"$type": "app.x", "key": k})),
            )
        })
        .collect();
    let mut tree = RootBuilder::new();
    for (k, r) in &records {
        tree.add(k, r).unwrap();
    }
    let commit = signed(fields(DID, rev, &tree.root()), &key);
    let commit = verify_commit(commit, DID, &public).unwrap();
    Signed {
        key,
        public,
        did: DID.into(),
        records,
        commit,
    }
}

pub(crate) const REV: &str = "3l3qo2vuowo2a";

impl Signed {
    pub fn star(&self) -> Vec<u8> {
        let mut out = Vec::new();
        star::write(&mut out, &self.commit, self.records.clone()).unwrap();
        out
    }

    /// Reads `bytes` as this repo's, whole.
    pub fn read(&self, bytes: &[u8]) -> Result<(Commit, Vec<Record>)> {
        read(bytes.to_vec(), &self.did, &self.public)
    }
}

/// Reads `bytes` whole, as `did`'s repo signed with `key`.
pub(crate) fn read(bytes: Vec<u8>, did: &str, key: &PublicKey) -> Result<(Commit, Vec<Record>)> {
    let spill = Box::new(std::io::Cursor::new(Vec::new()));
    let mut archive = open(std::io::Cursor::new(bytes), did, key, spill)?;
    let mut records = Vec::new();
    assert_eq!(archive.commit().did, did);
    while let Some(record) = archive.record()? {
        records.push(record);
    }
    Ok((archive.finish()?, records))
}

fn keys(n: usize) -> Vec<String> {
    (0..n).map(|i| format!("app.x/{i:04}")).collect()
}

fn error(result: Result<impl Sized>) -> String {
    result.err().expect("an error").to_string()
}

#[test]
fn star_lite_round_trips() {
    for n in [0, 1, 7, 300] {
        let keys = keys(n);
        let keys: Vec<&str> = keys.iter().map(String::as_str).collect();
        let repo = repo(&keys, REV);
        let (commit, records) = repo.read(&repo.star()).unwrap();
        // The same commit, its fields in canonical order now.
        let parts = |c: &Commit| (c.did.clone(), c.rev.clone(), c.data.clone());
        assert_eq!(parts(&commit), parts(&repo.commit));
        assert_eq!(commit.rev, REV);
        assert_eq!(records, repo.records);
        // zstd'd, as hubble sends it.
        let zstd = zstd::encode_all(&repo.star()[..], 3).unwrap();
        assert_eq!(repo.read(&zstd).unwrap().1, repo.records);
    }
}

#[test]
fn star_lite_tampered_with_is_refused() {
    let repo = repo(&["app.x/1", "app.x/2", "app.x/3"], REV);
    let with = |records: Vec<Record>| {
        let mut out = Vec::new();
        star::write(&mut out, &repo.commit, records).unwrap();
        error(repo.read(&out))
    };
    let mut changed = repo.records.clone();
    changed[1].1 = record(serde_json::json!({"forged": true}));
    let unmade = "the records do not make the tree the commit signed";
    assert_eq!(with(changed), unmade);
    assert_eq!(with(repo.records[..2].to_vec()), unmade);
    let mut swapped = repo.records.clone();
    swapped.swap(0, 1);
    assert_eq!(with(swapped), "keys out of order at app.x/1");

    // Signed by another key, or another account's.
    let other = super::tests::repo(&["app.x/1"], REV);
    let theirs = read(repo.star(), &repo.did, &other.public);
    assert_eq!(error(theirs), "a commit the account's key did not sign");
    let elsewhere = read(repo.star(), "did:plc:someoneelse", &repo.public);
    assert_eq!(
        error(elsewhere),
        format!("a commit for {DID}, not did:plc:someoneelse")
    );

    // Cut short anywhere: each is refused, however far it reads.
    let whole = repo.star();
    for n in 0..whole.len() {
        assert!(repo.read(&whole[..n]).is_err(), "cut at {n}");
        let zstd = zstd::encode_all(&whole[..n], 3).unwrap();
        assert!(repo.read(&zstd).is_err(), "cut at {n}, zstd'd");
    }
    let zstd = zstd::encode_all(&whole[..], 3).unwrap();
    assert!(repo.read(&zstd[..zstd.len() - 2]).is_err());
}

/// A STAR-lite archive's header, then `rest`.
fn star_lite(root: &[u8], commit: &[u8], rest: &[u8]) -> Vec<u8> {
    [&star::MAGIC[..], root, &varint(commit.len()), commit, rest].concat()
}

#[test]
fn star_lite_framing() {
    let repo = repo(&["app.x/1"], REV);
    let good = repo.star();
    let root = &repo.commit.data;
    let commit = drisl::encode(&repo.commit.partial);
    let open = |bytes: Vec<u8>| error(star::StarLite::open(&bytes[..], DID, &repo.public));
    let read = |rest: &[u8]| error(repo.read(&star_lite(root, &commit, rest)));
    assert_eq!(open(b"nope".repeat(10)), "not a STAR-lite archive");
    assert_eq!(open(star::MAGIC.to_vec()), "it ends inside its root");
    let raw = [&[0x01, 0x55, 0x12, 0x20][..], &root[4..]].concat();
    assert_eq!(
        open(star_lite(&raw, &commit, &[])),
        "a root that is not a tree's CID"
    );
    assert_eq!(
        open(star_lite(root, &[], &[])),
        "no commit, so nothing to check it against"
    );
    assert_eq!(
        open(star_lite(root, &[0; MAX_COMMIT + 1], &[])),
        "a commit of more than 4096 bytes"
    );
    assert_eq!(
        open(star_lite(root, &[0xff], &[])),
        "a commit that is not CBOR"
    );
    assert_eq!(
        open(star_lite(root, &[0x80], &[])),
        "a commit that is not a map"
    );
    let mut with_data = repo.commit.partial.clone().into_map().unwrap();
    with_data.push((V::Text("data".into()), drisl::link_to(root)));
    let with_data = drisl::encode(&V::Map(with_data));
    assert_eq!(
        open(star_lite(root, &with_data, &[])),
        "a commit naming a tree of its own"
    );
    assert!(star::StarLite::open(&good[..], DID, &repo.public).is_ok());

    assert_eq!(read(&[1, b'k']), "k with no record");
    assert_eq!(read(&[0x80]), "it ends inside a length");
    assert_eq!(read(&[0x80, 0]), "a length not in its shortest form");
    assert_eq!(read(&[0x80; 7]), "a length too long");
    assert_eq!(read(&[3, b'k']), "it ends inside a key");
    assert_eq!(read(&varint(MAX_KEY + 1)), "a key of more than 830 bytes");
    let big = [&[1, b'k'][..], &varint(MAX_RECORD + 1)].concat();
    assert_eq!(read(&big), "a record of more than 1048576 bytes");
    assert_eq!(read(&[0, 1, 0xa0]), "keys out of order at ");
    assert_eq!(read(&[1, 0xff, 1, 0xa0]), "a key that is not text");
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
    let repo = repo(&["app.x/1", "app.x/2"], REV);
    let whole = repo.star();
    for cut in [whole.len() - 20, whole.len() - 2, whole.len()] {
        let body = Fails(std::io::Cursor::new(whole[..cut].to_vec()));
        let spill = Box::new(std::io::Cursor::new(Vec::new()));
        let read = || -> Result<Commit> {
            let mut archive = open(body, DID, &repo.public, spill)?;
            while archive.record()?.is_some() {}
            archive.finish()
        };
        assert_eq!(error(read()), "went quiet", "cut at {cut}");
    }
}

#[test]
fn commits() {
    let repo = repo(&[], REV);
    let root = repo.commit.data.clone();
    let verify =
        |fields: Vec<(&str, V)>| error(verify_commit(signed(fields, &repo.key), DID, &repo.public));
    assert_eq!(
        error(verify_commit(V::Null, DID, &repo.public)),
        "a commit that is not a map"
    );
    assert_eq!(
        error(verify_commit(V::Map(vec![]), DID, &repo.public)),
        "a commit with no signature"
    );
    let without = |name: &str| {
        let mut f = fields(DID, REV, &root);
        f.retain(|(k, _)| *k != name);
        f
    };
    assert_eq!(verify(without("did")), "a commit with no DID");
    assert_eq!(verify(without("rev")), "a commit with no revision");
    assert_eq!(
        verify(fields(DID, "not-a-tid", &root)),
        "a commit with no revision"
    );
    assert_eq!(verify(without("data")), "a commit with no tree");
}

/// A CAR of `commit` and `blocks`.
fn car(commit: &V, blocks: &[Vec<u8>]) -> Vec<u8> {
    let commit = drisl::encode(commit);
    let mut out = Vec::new();
    let all: Vec<_> = std::iter::once(commit.clone())
        .chain(blocks.iter().cloned())
        .collect();
    car::write(&mut out, &drisl::cid(&commit), &all).unwrap();
    out
}

/// Two layers: `app.x/18` (layer 1) over `16`, `17` and `20`, `21`.
fn two_layers() -> (Vec<Record>, Vec<Vec<u8>>, Node) {
    let records: Vec<_> = ["16", "17", "18", "20", "21"]
        .iter()
        .map(|k| (format!("app.x/{k}"), record(serde_json::json!({"k": k}))))
        .collect();
    let entry = |i: usize, right: Option<Vec<u8>>| Entry {
        key: records[i].0.clone(),
        value: drisl::cid(&records[i].1),
        right,
    };
    let below = |from: usize| Node {
        left: None,
        entries: vec![entry(from, None), entry(from + 1, None)],
    };
    let (left, right) = (below(0).encode(), below(3).encode());
    let top = Node {
        left: Some(drisl::cid(&left)),
        entries: vec![entry(2, Some(drisl::cid(&right)))],
    };
    let mut blocks = vec![top.encode(), left, right];
    blocks.extend(records.iter().map(|(_, r)| r.clone()));
    (records, blocks, top)
}

#[test]
fn cars() {
    let key = k256::ecdsa::SigningKey::random(&mut rand_core::OsRng);
    let public = PublicKey::K256(*key.verifying_key());
    let (records, blocks, top) = two_layers();
    let mut tree = RootBuilder::new();
    records.iter().for_each(|(k, r)| tree.add(k, r).unwrap());
    let root = drisl::cid(&top.encode());
    assert_eq!(tree.root(), root, "as the tree is shaped by hand");
    let commit = signed(fields(DID, REV, &root), &key);
    let whole = car(&commit, &blocks);
    let (read_commit, got) = read(whole.clone(), DID, &public).unwrap();
    assert_eq!(got, records);
    assert_eq!(
        (read_commit.rev, read_commit.data),
        (REV.to_string(), root.clone())
    );
    let zstd = zstd::encode_all(&whole[..], 3).unwrap();
    assert_eq!(super::tests::read(zstd, DID, &public).unwrap().1, records);
    // An empty repo: one empty node.
    let empty = Node::default().encode();
    let commit_empty = signed(fields(DID, REV, &drisl::cid(&empty)), &key);
    let (_, none) = super::tests::read(car(&commit_empty, &[empty]), DID, &public).unwrap();
    assert!(none.is_empty());

    let read = |bytes: Vec<u8>| error(super::tests::read(bytes, DID, &public));
    let mut missing = blocks.clone();
    missing.remove(4);
    let lost = format!(
        "a CAR without the block {}",
        drisl::cid_text(&drisl::cid(&records[1].1))
    );
    assert_eq!(read(car(&commit, &missing)), lost);
    let mut changed = whole.clone();
    let last = changed.len() - 2;
    changed[last] ^= 1;
    assert_eq!(read(changed), "a CAR block that is not what its CID says");
    let mut raw = whole.clone();
    let first_block = 1 + raw[0] as usize + varint(drisl::encode(&commit).len() + 36).len();
    raw[first_block + 1] = 0x70;
    assert_eq!(read(raw), "a CAR block whose CID is not atproto's");
    assert_eq!(read(vec![1, 0xff]), "not a CAR");
    assert_eq!(read(vec![]), "not a CAR");
    let no_root = drisl::encode(&V::Map(vec![(
        V::Text("version".into()),
        V::Integer(1.into()),
    )]));
    assert_eq!(
        read([&varint(no_root.len())[..], &no_root].concat()),
        "a CAR with no root"
    );
    let later = drisl::encode(&V::Map(vec![
        (
            V::Text("roots".into()),
            V::Array(vec![drisl::link_to(&root)]),
        ),
        (V::Text("version".into()), V::Integer(2.into())),
    ]));
    let later = [&varint(later.len())[..], &later].concat();
    assert_eq!(read(later), "not a CAR of version 1");
    let mut no_commit = Vec::new();
    car::write(&mut no_commit, &drisl::cid(b"x"), &blocks).unwrap();
    assert!(read(no_commit).starts_with("a CAR without the block"));
    let not_cbor = {
        let mut out = Vec::new();
        car::write(&mut out, &drisl::cid(b"\xff"), &[b"\xff".to_vec()]).unwrap();
        out
    };
    assert_eq!(read(not_cbor), "a commit that is not CBOR");
    let other = k256::ecdsa::SigningKey::random(&mut rand_core::OsRng);
    let forged = signed(fields(DID, REV, &root), &other);
    assert!(read(car(&forged, &blocks)).starts_with("a commit the account's key did not sign"));

    // Every block what its CID says, but the tree not shaped as atproto
    // shapes one: all five keys in one node.
    let flat = Node {
        left: None,
        entries: records
            .iter()
            .map(|(k, r)| Entry {
                key: k.clone(),
                value: drisl::cid(r),
                right: None,
            })
            .collect(),
    }
    .encode();
    let commit_flat = signed(fields(DID, REV, &drisl::cid(&flat)), &key);
    let mut flat_blocks = vec![flat];
    flat_blocks.extend(records.iter().map(|(_, r)| r.clone()));
    assert_eq!(
        read(car(&commit_flat, &flat_blocks)),
        "the records do not make the tree the commit signed"
    );
    // One whose keys go backwards.
    let backwards = Node {
        left: None,
        entries: vec![
            Entry {
                key: records[1].0.clone(),
                value: drisl::cid(&records[1].1),
                right: None,
            },
            Entry {
                key: records[0].0.clone(),
                value: drisl::cid(&records[0].1),
                right: None,
            },
        ],
    }
    .encode();
    let commit_back = signed(fields(DID, REV, &drisl::cid(&backwards)), &key);
    let back_blocks = [backwards, records[0].1.clone(), records[1].1.clone()];
    assert_eq!(
        read(car(&commit_back, &back_blocks)),
        "keys out of order at app.x/16"
    );
    let bad_node = signed(fields(DID, REV, &drisl::cid(b"\xff")), &key);
    assert_eq!(
        read(car(&bad_node, &[b"\xff".to_vec()])),
        "a tree node that is not CBOR"
    );
}

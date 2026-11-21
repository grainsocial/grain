//! Repos as the reference PDS exports them: its CARs read and checked
//! against the account's key from the PLC directory, the same repo as
//! STAR-lite, as hubble would serve it, and either tampered with refused.

mod common;
use common::*;

use atproto::{Commit, star_lite};
use grain::crypto::PublicKey;
use grain::identity;
use grain::repo::{self, Record};
use serde_json::{Value, json};

/// An account with `n` galleries and a profile, and its session token.
async fn account_with(n: usize) -> (Account, String) {
    let a = account().await;
    let http = reqwest::Client::new();
    let session: Value = http
        .post(format!(
            "{}/xrpc/com.atproto.server.createSession",
            net().pds
        ))
        .json(&json!({"identifier": a.did, "password": a.password}))
        .send()
        .await
        .unwrap()
        .json()
        .await
        .unwrap();
    let token = session["accessJwt"].as_str().unwrap().to_string();
    let mut writes: Vec<Value> = (0..n)
        .map(|i| {
            json!({
                "$type": "com.atproto.repo.applyWrites#create",
                "collection": "social.grain.gallery",
                "value": {"$type": "social.grain.gallery", "title": format!("roll {i}"),
                          "createdAt": "2026-10-31T12:00:00.000Z"},
            })
        })
        .collect();
    writes.push(json!({
        "$type": "com.atproto.repo.applyWrites#create",
        "collection": "social.grain.actor.profile",
        "rkey": "self",
        "value": {"$type": "social.grain.actor.profile", "displayName": "Film"},
    }));
    let res = http
        .post(format!("{}/xrpc/com.atproto.repo.applyWrites", net().pds))
        .bearer_auth(&token)
        .json(&json!({"repo": a.did, "writes": writes}))
        .send()
        .await
        .unwrap();
    assert!(res.status().is_success(), "{}", res.text().await.unwrap());
    (a, token)
}

async fn car_of(did: &str) -> Vec<u8> {
    let url = format!("{}/xrpc/com.atproto.sync.getRepo?did={did}", net().pds);
    let res = reqwest::get(url).await.unwrap().error_for_status().unwrap();
    res.bytes().await.unwrap().to_vec()
}

async fn key_of(did: &str) -> PublicKey {
    let dir = tempfile::tempdir().unwrap();
    let doc = identity::document(&ctx(dir.path(), &[]), did)
        .await
        .unwrap();
    atproto::did::signing_key(&doc).unwrap()
}

fn read(bytes: Vec<u8>, did: &str, key: &PublicKey) -> anyhow::Result<(Commit, Vec<Record>)> {
    let spill = Box::new(tempfile::tempfile().unwrap());
    let mut archive = repo::open(std::io::Cursor::new(bytes), did, key, spill)?;
    let mut records = Vec::new();
    while let Some(record) = archive.record()? {
        records.push(record);
    }
    Ok((archive.finish()?, records))
}

#[tokio::test]
async fn the_reference_pdss_repos_read_and_check() {
    let (a, token) = account_with(150).await;
    let key = key_of(&a.did).await;
    let car = car_of(&a.did).await;
    let (commit, records) = read(car.clone(), &a.did, &key).unwrap();
    let latest: Value = reqwest::get(format!(
        "{}/xrpc/com.atproto.sync.getLatestCommit?did={}",
        net().pds,
        a.did
    ))
    .await
    .unwrap()
    .json()
    .await
    .unwrap();
    assert_eq!(commit.rev, latest["rev"]);
    assert_eq!(commit.data.to_string().len(), 59);
    assert_eq!(records.len(), 151);
    assert!(records.windows(2).all(|w| w[0].0 < w[1].0));
    assert_eq!(records[0].0, "social.grain.actor.profile/self");
    let profile = atproto::drisl::decode(&records[0].1).unwrap().to_json();
    assert_eq!(profile["displayName"], "Film");

    // The same repo as STAR-lite, plain and zstd'd.
    let lite = star_lite::write(&commit, records.iter().map(|(k, r)| (k.as_str(), &r[..])));
    assert!(lite.len() < car.len(), "STAR-lite carries no tree");
    let (again, same) = read(lite.clone(), &a.did, &key).unwrap();
    let parts = |c: &Commit| (c.did.clone(), c.rev.clone(), c.data);
    assert_eq!((parts(&again), &same), (parts(&commit), &records));
    let zstd = zstd::encode_all(&lite[..], 3).unwrap();
    assert_eq!(read(zstd, &a.did, &key).unwrap().1, records);

    // Tampered with, or cut short, either is refused.
    let mut forged = records.clone();
    let forged_title = atproto::drisl::Value::from_json(&json!({"title": "x"})).unwrap();
    forged[3].1 = atproto::drisl::encode(&forged_title);
    let lite_forged = star_lite::write(&commit, forged.iter().map(|(k, r)| (k.as_str(), &r[..])));
    let why = read(lite_forged, &a.did, &key).unwrap_err().to_string();
    assert_eq!(why, "the records do not make the tree the commit signed");
    assert!(read(lite[..lite.len() - 1].to_vec(), &a.did, &key).is_err());
    assert!(read(car[..car.len() - 1].to_vec(), &a.did, &key).is_err());
    let mut flipped = car.clone();
    let at = flipped.len() / 2;
    flipped[at] ^= 0x40;
    assert!(read(flipped, &a.did, &key).is_err());
    let other = key_of(&account().await.did).await;
    assert!(read(car.clone(), &a.did, &other).is_err());

    // A record deleted: the next export is at a later revision, without it.
    let (collection, rkey) = records[0].0.split_once('/').unwrap();
    let res = reqwest::Client::new()
        .post(format!("{}/xrpc/com.atproto.repo.deleteRecord", net().pds))
        .bearer_auth(&token)
        .json(&json!({"repo": a.did, "collection": collection, "rkey": rkey}))
        .send()
        .await
        .unwrap();
    assert!(res.status().is_success());
    let (later, fewer) = read(car_of(&a.did).await, &a.did, &key).unwrap();
    assert!(later.rev > commit.rev);
    assert_eq!(fewer[..], records[1..]);
}

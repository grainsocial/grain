//! Permissioned spaces against the reference PDS on the spaces alpha
//! (`GRAIN_DEV_ENV`): a group's pool made, members put on it, and its
//! repos read with credentials and refused to everyone else. These
//! pass trivially on a PDS without spaces.

mod common;
use common::*;

use grain::env::Ctx;
use grain::session::{self, Session};
use grain::space::{self, Admin};
use grain::xrpc::Xrpc;
use grain::{auth, keys};
use serde_json::json;

/// A 1x1 PNG.
const PNG: &[u8] = &[
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
    0x89, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0xf8, 0xcf, 0xc0, 0xf0,
    0x1f, 0x00, 0x05, 0x00, 0x01, 0xff, 0x89, 0x99, 0x3d, 0x1d, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45,
    0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
];

/// A new account, logged in with its password.
async fn someone(ctx: &Ctx) -> Session {
    let a = account().await;
    session::create(ctx, &a.handle, &a.password).await.unwrap()
}

#[tokio::test]
async fn a_pools_members_write_their_own_repos_and_read_each_others() {
    if !spaces() {
        return;
    }
    let dir = tempfile::tempdir().unwrap();
    let ctx = ctx(dir.path(), &[]);
    let (group, member, outsider) = (
        someone(&ctx).await,
        someone(&ctx).await,
        someone(&ctx).await,
    );
    let pool = Admin {
        ctx: &ctx,
        session: &group,
    }
    .create(space::POOL, "self")
    .await
    .unwrap();
    assert_eq!(pool, space::pool(&group.did));
    let admin = Admin {
        ctx: &ctx,
        session: &group,
    };
    admin.put_member(&pool, &member.did, true).await.unwrap();

    // The member writes a comment into their own repo there, then takes it
    // back.
    let mine = Admin {
        ctx: &ctx,
        session: &member,
    };
    let comment = json!({"$type": "social.grain.comment", "text": "lovely",
                         "subject": "at://did:plc:x/social.grain.gallery/1", "createdAt": keys::now_iso()});
    mine.put_record(&pool, "social.grain.comment", "c1", &comment)
        .await
        .unwrap();
    mine.put_record(&pool, "social.grain.comment", "c2", &comment)
        .await
        .unwrap();
    mine.delete_record(&pool, "social.grain.comment", "c2")
        .await
        .unwrap();
    let held = mine.records(&pool, "social.grain.comment").await.unwrap();
    assert_eq!(
        held.iter().map(|r| r.rkey.as_str()).collect::<Vec<_>>(),
        ["c1"]
    );

    // And a photo, its blob uploaded as any other.
    let pds = Xrpc::new(ctx.guarded.clone(), &member.service);
    let blob = pds
        .upload_blob(PNG.to_vec(), "image/png", &member.auth())
        .await
        .unwrap();
    let photo = json!({"$type": "social.grain.photo", "photo": blob,
                       "aspectRatio": {"width": 1, "height": 1}, "createdAt": keys::now_iso()});
    let writes = [space::create("social.grain.photo", "p1", photo)];
    mine.apply_writes(&pool, &writes).await.unwrap();

    // The group finds the space among its own.
    let listed = space::list_spaces(&ctx, &group, space::POOL).await.unwrap();
    assert!(listed.contains(&pool), "{listed:?}");

    // The group reads its members' repos with a credential of its own, and
    // asks its authority which repos the space holds.
    let credential = space::credential(&ctx, &group, &pool).await.unwrap();
    let repos = space::repos_with(&ctx, &credential).await.unwrap();
    assert!(repos.contains(&member.did), "{repos:?}");
    let read = space::read_with(&ctx, &credential, &member.did, "social.grain.comment")
        .await
        .unwrap();
    assert_eq!(read[0].value["text"], "lovely");
    assert!(credential.lasts());
    assert_eq!(credential.reader, group.did);
    let photos = space::read_with(&ctx, &credential, &member.did, "social.grain.photo")
        .await
        .unwrap();
    assert_eq!(photos.len(), 1);
    let cid = space::blob_cid(&photos[0].value["photo"])
        .unwrap()
        .to_string();
    let bytes = space::blob_with(&ctx, &credential, &member.did, &cid)
        .await
        .unwrap();
    assert_eq!(bytes, PNG);

    // An outsider's own PDS keeps what they write there, but the space
    // does not take them for a writer, and will not let them read it.
    let theirs = Admin {
        ctx: &ctx,
        session: &outsider,
    };
    let _ = theirs
        .put_record(&pool, "social.grain.comment", "c3", &comment)
        .await;
    let credential = space::credential(&ctx, &group, &pool).await.unwrap();
    let repos = space::repos_with(&ctx, &credential).await.unwrap();
    assert!(!repos.contains(&outsider.did), "{repos:?}");
    let refused = space::credential(&ctx, &outsider, &pool)
        .await
        .err()
        .unwrap();
    assert!(space::denied(&refused), "{refused:#}");

    // A delegation token names its reader to the space's authority, and is
    // checked against the reader's key.
    let token = space::delegation(&ctx, &outsider, &pool).await.unwrap();
    let found = auth::verify_delegation(&ctx, &token).await.unwrap();
    assert_eq!((found.iss, found.sub), (outsider.did.clone(), pool.clone()));
}

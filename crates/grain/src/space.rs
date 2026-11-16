//! Permissioned spaces, where groups' pools and member lists live.
//!
//! A space is `at://<authority>/space/<type>/<skey>`: its authority is the
//! account it is anchored on, which keeps its member list, and each member
//! who writes there has a repo of their own inside it, on their own PDS.
//! Nothing written in a space reaches a firehose, so nothing of it is
//! indexed: it is read from those repos as someone the space admits.
//!
//! A repo in a space is read with the session of the account it is, on its
//! own PDS. Every other read takes a space credential: the reader's own PDS
//! signs a delegation token naming them to the space's authority
//! ([`delegation`]), which the authority's PDS exchanges for a credential,
//! to members only ([`exchange`]). The credential is bound to a fresh
//! P-256 key, named in the exchange, and each request that presents it
//! signs it with the DID it is addressed to, so a host handed one cannot
//! use it on any other account's repo ([`signed`], RFC 9421, as the alpha
//! signs it).
//!
//! The reference PDS's alpha names a space's administration
//! `com.atproto.space.createSpace` and `com.atproto.memberspace.*`; pds.js
//! and zds name it `com.atproto.simplespace.*`. [`Admin`] asks the
//! reference names first and the others when the PDS has no such method.

use crate::crypto::{self, P256Key};
use crate::env::Ctx;
use crate::identity;
use crate::keys;
use crate::session::Session;
use crate::xrpc::{Auth, Xrpc, XrpcError};
use anyhow::{Context, Result, anyhow, bail};
use serde::Deserialize;
use serde_json::{Value, json};
use std::sync::Arc;

/// A group's pool's space type: one a group, keyed `self`, anchored on the
/// group, where each member writes their own galleries, favorites and
/// comments.
pub const POOL: &str = "social.grain.group";

/// A group's members space, which only its members may read: a credential
/// for it is how a group's host says someone is in it.
pub const MEMBERS: &str = "fyi.opensocial.members";

/// The signature's label and tag, as the alpha names a credential's use.
const LABEL: &str = "atproto-space-credential";

/// The header a query carries a delegation token in, from the asker's own
/// PDS for a space, for an appview to exchange as the asker would.
pub const DELEGATION_HEADER: &str = "atproto-space-delegation";

/// The space of type `kind` keyed `skey` on `authority`.
pub fn uri(authority: &str, kind: &str, skey: &str) -> String {
    format!("at://{authority}/space/{kind}/{skey}")
}

/// A group's pool.
pub fn pool(group: &str) -> String {
    uri(group, POOL, "self")
}

/// A group's members space.
pub fn members(group: &str) -> String {
    uri(group, MEMBERS, "self")
}

/// A space URI's parts.
#[derive(Debug, Clone, PartialEq)]
pub struct Named {
    pub authority: String,
    pub kind: String,
    pub skey: String,
}

/// The authority, type and key `uri` names, if it is a space's URI.
pub fn parse(uri: &str) -> Option<Named> {
    let rest = uri.strip_prefix("at://")?;
    let mut parts = rest.split('/');
    let (authority, space, kind, skey) =
        (parts.next()?, parts.next()?, parts.next()?, parts.next()?);
    let well_formed = authority.starts_with("did:")
        && space == "space"
        && !kind.is_empty()
        && !skey.is_empty()
        && parts.next().is_none();
    well_formed.then(|| Named {
        authority: authority.to_string(),
        kind: kind.to_string(),
        skey: skey.to_string(),
    })
}

/// A credential to read a space, and the key it is bound to.
#[derive(Clone)]
pub struct Credential {
    pub space: String,
    /// The account the authority gave it to.
    pub reader: String,
    token: String,
    key: Arc<P256Key>,
    /// When it stops, in seconds since the epoch.
    pub expires: u64,
}

impl Credential {
    /// What lets a request read `audience`'s repo in the space, or ask its
    /// authority (`audience` the authority) which repos it holds.
    pub fn auth(&self, audience: &str) -> Auth {
        let authorization = format!("Atproto-Space-Credential {}", self.token);
        Auth::Headers(signed(&self.key, &authorization, audience))
    }

    /// Whether it has a minute left in it.
    pub fn lasts(&self) -> bool {
        self.expires > keys::now_secs() + 60
    }
}

/// RFC 9421 message signature headers over `authorization`, a space
/// credential's, and the audience it is used for, as the alpha signs them.
pub fn signed(key: &P256Key, authorization: &str, audience: &str) -> Vec<(String, String)> {
    use base64::Engine;
    let params = format!(r#"("authorization" "atproto-space-audience");tag="{LABEL}""#);
    let base = format!(
        "\"authorization\": {authorization}\n\"atproto-space-audience\": {audience}\n\"@signature-params\": {params}"
    );
    let signature = base64::engine::general_purpose::STANDARD.encode(key.sign(base.as_bytes()));
    vec![
        ("authorization".to_string(), authorization.to_string()),
        ("atproto-space-audience".to_string(), audience.to_string()),
        ("signature-input".to_string(), format!("{LABEL}={params}")),
        ("signature".to_string(), format!("{LABEL}=:{signature}:")),
    ]
}

/// A delegation token from `me`'s PDS for `space`, naming them to its
/// authority: good for one exchange, within a minute. An app password's
/// session cannot get one; an OAuth session needs the space's scope.
pub async fn delegation(ctx: &Ctx, me: &Session, space: &str) -> Result<String> {
    #[derive(Deserialize)]
    struct Token {
        token: String,
    }
    let token: Token = Xrpc::new(ctx.guarded.clone(), &me.service)
        .query(
            "com.atproto.space.getDelegationToken",
            &[("space", space)],
            Some(&me.auth()),
        )
        .await?;
    Ok(token.token)
}

/// Exchanges the delegation token `token`, naming `reader`, for a
/// credential to read `space`, from its authority's PDS: given only to a
/// member.
pub async fn exchange(ctx: &Ctx, space: &str, reader: &str, token: &str) -> Result<Credential> {
    #[derive(Deserialize)]
    struct Out {
        credential: String,
    }
    let named = parse(space).ok_or_else(|| anyhow!("not a space: {space}"))?;
    let host = identity::resolve_pds(ctx, &named.authority).await?;
    let key = P256Key::generate();
    let body = json!({
        "space": space,
        "credentialKid": key.public().to_did_key(),
        "delegationToken": token,
    });
    let out: Out = Xrpc::new(ctx.guarded.clone(), &host)
        .procedure("com.atproto.space.getSpaceCredential", Some(&body), None)
        .await?;
    // An expiry that cannot be read is taken as a short one.
    let expires = crypto::jwt_parts(&out.credential)
        .ok()
        .and_then(|(_, claims)| claims["exp"].as_u64())
        .unwrap_or_else(|| keys::now_secs() + 120);
    Ok(Credential {
        space: space.to_string(),
        reader: reader.to_string(),
        token: out.credential,
        key: Arc::new(key),
        expires,
    })
}

/// A credential for `me` to read `space`: a delegation token from their
/// PDS, exchanged at the authority's.
pub async fn credential(ctx: &Ctx, me: &Session, space: &str) -> Result<Credential> {
    let token = delegation(ctx, me, space).await?;
    exchange(ctx, space, &me.did, &token).await
}

/// Whether `err` is a space's authority, or a repo's host, saying no to
/// the reader: the space is not theirs to read, which they cannot tell
/// from there being no such space. The alpha answers a refused reader as
/// it answers for a space that does not exist, so as not to say it does.
/// A member's repo missing from the space reads as the same no, as it is
/// to the reader: there is nothing there for them.
pub fn denied(err: &anyhow::Error) -> bool {
    XrpcError::of(err).is_some_and(|e| {
        matches!(
            e.error.as_str(),
            "SpaceNotFound"
                | "SpaceDeleted"
                | "UserNotAuthorized"
                | "NotAuthorized"
                | "NotPublic"
                | "RepoNotFound"
        ) || e.status == 403
    })
}

/// Whether `err` is a PDS saying it serves no such method: pds.js's 501,
/// zds's and the reference PDS's 404, or one that passes `space` calls on
/// to an appview that has none.
pub fn not_served(err: &anyhow::Error) -> bool {
    XrpcError::of(err).is_some_and(|e| {
        e.status == 501
            || e.error == "MethodNotImplemented"
            || (e.status == 404 && e.error.starts_with("HTTP"))
            || e.error == "XRPCNotSupported"
    })
}

/// A record in a repo in a space. It has no URI of its own: its address is
/// the space, the repo, the collection and the key.
#[derive(Debug, Clone, PartialEq)]
pub struct Record {
    pub collection: String,
    pub rkey: String,
    pub cid: String,
    pub value: Value,
}

/// The most records a page of `listRecords` holds.
const PAGE: usize = 100;

/// The most pages of one collection read: a repo of more than this many
/// records of it is read to there.
const MOST_PAGES: usize = 20;

/// Every record of `collection` in `repo`'s repo in `space`, read from its
/// host, `host`, with `auth`: its own session, or a credential addressed
/// to it.
pub async fn list_records(
    host: &Xrpc,
    space: &str,
    repo: &str,
    collection: &str,
    auth: &Auth,
) -> Result<Vec<Record>> {
    #[derive(Deserialize)]
    struct Listed {
        uri: Option<String>,
        rkey: Option<String>,
        cid: String,
        value: Value,
    }
    #[derive(Deserialize)]
    struct Page {
        #[serde(default)]
        records: Vec<Listed>,
        cursor: Option<String>,
    }
    let limit = PAGE.to_string();
    let mut cursor: Option<String> = None;
    let mut out = Vec::new();
    for _ in 0..MOST_PAGES {
        let mut params = vec![
            ("space", space),
            ("repo", repo),
            ("collection", collection),
            ("limit", limit.as_str()),
        ];
        if let Some(c) = &cursor {
            params.push(("cursor", c));
        }
        let page: Page = host
            .query("com.atproto.space.listRecords", &params, Some(auth))
            .await?;
        let empty = page.records.is_empty();
        for r in page.records {
            // The key is the record's own, or the last part of its URI.
            let rkey = r
                .rkey
                .or_else(|| r.uri.as_deref()?.rsplit('/').next().map(String::from));
            let Some(rkey) = rkey.filter(|k| !k.is_empty()) else {
                continue;
            };
            out.push(Record {
                collection: collection.to_string(),
                rkey,
                cid: r.cid,
                value: r.value,
            });
        }
        match page.cursor {
            Some(next) if !empty && cursor.as_ref() != Some(&next) => cursor = Some(next),
            _ => break,
        }
    }
    Ok(out)
}

/// The accounts with a repo in `space`, as its authority, at `host`, lists
/// them: only to a credential, whoever asks, the authority's own account
/// among them.
pub async fn list_repos(host: &Xrpc, space: &str, credential: &Credential) -> Result<Vec<String>> {
    #[derive(Deserialize)]
    struct Repo {
        did: String,
    }
    #[derive(Deserialize)]
    struct Page {
        #[serde(default)]
        repos: Vec<Repo>,
        cursor: Option<String>,
    }
    let named = parse(space).ok_or_else(|| anyhow!("not a space: {space}"))?;
    let auth = credential.auth(&named.authority);
    let mut cursor: Option<String> = None;
    let mut out: Vec<String> = Vec::new();
    for _ in 0..MOST_PAGES {
        let mut params = vec![("space", space), ("limit", "100")];
        if let Some(c) = &cursor {
            params.push(("cursor", c));
        }
        let page: Page = host
            .query("com.atproto.space.listRepos", &params, Some(&auth))
            .await?;
        let empty = page.repos.is_empty();
        for r in page.repos {
            if !out.contains(&r.did) {
                out.push(r.did);
            }
        }
        match page.cursor {
            Some(next) if !empty && cursor.as_ref() != Some(&next) => cursor = Some(next),
            _ => break,
        }
    }
    Ok(out)
}

/// The spaces of type `kind` that `me`'s PDS holds a repo of theirs in, or
/// that they made: every page.
pub async fn list_spaces(ctx: &Ctx, me: &Session, kind: &str) -> Result<Vec<String>> {
    #[derive(Deserialize)]
    struct Listed {
        uri: String,
    }
    #[derive(Deserialize)]
    struct Page {
        #[serde(default)]
        spaces: Vec<Listed>,
        cursor: Option<String>,
    }
    let pds = Xrpc::new(ctx.guarded.clone(), &me.service);
    let mut cursor: Option<String> = None;
    let mut out: Vec<String> = Vec::new();
    for _ in 0..MOST_PAGES {
        // `spaceType` is the reference PDS's name for the filter, `type`
        // pds.js's.
        let mut params = vec![("spaceType", kind), ("type", kind), ("limit", "100")];
        if let Some(c) = &cursor {
            params.push(("cursor", c));
        }
        let page: Page = pds
            .query("com.atproto.space.listSpaces", &params, Some(&me.auth()))
            .await?;
        let empty = page.spaces.is_empty();
        for s in page.spaces {
            let ours = parse(&s.uri).is_some_and(|n| n.kind == kind);
            if ours && !out.contains(&s.uri) {
                out.push(s.uri);
            }
        }
        match page.cursor {
            Some(next) if !empty && cursor.as_ref() != Some(&next) => cursor = Some(next),
            _ => break,
        }
    }
    Ok(out)
}

/// What an account does in spaces with its own session, on its own PDS:
/// the spaces it is the authority of, and its own repo in any it writes in.
pub struct Admin<'a> {
    pub ctx: &'a Ctx,
    pub session: &'a Session,
}

impl Admin<'_> {
    fn pds(&self) -> Xrpc {
        Xrpc::new(self.ctx.guarded.clone(), &self.session.service)
    }

    async fn call(&self, nsid: &str, body: &Value) -> Result<Value> {
        let auth = self.session.auth();
        self.pds().procedure(nsid, Some(body), Some(&auth)).await
    }

    /// The first of `calls` the PDS serves: any other refusal is the
    /// answer.
    async fn first_served(&self, calls: &[(&str, Value)]) -> Result<Value> {
        let mut last = None;
        for (nsid, body) in calls {
            match self.call(nsid, body).await {
                Err(e) if not_served(&e) => last = Some(e),
                answered => return answered,
            }
        }
        Err(last.unwrap_or_else(|| anyhow!("no call to make")))
    }

    /// Makes the space of type `kind` keyed `skey`, anchored on this
    /// account, readable by its member list alone. Returns its URI.
    pub async fn create(&self, kind: &str, skey: &str) -> Result<String> {
        let did = &self.session.did;
        self.first_served(&[
            (
                "com.atproto.space.createSpace",
                json!({
                    "spaceType": kind,
                    "skey": skey,
                    "policy": {"$type": "com.atproto.memberspace.policy"},
                }),
            ),
            // `did` names the authority: pds.js takes it from the session,
            // zds requires it. The policy is a bare string, in a nested
            // config, the one spelling both read.
            (
                "com.atproto.simplespace.createSpace",
                json!({
                    "did": did,
                    "type": kind,
                    "skey": skey,
                    "config": {
                        "policy": "member-list",
                        "appAccess": {"$type": "com.atproto.simplespace.defs#open"},
                    },
                }),
            ),
        ])
        .await?;
        Ok(uri(did, kind, skey))
    }

    /// Lets `did` read `space`, and write its own repo there if `write`.
    /// `simplespace.addMember` is sent the same rights: pds.js takes them
    /// there as at its `putMember`, and a server that takes none lets a
    /// member both read and write.
    pub async fn put_member(&self, space: &str, did: &str, write: bool) -> Result<()> {
        let member = json!({"space": space, "did": did, "read": true, "write": write});
        self.first_served(&[
            ("com.atproto.memberspace.putMember", member.clone()),
            ("com.atproto.simplespace.addMember", member),
        ])
        .await
        .map(drop)
    }

    /// Makes `writes`, each `{$type, collection, rkey, value}` with its
    /// `$type` `com.atproto.space.applyWrites#create`, `#update` or
    /// `#delete`, in this account's repo in `space`, at once.
    pub async fn apply_writes(&self, space: &str, writes: &[Value]) -> Result<Value> {
        let did = &self.session.did;
        let body = json!({"space": space, "repo": did, "writes": writes});
        self.call("com.atproto.space.applyWrites", &body).await
    }

    /// Writes `record` at `collection`/`rkey` in this account's repo in
    /// `space`.
    pub async fn put_record(
        &self,
        space: &str,
        collection: &str,
        rkey: &str,
        record: &Value,
    ) -> Result<()> {
        let body = json!({
            "space": space,
            "repo": self.session.did,
            "collection": collection,
            "rkey": rkey,
            "validate": false,
            "record": record,
        });
        self.call("com.atproto.space.putRecord", &body)
            .await
            .map(drop)
    }

    /// Deletes `collection`/`rkey` from this account's repo in `space`.
    pub async fn delete_record(&self, space: &str, collection: &str, rkey: &str) -> Result<()> {
        let body = json!({
            "space": space,
            "repo": self.session.did,
            "collection": collection,
            "rkey": rkey,
        });
        self.call("com.atproto.space.deleteRecord", &body)
            .await
            .map(drop)
    }

    /// Every record of `collection` in this account's own repo in `space`,
    /// read with its session.
    pub async fn records(&self, space: &str, collection: &str) -> Result<Vec<Record>> {
        let did = &self.session.did;
        list_records(&self.pds(), space, did, collection, &self.session.auth()).await
    }
}

/// A blob's CID, as a record references it: `{ref: {$link}}` as JSON
/// writes a CID, or `{ref: {"/": ...}}` as DAG-JSON does, which some space
/// reads answer with.
pub fn blob_cid(blob: &Value) -> Option<&str> {
    let link = &blob["ref"];
    link["$link"].as_str().or_else(|| link["/"].as_str())
}

/// The `applyWrites` write making `value` at `collection`/`rkey`.
pub fn create(collection: &str, rkey: &str, value: Value) -> Value {
    json!({
        "$type": "com.atproto.space.applyWrites#create",
        "collection": collection,
        "rkey": rkey,
        "value": value,
    })
}

/// The `applyWrites` write deleting `collection`/`rkey`.
pub fn delete(collection: &str, rkey: &str) -> Value {
    json!({
        "$type": "com.atproto.space.applyWrites#delete",
        "collection": collection,
        "rkey": rkey,
    })
}

/// Every record of `collection` in `repo`'s repo in the credential's
/// space, read at `repo`'s PDS with the credential addressed to it.
pub async fn read_with(
    ctx: &Ctx,
    credential: &Credential,
    repo: &str,
    collection: &str,
) -> Result<Vec<Record>> {
    let host = identity::resolve_pds(ctx, repo)
        .await
        .with_context(|| format!("finding {repo}'s PDS"))?;
    let host = Xrpc::new(ctx.guarded.clone(), &host);
    let auth = credential.auth(repo);
    list_records(&host, &credential.space, repo, collection, &auth).await
}

/// The bytes of the blob `cid`, referenced from `repo`'s repo in `space`,
/// read with `credential`.
pub async fn blob_with(
    ctx: &Ctx,
    credential: &Credential,
    repo: &str,
    cid: &str,
) -> Result<Vec<u8>> {
    let host = identity::resolve_pds(ctx, repo).await?;
    let host = Xrpc::new(ctx.guarded.clone(), &host);
    let auth = credential.auth(repo);
    host.get_space_blob(&credential.space, repo, cid, &auth)
        .await
}

/// A space's `listRepos` read at its authority's PDS with `credential`.
pub async fn repos_with(ctx: &Ctx, credential: &Credential) -> Result<Vec<String>> {
    let named = parse(&credential.space).ok_or_else(|| anyhow!("not a space"))?;
    let host = identity::resolve_pds(ctx, &named.authority).await?;
    list_repos(
        &Xrpc::new(ctx.guarded.clone(), &host),
        &credential.space,
        credential,
    )
    .await
}

/// Refuses `space` unless it is of type `kind`.
pub fn of_kind(space: &str, kind: &str) -> Result<Named> {
    match parse(space) {
        Some(named) if named.kind == kind => Ok(named),
        _ => bail!("not a {kind} space: {space}"),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use base64::Engine;
    use base64::engine::general_purpose::STANDARD;

    #[test]
    fn spaces_are_named_and_read() {
        assert_eq!(
            pool("did:plc:g"),
            "at://did:plc:g/space/social.grain.group/self"
        );
        assert_eq!(
            members("did:plc:g"),
            "at://did:plc:g/space/fyi.opensocial.members/self"
        );
        let named = parse(&uri("did:plc:a", POOL, "3l")).unwrap();
        assert_eq!(
            named,
            Named {
                authority: "did:plc:a".into(),
                kind: POOL.into(),
                skey: "3l".into(),
            }
        );
        for wrong in [
            "at://did:plc:a/space/t",
            "at://did:plc:a/space/t/k/more",
            "at://did:plc:a/social.grain.gallery/k",
            "at://alice.test/space/t/k",
            "at://did:plc:a/space//k",
            "https://did:plc:a/space/t/k",
        ] {
            assert_eq!(parse(wrong), None, "{wrong}");
        }
        assert!(of_kind(&pool("did:plc:g"), POOL).is_ok());
        assert!(of_kind(&pool("did:plc:g"), MEMBERS).is_err());
    }

    #[test]
    fn a_credential_is_signed_for_its_audience() {
        let key = P256Key::generate();
        let public = key.public();
        let credential = Credential {
            space: "at://did:plc:o/space/t/k".into(),
            reader: "did:plc:r".into(),
            token: "cred".into(),
            key: Arc::new(key),
            expires: keys::now_secs() + 600,
        };
        assert!(credential.lasts());
        let headers = credential
            .auth("did:plc:m")
            .headers("GET", "http://pds.test/xrpc/x");
        assert_eq!(
            headers[0],
            (
                "authorization".into(),
                "Atproto-Space-Credential cred".into()
            )
        );
        assert_eq!(
            headers[1],
            ("atproto-space-audience".into(), "did:plc:m".into())
        );
        let params = r#"("authorization" "atproto-space-audience");tag="atproto-space-credential""#;
        assert_eq!(headers[2].1, format!("atproto-space-credential={params}"));
        let sig = headers[3]
            .1
            .strip_prefix("atproto-space-credential=:")
            .and_then(|s| s.strip_suffix(':'))
            .unwrap();
        let base = format!(
            "\"authorization\": Atproto-Space-Credential cred\n\"atproto-space-audience\": did:plc:m\n\"@signature-params\": {params}"
        );
        public
            .verify(base.as_bytes(), &STANDARD.decode(sig).unwrap())
            .unwrap();
        let ending = Credential {
            expires: keys::now_secs() + 30,
            ..credential
        };
        assert!(!ending.lasts());
    }

    fn said(status: u16, error: &str) -> anyhow::Error {
        XrpcError {
            status,
            error: error.into(),
            message: String::new(),
            reset: None,
        }
        .into()
    }

    #[test]
    fn refusals_are_told_apart() {
        for no in [
            "SpaceNotFound",
            "SpaceDeleted",
            "UserNotAuthorized",
            "NotAuthorized",
            "NotPublic",
            "RepoNotFound",
        ] {
            assert!(
                denied(&said(400, no)) && !not_served(&said(400, no)),
                "{no}"
            );
        }
        assert!(denied(&said(403, "Forbidden")));
        for unserved in [
            said(501, "MethodNotImplemented"),
            said(404, "HTTP404"),
            said(400, "XRPCNotSupported"),
        ] {
            assert!(not_served(&unserved) && !denied(&unserved), "{unserved}");
        }
        assert!(!denied(&said(500, "InternalServerError")));
        assert!(!not_served(&said(404, "SpaceNotFound")));
        assert!(!denied(&anyhow!("connection refused")));
    }

    #[test]
    fn blobs_are_read_by_either_spelling() {
        let lex = json!({"ref": {"$link": "bafy1"}});
        let dag = json!({"ref": {"/": "bafy2"}});
        assert_eq!(blob_cid(&lex), Some("bafy1"));
        assert_eq!(blob_cid(&dag), Some("bafy2"));
        assert_eq!(blob_cid(&json!({})), None);
        assert_eq!(
            create("a.b", "k", json!({}))["$type"],
            "com.atproto.space.applyWrites#create"
        );
        assert_eq!(
            delete("a.b", "k")["$type"],
            "com.atproto.space.applyWrites#delete"
        );
    }

    #[tokio::test]
    async fn a_pds_without_the_reference_names_is_asked_the_older_ones() {
        let (pds, asked) = crate::xrpc::tests::serving(
            "501 Not Implemented",
            "",
            r#"{"error":"MethodNotImplemented","message":"no"}"#,
        );
        let env = crate::env::Env::from_vars(|k| (k == "GRAIN_ALLOW_PRIVATE").then(|| "1".into()));
        let ctx = Ctx::new(env);
        let session = Session {
            did: "did:plc:a".into(),
            handle: "a.test".into(),
            service: pds,
            access_jwt: "access".into(),
            refresh_jwt: "refresh".into(),
            oauth: None,
        };
        let admin = Admin {
            ctx: &ctx,
            session: &session,
        };
        let made = admin.create(POOL, "self").await.unwrap_err();
        assert!(not_served(&made), "{made:#}");
        assert!(
            admin
                .put_member(&pool("did:plc:a"), "did:plc:b", false)
                .await
                .is_err()
        );
        let asked = asked.lock().unwrap();
        let methods: Vec<&str> = asked
            .iter()
            .map(|r| {
                r.split_whitespace()
                    .nth(1)
                    .unwrap()
                    .split('?')
                    .next()
                    .unwrap()
            })
            .collect();
        assert_eq!(
            methods,
            [
                "/xrpc/com.atproto.space.createSpace",
                "/xrpc/com.atproto.simplespace.createSpace",
                "/xrpc/com.atproto.memberspace.putMember",
                "/xrpc/com.atproto.simplespace.addMember",
            ]
        );
        assert!(
            asked[1].contains(r#""policy":"member-list""#),
            "{}",
            asked[1]
        );
    }
}

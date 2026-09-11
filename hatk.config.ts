import { defineConfig } from "@hatk/hatk/config";

const isProd = process.env.NODE_ENV === "production";
// The public origin this instance serves. It becomes the OAuth issuer and the
// base of every registered client_id and redirect_uri, so it has to be the real
// origin rather than anything inferred — and if it is unset, the client list
// below is empty and OAuth fails at login rather than at boot.
const prodDomain = process.env.APP_DOMAIN;
// Dev listens wherever PORT says (default 3000). The loopback client_id and
// redirect URIs encode the origin, so they follow it.
const devPort = Number(process.env.PORT ?? 3000);
const devOrigin = `http://127.0.0.1:${devPort}`;
// Dev asks for the space scopes outright (see spaceScopes). Against a network
// whose PDS cannot dereference a `social.grain.gallery` space declaration —
// the opensocial dev stack, for one — the whole login fails with
// invalid_scope, so GRAIN_SPACE_SCOPES=0 leaves them out.
const devSpaceScopes = process.env.GRAIN_SPACE_SCOPES !== "0";
// The pool scopes, likewise: a network whose PDS cannot dereference
// `social.grain.group` fails every login if we ask for them. The opensocial dev
// stack publishes that declaration and turns these on; set GRAIN_POOL_SCOPES=0
// against one that does not.
const devPoolScopes = process.env.GRAIN_POOL_SCOPES !== "0";

const grainScopes = [
  "atproto",
  "blob:image/*",
  "repo:social.grain.gallery",
  "repo:social.grain.gallery.item",
  "repo:social.grain.photo",
  "repo:social.grain.photo.exif",
  "repo:social.grain.actor.profile",
  "repo:social.grain.graph.follow",
  "repo:social.grain.favorite",
  "repo:social.grain.comment",
  "repo:social.grain.story",
  "repo:social.grain.graph.block",
  // Groups: a member offers a gallery (submission, their repo); whoever acts
  // as the group answers (item, the group's repo).
  "repo:social.grain.group.submission",
  "repo:social.grain.group.item",
  "repo:social.grain.group.decline",
  // Joining and leaving a group is a call to its community host, made with
  // service auth the member's PDS mints for that host — any host, hence `*`.
  "rpc:community.opensocial.requestJoin?aud=*",
  "rpc:community.opensocial.leaveCommunity?aud=*",
  // Both actions, not just create: the gallery cross-post is written with
  // com.atproto.repo.putRecord so a resumed publish overwrites its own post
  // instead of posting twice, and putRecord asserts create *and* update.
  "repo:app.bsky.feed.post?action=create&action=update",
].join(" ");

// Older iOS builds and the Android app still ask for the create-only form of
// the Bluesky post scope. hatk forwards a native client's requested scope to
// the PDS verbatim, and the PDS checks each token against this document
// literally — not as a semantic subset — so dropping the narrow string would
// fail their sign-in with `invalid_scope`. Declared, never requested.
const legacyScopes = "repo:app.bsky.feed.post?action=create";

// Private galleries live in permissioned spaces (proposal 0016). `authority=*`
// because a reader's session has to reach a space anchored on somebody else's
// account; `manage=` because the author's session creates the space itself.
//
// Requested only from PDSes that serve spaces — see conditionalScopes below.
// Almost no PDS does, and a permission nobody can honor has no business on
// everybody's consent screen.
//
// Registered on every client all the same. A client metadata document's `scope`
// is the set the client may ask for, not the set it asks for on any given
// login, and a PDS that checks the request against it — zds does; bsky.social
// does not — rejects the whole authorization with `invalid_scope` when
// conditional scopes widen the request past what the document declares.
const spaceScopes = [
  "space:social.grain.gallery?authority=*&skey=*",
  "collection=social.grain.gallery",
  "collection=social.grain.gallery.item",
  "collection=social.grain.photo",
  "action=read&action=create&action=update&action=delete",
  "manage=create&manage=update&manage=delete",
].join("&");

// A community's pool is a space too, but not one of ours to make: the community
// creates it, and a member only reads it and writes their own galleries into
// it. So no `manage=` — and `authority=*` because the space is anchored on the
// community, never on the member.
//
// Requested separately from the gallery scopes above, and separately gated,
// because the two need different things of a PDS: this one only needs
// `social.grain.group` to resolve as a space declaration, which is a lexicon a
// community host publishes. A network that serves one may not serve the other.
const poolScopes = [
  "space:social.grain.group?authority=*&skey=*",
  "collection=social.grain.gallery",
  "collection=social.grain.gallery.item",
  "collection=social.grain.photo",
  // A favourite and a comment on a pooled gallery belong in the pool too. In
  // the public repo they would name a private gallery to the whole network,
  // which is the one thing the space is for.
  "collection=social.grain.favorite",
  "collection=social.grain.comment",
  "action=read&action=create&action=update&action=delete",
].join("&");

export default defineConfig({
  relay: isProd ? "wss://bsky.network" : "ws://localhost:2583",
  // Jetstream filters server-side, so we stop decoding the whole network to
  // find social.grain.*. Prod only — the local PDS has no Jetstream in front
  // of it. `relay` is still required: backfill resolves repos through it.
  //
  // us-west, not us-east. The original reason was Railway-specific: from around
  // 2026-08-19 the us-east name answered 503 ("No server is available", haproxy
  // with no backend) on every path for requests leaving Railway, while the same
  // IP answered 200 from anywhere else — healthy from a laptop, unreachable from
  // the one network that mattered. That constraint left with Railway, so us-east
  // may well work from Hetzner now. Nothing is gained by finding out: us-west is
  // what the Jetstream docs use in their own example, and it works.
  jetstream: isProd ? { url: "wss://jetstream.us-west.bsky.network" } : null,
  plc: isProd ? "https://plc.directory" : "http://localhost:2582",
  port: devPort,
  cdn: isProd
    ? {
        url: "https://cdn.grain.social",
        key: process.env.CDN_KEY!,
        salt: process.env.CDN_SALT!,
      }
    : null,
  databaseEngine: "sqlite",
  database: isProd ? "/data/grain.db" : "data/grain.db",
  backfill: {
    signalCollections: ["social.grain.actor.profile"],
    fullNetwork: false,
    parallelism: 5,
  },
  push: {
    apns: {
      keyFile: isProd ? "/data/certs/AuthKey_J53A95HDW7.p8" : "./certs/AuthKey_J53A95HDW7.p8",
      keyId: "J53A95HDW7",
      teamId: "YN68LN9T7Z",
      bundleId: "social.grain.grain",
      production: isProd,
    },
    // Android. The service account is a Firebase key with the Messaging role,
    // kept alongside the APNs key rather than in the repo; the project id comes
    // from inside it. Until the file is there, hatk logs the miss and simply
    // doesn't send to Android — iOS is unaffected.
    fcm: {
      keyFile: isProd
        ? "/data/certs/firebase-service-account.json"
        : "./certs/firebase-service-account.json",
    },
  },
  oauth: {
    issuer: isProd && prodDomain ? `https://${prodDomain}` : undefined,
    // Dev asks for the space scopes outright, and has to ask here too: the
    // server-initiated login builds its request from this list, and it must
    // match what the loopback client_id encodes or the PDS grants neither.
    scopes: [
      grainScopes,
      ...(!isProd && devSpaceScopes ? [spaceScopes] : []),
      ...(!isProd && devPoolScopes ? [poolScopes] : []),
    ]
      .join(" ")
      .split(" "),
    conditionalScopes: [
      { whenMethod: "com.atproto.simplespace.createSpace", scopes: [spaceScopes] },
    ],
    clients: [
      ...(prodDomain
        ? [
            {
              client_id: `https://${prodDomain}/oauth-client-metadata.json`,
              client_name: "grain",
              scope: `${grainScopes} ${legacyScopes} ${spaceScopes} ${poolScopes}`,
              redirect_uris: [
                `https://${prodDomain}/oauth/callback`,
                `https://${prodDomain}/admin`,
                "grain://oauth/callback",
              ],
            },
          ]
        : []),
      {
        // Dev asks for the space scopes outright. Negotiation is skipped for
        // loopback clients — the scope is encoded in the client_id, which the
        // token exchange rebuilds from this config, so the two would disagree.
        client_id: `${devOrigin}/oauth-client-metadata.json`,
        client_name: "grain",
        scope: [
          grainScopes,
          legacyScopes,
          ...(devSpaceScopes ? [spaceScopes] : []),
          ...(devPoolScopes ? [poolScopes] : []),
        ].join(" "),
        redirect_uris: [`${devOrigin}/oauth/callback`, `${devOrigin}/admin`],
      },
      {
        client_id: "grain-native://app",
        client_name: "Grain for iOS",
        scope: `${grainScopes} ${legacyScopes} ${spaceScopes} ${poolScopes}`,
        redirect_uris: ["grain://oauth/callback"],
      },
    ],
  },
});

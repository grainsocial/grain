import { defineConfig } from "@hatk/hatk/config";

const isProd = process.env.NODE_ENV === "production";
const prodDomain = process.env.RAILWAY_PUBLIC_DOMAIN;

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
  "repo:app.bsky.feed.post?action=create",
].join(" ");

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

export default defineConfig({
  relay: isProd ? "wss://bsky.network" : "ws://localhost:2583",
  // Jetstream filters server-side, so we stop decoding the whole network to
  // find social.grain.*. Prod only — the local PDS has no Jetstream in front
  // of it. `relay` is still required: backfill resolves repos through it.
  //
  // us-west, not us-east: since around 2026-08-19 the us-east name answers 503
  // ("No server is available", haproxy with no backend) on every path — /status
  // included — for requests leaving Railway, while the same IP answers 200 from
  // elsewhere. So it reads as healthy from a laptop and is unreachable from the
  // one network that matters, which is why this took a while to see. us-west is
  // what the Jetstream docs use in their own example.
  jetstream: isProd ? { url: "wss://jetstream.us-west.bsky.network" } : null,
  plc: isProd ? "https://plc.directory" : "http://localhost:2582",
  port: 3000,
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
    scopes: (isProd ? grainScopes : `${grainScopes} ${spaceScopes}`).split(" "),
    conditionalScopes: [
      { whenMethod: "com.atproto.simplespace.createSpace", scopes: [spaceScopes] },
    ],
    clients: [
      ...(prodDomain
        ? [
            {
              client_id: `https://${prodDomain}/oauth-client-metadata.json`,
              client_name: "grain",
              scope: `${grainScopes} ${spaceScopes}`,
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
        client_id: "http://127.0.0.1:3000/oauth-client-metadata.json",
        client_name: "grain",
        scope: `${grainScopes} ${spaceScopes}`,
        redirect_uris: ["http://127.0.0.1:3000/oauth/callback", "http://127.0.0.1:3000/admin"],
      },
      {
        client_id: "grain-native://app",
        client_name: "Grain for iOS",
        scope: `${grainScopes} ${spaceScopes}`,
        redirect_uris: ["grain://oauth/callback"],
      },
    ],
  },
});

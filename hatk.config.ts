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
  "repo:app.bsky.feed.post?action=create",
].join(" ");

export default defineConfig({
  relay: isProd ? "wss://bsky.network" : "ws://localhost:2583",
  plc: isProd ? "https://plc.directory" : "http://localhost:2582",
  port: 3000,
  databaseEngine: "sqlite",
  database: isProd ? "/data/grain.db" : "data/grain.db",
  backfill: {
    signalCollections: ["social.grain.actor.profile"],
    fullNetwork: false,
    parallelism: 5,
  },
  oauth: {
    issuer: isProd && prodDomain ? `https://${prodDomain}` : undefined,
    scopes: grainScopes.split(" "),
    clients: [
      ...(prodDomain
        ? [
            {
              client_id: `https://${prodDomain}/oauth-client-metadata.json`,
              client_name: "grain",
              scope: grainScopes,
              redirect_uris: [
                `https://${prodDomain}/oauth/callback`,
                `https://${prodDomain}/admin`,
              ],
            },
          ]
        : []),
      {
        client_id: "http://127.0.0.1:3000/oauth-client-metadata.json",
        client_name: "grain",
        scope: grainScopes,
        redirect_uris: ["http://127.0.0.1:3000/oauth/callback", "http://127.0.0.1:3000/admin"],
      },
    ],
  },
});

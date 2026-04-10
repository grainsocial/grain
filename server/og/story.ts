import { defineOG } from "$hatk";
import type { GrainActorProfile } from "$hatk";
import { syneBrandFont } from "./fonts.ts";

export default defineOG("/og/profile/:did/story/:rkey", async (ctx) => {
  const { db, params, fetchImage, lookup, blobUrl } = ctx;
  const { did, rkey } = params;

  const storyUri = `at://${did}/social.grain.story/${rkey}`;

  const rows = (await db.query(
    `SELECT uri, did, cid, media FROM "social.grain.story" WHERE uri = $1`,
    [storyUri],
  )) as Array<{
    uri: string;
    did: string;
    cid: string;
    media: string;
  }>;

  const row = rows[0];
  if (!row) {
    return {
      element: {
        type: "div",
        props: {
          style: {
            display: "flex",
            width: "100%",
            height: "100%",
            background: "#ffffff",
            color: "#171717",
            alignItems: "center",
            justifyContent: "center",
          },
          children: "Story not found",
        },
      },
    };
  }

  let blobRef: any;
  try {
    blobRef = typeof row.media === "string" ? JSON.parse(row.media) : row.media;
  } catch {
    blobRef = row.media;
  }

  const imageUrl = blobUrl(row.did, blobRef, "feed_fullsize");
  const imageDataUrl = imageUrl ? await fetchImage(imageUrl) : null;

  const profiles = await lookup<GrainActorProfile>("social.grain.actor.profile", "did", [did]);
  const author = profiles.get(did);
  const avatarRef = author ? blobUrl(did, author.value.avatar) : null;
  const avatarDataUrl = avatarRef ? await fetchImage(avatarRef) : null;

  return {
    element: {
      type: "div",
      props: {
        style: {
          display: "flex",
          width: "100%",
          height: "100%",
          backgroundColor: "#000000",
          position: "relative",
        },
        children: [
          ...(imageDataUrl
            ? [
                {
                  type: "img",
                  props: {
                    src: imageDataUrl,
                    style: { width: "100%", height: "100%", objectFit: "contain" as const },
                  },
                },
              ]
            : []),
          {
            type: "div",
            props: {
              style: {
                position: "absolute",
                bottom: "0",
                left: "0",
                right: "0",
                height: "80px",
                background: "linear-gradient(transparent, rgba(0,0,0,0.7))",
                display: "flex",
                alignItems: "flex-end",
                padding: "0 24px 16px 24px",
                gap: "12px",
              },
              children: [
                ...(avatarDataUrl
                  ? [
                      {
                        type: "img",
                        props: {
                          src: avatarDataUrl,
                          style: {
                            width: "44px",
                            height: "44px",
                            borderRadius: "22px",
                            objectFit: "cover" as const,
                          },
                        },
                      },
                    ]
                  : []),
                {
                  type: "div",
                  props: {
                    style: { display: "flex", flexDirection: "column", gap: "2px" },
                    children: [
                      {
                        type: "div",
                        props: {
                          children:
                            author?.value.displayName || `@${author?.handle || did.slice(0, 24)}`,
                          style: { fontSize: 24, fontWeight: 600, color: "#ffffff" },
                        },
                      },
                      {
                        type: "div",
                        props: {
                          children: "grain",
                          style: { fontSize: 16, fontFamily: "Syne", fontWeight: 800, color: "rgba(255,255,255,0.7)", letterSpacing: "-0.02em" },
                        },
                      },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
    options: { fonts: [syneBrandFont()] },
    meta: {
      title: `Story by @${author?.handle || did.slice(0, 24)} — Grain`,
      description: "Photo story on Grain",
    },
  };
});

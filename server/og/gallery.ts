import { defineOG } from "$hatk";
import type { GrainActorProfile, Photo } from "$hatk";
import { allFonts } from "./fonts.ts";
import { calculateCollageLayout } from "./collage.ts";

export default defineOG("/og/profile/:did/gallery/:rkey", async (ctx) => {
  const { db, params, fetchImage, lookup, blobUrl } = ctx;
  const { did, rkey } = params;

  const galleryUri = `at://${did}/social.grain.gallery/${rkey}`;

  // Fetch gallery record
  const rows = (await db.query(
    `SELECT uri, did, cid, title, description FROM "social.grain.gallery" WHERE uri = $1`,
    [galleryUri],
  )) as Array<{
    uri: string;
    did: string;
    cid: string;
    title: string;
    description: string | null;
  }>;

  const gallery = rows[0];
  if (!gallery) {
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
          children: "Gallery not found",
        },
      },
    };
  }

  // Fetch author profile
  const profiles = await lookup<GrainActorProfile>("social.grain.actor.profile", "did", [did]);
  const author = profiles.get(did);
  const avatarRef = author ? blobUrl(did, author.value.avatar) : null;

  // Fetch gallery photos (up to 6)
  const itemRows = (await db.query(
    `SELECT item FROM "social.grain.gallery.item" WHERE gallery = $1 ORDER BY position ASC LIMIT 6`,
    [galleryUri],
  )) as Array<{ item: string }>;

  const photoUris = itemRows.map((r) => r.item);
  const photoRecords =
    photoUris.length > 0
      ? await ctx.getRecords<Photo>("social.grain.photo", photoUris)
      : new Map<string, { uri: string; did: string; cid: string; value: Photo }>();

  // Fetch images as base64
  const imageData: Array<{ url: string; aspectRatio: number }> = [];
  for (const uri of photoUris) {
    const rec = photoRecords.get(uri);
    if (!rec) continue;
    const url = blobUrl(rec.did, rec.value.photo, "feed_thumbnail");
    if (!url) continue;
    const dataUrl = await fetchImage(url);
    if (!dataUrl) continue;
    const ar = rec.value.aspectRatio
      ? rec.value.aspectRatio.width / rec.value.aspectRatio.height
      : 4 / 3;
    imageData.push({ url: dataUrl, aspectRatio: ar });
  }

  const avatarDataUrl = avatarRef ? await fetchImage(avatarRef) : null;

  // Layout constants — matches grain-next og-server
  const width = 1200;
  const height = 630;
  const titleBarHeight = 100;
  const collageHeight = height - titleBarHeight;
  const gap = 12;
  const padding = 24;

  // Calculate collage layout
  const placements = calculateCollageLayout(
    imageData,
    width - padding * 2,
    collageHeight - padding * 2,
    gap,
  );

  return {
    element: {
      type: "div",
      props: {
        style: {
          display: "flex",
          flexDirection: "column",
          width: "100%",
          height: "100%",
          backgroundColor: "#ffffff",
          position: "relative",
        },
        children: [
          // Collage area — absolute positioned images
          {
            type: "div",
            props: {
              style: {
                display: "flex",
                width: `${width}px`,
                height: `${collageHeight}px`,
                position: "relative",
                padding: `${padding}px`,
              },
              children: placements.map(
                (p: {
                  item: { url: string };
                  x: number;
                  y: number;
                  width: number;
                  height: number;
                }) => ({
                  type: "img",
                  props: {
                    src: p.item.url,
                    style: {
                      position: "absolute",
                      left: `${p.x + padding}px`,
                      top: `${p.y + padding}px`,
                      width: `${p.width}px`,
                      height: `${p.height}px`,
                      objectFit: "cover",
                    },
                  },
                }),
              ),
            },
          },
          // Title bar
          {
            type: "div",
            props: {
              style: {
                position: "absolute",
                bottom: "0",
                left: "0",
                right: "0",
                height: `${titleBarHeight}px`,
                background: "#ffffff",
                display: "flex",
                alignItems: "flex-end",
                padding: "0 24px 20px 24px",
              },
              children: [
                {
                  type: "div",
                  props: {
                    style: {
                      display: "flex",
                      alignItems: "center",
                      gap: "16px",
                      width: "100%",
                    },
                    children: [
                      // Avatar
                      ...(avatarDataUrl
                        ? [
                            {
                              type: "img",
                              props: {
                                src: avatarDataUrl,
                                style: {
                                  width: "56px",
                                  height: "56px",
                                  borderRadius: "28px",
                                  objectFit: "cover" as const,
                                },
                              },
                            },
                          ]
                        : []),
                      // Title and handle
                      {
                        type: "div",
                        props: {
                          style: {
                            display: "flex",
                            flexDirection: "column",
                            gap: "4px",
                            flex: "1",
                            overflow: "hidden",
                          },
                          children: [
                            {
                              type: "div",
                              props: {
                                children: gallery.title,
                                style: {
                                  fontSize: 36,
                                  fontWeight: 700,
                                  color: "#171717",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap" as const,
                                },
                              },
                            },
                            {
                              type: "div",
                              props: {
                                children: `@${author?.handle || did.slice(0, 24)}`,
                                style: {
                                  fontSize: 20,
                                  color: "#525252",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap" as const,
                                },
                              },
                            },
                          ],
                        },
                      },
                      // Grain branding
                      {
                        type: "div",
                        props: {
                          children: "grain",
                          style: { fontSize: 32, fontFamily: "Syne", fontWeight: 800, color: "#171717", letterSpacing: "-0.02em" },
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
    options: { fonts: allFonts() },
    meta: {
      title: `${gallery.title} by @${author?.handle || did.slice(0, 24)} — Grain`,
      description: gallery.description || `Photo gallery on Grain`,
    },
  };
});


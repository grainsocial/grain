import { defineOG } from "$hatk";
import type { GrainActorProfile, Photo } from "$hatk";

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
                          children: "Grain",
                          style: { fontSize: 32, color: "#171717" },
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
    meta: {
      title: `${gallery.title} by @${author?.handle || did.slice(0, 24)} — Grain`,
      description: gallery.description || `Photo gallery on Grain`,
    },
  };
});

// ─── Collage Layout (ported from grain-next og-server/lib/collage.js) ────────

function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  return Math.abs(hash);
}

function createSeededRandom(seed: number): () => number {
  let currentSeed = seed;
  return () => {
    currentSeed = (currentSeed * 9301 + 49297) % 233280;
    return currentSeed / 233280;
  };
}

interface ImageItem {
  url: string;
  aspectRatio: number;
}

interface Placement {
  item: ImageItem;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

function calculateCollageLayout(
  imageData: ImageItem[],
  containerWidth: number,
  containerHeight: number,
  gap = 12,
): Placement[] {
  const seedString = imageData
    .map((item) => `${item.url}_${item.aspectRatio.toFixed(3)}`)
    .join("|");
  const seed = hashCode(seedString);
  const random = createSeededRandom(seed);

  const placements: Placement[] = [];
  const occupiedSpace: Rect[] = [];

  const sortedImages = [...imageData].sort((a, b) => {
    const aScore = a.aspectRatio + (random() - 0.5) * 0.1;
    const bScore = b.aspectRatio + (random() - 0.5) * 0.1;
    return bScore - aScore;
  });

  const containerArea = containerWidth * containerHeight;
  const numImages = sortedImages.length;
  const targetCoverage = 0.75 + random() * 0.1;
  const targetTotalArea = containerArea * targetCoverage;
  const averageImageArea = targetTotalArea / numImages;

  const sizeCategories = [
    { min: 1.2, max: 1.8 },
    { min: 0.8, max: 1.2 },
    { min: 0.5, max: 0.8 },
  ];

  for (const item of sortedImages) {
    const categoryIndex = Math.floor(random() * sizeCategories.length);
    const category = sizeCategories[categoryIndex];
    const sizeMultiplier = category.min + random() * (category.max - category.min);

    const targetArea = averageImageArea * sizeMultiplier;
    const targetHeight = Math.sqrt(targetArea / item.aspectRatio);
    const targetWidth = targetHeight * item.aspectRatio;

    const minSize = Math.min(containerWidth, containerHeight) * 0.12;
    const maxSize = Math.min(containerWidth, containerHeight) * 0.75;

    let finalWidth = Math.max(minSize, Math.min(maxSize, targetWidth));
    let finalHeight = finalWidth / item.aspectRatio;

    if (finalHeight > maxSize) {
      finalHeight = maxSize;
      finalWidth = finalHeight * item.aspectRatio;
    }

    finalWidth = Math.min(finalWidth, containerWidth - gap);
    finalHeight = Math.min(finalHeight, containerHeight - gap);

    let placed = false;
    let attempts = 0;
    const maxAttempts = 200;

    while (!placed && attempts < maxAttempts) {
      let x: number, y: number;

      if (attempts < 50) {
        x = random() * (containerWidth - finalWidth - gap);
        y = random() * (containerHeight - finalHeight - gap);
      } else {
        const gridSize = Math.min(containerWidth, containerHeight) / 8;
        const gridX = Math.floor(
          random() * Math.ceil((containerWidth - finalWidth - gap) / gridSize),
        );
        const gridY = Math.floor(
          random() * Math.ceil((containerHeight - finalHeight - gap) / gridSize),
        );
        x = Math.min(gridX * gridSize, containerWidth - finalWidth - gap);
        y = Math.min(gridY * gridSize, containerHeight - finalHeight - gap);
      }

      const reservedRect: Rect = {
        x,
        y,
        width: finalWidth + gap,
        height: finalHeight + gap,
      };

      const overlaps = occupiedSpace.some((rect) => {
        return !(
          reservedRect.x >= rect.x + rect.width ||
          reservedRect.x + reservedRect.width <= rect.x ||
          reservedRect.y >= rect.y + rect.height ||
          reservedRect.y + reservedRect.height <= rect.y
        );
      });

      if (!overlaps) {
        placements.push({
          item,
          x: Math.round(x),
          y: Math.round(y),
          width: Math.round(finalWidth),
          height: Math.round(finalHeight),
        });
        occupiedSpace.push({
          x: Math.round(x),
          y: Math.round(y),
          width: Math.round(finalWidth) + gap,
          height: Math.round(finalHeight) + gap,
        });
        placed = true;
      }

      attempts++;
    }

    // Fallback: try smaller sizes
    if (!placed) {
      for (let sizeReduction = 0; sizeReduction <= 0.5; sizeReduction += 0.1) {
        if (placed) break;
        const reducedWidth = finalWidth * (1 - sizeReduction);
        const reducedHeight = finalHeight * (1 - sizeReduction);
        const minAcceptable = Math.min(containerWidth, containerHeight) * 0.08;
        if (reducedWidth < minAcceptable || reducedHeight < minAcceptable) continue;

        const gridSize = Math.max(10, Math.min(reducedWidth, reducedHeight) / 4);
        for (let gx = 0; gx <= containerWidth - reducedWidth - gap && !placed; gx += gridSize) {
          for (let gy = 0; gy <= containerHeight - reducedHeight - gap && !placed; gy += gridSize) {
            const testRect: Rect = {
              x: gx,
              y: gy,
              width: reducedWidth + gap,
              height: reducedHeight + gap,
            };
            const hasOverlap = occupiedSpace.some((rect) => {
              return !(
                testRect.x >= rect.x + rect.width ||
                testRect.x + testRect.width <= rect.x ||
                testRect.y >= rect.y + rect.height ||
                testRect.y + testRect.height <= rect.y
              );
            });
            if (!hasOverlap) {
              placements.push({
                item,
                x: Math.round(gx),
                y: Math.round(gy),
                width: Math.round(reducedWidth),
                height: Math.round(reducedHeight),
              });
              occupiedSpace.push({
                x: Math.round(gx),
                y: Math.round(gy),
                width: Math.round(reducedWidth) + gap,
                height: Math.round(reducedHeight) + gap,
              });
              placed = true;
            }
          }
        }
      }
    }
  }

  return placements;
}

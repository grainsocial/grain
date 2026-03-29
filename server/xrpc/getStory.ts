import { defineQuery } from "$hatk";
import { views } from "$hatk";
import type { GrainActorProfile, Story } from "$hatk";
import { lookupCrossPosts } from "../hydrate/galleries.ts";

export default defineQuery("social.grain.unspecced.getStory", async (ctx) => {
  const { db, ok } = ctx;
  const storyUri = ctx.params.story;
  if (!storyUri) return ok({});

  const rows = (await db.query(
    `SELECT uri, cid, did, media, aspect_ratio, location, address, created_at
     FROM "social.grain.story"
     WHERE uri = $1`,
    [storyUri],
  )) as {
    uri: string;
    cid: string;
    did: string;
    media: string;
    aspect_ratio: string;
    location: string | null;
    address: string | null;
    created_at: string;
  }[];

  const row = rows[0];
  if (!row) return ok({});

  // Resolve author profile
  const profiles = await ctx.lookup<GrainActorProfile>("social.grain.actor.profile", "did", [
    row.did,
  ]);
  const author = profiles.get(row.did);
  const profileView = author
    ? views.grainActorDefsProfileView({
        cid: author.cid,
        did: author.did,
        handle: author.handle ?? author.did,
        displayName: author.value.displayName,
        avatar: ctx.blobUrl(author.did, author.value.avatar) ?? undefined,
      })
    : views.grainActorDefsProfileView({
        cid: "",
        did: row.did,
        handle: row.did,
      });

  let blobRef: any;
  try {
    blobRef = typeof row.media === "string" ? JSON.parse(row.media) : row.media;
  } catch {
    blobRef = row.media;
  }

  let aspectRatio: { width: number; height: number };
  try {
    aspectRatio =
      typeof row.aspect_ratio === "string" ? JSON.parse(row.aspect_ratio) : row.aspect_ratio;
  } catch {
    aspectRatio = { width: 4, height: 3 };
  }

  let location: Story["location"] | null = null;
  if (row.location) {
    try {
      location = typeof row.location === "string" ? JSON.parse(row.location) : row.location;
    } catch {
      location = null;
    }
  }

  let address: Story["address"] | null = null;
  if (row.address) {
    try {
      address = typeof row.address === "string" ? JSON.parse(row.address) : row.address;
    } catch {
      address = null;
    }
  }

  // Cross-post lookup
  const crossPostMap = await lookupCrossPosts(db, [row], "story");
  const crossPostUrl = crossPostMap.get(row.uri);
  const crossPost = crossPostUrl ? { url: crossPostUrl } : undefined;

  const story = views.storyView({
    uri: row.uri,
    cid: row.cid,
    creator: profileView,
    thumb: ctx.blobUrl(row.did, blobRef, "feed_thumbnail") ?? "",
    fullsize: ctx.blobUrl(row.did, blobRef, "feed_fullsize") ?? "",
    aspectRatio,
    ...(location
      ? {
          location: { name: location.name, value: location.value },
          ...(address ? { address } : {}),
        }
      : {}),
    ...(crossPost ? { crossPost } : {}),
    createdAt: row.created_at,
  });

  return ok({ story });
});

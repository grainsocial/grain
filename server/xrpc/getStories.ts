import { defineQuery } from "$hatk";
import { views } from "$hatk";
import type { GrainActorProfile, Story } from "$hatk";

const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

export default defineQuery("social.grain.unspecced.getStories", async (ctx) => {
  const { db, ok } = ctx;
  const actor = ctx.params.actor;
  if (!actor) return ok({ stories: [] });

  const cutoff = new Date(Date.now() - TWENTY_FOUR_HOURS).toISOString();

  // hatk stores aspect_ratio and location as JSON TEXT columns, media as JSON blob ref
  const rows = (await db.query(
    `SELECT uri, cid, did, media, aspect_ratio, location, address, created_at
       FROM "social.grain.story"
       WHERE did = $1 AND created_at > $2
       ORDER BY created_at ASC`,
    [actor, cutoff],
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

  // Resolve author profile
  const profiles = await ctx.lookup<GrainActorProfile>("social.grain.actor.profile", "did", [
    actor,
  ]);
  const author = profiles.get(actor);
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
        did: actor,
        handle: actor,
      });

  const stories = rows.map((row) => {
    // Parse the JSON blob reference for URL generation
    let blobRef: any;
    try {
      blobRef = typeof row.media === "string" ? JSON.parse(row.media) : row.media;
    } catch {
      blobRef = row.media;
    }

    // Parse aspect_ratio JSON (stored as e.g. {"width":4,"height":3})
    let aspectRatio: { width: number; height: number };
    try {
      aspectRatio =
        typeof row.aspect_ratio === "string" ? JSON.parse(row.aspect_ratio) : row.aspect_ratio;
    } catch {
      aspectRatio = { width: 4, height: 3 };
    }

    // Parse location JSON if present
    let location: Story["location"] | null = null;
    if (row.location) {
      try {
        location = typeof row.location === "string" ? JSON.parse(row.location) : row.location;
      } catch {
        location = null;
      }
    }

    // Parse address JSON if present
    let address: Story["address"] | null = null;
    if (row.address) {
      try {
        address = typeof row.address === "string" ? JSON.parse(row.address) : row.address;
      } catch {
        address = null;
      }
    }

    return views.storyView({
      uri: row.uri,
      cid: row.cid,
      creator: profileView,
      thumb: ctx.blobUrl(row.did, blobRef, "feed_thumbnail") ?? "",
      fullsize: ctx.blobUrl(row.did, blobRef, "feed_fullsize") ?? "",
      aspectRatio,
      ...(location
        ? {
            location: {
              name: location.name,
              value: location.value,
            },
            ...(address ? { address } : {}),
          }
        : {}),
      createdAt: row.created_at,
    });
  });

  return ok({ stories });
});

import { views } from "$hatk";
import type { GrainActorProfile, Story, Label, Row, BaseContext } from "$hatk";
import { HIDE_LABELS } from "../labels/_hidden.ts";
import { lookupCrossPosts } from "./galleries.ts";
import { lookupHandles } from "../helpers/lookupHandles.ts";

export type StoryRow = {
  uri: string;
  cid: string;
  did: string;
  media: string;
  aspect_ratio: string;
  location: string | null;
  address: string | null;
  created_at: string;
};

/**
 * Hydrate raw story rows into StoryView objects.
 * Resolves the author profile, filters by label moderation, and maps to views.
 */
export async function hydrateStories(ctx: BaseContext, actor: string, rows: StoryRow[]) {
  // Resolve author profile
  const [profiles, handleMap] = await Promise.all([
    ctx.lookup<GrainActorProfile>("social.grain.actor.profile", "did", [actor]),
    lookupHandles(ctx.db, [actor]),
  ]);
  const author = profiles.get(actor);
  const profileView = author
    ? views.grainActorDefsProfileView({
        cid: author.cid,
        did: author.did,
        handle: author.handle ?? handleMap.get(author.did) ?? author.did,
        displayName: author.value.displayName,
        avatar: ctx.blobUrl(author.did, author.value.avatar) ?? undefined,
      })
    : views.grainActorDefsProfileView({
        cid: "",
        did: actor,
        handle: handleMap.get(actor) ?? actor,
      });

  // Hydrate external labels
  const storyUris = rows.map((r) => r.uri);
  const labelsByUri =
    storyUris.length > 0
      ? ((await ctx.labels(storyUris)) as Map<string, Label[]>)
      : new Map<string, Label[]>();

  // Merge self-labels from records
  if (storyUris.length > 0) {
    const selfLabelRows = (await ctx.db.query(
      `SELECT parent_uri, val FROM "social.grain.story__labels_self_labels"
       WHERE parent_uri IN (${storyUris.map((_, i) => `$${i + 1}`).join(",")})`,
      storyUris,
    )) as { parent_uri: string; val: string }[];
    for (const row of selfLabelRows) {
      const label: Label = { src: row.parent_uri.split("/")[2], uri: row.parent_uri, val: row.val, cts: new Date().toISOString() };
      const existing = labelsByUri.get(row.parent_uri) ?? [];
      existing.push(label);
      labelsByUri.set(row.parent_uri, existing);
    }
  }

  // Filter stories with hide-severity labels (latest entry per val wins)
  const visibleRows = rows.filter((row) => {
    const labels = labelsByUri.get(row.uri);
    if (!labels) return true;
    const latestByVal = new Map<string, Label>();
    for (const l of labels) {
      const prev = latestByVal.get(l.val);
      if (!prev || l.cts > prev.cts) latestByVal.set(l.val, l);
    }
    return ![...latestByVal.values()].some((l) => HIDE_LABELS.has(l.val) && !l.neg);
  });

  // Cross-post lookup
  const crossPosts = await lookupCrossPosts(ctx.db, visibleRows, "story");

  const stories = visibleRows.map((row) => {
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

    return views.storyView({
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
      createdAt: row.created_at,
      ...(labelsByUri.has(row.uri) ? { labels: labelsByUri.get(row.uri) } : {}),
      ...(crossPosts.has(row.uri) ? { crossPost: { url: crossPosts.get(row.uri)! } } : {}),
    });
  });

  return stories;
}

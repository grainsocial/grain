import { defineFeed } from "$hatk";
import { hydrateGalleries } from "../hydrate/galleries.ts";
import { hideLabelsFilter } from "../labels/_hidden.ts";
import { blockMuteFilter } from "../filters/blockMute.ts";

// ─── Scoring parameters (spacecowboy17's optimized A/B values) ───────
const HALF_LIFE_HOURS = 6;
const SMOOTHING_FACTOR = 0.5;
const POPULARITY_PENALTY = 0.3;
const DIVISOR_POWER = 1.0;
const CORATER_DECAY = 0;
const TIME_SHIFT_HOURS = 24;
const SEED_LIMIT = 500;
const MAX_COLIKERS = 1000;
const PAGE_SIZE = 50;

export default defineFeed({
  collection: "social.grain.gallery",
  label: "For You",

  hydrate: hydrateGalleries,

  async generate(ctx) {
    const actor = ctx.params.actor;
    if (!actor) return ctx.ok({ uris: [] });

    const limit = Math.min(Number(ctx.params.limit) || PAGE_SIZE, PAGE_SIZE);
    const offset = Number(ctx.params.cursor) || 0;

    // Step 1: Get user's recent favorites (seed)
    const seedRows = (await ctx.db.query(
      `SELECT f.subject AS gallery_uri, f.created_at
       FROM "social.grain.favorite" f
       WHERE f.did = $1
       ORDER BY f.created_at DESC
       LIMIT $2`,
      [actor, SEED_LIMIT],
    )) as { gallery_uri: string; created_at: string }[];

    // Cold start: fall back to popular galleries
    if (seedRows.length === 0) {
      return coldStartFeed(ctx, actor, limit, offset);
    }

    const seedUris = seedRows.map((r) => r.gallery_uri);

    // Build a map of seed gallery → when the user liked it
    const seedLikeTime = new Map<string, number>();
    for (const row of seedRows) {
      seedLikeTime.set(row.gallery_uri, new Date(row.created_at).getTime());
    }

    // Step 2: Find co-likers (people who favorited the same galleries)
    const placeholders = seedUris.map((_, i) => `$${i + 2}`).join(", ");
    const colikerRows = (await ctx.db.query(
      `SELECT f.did AS coliker, f.subject AS gallery_uri, f.created_at
       FROM "social.grain.favorite" f
       WHERE f.subject IN (${placeholders})
         AND f.did != $1
       ORDER BY f.created_at DESC`,
      [actor, ...seedUris],
    )) as { coliker: string; gallery_uri: string; created_at: string }[];

    // Filter co-likers: only those who liked before the user (unless ignore_order)
    // + apply time_shift window
    const validColikers = new Set<string>();
    const colikerSeedPairs = new Map<string, Set<string>>(); // coliker → set of shared galleries

    for (const row of colikerRows) {
      const userLikeTime = seedLikeTime.get(row.gallery_uri);
      if (!userLikeTime) continue;

      const colikeTime = new Date(row.created_at).getTime();
      // Only consider likes before the user's like (+ time_shift window)
      if (colikeTime <= userLikeTime + TIME_SHIFT_HOURS * 3600_000) {
        validColikers.add(row.coliker);
        if (!colikerSeedPairs.has(row.coliker)) {
          colikerSeedPairs.set(row.coliker, new Set());
        }
        colikerSeedPairs.get(row.coliker)!.add(row.gallery_uri);
      }
    }

    if (validColikers.size === 0) {
      return coldStartFeed(ctx, actor, limit, offset);
    }

    // Step 3: Get co-likers' other favorites (candidates) + their total like counts
    // Cap co-likers, preferring those with more overlap
    const colikerList = [...validColikers]
      .sort((a, b) => (colikerSeedPairs.get(b)?.size ?? 0) - (colikerSeedPairs.get(a)?.size ?? 0))
      .slice(0, MAX_COLIKERS);

    const colikerPlaceholders = colikerList.map((_, i) => `$${i + 2}`).join(", ");
    const seedPlaceholders = seedUris.map((_, i) => `$${i + 2 + colikerList.length}`).join(", ");

    const likeCountPlaceholders = colikerList.map((_, i) => `$${i + 1}`).join(", ");

    const [candidateRows, likeCounts] = await Promise.all([
      ctx.db.query(
        `SELECT f.did AS coliker, f.subject AS gallery_uri, t.created_at AS gallery_created_at
         FROM "social.grain.favorite" f
         JOIN "social.grain.gallery" t ON t.uri = f.subject
         LEFT JOIN _repos r ON t.did = r.did
         WHERE f.did IN (${colikerPlaceholders})
           AND f.subject NOT IN (${seedPlaceholders})
           AND t.did != $1
           AND (r.status IS NULL OR r.status != 'takendown')
           AND ${hideLabelsFilter("t.uri")}
           AND (SELECT count(*) FROM "social.grain.gallery.item" gi WHERE gi.gallery = t.uri) > 0
           AND ${blockMuteFilter("t.did", "$1")}`,
        [actor, ...colikerList, ...seedUris],
      ) as Promise<{ coliker: string; gallery_uri: string; gallery_created_at: string }[]>,

      ctx.db.query(
        `SELECT did, COUNT(*) as cnt
         FROM "social.grain.favorite"
         WHERE did IN (${likeCountPlaceholders})
         GROUP BY did`,
        colikerList,
      ) as Promise<{ did: string; cnt: number }[]>,
    ]);

    // Build co-liker total likes map
    const colikerTotalLikes = new Map<string, number>();
    for (const row of likeCounts) {
      colikerTotalLikes.set(row.did, Number(row.cnt));
    }

    // Step 4: Score each candidate gallery
    const now = Date.now();
    const galleryScores = new Map<
      string,
      { score: number; paths: number; created_at: string; coratersSeenCount: Map<string, number> }
    >();

    // Get popularity (total favorites) for candidate galleries
    const candidateUris = [...new Set(candidateRows.map((r) => r.gallery_uri))];

    const popularityMap = new Map<string, number>();
    if (candidateUris.length > 0) {
      const popPlaceholders = candidateUris.map((_, i) => `$${i + 1}`).join(", ");
      const popRows = (await ctx.db.query(
        `SELECT subject, COUNT(*) as cnt
         FROM "social.grain.favorite"
         WHERE subject IN (${popPlaceholders})
         GROUP BY subject`,
        candidateUris,
      )) as { subject: string; cnt: number }[];
      for (const row of popRows) {
        popularityMap.set(row.subject, Number(row.cnt));
      }
    }

    for (const row of candidateRows) {
      const totalLikes = colikerTotalLikes.get(row.coliker) || 1;

      let entry = galleryScores.get(row.gallery_uri);
      if (!entry) {
        entry = {
          score: 0,
          paths: 0,
          created_at: row.gallery_created_at,
          coratersSeenCount: new Map(),
        };
        galleryScores.set(row.gallery_uri, entry);
      }

      // Track how many items we've seen from this corater (for decay)
      const seenCount = entry.coratersSeenCount.get(row.coliker) || 0;
      entry.coratersSeenCount.set(row.coliker, seenCount + 1);

      // Path score: 1 / total_likes^divisor_power
      let pathScore = 1 / Math.pow(totalLikes, DIVISOR_POWER);

      // Corater decay
      if (CORATER_DECAY > 0) {
        pathScore *= Math.pow(1 - CORATER_DECAY, seenCount);
      }

      entry.score += pathScore;
      entry.paths += 1;
    }

    // Apply smoothing, time decay, and popularity penalty
    const scored: { uri: string; score: number }[] = [];

    for (const [uri, entry] of galleryScores) {
      let score = entry.score;

      // Smoothing: boost multi-path galleries
      if (SMOOTHING_FACTOR > 0) {
        score *= Math.pow(entry.paths, SMOOTHING_FACTOR);
      }

      // Time decay
      if (HALF_LIFE_HOURS > 0) {
        const ageHours = (now - new Date(entry.created_at).getTime()) / 3_600_000;
        score *= Math.pow(0.5, ageHours / HALF_LIFE_HOURS);
      }

      // Popularity penalty
      if (POPULARITY_PENALTY > 0) {
        const popularity = popularityMap.get(uri) || 1;
        score /= Math.pow(popularity, POPULARITY_PENALTY);
      }

      scored.push({ uri, score });
    }

    // Sort by score descending
    scored.sort((a, b) => b.score - a.score);

    // Paginate
    const page = scored.slice(offset, offset + limit);
    const nextCursor = offset + limit < scored.length ? String(offset + limit) : undefined;

    return ctx.ok({
      uris: page.map((r) => r.uri),
      cursor: nextCursor,
    });
  },
});

// ─── Cold start: most-favorited galleries from last 30 days ──────────
async function coldStartFeed(
  ctx: Parameters<Parameters<typeof defineFeed>[0]["generate"]>[0],
  actor: string,
  limit: number,
  offset: number,
) {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 3600_000).toISOString();

  const rows = (await ctx.db.query(
    `SELECT t.uri, COUNT(f.did) as fav_count
     FROM "social.grain.gallery" t
     LEFT JOIN "social.grain.favorite" f ON f.subject = t.uri
     LEFT JOIN _repos r ON t.did = r.did
     WHERE (r.status IS NULL OR r.status != 'takendown')
       AND t.did != $1
       AND t.created_at > $2
       AND ${hideLabelsFilter("t.uri")}
       AND (SELECT count(*) FROM "social.grain.gallery.item" gi WHERE gi.gallery = t.uri) > 0
       AND ${blockMuteFilter("t.did", "$1")}
     GROUP BY t.uri
     ORDER BY fav_count DESC, t.created_at DESC
     LIMIT $3 OFFSET $4`,
    [actor, thirtyDaysAgo, limit, offset],
  )) as { uri: string; fav_count: number }[];

  // Check if there are more results
  const hasMore = rows.length === limit;
  const nextCursor = hasMore ? String(offset + limit) : undefined;

  return ctx.ok({
    uris: rows.map((r) => r.uri),
    cursor: nextCursor,
  });
}

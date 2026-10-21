/**
 * Accounts bridged in by Bridgy Fed, from the fediverse or from a website. It
 * writes their image posts as grain galleries: news feeds, blogs and toots
 * that carry a picture, mirrored here without anyone choosing to post on
 * grain. Every post from one is labelled `spam`, by the label rule in
 * `labels/spam.ts` as a post is indexed live and by the `bridged` classifier
 * for posts a backfill wrote.
 */

/** The collections whose records are hidden when a bridged account writes them. */
export const BRIDGED_HIDDEN_COLLECTIONS = [
  "social.grain.gallery",
  "social.grain.story",
  "social.grain.comment",
];

/** A handle Bridgy Fed issued: `*.ap.brid.gy` for the fediverse, `*.web.brid.gy` for a website. */
export function isBridgedHandle(handle: string | null | undefined): boolean {
  return !!handle?.toLowerCase().endsWith(".brid.gy");
}

/**
 * The footer Bridgy Fed appends to every bridged profile's description, which
 * is the signal for a bridged account that has set a domain handle of its own:
 * `🌉 bridged from ⁂ https://…, follow @ap.brid.gy to interact` for the
 * fediverse, `🌉 bridged from 🌐 https://…: https://fed.brid.gy/web/…` for a
 * website. A person who mentions their bridged account in their own words
 * writes neither.
 */
export function isBridgedDescription(description: string | null | undefined): boolean {
  if (!description?.includes("🌉 bridged from")) return false;
  return (
    description.includes("follow @ap.brid.gy to interact") ||
    description.includes("https://fed.brid.gy/")
  );
}

type Db = { query: (sql: string, params?: unknown[]) => Promise<unknown[]> };

/** Whether `did` is a bridged account, by its handle or else its grain profile. */
export async function isBridgedAccount(
  db: Db,
  did: string,
  handle?: string | null,
): Promise<boolean> {
  if (handle === undefined) {
    const [repo] = (await db.query(`SELECT handle FROM _repos WHERE did = $1`, [did])) as {
      handle: string | null;
    }[];
    handle = repo?.handle;
  }
  if (isBridgedHandle(handle)) return true;
  const [profile] = (await db.query(
    `SELECT description FROM "social.grain.actor.profile" WHERE did = $1 LIMIT 1`,
    [did],
  )) as { description: string | null }[];
  return isBridgedDescription(profile?.description);
}

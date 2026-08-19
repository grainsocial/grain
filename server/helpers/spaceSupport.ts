// Does a PDS serve permissioned spaces (proposal 0016)?
//
// `community.lexicon.service.describe` is the only way to ask. atproto
// publishes no method list, so the alternative — call a space method and read
// the failure — cannot tell a server without the feature apart from one that is
// broken. A PDS that doesn't answer describe at all is read as "no", which is
// the right answer for every PDS that doesn't implement spaces anyway.

const DESCRIBE_NSID = "community.lexicon.service.describe";
const PROBE_TIMEOUT_MS = 5000;

/**
 * The space methods grain needs, in the order a shared gallery uses them.
 * Each entry is a set of accepted spellings: the proposal renamed things after
 * implementations shipped, so a server may answer to either name and one is
 * enough. See pds.js docs/permissioned-data.md, "Two spellings".
 */
const REQUIRED_METHODS: string[][] = [
  ["com.atproto.simplespace.createSpace"],
  ["com.atproto.simplespace.addMember"],
  ["com.atproto.simplespace.listMembers"],
  ["com.atproto.simplespace.getSpace", "com.atproto.space.getSpace"],
  ["com.atproto.space.createRecord"],
  ["com.atproto.space.listRecords"],
  ["com.atproto.space.listRepos"],
  ["com.atproto.space.getDelegationToken"],
  ["com.atproto.space.getSpaceCredential"],
  ["com.atproto.space.getBlob"],
];

/**
 * Re-probe this often. A PDS gains spaces by redeploying, not by telling us.
 *
 * A yes and a no are not held for the same length of time, because they do not
 * go stale in the same direction. A yes that has gone stale costs one failed
 * call, which says what happened; the operator who turns spaces off is rare and
 * the app finds out immediately.
 *
 * A no is the answer that traps people. An operator enables spaces, and for the
 * rest of the hour every account on that server is told it has none — with
 * nothing to do about it, because the thing that would change the answer has
 * already happened. A no also absorbs every reason a probe can fail to land: a
 * restart, a timeout, a blip on the way. None of those are evidence about the
 * server, and none should outlive the minute they happened in. So a no is kept
 * only long enough to spare the PDS a probe per page load.
 */
const CACHE_TTL_MS = 60 * 60 * 1000;
const NEGATIVE_CACHE_TTL_MS = 5 * 60 * 1000;

export interface SpaceSupport {
  supported: boolean;
  pds: string;
  checkedAt: string;
  /** Required methods this PDS does not serve. Empty exactly when supported. */
  missing: string[];
}

type Db = {
  query: (sql: string, params?: unknown[]) => Promise<unknown[]>;
  run: (sql: string, params?: unknown[]) => Promise<void>;
};

/** Every method name in a describe response, or null if it isn't one. */
async function fetchMethods(pdsEndpoint: string): Promise<Set<string> | null> {
  const url = `${pdsEndpoint.replace(/\/$/, "")}/xrpc/${DESCRIBE_NSID}`;
  let res: Response;
  try {
    res = await fetch(url, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    });
  } catch {
    return null;
  }
  if (!res.ok) return null;

  const body = (await res.json().catch(() => null)) as {
    methods?: { value?: unknown }[];
  } | null;
  if (!Array.isArray(body?.methods)) return null;

  const names = new Set<string>();
  for (const m of body.methods) {
    if (typeof m?.value === "string") names.add(m.value);
  }
  return names;
}

/** Probe a PDS directly, bypassing the cache. */
export async function probeSpaceSupport(pdsEndpoint: string): Promise<SpaceSupport> {
  const methods = await fetchMethods(pdsEndpoint);
  const checkedAt = new Date().toISOString();

  // No describe endpoint means no spaces — a server that implements the
  // proposal implements the discovery method with it.
  if (!methods) {
    return {
      supported: false,
      pds: pdsEndpoint,
      checkedAt,
      missing: REQUIRED_METHODS.map((spellings) => spellings[0]),
    };
  }

  const missing = REQUIRED_METHODS.filter(
    (spellings) => !spellings.some((name) => methods.has(name)),
  ).map((spellings) => spellings[0]);

  return { supported: missing.length === 0, pds: pdsEndpoint, checkedAt, missing };
}

/**
 * Cached support for a PDS, re-probed once the cached answer has aged out.
 * A probe that fails to reach the server is not an error here — it lands as
 * "not supported", which is what an unreachable PDS means for this feature.
 */
export async function getSpaceSupport(
  db: Db,
  pdsEndpoint: string,
  opts?: { force?: boolean },
): Promise<SpaceSupport> {
  const rows = (await db.query(
    `SELECT supported, missing, checked_at FROM _space_support WHERE pds_endpoint = $1`,
    [pdsEndpoint],
  )) as { supported: number; missing: string; checked_at: string }[];

  const cached = rows[0];
  if (cached && !opts?.force) {
    const age = Date.now() - Date.parse(cached.checked_at);
    const ttl = cached.supported ? CACHE_TTL_MS : NEGATIVE_CACHE_TTL_MS;
    if (Number.isFinite(age) && age < ttl) {
      return {
        supported: !!cached.supported,
        pds: pdsEndpoint,
        checkedAt: cached.checked_at,
        missing: JSON.parse(cached.missing) as string[],
      };
    }
  }

  const fresh = await probeSpaceSupport(pdsEndpoint);
  await db.run(
    `INSERT INTO _space_support (pds_endpoint, supported, missing, checked_at)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (pds_endpoint) DO UPDATE SET
       supported = excluded.supported,
       missing = excluded.missing,
       checked_at = excluded.checked_at`,
    [pdsEndpoint, fresh.supported ? 1 : 0, JSON.stringify(fresh.missing), fresh.checkedAt],
  );
  return fresh;
}

/** The PDS endpoint grain holds a session for, or null if there isn't one. */
export async function pdsEndpointFor(db: Db, did: string): Promise<string | null> {
  const rows = (await db.query(`SELECT pds_endpoint FROM _oauth_sessions WHERE did = $1`, [
    did,
  ])) as { pds_endpoint: string }[];
  return rows[0]?.pds_endpoint ?? null;
}

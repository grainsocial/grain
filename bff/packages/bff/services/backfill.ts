import { Agent } from "@atproto/api";
import { type AtprotoData, DidResolver, MemoryCache } from "@atproto/identity";
import { stringifyLex } from "@atproto/lexicon";
import { AtUri } from "@atproto/syntax";
import type { BffConfig, RecordTable } from "../types.d.ts";
import type { IndexService } from "./indexing.ts";

type RecordTableWithoutIndexedAt = Omit<
  RecordTable,
  "indexedAt"
>;

const atpCache = new MemoryCache();

export async function getRecordsForRepos(
  repos: string[],
  collections: string[],
  atpMap: Map<string, AtprotoData>,
): Promise<RecordTableWithoutIndexedAt[]> {
  async function fetchRecordsForRepoCollection(
    repo: string,
    collection: string,
  ): Promise<RecordTableWithoutIndexedAt[]> {
    const repoRecords: RecordTableWithoutIndexedAt[] = [];
    const atpData = atpMap.get(repo);

    if (!atpData) {
      console.error(`No Atproto data found for repo: ${repo}`);
      return [];
    }

    const agent = new Agent(new URL(atpData.pds));
    let cursor: string | undefined = undefined;

    try {
      do {
        const response = await agent.com.atproto.repo.listRecords({
          repo,
          collection,
          cursor,
          limit: 100,
        });

        response.data.records.forEach((r) => {
          repoRecords.push({
            uri: r.uri,
            cid: r.cid.toString(),
            did: repo,
            collection,
            json: stringifyLex(r.value),
          } as RecordTableWithoutIndexedAt);
        });

        cursor = response.data.cursor ?? undefined;
      } while (cursor);

      return repoRecords;
    } catch (_error) {
      console.error(`Error fetching records for ${repo}/${collection}`);
      return [];
    }
  }

  const fetchPromises = repos.flatMap((repo) =>
    collections.map((collection) =>
      fetchRecordsForRepoCollection(repo, collection)
    )
  );

  const results = await Promise.all(fetchPromises);

  return results.flat();
}

export async function getAtpMapForRepos(
  repos: string[],
  cfg: BffConfig,
): Promise<Map<string, AtprotoData>> {
  const didResolver = new DidResolver({
    plcUrl: cfg.plcDirectoryUrl,
    didCache: atpCache,
  });
  const atpMap = new Map<string, AtprotoData>();
  for (const repo of repos) {
    const atpData = await didResolver.resolveAtprotoData(repo);
    if (!atpMap.has(atpData.did)) {
      atpMap.set(atpData.did, atpData);
    }
  }
  return atpMap;
}

export async function getRecordsForUris(
  uris: string[],
  atpMap: Map<string, AtprotoData>,
  indexService: IndexService,
): Promise<RecordTableWithoutIndexedAt[]> {
  const urisToFetch = uris.filter((uri) => !indexService.getRecord(uri));

  if (urisToFetch.length === 0) {
    return [];
  }

  const urisByDid = new Map<string, string[]>();
  urisToFetch.forEach((uri) => {
    const did = new AtUri(uri).hostname;
    if (!urisByDid.has(did)) {
      urisByDid.set(did, []);
    }
    urisByDid.get(did)!.push(uri);
  });

  const fetchPromises = Array.from(urisByDid.entries()).map(
    async ([did, didUris]): Promise<RecordTableWithoutIndexedAt[]> => {
      const atpData = atpMap.get(did);
      if (!atpData) {
        console.error(`No Atproto data found for repo: ${did}`);
        return [];
      }

      const agent = new Agent(new URL(atpData.pds));

      const uriPromises = didUris.map(async (uri) => {
        try {
          const atUri = new AtUri(uri);
          console.log(`Fetching record for ${uri}`);
          const response = await agent.com.atproto.repo.getRecord({
            repo: did,
            collection: atUri.collection,
            rkey: atUri.rkey,
          });

          return {
            uri: response.data.uri,
            cid: response.data.cid,
            did,
            collection: atUri.collection,
            json: stringifyLex(response.data.value),
          } as RecordTableWithoutIndexedAt;
        } catch (error) {
          console.error(`Failed to fetch record from ${uri}:`, error);
          return null;
        }
      });

      const results = await Promise.all(uriPromises);
      return results.filter((record): record is RecordTableWithoutIndexedAt =>
        record !== null
      );
    },
  );

  const resultsArrays = await Promise.all(fetchPromises);
  return resultsArrays.flat();
}

export function indexRecords(
  records: RecordTableWithoutIndexedAt[],
  indexService: IndexService,
) {
  for (const record of records) {
    indexService.insertRecord({
      uri: record.uri,
      cid: record.cid.toString(),
      did: record.did,
      collection: record.collection,
      json: record.json,
      indexedAt: new Date().toISOString(),
    });
  }
}

export function indexActors(
  repos: string[],
  atpMap: Map<string, AtprotoData>,
  indexService: IndexService,
) {
  for (const repo of repos) {
    const atpData = atpMap.get(repo);
    if (!atpData) continue;
    indexService.insertActor({
      did: repo,
      handle: atpData.handle,
      indexedAt: new Date().toISOString(),
    });
  }
}

export function backfillUris(
  indexService: IndexService,
  cfg: BffConfig,
): (uris: string[]) => Promise<void> {
  return async (uris: string[]) => {
    const repos = uris.map((uri) => new AtUri(uri).hostname);
    const atpMap = await getAtpMapForRepos(repos, cfg);
    const records = await getRecordsForUris(uris, atpMap, indexService);
    indexActors(repos, atpMap, indexService);
    indexRecords(records, indexService);
  };
}

export function backfillCollections(
  indexService: IndexService,
  cfg: BffConfig,
): (
  params: {
    collections?: string[];
    externalCollections?: string[];
    repos?: string[];
  },
) => Promise<void> {
  return async (
    { collections, externalCollections, repos }: {
      collections?: string[];
      externalCollections?: string[];
      repos?: string[];
    },
  ) => {
    const originalConsoleError = console.error;

    // append error logging to a file
    console.error = (...args: unknown[]) => {
      const message = `[ERROR] ${new Date().toISOString()} ${
        args.map(String).join(" ")
      }\n`;

      try {
        Deno.writeTextFileSync("./sync.log", message, { append: true });
      } catch (e) {
        originalConsoleError("Failed to write to error log:", e);
      }
    };

    console.log();
    console.log("🔄 Starting backfill operation");

    if (!collections || collections.length === 0) {
      console.log("⚠️ No collections specified for backfill");
    } else {
      console.log(
        `📚 Processing ${collections.length} collections: ${
          collections.join(", ")
        }`,
      );
    }

    if (externalCollections && externalCollections.length > 0) {
      console.log(
        `🌐 Including ${externalCollections.length} external collections: ${
          externalCollections.join(", ")
        }`,
      );
    }

    const agent = new Agent("https://relay1.us-west.bsky.network");

    let allRepos: string[] = [];
    if (repos && repos.length > 0) {
      console.log(`📋 Using ${repos.length} provided repositories`);
      allRepos = repos;
    } else {
      // Fetch repos for all collections concurrently
      console.log("📊 Fetching repositories for collections...");
      const collectionResults = await Promise.all(
        (collections || []).map(async (collection) => {
          const response = await agent.com.atproto.sync.listReposByCollection({
            collection,
          });
          console.log(
            `✓ Found ${response.data.repos.length} repositories for collection "${collection}"`,
          );
          return {
            collection,
            repos: response.data.repos.map((repo) => repo.did),
          };
        }),
      );

      // Aggregate unique repos across all collections
      allRepos = [
        ...new Set(collectionResults.flatMap((result) => result.repos)),
      ];
      console.log(`📋 Processing ${allRepos.length} unique repositories`);
    }

    // Get ATP data for all repos at once
    console.log("🔍 Resolving ATP data for repositories...");
    const atpMap = await getAtpMapForRepos(allRepos, cfg);
    console.log(
      `✓ Resolved ATP data for ${atpMap.size}/${allRepos.length} repositories`,
    );

    // Get all records for all repos and collections at once
    console.log("📥 Fetching records for repositories and collections...");
    let totalRecords = 0;

    const records = await getRecordsForRepos(
      allRepos,
      (collections || []).concat(externalCollections || []),
      atpMap,
    );
    totalRecords = records.length;
    console.log(`✓ Fetched ${totalRecords} total records`);

    // Index the actors and records
    console.log("📝 Indexing actors...");
    indexActors(allRepos, atpMap, indexService);
    console.log(`✓ Indexed ${allRepos.length} actors`);

    console.log(`📝 Indexing ${totalRecords} records...`);
    indexRecords(records, indexService);
    console.log("✅ Backfill complete!");
  };
}

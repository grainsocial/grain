import { Agent } from "@atproto/api";
import type { AtprotoData, DidResolver } from "@atproto/identity";
import { TtlCache } from "@std/cache";
import Labeler from "../clients/labeler.ts";
import type { BffConfig, LabelerPolicies } from "../types.d.ts";
import type { IndexService } from "./indexing.ts";

export function getLabelerDefinitions(
  didResolver: DidResolver,
  cfg: BffConfig,
) {
  const cache = new TtlCache<string, Record<string, LabelerPolicies>>(
    6 * 60 * 60 * 1000,
  ); // 6 hours TTL

  return async (): Promise<Record<string, LabelerPolicies>> => {
    if (cfg.appLabelerCollection === undefined) {
      throw new Error("App labeler collection is not defined");
    }

    if (!cfg.appLabelers) {
      throw new Error("App labelers are not defined");
    }

    const cacheKey = "definitions";
    const cached = cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const definitionsByDid: Record<string, LabelerPolicies> = {};

    for (const did of cfg.appLabelers) {
      let atpData: AtprotoData | undefined;
      try {
        atpData = await didResolver.resolveAtprotoData(did);
      } catch (error) {
        console.error(`Failed to resolve Atproto data for ${did}`, error);
        continue;
      }

      const agent = new Agent(new URL(atpData.pds));

      try {
        const response = await agent.com.atproto.repo.getRecord({
          collection: cfg.appLabelerCollection,
          rkey: "self",
          repo: did,
        });
        const policies = response.data?.value?.policies ??
          { labelValues: [], labelValueDefinitions: [] };
        definitionsByDid[did] = policies as LabelerPolicies;
      } catch (error) {
        console.error("Error fetching labeler definitions:", error);
        // continue to next labeler
      }
    }

    cache.set(cacheKey, definitionsByDid);
    return definitionsByDid;
  };
}

export async function createLabelerSubscriptions(
  didResolver: DidResolver,
  indexService: IndexService,
  cfg: BffConfig,
) {
  const labelerMap = new Map<string, Labeler>();
  for (const did of cfg.appLabelers || []) {
    const doc = await didResolver.resolve(did);
    const modServiceEndpoint = doc?.service?.find((s) =>
      s.type === "AtprotoLabeler"
    )?.serviceEndpoint;

    if (typeof modServiceEndpoint !== "string") {
      console.warn(`No AtprotoLabeler service found for DID: ${did}`);
      continue;
    }

    const wsUrl = modServiceEndpoint.replace(/^https:\/\//, "wss://");

    let isFirstEvent = true;

    const labeler = new Labeler({
      instanceUrl: wsUrl,
      handleEvent: (event) => {
        // On the first event, clear the cache (assuming full backfill)
        if (isFirstEvent) {
          try {
            indexService.clearLabels();
          } catch (error) {
            console.error("Error clearing labels cache:", error);
          }
          isFirstEvent = false;
        }
        // @TODO: validate label
        if (event.labels && event.labels.length > 0) {
          for (const label of event.labels) {
            try {
              indexService.insertLabel(label);
            } catch (error) {
              console.error("Error inserting label:", error);
            }
          }
        }
      },
    });
    labelerMap.set(did, labeler);
  }
  return labelerMap;
}

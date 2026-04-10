import { callXrpc } from "$hatk/client";
import type { QueryClient } from "@tanstack/svelte-query";
import { get } from "svelte/store";
import { viewer as viewerStore } from "$lib/stores";

function invalidateFeedsAndProfile(did: string, queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: ["actorProfile", did] });
  queryClient.invalidateQueries({ queryKey: ["getFeed"] });
  queryClient.invalidateQueries({ queryKey: ["storyAuthors"] });
  queryClient.invalidateQueries({ queryKey: ["notifications"] });
}

export async function blockActor(did: string, queryClient: QueryClient) {
  if (get(viewerStore)?.did === did) return;
  await callXrpc("dev.hatk.createRecord", {
    collection: "social.grain.graph.block",
    record: { subject: did, createdAt: new Date().toISOString() },
  });
  invalidateFeedsAndProfile(did, queryClient);
  queryClient.invalidateQueries({ queryKey: ["blocks"] });
}

export async function unblockActor(
  did: string,
  blockUri: string,
  queryClient: QueryClient,
) {
  const rkey = blockUri.split("/").pop()!;
  await callXrpc("dev.hatk.deleteRecord", {
    collection: "social.grain.graph.block",
    rkey,
  });
  invalidateFeedsAndProfile(did, queryClient);
  queryClient.invalidateQueries({ queryKey: ["blocks"] });
}

export async function muteActor(did: string, queryClient: QueryClient) {
  await callXrpc("social.grain.graph.muteActor", { actor: did });
  invalidateFeedsAndProfile(did, queryClient);
  queryClient.invalidateQueries({ queryKey: ["mutes"] });
}

export async function unmuteActor(did: string, queryClient: QueryClient) {
  await callXrpc("social.grain.graph.unmuteActor", { actor: did });
  invalidateFeedsAndProfile(did, queryClient);
  queryClient.invalidateQueries({ queryKey: ["mutes"] });
}

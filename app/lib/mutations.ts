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

export async function unblockActor(did: string, blockUri: string, queryClient: QueryClient) {
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

// ─── Groups ─────────────────────────────────────────────────────────
//
// Two records, two repos. A submission is the member's (their repo, public);
// an item is the group's (written while signed in as it). Nothing here talks
// to the group host — the host is where the group is *run*, Grain is
// where it lives.

function invalidateGroups(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: ["groups"] });
  queryClient.invalidateQueries({ queryKey: ["group"] });
  queryClient.invalidateQueries({ queryKey: ["groupSubmissions"] });
  queryClient.invalidateQueries({ queryKey: ["getFeed"] });
}

export async function submitToGroup(group: string, gallery: string, queryClient: QueryClient) {
  await callXrpc("dev.hatk.createRecord", {
    collection: "social.grain.group.submission",
    record: { group, gallery, createdAt: new Date().toISOString() },
  });
  invalidateGroups(queryClient);
}

export async function withdrawSubmission(submissionUri: string, queryClient: QueryClient) {
  const rkey = submissionUri.split("/").pop()!;
  await callXrpc("dev.hatk.deleteRecord", { collection: "social.grain.group.submission", rkey });
  invalidateGroups(queryClient);
}

/** Accept = write one item into the group's repo. Only works signed in as the group. */
export async function acceptSubmission(
  gallery: string,
  submissionUri: string,
  queryClient: QueryClient,
) {
  await callXrpc("dev.hatk.createRecord", {
    collection: "social.grain.group.item",
    record: { gallery, submission: submissionUri, createdAt: new Date().toISOString() },
  });
  invalidateGroups(queryClient);
}

export async function removeFromPool(itemUri: string, queryClient: QueryClient) {
  const rkey = itemUri.split("/").pop()!;
  await callXrpc("dev.hatk.deleteRecord", { collection: "social.grain.group.item", rkey });
  invalidateGroups(queryClient);
}

/**
 * Take your own gallery back out of a pool.
 *
 * Distinct from `removeFromPool`, which deletes the group's item record and is
 * the group's act. This deletes the author's own records from the group's
 * space — their gallery, its photos, the items joining them — and can only ever
 * reach their own repo.
 */
export async function withdrawFromPool(group: string, rkey: string, queryClient: QueryClient) {
  await callXrpc("social.grain.unspecced.deletePoolGallery", { group, rkey });
  invalidateGroups(queryClient);
}

/** Decline = the group's "no", as its own record. The submission stays the member's. */
export async function declineSubmission(
  gallery: string,
  submissionUri: string,
  queryClient: QueryClient,
) {
  await callXrpc("dev.hatk.createRecord", {
    collection: "social.grain.group.decline",
    record: { gallery, submission: submissionUri, createdAt: new Date().toISOString() },
  });
  invalidateGroups(queryClient);
}

export async function joinGroup(
  group: string,
  queryClient: QueryClient,
): Promise<"admitted" | "pending"> {
  const r = await callXrpc("social.grain.unspecced.joinGroup", { group });
  invalidateGroups(queryClient);
  return r.status === "admitted" ? "admitted" : "pending";
}

export async function leaveGroup(group: string, queryClient: QueryClient) {
  await callXrpc("social.grain.unspecced.leaveGroup", { group });
  invalidateGroups(queryClient);
}

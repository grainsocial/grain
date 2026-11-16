import { createRecord, deleteRecord } from "$lib/utils/records";
import type { DidString } from "@atproto/lex";
import { call } from "$lib/xrpc";
import type * as muteActorMethod from "$lib/lexicons/social/grain/graph/muteActor.ts";
import type * as unmuteActorMethod from "$lib/lexicons/social/grain/graph/unmuteActor.ts";
import type * as groupCreateGroup from "$lib/lexicons/social/grain/group/createGroup.ts";
import type * as groupJoinGroup from "$lib/lexicons/social/grain/group/joinGroup.ts";
import type * as groupLeaveGroup from "$lib/lexicons/social/grain/group/leaveGroup.ts";
import type * as groupDeleteGallery from "$lib/lexicons/social/grain/group/deleteGallery.ts";
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
  await createRecord({
    collection: "social.grain.graph.block",
    record: { subject: did, createdAt: new Date().toISOString() },
  });
  invalidateFeedsAndProfile(did, queryClient);
  queryClient.invalidateQueries({ queryKey: ["blocks"] });
}

export async function unblockActor(did: string, blockUri: string, queryClient: QueryClient) {
  const rkey = blockUri.split("/").pop()!;
  await deleteRecord({
    collection: "social.grain.graph.block",
    rkey,
  });
  invalidateFeedsAndProfile(did, queryClient);
  queryClient.invalidateQueries({ queryKey: ["blocks"] });
}

export async function muteActor(did: string, queryClient: QueryClient) {
  await call<typeof muteActorMethod.main>("social.grain.graph.muteActor", {
    actor: did as DidString,
  });
  invalidateFeedsAndProfile(did, queryClient);
  queryClient.invalidateQueries({ queryKey: ["mutes"] });
}

export async function unmuteActor(did: string, queryClient: QueryClient) {
  await call<typeof unmuteActorMethod.main>("social.grain.graph.unmuteActor", {
    actor: did as DidString,
  });
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
  await createRecord({
    collection: "social.grain.group.submission",
    record: { group, gallery, createdAt: new Date().toISOString() },
  });
  invalidateGroups(queryClient);
}

export async function withdrawSubmission(submissionUri: string, queryClient: QueryClient) {
  const rkey = submissionUri.split("/").pop()!;
  await deleteRecord({ collection: "social.grain.group.submission", rkey });
  invalidateGroups(queryClient);
}

/** Accept = write one item into the group's repo. Only works signed in as the group. */
export async function acceptSubmission(
  gallery: string,
  submissionUri: string,
  queryClient: QueryClient,
) {
  await createRecord({
    collection: "social.grain.group.item",
    record: { gallery, submission: submissionUri, createdAt: new Date().toISOString() },
  });
  invalidateGroups(queryClient);
}

export async function removeFromPool(itemUri: string, queryClient: QueryClient) {
  const rkey = itemUri.split("/").pop()!;
  await deleteRecord({ collection: "social.grain.group.item", rkey });
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
  await call<typeof groupDeleteGallery.main>("social.grain.group.deleteGallery", {
    group: group as DidString,
    rkey,
  });
  invalidateGroups(queryClient);
}

/** Decline = the group's "no", as its own record. The submission stays the member's. */
export async function declineSubmission(
  gallery: string,
  submissionUri: string,
  queryClient: QueryClient,
) {
  await createRecord({
    collection: "social.grain.group.decline",
    record: { gallery, submission: submissionUri, createdAt: new Date().toISOString() },
  });
  invalidateGroups(queryClient);
}

export async function joinGroup(
  group: string,
  queryClient: QueryClient,
): Promise<"admitted" | "pending"> {
  const r = await call<typeof groupJoinGroup.main>("social.grain.group.joinGroup", {
    group: group as DidString,
  });
  invalidateGroups(queryClient);
  return r.status === "admitted" ? "admitted" : "pending";
}

export async function createGroup(
  input: { name: string; displayName: string; description?: string },
  queryClient: QueryClient,
): Promise<{ did: string; handle: string }> {
  const r = await call<typeof groupCreateGroup.main>("social.grain.group.createGroup", input);
  invalidateGroups(queryClient);
  return r;
}

export async function leaveGroup(group: string, queryClient: QueryClient) {
  await call<typeof groupLeaveGroup.main>("social.grain.group.leaveGroup", {
    group: group as DidString,
  });
  invalidateGroups(queryClient);
}

import type { AtUriString, LexMap, NsidString, RecordKeyString } from "@atproto/lex";
import { call, query, upload } from "$lib/xrpc";
import type * as applyWritesMethod from "$lib/lexicons/social/grain/repo/applyWrites.ts";
import type * as createRecordMethod from "$lib/lexicons/social/grain/repo/createRecord.ts";
import type * as deleteRecordMethod from "$lib/lexicons/social/grain/repo/deleteRecord.ts";
import type * as putRecordMethod from "$lib/lexicons/social/grain/repo/putRecord.ts";
import type * as uploadBlobMethod from "$lib/lexicons/social/grain/repo/uploadBlob.ts";
import type * as getGallery from "$lib/lexicons/social/grain/gallery/getGallery.ts";
import { nextTid } from "./tid.ts";

/** One `social.grain.repo.applyWrites#create` entry with a client-minted rkey. */
export interface CreateWrite {
  $type: "social.grain.repo.applyWrites#create";
  collection: string;
  rkey: string;
  value: Record<string, unknown>;
}

/** One `social.grain.repo.applyWrites#update` entry. The record must already exist. */
export interface UpdateWrite {
  $type: "social.grain.repo.applyWrites#update";
  collection: string;
  rkey: string;
  value: Record<string, unknown>;
}

export interface DeleteWrite {
  $type: "social.grain.repo.applyWrites#delete";
  collection: string;
  rkey: string;
}

export type Write = CreateWrite | UpdateWrite | DeleteWrite;

export function createWrite(
  collection: string,
  rkey: string,
  value: Record<string, unknown>,
): CreateWrite {
  return { $type: "social.grain.repo.applyWrites#create", collection, rkey, value };
}

export function updateWrite(
  collection: string,
  rkey: string,
  value: Record<string, unknown>,
): UpdateWrite {
  return { $type: "social.grain.repo.applyWrites#update", collection, rkey, value };
}

export function deleteWrite(collection: string, rkey: string): DeleteWrite {
  return { $type: "social.grain.repo.applyWrites#delete", collection, rkey };
}

export function atUri(did: string, collection: string, rkey: string): string {
  return `at://${did}/${collection}/${rkey}`;
}

export function rkeyOf(uri: string): string {
  return uri.split("/").pop()!;
}

/**
 * Send every write in a single atomic PDS transaction.
 *
 * One request instead of one per record: a 10-photo gallery used to be ~31
 * sequential `createRecord` calls, each its own signed repo commit and firehose
 * event, which is where the minute-plus publish time came from. It also means a
 * failure can no longer leave a half-written gallery behind.
 */
export async function applyWrites(writes: Write[]): Promise<void> {
  if (writes.length === 0) return;
  await call<typeof applyWritesMethod.main>("social.grain.repo.applyWrites", {
    writes,
  } as never);
}

/** True if the gallery is already in the index. Any failure reads as "no". */
export async function galleryExists(galleryUri: string): Promise<boolean> {
  try {
    const res = await query<typeof getGallery.main>("social.grain.gallery.getGallery", {
      gallery: galleryUri as AtUriString,
    });
    return !!(res as { gallery?: unknown })?.gallery;
  } catch {
    return false;
  }
}

/** Run `fn` over `items`, at most `limit` at a time, preserving input order. */
export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await fn(items[index], index);
    }
  });
  await Promise.all(workers);
  return results;
}

/**
 * Blobs can't ride along in applyWrites — the PDS takes raw bytes — so they
 * stay one request each. Overlapping a few keeps a full gallery from being a
 * long chain of serial uploads, while staying gentle enough on a phone's
 * connection and memory.
 */
const UPLOAD_CONCURRENCY = 3;

export function dataUrlToBlob(dataUrl: string): Blob {
  const base64 = dataUrl.split(",")[1];
  const binary = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  return new Blob([binary], { type: "image/jpeg" });
}

/** Upload each data URL as a blob and return the blob refs in input order. */
export async function uploadPhotoBlobs(dataUrls: string[]): Promise<unknown[]> {
  return mapWithConcurrency(dataUrls, UPLOAD_CONCURRENCY, async (dataUrl) => {
    return (await uploadBlob(dataUrlToBlob(dataUrl))).blob;
  });
}

// The logged-in account's writes, each to its PDS through grain-serve, which
// indexes it before answering. Each takes what `com.atproto.repo`'s method of
// its name takes, less the `repo`.

/** What a write names: a collection grain indexes, and a record key in it. */
interface Named {
  collection: string;
  rkey?: string;
}

/** Writes `record` to a new key (`rkey`, or one the PDS mints). */
export function createRecord(input: Named & { record: Record<string, unknown> }) {
  return call<typeof createRecordMethod.main>("social.grain.repo.createRecord", {
    collection: input.collection as NsidString,
    rkey: input.rkey as RecordKeyString | undefined,
    record: input.record as LexMap,
  });
}

/** Writes `record` at `rkey`, over what is there. */
export function putRecord(input: Named & { rkey: string; record: Record<string, unknown> }) {
  return call<typeof putRecordMethod.main>("social.grain.repo.putRecord", {
    collection: input.collection as NsidString,
    rkey: input.rkey as RecordKeyString,
    record: input.record as LexMap,
  });
}

/** Deletes the record at `rkey`. */
export function deleteRecord(input: Named & { rkey: string }) {
  return call<typeof deleteRecordMethod.main>("social.grain.repo.deleteRecord", {
    collection: input.collection as NsidString,
    rkey: input.rkey as RecordKeyString,
  });
}

/** Uploads `blob` to the account's PDS: its ref, for a record to hold. */
export function uploadBlob(blob: Blob) {
  return upload<typeof uploadBlobMethod.main>("social.grain.repo.uploadBlob", blob);
}

/** Mint a fresh record key. Re-exported so callers only import from one place. */
export { nextTid };

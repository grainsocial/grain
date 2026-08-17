import { callXrpc } from "$hatk/client";
import { nextTid } from "./tid.ts";

/** One `dev.hatk.applyWrites#create` entry with a client-minted rkey. */
export interface CreateWrite {
  $type: "dev.hatk.applyWrites#create";
  collection: string;
  rkey: string;
  value: Record<string, unknown>;
}

/** One `dev.hatk.applyWrites#update` entry. The record must already exist. */
export interface UpdateWrite {
  $type: "dev.hatk.applyWrites#update";
  collection: string;
  rkey: string;
  value: Record<string, unknown>;
}

export interface DeleteWrite {
  $type: "dev.hatk.applyWrites#delete";
  collection: string;
  rkey: string;
}

export type Write = CreateWrite | UpdateWrite | DeleteWrite;

export function createWrite(
  collection: string,
  rkey: string,
  value: Record<string, unknown>,
): CreateWrite {
  return { $type: "dev.hatk.applyWrites#create", collection, rkey, value };
}

export function updateWrite(
  collection: string,
  rkey: string,
  value: Record<string, unknown>,
): UpdateWrite {
  return { $type: "dev.hatk.applyWrites#update", collection, rkey, value };
}

export function deleteWrite(collection: string, rkey: string): DeleteWrite {
  return { $type: "dev.hatk.applyWrites#delete", collection, rkey };
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
  await callXrpc("dev.hatk.applyWrites", { writes } as never);
}

/** True if the gallery is already in the index. Any failure reads as "no". */
export async function galleryExists(galleryUri: string): Promise<boolean> {
  try {
    const res = await callXrpc("social.grain.unspecced.getGallery", { gallery: galleryUri });
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
    const result = await callXrpc("dev.hatk.uploadBlob", dataUrlToBlob(dataUrl) as never);
    return (result as { blob: unknown }).blob;
  });
}

/** Mint a fresh record key. Re-exported so callers only import from one place. */
export { nextTid };

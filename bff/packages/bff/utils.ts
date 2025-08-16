import { BlobRef } from "@atproto/lexicon";
import { CID } from "multiformats/cid";

interface BlobLike {
  $type: string;
  ref: {
    "$link": string;
  };
  mimeType: string;
  size: number;
}

function isBlobLike(obj: unknown): obj is BlobLike {
  return (
    obj !== null &&
    typeof obj === "object" &&
    "$type" in obj &&
    (obj as BlobLike).$type === "blob" &&
    "ref" in obj &&
    typeof (obj as BlobLike).ref === "object" &&
    "$link" in (obj as BlobLike).ref &&
    "mimeType" in obj &&
    "size" in obj
  );
}

export function hydrateBlobRefs<T>(obj: T): T {
  if (obj === null || typeof obj !== "object") {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => hydrateBlobRefs(item)) as unknown as T;
  }

  if (isBlobLike(obj)) {
    return new BlobRef(
      // @ts-ignore @TODO: fix this?. BlobRef.asBlobRef() is returning null for some reason
      CID.parse(obj.ref["$link"]),
      obj.mimeType,
      obj.size,
    ) as unknown as T;
  }

  const result = {} as T;
  for (const key in obj) {
    if (Object.hasOwn(obj, key)) {
      const value = obj[key];
      result[key] = hydrateBlobRefs(value);
    }
  }

  return result;
}

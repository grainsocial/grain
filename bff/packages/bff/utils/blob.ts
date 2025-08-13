import type { BlobRef } from "@atproto/lexicon";
import type { ATProtoSession } from "../aip/atproto-session.ts";
import { makeDPoPRequest } from "../services/pds.ts";
import { hydrateBlobRefs } from "../utils.ts";

/**
 * Upload a blob using DPoP authentication
 */
function makeBlobUploadRequest(
  session: ATProtoSession,
  data: File | Uint8Array,
  contentType?: string,
): Promise<Response> {
  const headers: Record<string, string> = {};

  if (data instanceof File) {
    headers["Content-Type"] = data.type || "application/octet-stream";
    if (data.size) {
      headers["Content-Length"] = data.size.toString();
    }
  } else {
    headers["Content-Type"] = contentType || "application/octet-stream";
    headers["Content-Length"] = data.length.toString();
  }

  return makeDPoPRequest(
    session,
    "POST",
    "/xrpc/com.atproto.repo.uploadBlob",
    data,
    headers,
  );
}

export function uploadBlob(
  getSession: () => Promise<ATProtoSession>,
) {
  return async (
    data: File | Uint8Array,
    contentType?: string,
  ): Promise<BlobRef> => {
    try {
      const session = await getSession();
      const response = await makeBlobUploadRequest(session, data, contentType);
      const responseData = await response.json();
      return hydrateBlobRefs(responseData.blob);
    } catch (error) {
      console.error("Error uploading blob:", error);
      throw new Error(`Failed to upload blob: ${error}`);
    }
  };
}

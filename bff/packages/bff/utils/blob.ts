import type { BlobRef } from "@atproto/lexicon";
import type { ATProtoSession } from "../aip/atproto-session.ts";
import { makeDPoPRequest } from "../services/pds.ts";
import { hydrateBlobRefs } from "../utils.ts";

/**
 * Upload a blob using DPoP authentication
 */
function makeBlobUploadRequest(
  session: ATProtoSession,
  file: File,
): Promise<Response> {
  const headers: Record<string, string> = {
    "Content-Type": file.type || "application/octet-stream",
  };

  // Add Content-Length if available
  if (file.size) {
    headers["Content-Length"] = file.size.toString();
  }

  return makeDPoPRequest(
    session,
    "POST",
    "/xrpc/com.atproto.repo.uploadBlob",
    file,
    headers,
  );
}

export function uploadBlob(
  getSession: () => Promise<ATProtoSession>,
) {
  return async (file: File): Promise<BlobRef> => {
    try {
      const session = await getSession();
      const response = await makeBlobUploadRequest(session, file);
      const responseData = await response.json();
      return hydrateBlobRefs(responseData.blob);
    } catch (error) {
      console.error("Error uploading blob:", error);
      throw new Error(`Failed to upload blob: ${error}`);
    }
  };
}

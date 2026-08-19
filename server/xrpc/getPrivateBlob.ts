// Serve a photo that lives in a permissioned space.
//   GET /xrpc/social.grain.unspecced.getPrivateBlob?space=&did=&cid=
//
// Every other image in grain is served by the CDN. These cannot be: the space
// hands over a blob only to a holder of a credential bound to a key, and the CDN
// is an unauthenticated cache keyed by a public URL — putting a private photo
// behind one would turn its URL into the capability the credential exists to
// replace.
//
// So the bytes come through here, on the viewer's behalf, and go no further:
// `private, no-store` keeps them out of every shared cache between us and the
// browser.

import { defineQuery, InvalidRequestError } from "$hatk";
import { fetchSpaceBlob } from "../spaces/client.ts";
import { throwSpaceError } from "../spaces/errors.ts";

/** What we are willing to hand back, whatever the repo claims it is. */
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif", "image/gif"];

export default defineQuery("social.grain.unspecced.getPrivateBlob", async (ctx) => {
  const { db, viewer, pds, params } = ctx;
  if (!viewer) throw new InvalidRequestError("Authentication required");

  const { space, did, cid } = params;

  let upstream: Response;
  try {
    upstream = await fetchSpaceBlob(pds, viewer.did, space, did, cid);
  } catch (err) {
    return throwSpaceError(err, db, viewer.did);
  }

  // A repo we do not control names the type. Serving it back unchecked would let
  // that repo choose what the browser executes in grain's origin.
  const upstreamType = (upstream.headers.get("content-type") ?? "").split(";")[0].trim();
  const contentType = ALLOWED_TYPES.includes(upstreamType)
    ? upstreamType
    : "application/octet-stream";

  return new Response(upstream.body, {
    status: 200,
    headers: {
      "content-type": contentType,
      "cache-control": "private, no-store",
      "content-security-policy": "default-src 'none'; sandbox",
      "x-content-type-options": "nosniff",
      "content-disposition": "inline",
    },
  });
});

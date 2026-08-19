// Turning a failed space read into something a reader can act on.
//
// Three very different problems reach a handler as an exception, and until this
// existed only one of them was translated — the rest surfaced as a 500, which
// told a reader nothing and made "the author never added me", "sign in again"
// and "your server cannot do this" look identical.

import { InvalidRequestError } from "$hatk";
import { getSpaceSupport, pdsEndpointFor } from "../helpers/spaceSupport.ts";
import { SpaceError } from "./client.ts";

type Db = {
  query: (sql: string, params?: unknown[]) => Promise<unknown[]>;
  run: (sql: string, params?: unknown[]) => Promise<void>;
};

/** The status a thrown error carries, whether it is ours or hatk's ProxyError. */
function statusOf(err: unknown): number | null {
  const status = (err as { status?: unknown })?.status;
  return typeof status === "number" ? status : null;
}

/**
 * Rethrow a space failure as the closest thing to an explanation.
 *
 * Never returns — it either throws an InvalidRequestError naming the problem or
 * rethrows what it was given.
 */
export async function throwSpaceError(err: unknown, db: Db, viewerDid: string): Promise<never> {
  const status = statusOf(err);

  // No session to trade for a credential. hatk drops the PDS session when a
  // scope is refused, so this is what a reader hits on the request after the
  // one that told them to authorize again — the browser still holds a viewer
  // cookie, and nothing behind it works.
  if (status === 401) {
    throw new InvalidRequestError("Sign in again to open this gallery", "SessionExpired");
  }

  // A PDS with no permissioned data answers the very first call — a delegation
  // token from the reader's own server — with a 404 for a method it does not
  // serve. Indistinguishable from "no such space" by status alone, so ask.
  if (status === 403 || status === 404) {
    const endpoint = await pdsEndpointFor(db, viewerDid);
    if (endpoint) {
      const support = await getSpaceSupport(db, endpoint);
      if (!support.supported) {
        throw new InvalidRequestError(
          "Your PDS does not serve permissioned spaces, so it cannot open a private gallery",
          "SpacesUnsupported",
        );
      }
    }
    throw new InvalidRequestError("Not a member of this space", "NotAuthorized");
  }

  // A repo host that cannot be reached or resolved is a failure of ours to
  // report, not of the reader to fix.
  if (err instanceof SpaceError) {
    throw new InvalidRequestError("Could not reach the gallery's host", "UpstreamFailed");
  }

  throw err;
}

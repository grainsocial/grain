import { fetchATProtoSession } from "./atproto-session.ts";
import { requireToken } from "./token-auth.ts";
import type { BffContext } from "../types.d.ts";

export function createRequireTokenHelper(ctx: BffContext) {
  return function(req: Request) {
    return requireToken(req, ctx);
  };
}

export function createGetATProtoSessionHelper() {
  return function(req: Request) {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw new Error("No access token available for ATProto session");
    }
    const accessToken = authHeader.substring(7);
    return fetchATProtoSession(accessToken);
  };
}
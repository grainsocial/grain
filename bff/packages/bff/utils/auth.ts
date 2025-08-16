import type { ActorTable, BffContext } from "../types.d.ts";
import { UnauthorizedError } from "./errors.ts";

export function requireAuth(ctx: BffContext): ActorTable {
  if (!ctx.currentUser) {
    throw new UnauthorizedError("User not authenticated", ctx);
  }
  return ctx.currentUser;
}

import type { ActorTable, BffContext } from "../types.d.ts";
import { UnauthorizedError } from "../utils/errors.ts";

/**
 * Validates Bearer token and returns authenticated user for API endpoints
 * Throws UnauthorizedError if token is invalid or user not found
 */
export async function requireToken(
  req: Request,
  ctx: BffContext,
): Promise<ActorTable> {
  const authHeader = req.headers.get("Authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new UnauthorizedError(
      "Missing or invalid Authorization header. Expected: Bearer <token>",
      ctx,
    );
  }

  const token = authHeader.substring(7);

  // Validate token with AIP
  const aipBaseUrl = Deno.env.get("AIP_BASE_URL") || "http://localhost:8081";

  try {
    // Validate token by calling AIP session endpoint
    const sessionResponse = await fetch(
      `${aipBaseUrl}/api/atprotocol/session`,
      {
        headers: {
          "Authorization": `Bearer ${token}`,
        },
      },
    );
    console.log(
      "Session response:",
      sessionResponse.status,
      sessionResponse.statusText,
    );

    if (!sessionResponse.ok) {
      throw new UnauthorizedError("Invalid or expired token", ctx);
    }

    const sessionData = await sessionResponse.json();
    const userDid = sessionData.did;

    // Get actor data from database
    const actor = ctx.indexService.getActor(userDid);
    if (!actor) {
      throw new UnauthorizedError("User not found in system", ctx);
    }

    // Set currentUser in context (same as regular auth)
    ctx.currentUser = actor;

    return actor;
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      throw error;
    }

    console.error("❌ Token validation error:", error);
    throw new UnauthorizedError("Token validation failed", ctx);
  }
}

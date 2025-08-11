import type { BffMiddleware, Database } from "../types.d.ts";
import { AipSessionStore } from "./session-store.ts";
import { getValidAipSession } from "./token-refresh.ts";

// Global session store - will be initialized when middleware is used
let sessionStore: AipSessionStore;

export const aipAuthMiddleware: BffMiddleware = async (req, ctx) => {
  // Initialize session store if not already done
  if (!sessionStore) {
    sessionStore = new AipSessionStore(ctx.db);
  }

  const sessionId = getSessionId(req);
  if (sessionId) {
    // Get valid session (will refresh if needed)
    const session = await getValidAipSession(sessionId, sessionStore);

    if (session) {
      // Get actor data from database using indexService
      const actor = ctx.indexService.getActor(session.did);
      if (actor) {
        ctx.currentUser = actor;
      }
      // If actor not found, don't set currentUser (they've been deleted)

      return await ctx.next();
    }
    // If session is null, it was invalid/expired and already cleaned up
  }

  // No valid session - continue without authentication
  return await ctx.next();
};

export const requireAipAuthMiddleware: BffMiddleware = async (req, ctx) => {
  if (!ctx.currentUser) {
    const url = new URL(req.url);
    return redirectToLogin(req, url.pathname);
  }
  return await ctx.next();
};

// API Authentication middleware for mobile apps and API clients
// Validates Bearer tokens with AIP directly
export const aipApiAuthMiddleware: BffMiddleware = async (req, ctx) => {
  const authHeader = req.headers.get("Authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return new Response(
      JSON.stringify({
        error: "unauthorized",
        message:
          "Missing or invalid Authorization header. Expected: Bearer <token>",
      }),
      {
        status: 401,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  const token = authHeader.substring(7);

  // Validate token with AIP
  const aipBaseUrl = Deno.env.get("AIP_BASE_URL") || "http://localhost:8081";

  try {
    console.log(`🔍 Validating API token with AIP`);

    // Simple token validation - just check if token exists and get user info
    // We'll use a simpler AIP endpoint or validate directly with token introspection
    let userDid: string;

    // For now, we'll do a simple validation by making any authenticated call to AIP
    // If it succeeds, we know the token is valid
    try {
      const testResponse = await fetch(`${aipBaseUrl}/api/atprotocol/session`, {
        headers: {
          "Authorization": `Bearer ${token}`,
        },
      });

      if (!testResponse.ok) {
        return new Response(
          JSON.stringify({
            error: "invalid_token",
            message: "Token validation failed with AIP",
          }),
          {
            status: 401,
            headers: { "Content-Type": "application/json" },
          },
        );
      }

      const sessionData = await testResponse.json();
      userDid = sessionData.did;
      console.log(sessionData);
      console.log(`✅ Token validated for DID: ${userDid}`);
    } catch (error) {
      console.error("❌ Token validation error:", error);
      return new Response(
        JSON.stringify({
          error: "authentication_failed",
          message: "Unable to validate token with AIP",
          details: error instanceof Error ? error.message : String(error),
        }),
        {
          status: 401,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    // Get actor data from database using indexService
    const actor = ctx.indexService.getActor(userDid);
    if (actor) {
      ctx.currentUser = actor;

      return await ctx.next();
    } else {
      // Actor not found in database (deleted user)
      return new Response(
        JSON.stringify({
          error: "user_not_found",
          message: "User not found in system",
        }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        },
      );
    }
  } catch (error) {
    console.error("❌ Authentication error:", error);
    return new Response(
      JSON.stringify({
        error: "authentication_failed",
        message: "Unable to validate token with authentication server",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
};

function getSessionId(req: Request): string | null {
  const cookieHeader = req.headers.get("Cookie");
  if (!cookieHeader) return null;

  const cookies = parseCookies(cookieHeader);
  return cookies.sessionId || null;
}

function parseCookies(cookieHeader: string): Record<string, string> {
  const cookies: Record<string, string> = {};
  cookieHeader.split(";").forEach((cookie) => {
    const [name, value] = cookie.trim().split("=");
    if (name && value) {
      cookies[name] = decodeURIComponent(value);
    }
  });
  return cookies;
}

function redirectToLogin(req: Request, returnUrl?: string): Response {
  const loginUrl = new URL("/oauth/login", req.url);
  if (returnUrl && returnUrl !== "/") {
    loginUrl.searchParams.set("returnUrl", returnUrl);
  }

  return new Response(null, {
    status: 302,
    headers: {
      "Location": loginUrl.toString(),
    },
  });
}

export function createUserSession(
  did: string,
  handle: string,
  accessToken: string,
  refreshToken: string,
  expiresIn: number = 86400,
  db: Database,
): string {
  if (!sessionStore) {
    sessionStore = new AipSessionStore(db);
  }

  return sessionStore.createSession(
    did,
    handle,
    accessToken,
    refreshToken,
    expiresIn,
  );
}

export function setSessionCookie(
  sessionId: string,
  maxAge: number = 86400,
): string {
  return `sessionId=${sessionId}; HttpOnly; SameSite=Lax; Max-Age=${maxAge}; Path=/`;
}

export function deleteUserSession(sessionId: string, db: Database): void {
  if (!sessionStore) {
    sessionStore = new AipSessionStore(db);
  }
  sessionStore.delete(sessionId);
}

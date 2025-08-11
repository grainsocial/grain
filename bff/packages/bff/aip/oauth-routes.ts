import type {
  ActorTable,
  AipMiddlewareOptions,
  BffContext,
  RouteHandler,
} from "../types.d.ts";
import { createUserSession, setSessionCookie } from "./auth.ts";
import { getAipOAuthClient } from "./oauth-client.ts";

interface AipOAuthState {
  codeVerifier: string;
  state: string;
  returnUrl: string;
}

// Store OAuth state (in production, use Redis or database)
const aipOauthStates = new Map<string, AipOAuthState>();

export const aipOauthLoginHandler: RouteHandler = async (
  req,
  _params,
  ctx: BffContext,
) => {
  try {
    const url = new URL(req.url);
    const returnUrl = url.searchParams.get("returnUrl") || "/";
    const loginHint = url.searchParams.get("login_hint"); // Get handle from query param

    const aipOauthClient = getAipOAuthClient();
    // Client should already be initialized at startup

    const config = aipOauthClient.getConfig();
    const metadata = aipOauthClient.getMetadata();

    // Generate PKCE parameters and state
    const { codeVerifier, codeChallenge } = await aipOauthClient.generatePKCE();
    const state = aipOauthClient.generateState();

    // Store OAuth state
    aipOauthStates.set(state, {
      codeVerifier,
      state,
      returnUrl,
    });

    // Make PAR (Pushed Authorization Request) if supported
    let authorizationUrl: string;
    let requestUri: string | null = null;

    if (metadata.pushed_authorization_request_endpoint) {
      try {
        const parResponse = await fetch(
          metadata.pushed_authorization_request_endpoint,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
              client_id: config.clientId,
              response_type: "code",
              redirect_uri: config.redirectUri,
              scope: config.scopes.join(" "),
              state,
              code_challenge: codeChallenge,
              code_challenge_method: "S256",
              ...(loginHint && { login_hint: loginHint }),
            }),
          },
        );

        if (parResponse.ok) {
          const parData = await parResponse.json();
          requestUri = parData.request_uri;
          console.log("✅ AIP PAR request successful");
        }
      } catch (error) {
        console.warn(
          "⚠️ AIP PAR request failed, falling back to direct authorization:",
          error,
        );
      }
    }

    // Build authorization URL
    if (requestUri) {
      // Use request_uri from PAR
      const authUrl = new URL(metadata.authorization_endpoint);
      authUrl.searchParams.set("client_id", config.clientId);
      authUrl.searchParams.set("request_uri", requestUri);
      authorizationUrl = authUrl.toString();
    } else {
      // Direct authorization without PAR
      const authUrl = new URL(metadata.authorization_endpoint);
      authUrl.searchParams.set("client_id", config.clientId);
      authUrl.searchParams.set("response_type", "code");
      authUrl.searchParams.set("redirect_uri", config.redirectUri);
      authUrl.searchParams.set("scope", config.scopes.join(" "));
      authUrl.searchParams.set("state", state);
      authUrl.searchParams.set("code_challenge", codeChallenge);
      authUrl.searchParams.set("code_challenge_method", "S256");
      if (loginHint) {
        authUrl.searchParams.set("login_hint", loginHint);
      }
      authorizationUrl = authUrl.toString();
    }

    console.log(
      "🔗 Redirecting to AIP OAuth authorization URL:",
      authorizationUrl,
    );
    // Redirect to authorization server
    return ctx.redirect(authorizationUrl);
  } catch (error) {
    console.error("❌ AIP OAuth login error:", error);
    return new Response("Internal server error", { status: 500 });
  }
};

export const aipOauthCallbackHandler =
  (opts?: AipMiddlewareOptions): RouteHandler =>
  async (
    req,
    _params,
    ctx: BffContext,
  ) => {
    try {
      const url = new URL(req.url);
      const code = url.searchParams.get("code");
      const state = url.searchParams.get("state");
      const error = url.searchParams.get("error");

      // Handle OAuth error responses
      if (error) {
        const errorDescription = url.searchParams.get("error_description");
        console.error("❌ AIP OAuth error:", error, errorDescription);
        return new Response(`AIP OAuth error: ${error} - ${errorDescription}`, {
          status: 400,
        });
      }

      if (!code || !state) {
        return new Response("Missing code or state parameter", { status: 400 });
      }

      // Retrieve OAuth state
      const aipOauthState = aipOauthStates.get(state);
      if (!aipOauthState) {
        return new Response("Invalid state parameter", { status: 400 });
      }

      // Clean up state
      aipOauthStates.delete(state);

      const aipOauthClient = getAipOAuthClient();
      // Client should already be initialized at startup
      const config = aipOauthClient.getConfig();
      const metadata = aipOauthClient.getMetadata();

      // Exchange authorization code for access token
      const tokenResponse = await fetch(metadata.token_endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          client_id: config.clientId,
          client_secret: config.clientSecret || "",
          code,
          redirect_uri: config.redirectUri,
          code_verifier: aipOauthState.codeVerifier,
        }),
      });

      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        console.error(
          "❌ AIP token exchange failed:",
          tokenResponse.status,
          errorText,
        );
        return new Response(
          `AIP token exchange failed: ${tokenResponse.status}`,
          {
            status: 500,
          },
        );
      }

      const tokenData = await tokenResponse.json();
      console.log("tokenData:", tokenData);
      console.log("✅ AIP access token obtained");

      // Get ATProtocol session information
      const aipBaseUrl = Deno.env.get("AIP_BASE_URL") ||
        "http://localhost:8081";
      const sessionResponse = await fetch(
        `${aipBaseUrl}/api/atprotocol/session`,
        {
          headers: {
            "Authorization": `Bearer ${tokenData.access_token}`,
            "Content-Type": "application/json",
          },
        },
      );

      if (!sessionResponse.ok) {
        const errorText = await sessionResponse.text();
        console.error(
          "❌ Failed to get AIP ATProtocol session:",
          sessionResponse.status,
          errorText,
        );
        return new Response("Failed to get user session", { status: 500 });
      }

      const session = await sessionResponse.json();
      console.log("✅ AIP ATProtocol session retrieved:");
      console.log("📋 Full session data:", JSON.stringify(session, null, 2));

      // Create actor object for onSignedIn callback
      const actor: ActorTable = {
        did: session.did,
        handle: session.handle,
        indexedAt: new Date().toISOString(),
      };

      // Call onSignedIn callback if provided
      let redirectPath = aipOauthState.returnUrl;
      if (opts?.onSignedIn) {
        const callbackResult = await opts.onSignedIn({ actor, ctx });
        if (callbackResult) {
          redirectPath = callbackResult;
        }
      }

      // Create user session with refresh token
      const sessionId = createUserSession(
        session.did,
        session.handle,
        tokenData.access_token,
        tokenData.refresh_token,
        tokenData.expires_in || 86400,
        ctx.db,
      );

      // Set session cookie and redirect
      const headers = new Headers();
      headers.set(
        "Set-Cookie",
        setSessionCookie(sessionId, tokenData.expires_in || 3600),
      );
      headers.set("Location", redirectPath);

      return new Response(null, {
        status: 302,
        headers,
      });
    } catch (error) {
      console.error("❌ AIP OAuth callback error:", error);
      return new Response("Internal server error", { status: 500 });
    }
  };

export const aipOauthLogoutHandler: RouteHandler = (
  _req,
  _params,
  _ctx: BffContext,
) => {
  const headers = new Headers();
  headers.set(
    "Set-Cookie",
    "sessionId=; HttpOnly; SameSite=Lax; Max-Age=0; Path=/",
  );
  headers.set("HX-Redirect", "/");

  return new Response(null, {
    status: 302,
    headers,
  });
};

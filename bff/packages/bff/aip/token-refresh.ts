import { getAipOAuthClient } from "./oauth-client.ts";
import type { AipSessionTable, AipSessionStore } from "../services/aip-session.ts";

export interface RefreshTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
  scope: string;
}

export async function refreshAipSession(
  session: AipSessionTable,
  sessionStore: AipSessionStore,
): Promise<AipSessionTable | null> {
  try {
    const aipOauthClient = getAipOAuthClient();
    const config = aipOauthClient.getConfig();
    const metadata = aipOauthClient.getMetadata();

    console.log(`🔄 Refreshing AIP session for DID: ${session.did}`);

    const refreshResponse = await fetch(metadata.token_endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        client_id: config.clientId,
        client_secret: config.clientSecret || "",
        refresh_token: session.refreshToken,
      }),
    });

    if (!refreshResponse.ok) {
      const errorText = await refreshResponse.text();
      console.error(
        "❌ AIP token refresh failed:",
        refreshResponse.status,
        errorText,
      );
      // Delete the session as refresh failed
      sessionStore.delete(session.sessionId);
      return null;
    }

    const tokenData: RefreshTokenResponse = await refreshResponse.json();
    console.log("✅ AIP tokens refreshed successfully");

    // Update session with new tokens
    const updatedSession: AipSessionTable = {
      ...session,
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      expiresAt: Date.now() + (tokenData.expires_in * 1000),
    };

    sessionStore.set(updatedSession);
    return updatedSession;

  } catch (error) {
    console.error("❌ Error refreshing AIP session:", error);
    // Delete the session on error
    sessionStore.delete(session.sessionId);
    return null;
  }
}

// Helper to get a valid session, refreshing if needed
export async function getValidAipSession(
  sessionId: string,
  sessionStore: AipSessionStore,
): Promise<AipSessionTable | null> {
  const session = sessionStore.get(sessionId);
  if (!session) return null;

  const now = Date.now();
  const bufferTime = 5 * 60 * 1000; // 5 minutes buffer before expiry

  // If token expires soon, try to refresh it
  if (session.expiresAt <= now + bufferTime) {
    console.log(`🕐 AIP session expires soon, refreshing...`);
    return await refreshAipSession(session, sessionStore);
  }

  return session;
}
// ATProto session response type (based on AIP's AtpSessionResponse)
export interface ATProtoSession {
  /** ATProtocol DID */
  did: string;
  /** ATProtocol handle (if available) */
  handle: string;
  /** ATProtocol access token */
  access_token: string;
  /** ATProtocol token type (usually "Bearer") */
  token_type: string;
  /** ATProtocol scopes */
  scopes: string[];
  /** PDS endpoint (if available) */
  pds_endpoint: string;
  /** DPoP key thumbprint (if DPoP-bound) */
  dpop_key?: string;
  /** DPoP key as JWK (if DPoP-bound) */
  dpop_jwk?: unknown;
  /** Session expiration timestamp (Unix timestamp) */
  expires_at?: number;
  /** Additional fields that might be present */
  [key: string]: unknown;
}

// Helper to fetch ATProto session data on demand from AIP
export async function fetchATProtoSession(accessToken: string): Promise<ATProtoSession> {
  const aipBaseUrl = Deno.env.get("AIP_BASE_URL") || "http://localhost:8081";
  
  try {
    const sessionResponse = await fetch(
      `${aipBaseUrl}/api/atprotocol/session`,
      {
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      },
    );

    if (!sessionResponse.ok) {
      throw new Error(
        `Failed to fetch ATProto session: ${sessionResponse.status} ${sessionResponse.statusText}`,
      );
    }

    return await sessionResponse.json();
  } catch (error) {
    console.error("❌ Error fetching ATProto session:", error);
    throw error;
  }
}
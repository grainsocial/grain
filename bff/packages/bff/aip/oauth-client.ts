export interface AipOAuthClientConfig {
  clientId: string;
  clientSecret?: string;
  redirectUri: string;
  scopes: string[];
}

export interface AipOAuthServerMetadata {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  pushed_authorization_request_endpoint: string;
  registration_endpoint: string;
  jwks_uri: string;
  scopes_supported: string[];
  response_types_supported: string[];
  grant_types_supported: string[];
  code_challenge_methods_supported: string[];
}

export class AipOAuthClient {
  private config: AipOAuthClientConfig;
  private metadata: AipOAuthServerMetadata | null = null;
  private aipBaseUrl: string;
  private clientBaseUrl: string;

  constructor(aipBaseUrl: string, clientBaseUrl: string, clientId: string, clientSecret?: string) {
    this.aipBaseUrl = aipBaseUrl.replace(/\/$/, "");
    this.clientBaseUrl = clientBaseUrl.replace(/\/$/, "");
    this.config = {
      clientId,
      clientSecret,
      redirectUri: `${this.clientBaseUrl}/oauth/callback`,
      scopes: ["atproto:atproto", "atproto:transition:generic"],
    };
  }

  async initialize(): Promise<void> {
    await this.discoverMetadata();
  }

  private async discoverMetadata(): Promise<void> {
    const metadataUrl =
      `${this.aipBaseUrl}/.well-known/oauth-authorization-server`;

    try {
      const response = await fetch(metadataUrl);
      if (!response.ok) {
        throw new Error(
          `Failed to fetch AIP OAuth metadata: ${response.status} ${response.statusText}`,
        );
      }

      this.metadata = await response.json();
      console.log("✅ AIP OAuth server metadata discovered");
    } catch (error) {
      console.error("❌ Failed to discover AIP OAuth metadata:", error);
      throw error;
    }
  }


  getConfig(): AipOAuthClientConfig {
    return this.config;
  }

  getMetadata(): AipOAuthServerMetadata {
    if (!this.metadata) {
      throw new Error("AIP OAuth metadata not available");
    }
    return this.metadata;
  }

  // Generate PKCE parameters
  async generatePKCE(): Promise<
    { codeVerifier: string; codeChallenge: string }
  > {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    const codeVerifier = this.base64URLEncode(array);

    const hashBuffer = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(codeVerifier),
    );
    const codeChallenge = this.base64URLEncode(new Uint8Array(hashBuffer));

    return { codeVerifier, codeChallenge };
  }

  // Generate state parameter
  generateState(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return this.base64URLEncode(array);
  }

  private base64URLEncode(array: Uint8Array): string {
    return btoa(String.fromCharCode(...array))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=/g, "");
  }
}

export function createAipOAuthClient(aipBaseUrl: string, clientBaseUrl: string, clientId: string, clientSecret?: string): AipOAuthClient {
  return new AipOAuthClient(aipBaseUrl, clientBaseUrl, clientId, clientSecret);
}

// Global client instance
let globalAipOAuthClient: AipOAuthClient | null = null;

/**
 * Initialize the global AIP OAuth client
 * This should be called once at application startup
 */
export async function initializeAipOAuthClient(
  aipBaseUrl?: string,
  clientBaseUrl?: string,
  clientId?: string,
  clientSecret?: string
): Promise<void> {
  // Use environment variables if parameters not provided
  const finalAipBaseUrl = aipBaseUrl || Deno.env.get("BFF_AIP_BASE_URL") || "http://localhost:8081";
  const finalClientBaseUrl = clientBaseUrl || Deno.env.get("BFF_PUBLIC_URL") || "http://localhost:8080";
  const finalClientId = clientId || Deno.env.get("BFF_AIP_CLIENT_ID") || "";
  const finalClientSecret = clientSecret || Deno.env.get("BFF_AIP_CLIENT_SECRET") || "";

  if (!finalClientId) {
    throw new Error("AIP OAuth client ID is required. Set BFF_AIP_CLIENT_ID environment variable or run the registration script.");
  }

  console.log(`🔧 Initializing AIP OAuth client for ${finalAipBaseUrl}`);
  
  globalAipOAuthClient = createAipOAuthClient(
    finalAipBaseUrl,
    finalClientBaseUrl,
    finalClientId,
    finalClientSecret
  );
  
  await globalAipOAuthClient.initialize();
  
  console.log("✅ AIP OAuth client initialized successfully");
}

/**
 * Get the global AIP OAuth client instance
 * Throws an error if the client hasn't been initialized
 */
export function getAipOAuthClient(): AipOAuthClient {
  if (!globalAipOAuthClient) {
    throw new Error("AIP OAuth client not initialized. Call initializeAipOAuthClient() first.");
  }
  
  return globalAipOAuthClient;
}
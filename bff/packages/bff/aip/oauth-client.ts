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
  private config: AipOAuthClientConfig | null = null;
  private metadata: AipOAuthServerMetadata | null = null;
  private aipBaseUrl: string;
  private clientBaseUrl: string;
  private initialized: boolean = false;
  private initializationPromise: Promise<void> | null = null;
  private configFile: string;

  constructor(aipBaseUrl: string, clientBaseUrl: string) {
    this.aipBaseUrl = aipBaseUrl.replace(/\/$/, "");
    this.clientBaseUrl = clientBaseUrl.replace(/\/$/, "");
    this.configFile = ".aip-oauth-client.json";
  }

  async initialize(): Promise<void> {
    // If already initialized, return immediately
    if (this.initialized) {
      return;
    }

    // If initialization is in progress, wait for it to complete
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    // Start initialization
    this.initializationPromise = this.performInitialization();
    await this.initializationPromise;
  }

  private async performInitialization(): Promise<void> {
    try {
      // Discover OAuth server metadata
      await this.discoverMetadata();

      // Try to load existing client config from environment or file
      await this.loadClientConfig();

      // Register client if not already registered
      if (!this.config) {
        await this.registerClient();
        await this.saveClientConfig();
      }

      this.initialized = true;
      console.log("✅ AIP OAuth client fully initialized");
    } catch (error) {
      this.initializationPromise = null; // Reset on error so we can retry
      throw error;
    }
  }

  private async loadClientConfig(): Promise<void> {
    // First try environment variables
    const envClientId = Deno.env.get("AIP_OAUTH_CLIENT_ID");
    const envClientSecret = Deno.env.get("AIP_OAUTH_CLIENT_SECRET");
    
    if (envClientId) {
      this.config = {
        clientId: envClientId,
        clientSecret: envClientSecret,
        redirectUri: `${this.clientBaseUrl}/oauth/callback`,
        scopes: ["atproto:atproto", "atproto:transition:generic"],
      };
      console.log("✅ Loaded AIP OAuth client config from environment variables");
      return;
    }

    // Try to load from file
    try {
      const configText = await Deno.readTextFile(this.configFile);
      const savedConfig = JSON.parse(configText);
      
      // Validate the config has required fields
      if (savedConfig.clientId && savedConfig.redirectUri) {
        this.config = savedConfig;
        console.log("✅ Loaded AIP OAuth client config from file");
      }
    } catch (_error) {
      // File doesn't exist or is invalid, will need to register
      console.log("ℹ️ No existing AIP OAuth client config found, will register new client");
    }
  }

  private async saveClientConfig(): Promise<void> {
    if (!this.config) return;
    
    try {
      await Deno.writeTextFile(this.configFile, JSON.stringify(this.config, null, 2));
      console.log("✅ AIP OAuth client config saved to file");
    } catch (error) {
      console.warn("⚠️ Failed to save AIP OAuth client config to file:", error);
    }
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

  private async registerClient(): Promise<void> {
    if (!this.metadata) {
      throw new Error("AIP OAuth metadata not available");
    }

    const registrationData = {
      client_name: "BFF App with AIP",
      client_uri: this.clientBaseUrl,
      redirect_uris: [`${this.clientBaseUrl}/oauth/callback`],
      scope: "atproto:atproto atproto:transition:generic",
      grant_types: ["authorization_code"],
      response_types: ["code"],
      token_endpoint_auth_method: "client_secret_post",
    };

    try {
      // Try RFC 7591 registration first
      let response = await fetch(this.metadata.registration_endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(registrationData),
      });

      // Fallback to custom registration endpoint if RFC 7591 fails
      if (!response.ok && response.status === 404) {
        console.log("RFC 7591 registration not available, trying fallback");
        response = await fetch(`${this.aipBaseUrl}/oauth/clients/register`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(registrationData),
        });
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ AIP client registration response:', response.status, errorText);
        throw new Error(
          `AIP client registration failed: ${response.status} ${response.statusText} - ${errorText}`,
        );
      }

      const clientData = await response.json();
      this.config = {
        clientId: clientData.client_id,
        clientSecret: clientData.client_secret,
        redirectUri: `${this.clientBaseUrl}/oauth/callback`,
        scopes: ["atproto:atproto", "atproto:transition:generic"],
      };

      console.log("✅ AIP OAuth client registered:", {
        clientId: this.config.clientId,
      });
    } catch (error) {
      console.error("❌ AIP client registration failed:", error);
      throw error;
    }
  }

  getConfig(): AipOAuthClientConfig {
    if (!this.config) {
      throw new Error("AIP OAuth client not initialized");
    }
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

// Global AIP OAuth client instance
let aipOauthClient: AipOAuthClient | null = null;
let globalInitializationPromise: Promise<void> | null = null;

export function getAipOAuthClient(): AipOAuthClient {
  if (!aipOauthClient) {
    const aipBaseUrl = Deno.env.get("AIP_BASE_URL") || "http://localhost:8081";
    console.log(
      "🔐 Initializing global AIP OAuth client with AIP base URL:",
      aipBaseUrl,
    );
    const clientBaseUrl = Deno.env.get("CLIENT_BASE_URL") ||
      "http://localhost:8080";
    aipOauthClient = new AipOAuthClient(aipBaseUrl, clientBaseUrl);
  }
  return aipOauthClient;
}

// Initialize the AIP OAuth client early (call this at app startup)
export function initializeAipOAuthClient(): Promise<void> {
  if (globalInitializationPromise) {
    return globalInitializationPromise;
  }

  globalInitializationPromise = (async () => {
    const client = getAipOAuthClient();
    await client.initialize();
    console.log("🔐 Global AIP OAuth client initialized");
  })();

  return globalInitializationPromise;
}
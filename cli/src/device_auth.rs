/// OAuth 2.0 Device Authorization Grant (RFC 8628) implementation for grain-cli

use anyhow::{Context, Result};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::time::Duration;

const AIP_BASE_URL: &str = "http://localhost:8081"; // AIP server, not grain app

fn get_client_id() -> String {
    std::env::var("CLIENT_ID").unwrap_or_else(|_| "".to_string())
}

fn get_aip_base_url() -> String {
    std::env::var("AIP_BASE_URL").unwrap_or_else(|_| AIP_BASE_URL.to_string())
}

#[derive(Debug, Serialize)]
pub struct DeviceAuthorizationRequest {
    pub client_id: String,
    pub scope: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct DeviceAuthorizationResponse {
    pub device_code: String,
    pub user_code: String,
    pub verification_uri: String,
    pub verification_uri_complete: Option<String>,
    pub expires_in: u64,
    pub interval: Option<u64>,
}

#[derive(Debug, Serialize)]
pub struct DeviceTokenRequest {
    pub grant_type: String,
    pub device_code: String,
    pub client_id: String,
}

#[derive(Debug, Deserialize)]
pub struct TokenResponse {
    pub access_token: String,
    pub expires_in: Option<u64>,
    pub refresh_token: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct TokenError {
    pub error: String,
    pub error_description: Option<String>,
}

pub struct DeviceOAuthClient {
    client: Client,
    aip_base_url: String,
}

impl DeviceOAuthClient {
    pub fn new() -> Self {
        Self {
            client: Client::new(),
            aip_base_url: get_aip_base_url(),
        }
    }

    /// Start device authorization flow (RFC 8628)
    pub async fn start_device_authorization(
        &self,
        scope: Option<&str>,
        verbose: bool,
    ) -> Result<DeviceAuthorizationResponse> {
        let device_auth_url = format!("{}/oauth/device", self.aip_base_url);

        let client_id = get_client_id();
        let request = DeviceAuthorizationRequest {
            client_id: client_id.clone(),
            scope: scope.map(|s| s.to_string()),
        };

        if verbose {
            println!("🚀 Starting device authorization flow...");
            println!("📝 Device authorization request: client_id={}", client_id);
        }

        let response = self.client
            .post(&device_auth_url)
            .form(&request)
            .send()
            .await
            .context("Failed to send device authorization request")?;

        let status = response.status();
        if !status.is_success() {
            let error_text = response.text().await?;
            return Err(anyhow::anyhow!(
                "Device authorization failed (HTTP {}): {}",
                status,
                error_text
            ));
        }

        let auth_response: DeviceAuthorizationResponse = response
            .json()
            .await
            .context("Failed to parse device authorization response")?;

        if verbose {
            println!("✅ Device authorization started successfully!");
            println!("🔑 Device Code: {}", auth_response.device_code);
            println!("👤 User Code: {}", auth_response.user_code);
            println!("🌐 Verification URI: {}", auth_response.verification_uri);
        }

        Ok(auth_response)
    }

    /// Poll for access token using device code
    pub async fn poll_for_token(
        &self,
        device_code: &str,
        interval: u64,
        expires_in: u64,
        verbose: bool,
    ) -> Result<TokenResponse> {
        let token_url = format!("{}/oauth/token", self.aip_base_url);
        let poll_interval = Duration::from_secs(interval.max(5)); // Minimum 5 seconds
        let expiry = std::time::Instant::now() + Duration::from_secs(expires_in);

        let request = DeviceTokenRequest {
            grant_type: "urn:ietf:params:oauth:grant-type:device_code".to_string(),
            device_code: device_code.to_string(),
            client_id: get_client_id(),
        };

        if verbose {
            println!("⏳ Polling for access token every {} seconds...", interval);
        }

        loop {
            if std::time::Instant::now() > expiry {
                return Err(anyhow::anyhow!("Device code expired"));
            }

            let response = self.client
                .post(&token_url)
                .form(&request)
                .send()
                .await
                .context("Failed to send token request")?;

            if response.status().is_success() {
                let token_response: TokenResponse = response
                    .json()
                    .await
                    .context("Failed to parse token response")?;

                if verbose {
                    println!("✅ Access token obtained successfully!");
                }

                return Ok(token_response);
            }

            // Handle specific error cases
            let status = response.status();
            let error_response: Result<TokenError, _> = response.json().await;

            match error_response {
                Ok(error) => {
                    match error.error.as_str() {
                        "authorization_pending" => {
                            if verbose {
                                println!("⏳ Authorization pending, continuing to poll...");
                            }
                        }
                        "slow_down" => {
                            if verbose {
                                println!("⏸️  Slowing down polling interval...");
                            }
                            tokio::time::sleep(poll_interval + Duration::from_secs(5)).await;
                            continue;
                        }
                        "access_denied" => {
                            return Err(anyhow::anyhow!("User denied the authorization request"));
                        }
                        "expired_token" => {
                            return Err(anyhow::anyhow!("Device code expired"));
                        }
                        "server_error" => {
                            // Check if this is actually an authorization pending error
                            let description = error.error_description.unwrap_or_default();
                            if description.contains("Authorization pending") {
                                if verbose {
                                    println!("⏳ Authorization pending, continuing to poll...");
                                }
                            } else {
                                return Err(anyhow::anyhow!(
                                    "Token request failed: {} - {}",
                                    error.error,
                                    description
                                ));
                            }
                        }
                        _ => {
                            return Err(anyhow::anyhow!(
                                "Token request failed: {} - {}",
                                error.error,
                                error.error_description.unwrap_or_default()
                            ));
                        }
                    }
                }
                Err(_) => {
                    return Err(anyhow::anyhow!(
                        "Token request failed with HTTP {}",
                        status
                    ));
                }
            }

            tokio::time::sleep(poll_interval).await;
        }
    }

    /// Complete device flow authentication
    pub async fn authenticate_device_flow(
        &self,
        scope: Option<&str>,
        verbose: bool,
    ) -> Result<TokenResponse> {
        // Step 1: Start device authorization
        let auth_response = self
            .start_device_authorization(scope, verbose)
            .await?;

        // Step 2: Show user instructions
        println!("\n🔐 Device Authorization Required");
        println!("════════════════════════════════");
        println!("1. Open this URL in your browser:");
        println!("   {}", auth_response.verification_uri);
        println!("2. Enter this user code:");
        println!("   {}", auth_response.user_code);

        if let Some(complete_uri) = &auth_response.verification_uri_complete {
            println!("3. Or visit this direct link:");
            println!("   {}", complete_uri);
        }

        println!("\n⏰ This code expires in {} seconds", auth_response.expires_in);
        println!("⏳ Waiting for authorization...\n");

        // Re-enable browser opening but in a safe way
        if let Some(complete_uri) = &auth_response.verification_uri_complete {
            println!("🌐 Opening browser (you can also manually visit the URL above)...");
            let _ = open::that(complete_uri);
        }

        // Step 3: Poll for token
        let token_response = self
            .poll_for_token(
                &auth_response.device_code,
                auth_response.interval.unwrap_or(5),
                auth_response.expires_in,
                verbose,
            )
            .await?;

        Ok(token_response)
    }
}

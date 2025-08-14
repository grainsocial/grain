use anyhow::{Context, Result};
use reqwest::Client;
use serde::Deserialize;
use sha2::{Digest, Sha256};
use base64::prelude::*;
use rand::Rng;

/// Generate a cryptographically secure code verifier for PKCE
pub fn generate_code_verifier() -> String {
    let mut rng = rand::thread_rng();
    let bytes: Vec<u8> = (0..32).map(|_| rng.gen()).collect();
    BASE64_URL_SAFE_NO_PAD.encode(bytes)
}

/// Generate code challenge from verifier using S256 method
pub fn generate_code_challenge(verifier: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(verifier.as_bytes());
    let hash = hasher.finalize();
    BASE64_URL_SAFE_NO_PAD.encode(hash)
}

/// Token response from AIP
#[derive(Deserialize)]
pub struct TokenExchangeResponse {
    pub access_token: String,
    pub expires_in: Option<u64>,
    pub refresh_token: Option<String>,
}

/// User info response from AIP
#[derive(Deserialize)]
pub struct UserInfoResponse {
    pub sub: String,
}

/// ATProtocol session response from AIP (we only need the token fields)
#[derive(Deserialize)]
pub struct AtpSessionResponse {
    pub did: String,
    pub access_token: String,
    pub expires_at: i64,
}

/// Exchange authorization code for access token
pub async fn exchange_code_for_token(
    aip_base_url: &str,
    client_id: &str,
    code: &str,
    redirect_uri: &str,
    code_verifier: &str,
    verbose: bool,
) -> Result<TokenExchangeResponse> {
    let client = Client::new();
    let token_url = format!("{}/oauth/token", aip_base_url);

    if verbose {
        println!("🔄 Exchanging authorization code for access token...");
    }

    let params = [
        ("grant_type", "authorization_code"),
        ("code", code),
        ("redirect_uri", redirect_uri),
        ("client_id", client_id),
        ("code_verifier", code_verifier),
    ];

    let response = client
        .post(&token_url)
        .form(&params)
        .send()
        .await
        .context("Failed to send token exchange request")?;

    let status = response.status();
    if !status.is_success() {
        let error_text = response.text().await?;
        return Err(anyhow::anyhow!(
            "Token exchange failed (HTTP {}): {}",
            status,
            error_text
        ));
    }

    let token_response: TokenExchangeResponse = response
        .json()
        .await
        .context("Failed to parse token response")?;

    if verbose {
        println!("✅ Token exchange successful!");
    }

    Ok(token_response)
}

/// Get user info from AIP userinfo endpoint
pub async fn get_user_info(
    aip_base_url: &str,
    access_token: &str,
    verbose: bool,
) -> Result<UserInfoResponse> {
    let client = Client::new();
    let userinfo_url = format!("{}/oauth/userinfo", aip_base_url);

    if verbose {
        println!("🔑 Using access token: {}", access_token);
        println!("🔍 Fetching user info to get DID...");
    }

    let response = client
        .get(&userinfo_url)
        .bearer_auth(access_token)
        .send()
        .await
        .context("Failed to send userinfo request")?;

    let status = response.status();
    if !status.is_success() {
        let error_text = response.text().await?;
        return Err(anyhow::anyhow!(
            "Userinfo request failed (HTTP {}): {}",
            status,
            error_text
        ));
    }

    let user_info: UserInfoResponse = response
        .json()
        .await
        .context("Failed to parse userinfo response")?;

    if verbose {
        println!("✅ Got user DID: {}", user_info.sub);
    }

    Ok(user_info)
}

/// Refresh access token using refresh token
pub async fn refresh_access_token(
    aip_base_url: &str,
    client_id: &str,
    refresh_token: &str,
    verbose: bool,
) -> Result<TokenExchangeResponse> {
    let client = Client::new();
    let token_url = format!("{}/oauth/token", aip_base_url);

    if verbose {
        println!("🔄 Refreshing access token...");
    }

    let params = [
        ("grant_type", "refresh_token"),
        ("refresh_token", refresh_token),
        ("client_id", client_id),
    ];

    let response = client
        .post(&token_url)
        .form(&params)
        .send()
        .await
        .context("Failed to send token refresh request")?;

    let status = response.status();
    if !status.is_success() {
        let error_text = response.text().await?;
        return Err(anyhow::anyhow!(
            "Token refresh failed (HTTP {}): {}",
            status,
            error_text
        ));
    }

    let token_response: TokenExchangeResponse = response
        .json()
        .await
        .context("Failed to parse token refresh response")?;

    if verbose {
        println!("✅ Token refresh successful!");
    }

    Ok(token_response)
}

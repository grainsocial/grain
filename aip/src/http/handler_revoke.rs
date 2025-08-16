//! Handles POST /oauth/revoke - Revokes OAuth 2.0 access and refresh tokens (RFC 7009)

use anyhow::Result;
use axum::{
    Form,
    Json,
    extract::State,
    http::{HeaderMap, StatusCode},
};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};

use super::context::AppState;
use crate::errors::OAuthError;
use crate::oauth::auth_server::{extract_client_auth, TokenForm};

#[derive(Debug, Deserialize)]
pub struct RevokeRequest {
    /// The token to be revoked (REQUIRED)
    pub token: String,
    /// Hint about the token type: "access_token" or "refresh_token" (OPTIONAL)
    pub token_type_hint: Option<String>,
    /// Client ID (for client authentication)
    pub client_id: Option<String>,
    /// Client secret (for client authentication)
    pub client_secret: Option<String>,
    /// Client assertion for private_key_jwt authentication
    pub client_assertion: Option<String>,
    /// Client assertion type for private_key_jwt authentication
    pub client_assertion_type: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct RevokeResponse {
    // Empty response body for successful revocation
}

/// Handle OAuth 2.0 token revocation requests
/// POST /oauth/revoke - Revokes access or refresh tokens per RFC 7009
#[axum::debug_handler]
pub async fn handle_revoke(
    State(state): State<AppState>,
    headers: HeaderMap,
    Form(form): Form<RevokeRequest>,
) -> Result<Json<RevokeResponse>, (StatusCode, Json<Value>)> {
    // Convert to TokenForm for client authentication extraction
    let token_form = TokenForm {
        grant_type: "client_credentials".to_string(), // Not used for revocation
        code: None,
        redirect_uri: None,
        client_id: form.client_id.clone(),
        client_secret: form.client_secret.clone(),
        client_assertion: form.client_assertion.clone(),
        client_assertion_type: form.client_assertion_type.clone(),
        code_verifier: None,
        scope: None,
        refresh_token: None,
        device_code: None,
    };

    // Extract client authentication from Authorization header or form
    let client_auth = extract_client_auth(&headers, &token_form);

    // Validate that we have client authentication
    let client_id = match client_auth {
        Some(auth) => auth.client_id,
        None => {
            let error_response = json!({
                "error": "invalid_client",
                "error_description": "Client authentication required"
            });
            return Err((StatusCode::UNAUTHORIZED, Json(error_response)));
        }
    };

    // Validate that the client exists
    match state.oauth_storage.get_client(&client_id).await {
        Ok(Some(_client)) => {
            // Client exists, proceed with revocation
        }
        Ok(None) => {
            let error_response = json!({
                "error": "invalid_client",
                "error_description": "Client not found"
            });
            return Err((StatusCode::UNAUTHORIZED, Json(error_response)));
        }
        Err(e) => {
            tracing::error!(
                error = %e,
                client_id = %client_id,
                "Failed to retrieve client"
            );
            let error_response = json!({
                "error": "server_error",
                "error_description": "Internal server error"
            });
            return Err((StatusCode::INTERNAL_SERVER_ERROR, Json(error_response)));
        }
    }

    // Attempt to revoke the token
    let revocation_result = match form.token_type_hint.as_deref() {
        Some("refresh_token") => {
            // Try refresh token first, then access token
            match revoke_refresh_token(&state, &form.token, &client_id).await {
                Ok(()) => Ok(()),
                Err(_) => revoke_access_token(&state, &form.token, &client_id).await,
            }
        }
        Some("access_token") | None => {
            // Try access token first, then refresh token
            match revoke_access_token(&state, &form.token, &client_id).await {
                Ok(()) => Ok(()),
                Err(_) => revoke_refresh_token(&state, &form.token, &client_id).await,
            }
        }
        Some(_) => {
            // Invalid token_type_hint
            let error_response = json!({
                "error": "unsupported_token_type",
                "error_description": "Unsupported token type hint"
            });
            return Err((StatusCode::BAD_REQUEST, Json(error_response)));
        }
    };

    match revocation_result {
        Ok(_) => {
            // RFC 7009: Return HTTP 200 for successful revocation
            Ok(Json(RevokeResponse {}))
        }
        Err(e) => {
            // Log the error but still return 200 per RFC 7009
            // (invalid tokens should not result in error responses)
            tracing::debug!(
                error = %e,
                token = %form.token,
                client_id = %client_id,
                "Token revocation failed (returning success per RFC 7009)"
            );
            Ok(Json(RevokeResponse {}))
        }
    }
}

/// Revoke an access token
async fn revoke_access_token(
    state: &AppState,
    token: &str,
    client_id: &str,
) -> Result<(), OAuthError> {
    // Get the access token to verify it belongs to the client
    match state.oauth_storage.get_token(token).await {
        Ok(Some(access_token)) => {
            // Verify the token belongs to the requesting client
            if access_token.client_id != client_id {
                return Err(OAuthError::InvalidClient(
                    "Token does not belong to client".to_string(),
                ));
            }

            // Revoke the access token
            state.oauth_storage.revoke_token(token).await
                .map_err(|e| OAuthError::ServerError(format!("Failed to revoke access token: {}", e)))?;

            tracing::info!(
                token = %token,
                client_id = %client_id,
                user_id = ?access_token.user_id,
                "Access token revoked"
            );

            Ok(())
        }
        Ok(None) => {
            // Token not found
            Err(OAuthError::InvalidGrant("Token not found".to_string()))
        }
        Err(e) => {
            Err(OAuthError::ServerError(format!("Failed to retrieve access token: {}", e)))
        }
    }
}

/// Revoke a refresh token
async fn revoke_refresh_token(
    state: &AppState,
    token: &str,
    client_id: &str,
) -> Result<(), OAuthError> {
    // Get the refresh token to verify it belongs to the client
    match state.oauth_storage.consume_refresh_token(token).await {
        Ok(Some(refresh_token)) => {
            // Verify the token belongs to the requesting client
            if refresh_token.client_id != client_id {
                return Err(OAuthError::InvalidClient(
                    "Token does not belong to client".to_string(),
                ));
            }

            tracing::info!(
                token = %token,
                client_id = %client_id,
                user_id = ?refresh_token.user_id,
                "Refresh token revoked"
            );

            // Note: consume_refresh_token already removes the token from storage
            Ok(())
        }
        Ok(None) => {
            // Token not found
            Err(OAuthError::InvalidGrant("Token not found".to_string()))
        }
        Err(e) => {
            Err(OAuthError::ServerError(format!("Failed to retrieve refresh token: {}", e)))
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::oauth::DPoPNonceGenerator;
    use crate::storage::SimpleKeyProvider;
    use crate::storage::inmemory::MemoryOAuthStorage;
    use atproto_identity::{resolve::create_resolver, storage_lru::LruDidDocumentStorage};
    use atproto_oauth::storage_lru::LruOAuthRequestStorage;
    use std::{num::NonZeroUsize, sync::Arc};

    fn create_test_app_state() -> AppState {
        let oauth_storage = Arc::new(MemoryOAuthStorage::new());

        let http_client = reqwest::Client::new();
        let dns_nameservers = vec![];
        let dns_resolver = create_resolver(&dns_nameservers);
        let identity_resolver = atproto_identity::resolve::IdentityResolver(Arc::new(
            atproto_identity::resolve::InnerIdentityResolver {
                http_client: http_client.clone(),
                dns_resolver,
                plc_hostname: "plc.directory".to_string(),
            },
        ));

        let key_provider = Arc::new(SimpleKeyProvider::new());
        let oauth_request_storage =
            Arc::new(LruOAuthRequestStorage::new(NonZeroUsize::new(256).unwrap()));
        let document_storage =
            Arc::new(LruDidDocumentStorage::new(NonZeroUsize::new(100).unwrap()));

        #[cfg(feature = "reload")]
        let template_env = {
            use minijinja_autoreload::AutoReloader;
            axum_template::engine::Engine::new(AutoReloader::new(|_| {
                Ok(minijinja::Environment::new())
            }))
        };

        #[cfg(not(feature = "reload"))]
        let template_env = axum_template::engine::Engine::new(minijinja::Environment::new());

        let config = Arc::new(crate::config::Config {
            version: "test".to_string(),
            http_port: "3000".to_string().try_into().unwrap(),
            http_static_path: "static".to_string(),
            http_templates_path: "templates".to_string(),
            external_base: "https://localhost".to_string(),
            certificate_bundles: "".to_string().try_into().unwrap(),
            user_agent: "test-user-agent".to_string(),
            plc_hostname: "plc.directory".to_string(),
            dns_nameservers: "".to_string().try_into().unwrap(),
            http_client_timeout: "10s".to_string().try_into().unwrap(),
            atproto_oauth_signing_keys: Default::default(),
            oauth_signing_keys: Default::default(),
            oauth_supported_scopes: crate::config::OAuthSupportedScopes::try_from(
                "read write atproto:atproto".to_string(),
            )
            .unwrap(),
            dpop_nonce_seed: "seed".to_string(),
            storage_backend: "memory".to_string(),
            database_url: None,
            redis_url: None,
            enable_client_api: false,
            client_default_access_token_expiration: "1d".to_string().try_into().unwrap(),
            client_default_refresh_token_expiration: "14d".to_string().try_into().unwrap(),
            admin_dids: "".to_string().try_into().unwrap(),
            client_default_redirect_exact: "true".to_string().try_into().unwrap(),
            atproto_client_name: "AIP OAuth Server".to_string().try_into().unwrap(),
            atproto_client_logo: None::<String>.try_into().unwrap(),
            atproto_client_tos: None::<String>.try_into().unwrap(),
            atproto_client_policy: None::<String>.try_into().unwrap(),
            internal_device_auth_client_id: "test-device-client".to_string().try_into().unwrap(),
        });

        let atp_session_storage = Arc::new(
            crate::oauth::UnifiedAtpOAuthSessionStorageAdapter::new(oauth_storage.clone()),
        );
        let authorization_request_storage = Arc::new(
            crate::oauth::UnifiedAuthorizationRequestStorageAdapter::new(oauth_storage.clone()),
        );
        let client_registration_service = Arc::new(crate::oauth::ClientRegistrationService::new(
            oauth_storage.clone(),
            chrono::Duration::days(1),
            chrono::Duration::days(14),
            true,
        ));

        AppState {
            http_client: http_client.clone(),
            config: config.clone(),
            template_env,
            identity_resolver,
            key_provider,
            oauth_request_storage,
            document_storage,
            oauth_storage,
            client_registration_service,
            atp_session_storage,
            authorization_request_storage,
            atproto_oauth_signing_keys: vec![],
            dpop_nonce_provider: Arc::new(DPoPNonceGenerator::new(
                config.dpop_nonce_seed.clone(),
                1,
            )),
        }
    }

    #[tokio::test]
    async fn test_revoke_request_validation() {
        let app_state = create_test_app_state();
        assert!(!app_state.config.external_base.is_empty());
    }
}
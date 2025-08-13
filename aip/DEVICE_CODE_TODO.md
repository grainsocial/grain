# Device Code Flow Implementation TODO

## Current Status ✅
- [x] RFC 7591 client registration fully implemented
- [x] Device authorization endpoint (`POST /oauth/device`) working
- [x] CLI device flow client implemented
- [x] Well-known metadata includes device_code grant
- [x] Client validation for device flow

## What's Missing for Full Device Code Flow 🚧

### 1. Device Code Storage Layer
**Location**: `src/storage/traits.rs`
```rust
// Add to storage traits
pub trait DeviceCodeStore: Send + Sync {
    async fn store_device_code(
        &self,
        device_code: &str,
        user_code: &str,
        client_id: &str,
        scope: Option<&str>,
        expires_in: u64,
    ) -> Result<(), StorageError>;
    
    async fn get_device_code(&self, device_code: &str) -> Result<Option<DeviceCodeEntry>, StorageError>;
    
    async fn authorize_device_code(
        &self,
        user_code: &str,
        user_id: &str,
    ) -> Result<(), StorageError>;
    
    async fn consume_device_code(&self, device_code: &str) -> Result<Option<String>, StorageError>;
}

#[derive(Debug)]
pub struct DeviceCodeEntry {
    pub device_code: String,
    pub user_code: String,
    pub client_id: String,
    pub scope: Option<String>,
    pub authorized_user: Option<String>,
    pub expires_at: DateTime<Utc>,
    pub created_at: DateTime<Utc>,
}
```

### 2. Database Migrations
**SQLite**: `migrations/sqlite/022_create_device_codes.sql`
```sql
CREATE TABLE device_codes (
    device_code TEXT PRIMARY KEY,
    user_code TEXT UNIQUE NOT NULL,
    client_id TEXT NOT NULL,
    scope TEXT,
    authorized_user TEXT,
    expires_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (client_id) REFERENCES oauth_clients (client_id)
);

CREATE INDEX idx_device_codes_user_code ON device_codes(user_code);
CREATE INDEX idx_device_codes_expires_at ON device_codes(expires_at);
```

**PostgreSQL**: `migrations/postgres/011_create_device_codes.sql`
```sql
CREATE TABLE device_codes (
    device_code TEXT PRIMARY KEY,
    user_code TEXT UNIQUE NOT NULL,
    client_id TEXT NOT NULL REFERENCES oauth_clients(client_id),
    scope TEXT,
    authorized_user TEXT,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_device_codes_user_code ON device_codes(user_code);
CREATE INDEX idx_device_codes_expires_at ON device_codes(expires_at);
```

### 3. Update Device Authorization Handler
**Location**: `src/http/handler_device_code.rs`

Replace the TODO section with:
```rust
// Store device code in storage
state
    .oauth_storage
    .store_device_code(
        &device_code,
        &user_code,
        &request.client_id,
        request.scope.as_deref(),
        1800, // 30 minutes
    )
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            ResponseJson(json!({
                "error": "server_error",
                "error_description": format!("Failed to store device code: {}", e)
            })),
        )
    })?;
```

### 4. Implement Token Exchange in Auth Server
**Location**: `src/oauth/auth_server.rs`

Replace the device code handler:
```rust
GrantType::DeviceCode => {
    self.handle_device_code_grant(request, client_auth).await
}

// Add new method:
async fn handle_device_code_grant(
    &self,
    request: TokenRequest,
    client_auth: Option<ClientAuthentication>,
) -> Result<TokenResponse, OAuthError> {
    let device_code = request.device_code.ok_or_else(|| {
        OAuthError::InvalidRequest("device_code required for device_code grant".to_string())
    })?;

    // Get and consume device code
    let authorized_user = self.storage
        .consume_device_code(&device_code)
        .await
        .map_err(|e| OAuthError::ServerError(format!("Storage error: {}", e)))?
        .ok_or_else(|| OAuthError::InvalidGrant("Invalid or expired device code".to_string()))?;

    // Generate access token
    let access_token = self.generate_access_token(&client_id, &authorized_user, scope).await?;
    
    Ok(TokenResponse {
        access_token,
        token_type: "Bearer".to_string(),
        expires_in: Some(3600),
        refresh_token: None, // Add refresh token if needed
        scope,
    })
}
```

### 5. Create User Authorization Web Page
**Location**: `templates/device_authorize.html`
```html
<!DOCTYPE html>
<html>
<head>
    <title>Device Authorization - AIP</title>
    <link rel="stylesheet" href="/static/pico.css">
</head>
<body>
    <main class="container">
        <h1>Device Authorization</h1>
        <form method="post" action="/device/authorize">
            <label for="user_code">Enter the code from your device:</label>
            <input type="text" id="user_code" name="user_code" placeholder="XXXX-XXXX" required>
            <button type="submit">Authorize Device</button>
        </form>
    </main>
</body>
</html>
```

### 6. Add Device Authorization Routes
**Location**: `src/http/server.rs`
```rust
.route("/device", get(device_authorization_page))
.route("/device/authorize", post(device_authorization_handler))
```

### 7. Estimated Time: 2-3 hours
- Storage implementation: 1 hour
- Token exchange: 30 minutes  
- Web authorization flow: 1 hour
- Testing and debugging: 30 minutes

## Testing Steps
1. Run `grain login` 
2. CLI shows device code and opens browser
3. User enters code on AIP web page
4. CLI automatically receives access token
5. Verify token works with protected endpoints

## Files Modified for Device Code Flow
- `src/storage/traits.rs` - Add DeviceCodeStore trait
- `src/storage/*/mod.rs` - Implement storage for each backend
- `src/http/handler_device_code.rs` - Store device codes
- `src/oauth/auth_server.rs` - Handle device code token exchange
- `src/http/server.rs` - Add device authorization routes
- `templates/device_authorize.html` - User authorization page
- `migrations/` - Database schema updates

---

## Current Workaround: Authorization Code Flow
The CLI now uses traditional OAuth authorization code flow which works immediately with the registered device client.
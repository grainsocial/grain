# OAuth Client Registration Scripts

This directory contains scripts for managing OAuth client registration with the AIP (AT Protocol Identity Provider) server.

## Scripts

### `register_oauth_client.sh`

Registers a new OAuth client with the AIP server using RFC 7591 Dynamic Client Registration.

**Usage:**
```bash
# Basic usage (uses default configuration)
bash scripts/register_oauth_client.sh

# With custom configuration
AIP_BASE_URL="https://your-aip-server.com" \
CLIENT_BASE_URL="https://your-client-app.com" \
CLIENT_NAME="My Custom Client" \
bash scripts/register_oauth_client.sh
```

**Environment Variables:**
- `AIP_BASE_URL`: The base URL of the AIP server (default: `http://localhost:8081`)
- `CLIENT_BASE_URL`: The base URL of your client application (default: `http://localhost:8080`)
- `CLIENT_NAME`: The name for your OAuth client (default: `Grain BFF Client`)

**Output:**
- Creates or updates `oauth_client.conf` with the registered client credentials
- Displays the client ID and redirect URI for reference
- Provides environment variable commands for easy setup

### `test_aip_endpoints.sh`

Tests the OAuth flow using the registered client credentials.

**Usage:**
```bash
bash scripts/test_aip_endpoints.sh
```

**Prerequisites:**
- Client must be registered (run `register_oauth_client.sh` first)
- AIP server must be running
- `oauth_client.conf` must exist with valid credentials

## Configuration Files

### `oauth_client.conf`

Contains the registered OAuth client credentials:
```bash
CLIENT_ID="your-client-id-here"
CLIENT_SECRET="your-client-secret-here"
```

This file is created automatically by `register_oauth_client.sh`.

### `oauth_client.conf.example`

Template for the configuration file. Copy and fill in your credentials if setting up manually.

## Integration with BFF

After registering a client, set these environment variables for the BFF application:

```bash
export BFF_AIP_CLIENT_ID="your-client-id-here"
export BFF_AIP_CLIENT_SECRET="your-client-secret-here"
export BFF_AIP_BASE_URL="http://localhost:8081"  # or your AIP server URL
export BFF_PUBLIC_URL="http://localhost:8080"    # or your BFF public URL
```

The BFF will automatically use these credentials when initializing the OAuth client.

## Workflow

1. **Start the AIP server** (ensure it's running and accessible)
2. **Register the client**: `bash scripts/register_oauth_client.sh`
3. **Set environment variables** from the script output
4. **Start the BFF application** - it will automatically use the registered client
5. **Test the OAuth flow**: `bash scripts/test_aip_endpoints.sh` (optional)

## Troubleshooting

### "Failed to fetch AIP OAuth metadata"
- Ensure the AIP server is running on the expected URL
- Check that the server supports the `/.well-known/oauth-authorization-server` endpoint

### "Could not find registration endpoint"
- The AIP server may not support dynamic client registration
- Check the server configuration and ensure RFC 7591 support is enabled

### "Failed to register client"
- Check the server logs for detailed error messages
- Ensure the registration request format is correct
- Verify the server accepts the requested scopes and grant types

### "Client registration may have failed"
- This error in the BFF indicates the client credentials are missing
- Run the registration script and set the environment variables
- Restart the BFF application after setting credentials
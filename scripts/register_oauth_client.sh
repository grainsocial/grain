#!/bin/bash

# OAuth Dynamic Client Registration Script
# Registers a new OAuth client with the AIP server per RFC 7591
# Usage: bash register_oauth_client.sh

set -e  # Exit on any error

# Configuration
AIP_BASE="${AIP_BASE_URL:-http://localhost:8081}"
CLIENT_BASE_URL="${CLIENT_BASE_URL:-http://localhost:8080}"
CLIENT_NAME="${CLIENT_NAME:-Grain BFF Client}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_FILE="$SCRIPT_DIR/oauth_client.conf"

echo "🚀 OAuth Dynamic Client Registration"
echo "AIP Server: $AIP_BASE"
echo "Client Base URL: $CLIENT_BASE_URL"
echo

# Check if client is already registered
if [ -f "$CONFIG_FILE" ]; then
    echo "⚠️  Existing client configuration found at $CONFIG_FILE"
    echo -n "Do you want to register a new client? This will overwrite the existing config. (y/N): "
    read -r OVERWRITE
    if [ "$OVERWRITE" != "y" ] && [ "$OVERWRITE" != "Y" ]; then
        echo "❌ Registration cancelled"
        exit 1
    fi
fi

echo "🔍 Using known OAuth registration endpoint..."
REGISTRATION_ENDPOINT="$AIP_BASE/oauth/clients/register"

echo "✅ Registration endpoint: $REGISTRATION_ENDPOINT"
echo

# Create client registration request
echo "📝 Creating client registration request..."
REDIRECT_URI="$CLIENT_BASE_URL/oauth/callback"

REGISTRATION_REQUEST=$(cat <<EOF
{
    "client_name": "$CLIENT_NAME",
    "redirect_uris": ["$REDIRECT_URI"],
    "scope": "atproto:atproto atproto:transition:generic",
    "grant_types": ["authorization_code", "refresh_token"],
    "response_types": ["code"],
    "token_endpoint_auth_method": "client_secret_basic"
}
EOF
)

echo "Registration request:"
echo "$REGISTRATION_REQUEST" | jq '.' || echo "$REGISTRATION_REQUEST"
echo

# Register the client
echo "🔄 Registering client with AIP server..."
REGISTRATION_RESPONSE=$(curl -s -X POST "$REGISTRATION_ENDPOINT" \
    -H "Content-Type: application/json" \
    -d "$REGISTRATION_REQUEST" || {
        echo "❌ Failed to register client with AIP server"
        exit 1
    })

echo "Registration response:"
echo "$REGISTRATION_RESPONSE" | jq '.' || echo "$REGISTRATION_RESPONSE"
echo

# Extract client credentials
CLIENT_ID=$(echo "$REGISTRATION_RESPONSE" | grep -o '"client_id":"[^"]*' | cut -d'"' -f4)
CLIENT_SECRET=$(echo "$REGISTRATION_RESPONSE" | grep -o '"client_secret":"[^"]*' | cut -d'"' -f4)

if [ -z "$CLIENT_ID" ] || [ -z "$CLIENT_SECRET" ]; then
    echo "❌ Failed to extract client credentials from registration response"
    echo "Expected client_id and client_secret in response"
    exit 1
fi

echo "✅ Client registered successfully!"
echo "Client ID: $CLIENT_ID"
echo "Client Secret: [REDACTED]"
echo

# Save credentials to configuration file
echo "💾 Saving client credentials to $CONFIG_FILE..."
cat > "$CONFIG_FILE" <<EOF
CLIENT_ID="$CLIENT_ID"
CLIENT_SECRET="$CLIENT_SECRET"
EOF

echo "✅ Client registration complete!"
echo
echo "📋 Summary:"
echo "  - Client ID: $CLIENT_ID"
echo "  - Redirect URI: $REDIRECT_URI"
echo "  - Scopes: atproto:atproto atproto:transition:generic"
echo "  - Config saved to: $CONFIG_FILE"
echo
echo "🔧 You can now use these credentials in your application:"
echo "  export BFF_AIP_CLIENT_ID=\"$CLIENT_ID\""
echo "  export BFF_AIP_CLIENT_SECRET=\"$CLIENT_SECRET\""
echo
echo "💡 To test the OAuth flow, run:"
echo "  bash $SCRIPT_DIR/test_aip_endpoints.sh"
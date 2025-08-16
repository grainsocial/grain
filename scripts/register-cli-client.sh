#!/bin/bash

# Register grain-cli client for authorization code flow
set -e

# Configuration
AIP_BASE_URL="${AIP_BASE_URL:-http://localhost:8081}"
REGISTRATION_ENDPOINT="${AIP_BASE_URL}/oauth/clients/register"

echo "🚀 Registering grain-cli client for authorization code flow..."

# Create the registration request JSON
request_json=$(cat <<EOF
{
    "client_name": "grain-cli",
    "grant_types": ["authorization_code", "refresh_token"],
    "response_types": ["code"],
    "redirect_uris": ["http://localhost:8787/callback"],
    "token_endpoint_auth_method": "none",
    "application_type": "native",
    "software_id": "social.grain.cli",
    "software_version": "0.1.0"
}
EOF
)

echo "📝 Registration request:"
echo "$request_json" | jq '.' 2>/dev/null || echo "$request_json"
echo ""

# Make the registration request
response=$(curl -s -w "%{http_code}" \
    -X POST \
    -H "Content-Type: application/json" \
    -d "$request_json" \
    "$REGISTRATION_ENDPOINT")

status_code="${response: -3}"
response_body="${response%???}"

if [[ "$status_code" == "200" || "$status_code" == "201" ]]; then
    echo "✅ Client registered successfully!"
    echo "$response_body" | jq '.' 2>/dev/null || echo "$response_body"

    # Extract client ID
    client_id=$(echo "$response_body" | jq -r '.client_id // empty' 2>/dev/null)
    if [[ -n "$client_id" ]]; then
        echo ""
        echo "🔑 New Client ID: $client_id"
        echo "📝 Update your CLI to use this client ID"
    fi
else
    echo "❌ Registration failed (HTTP $status_code)"
    echo "$response_body"
    exit 1
fi

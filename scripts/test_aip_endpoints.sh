#!/bin/bash

# Simple OAuth flow - just generates URL and waits for you to paste the code
# Usage: bash test_ai[_endpoints.sh

# Load client credentials from external file
if [ -f "oauth_client.conf" ]; then
    source oauth_client.conf
elif [ -f "scripts/oauth_client.conf" ]; then
    source scripts/oauth_client.conf
else
    echo "❌ oauth_client.conf not found"
    echo "Please create oauth_client.conf with:"
    echo "CLIENT_ID=\"your-client-id\""
    echo "CLIENT_SECRET=\"your-client-secret\""
    exit 1
fi
REDIRECT_URI="http://localhost:3000/callback"
AIP_BASE="http://localhost:8081"
EXTERNAL_BASE="https://f77e9af5359a.ngrok-free.app"
LOGIN_HINT="chadtmiller.com"

echo "🚀 Simple OAuth Flow for AIP API Testing"
echo

# Generate fresh PKCE parameters
echo "🔑 Generating PKCE parameters..."
CODE_VERIFIER=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-43)
CODE_CHALLENGE=$(echo -n "$CODE_VERIFIER" | openssl dgst -sha256 -binary | base64 | tr '+/' '-_' | tr -d '=')
STATE=$(openssl rand -base64 32 | tr -d "=+/")

echo "Code verifier: $CODE_VERIFIER"
echo "Code challenge: $CODE_CHALLENGE"
echo "State: $STATE"
echo

# Build authorization URL
AUTH_URL="${EXTERNAL_BASE}/oauth/authorize?client_id=${CLIENT_ID}&response_type=code&redirect_uri=${REDIRECT_URI}&state=${STATE}&code_challenge=${CODE_CHALLENGE}&code_challenge_method=S256&scope=atproto:atproto&login_hint=${LOGIN_HINT}"

echo "📋 Please visit this URL in your browser:"
echo "$AUTH_URL"
echo
echo "📝 After authorization, you'll be redirected to a callback URL like:"
echo "http://localhost:3000/callback?code=XXXXXXX&state=XXXXXXX"
echo
echo -n "🔄 Please paste the 'code' parameter from the callback URL: "
read -r AUTH_CODE

if [ -z "$AUTH_CODE" ]; then
    echo "❌ No authorization code provided. Exiting."
    exit 1
fi

echo
echo "🔄 Exchanging authorization code for access token..."
TOKEN_RESPONSE=$(curl -s -X POST "$AIP_BASE/oauth/token" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    -d "grant_type=authorization_code&code=$AUTH_CODE&redirect_uri=$REDIRECT_URI&client_id=$CLIENT_ID&client_secret=$CLIENT_SECRET&code_verifier=$CODE_VERIFIER")

echo "Token response: $TOKEN_RESPONSE"

# Extract access token
ACCESS_TOKEN=$(echo "$TOKEN_RESPONSE" | grep -o '"access_token":"[^"]*' | cut -d'"' -f4)

if [ -n "$ACCESS_TOKEN" ]; then
    echo "✅ Access token: $ACCESS_TOKEN"

    # Test protected endpoints with token
    echo
    echo "🧪 Testing protected endpoints with token..."

    echo "🔐 /api/atprotocol/session:"
    curl -s -H "Authorization: Bearer $ACCESS_TOKEN" "$AIP_BASE/api/atprotocol/session" | jq '.' || curl -s -H "Authorization: Bearer $ACCESS_TOKEN" "$AIP_BASE/api/atprotocol/session"
    echo

    echo "👤 /oauth/userinfo:"
    curl -s -H "Authorization: Bearer $ACCESS_TOKEN" "$AIP_BASE/oauth/userinfo" | jq '.' || curl -s -H "Authorization: Bearer $ACCESS_TOKEN" "$AIP_BASE/oauth/userinfo"
    echo

    # Save token for future use
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    echo "$ACCESS_TOKEN" > "$SCRIPT_DIR/access_token.txt"
    echo "💾 Access token saved to $SCRIPT_DIR/access_token.txt"

    echo "✅ OAuth flow and API testing complete!"
else
    echo "❌ Failed to extract access token from response"
fi

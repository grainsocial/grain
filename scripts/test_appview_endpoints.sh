#!/bin/bash

# Test script for /api/test/whoami and /api/test/session endpoints
# Usage: bash test_appview_endpoints.sh [access_token]

APPVIEW_BASE="http://localhost:8080"

# Get access token from argument or file
if [ -n "$1" ]; then
    ACCESS_TOKEN="$1"
elif [ -f "access_token.txt" ]; then
    ACCESS_TOKEN=$(cat access_token.txt)
else
    echo "❌ No access token provided"
    echo "Usage: $0 [access_token]"
    echo "Or ensure access_token.txt exists in the current directory"
    exit 1
fi

if [ -z "$ACCESS_TOKEN" ]; then
    echo "❌ Access token is empty"
    exit 1
fi

echo "🧪 Testing appview token endpoints"
echo "🔑 Using access token: ${ACCESS_TOKEN:0:20}..."
echo

# Test /api/test/whoami
echo "👤 Testing /api/test/whoami:"
echo "curl -v -H \"Authorization: Bearer \$TOKEN\" \"$APPVIEW_BASE/api/test/whoami\""
WHOAMI_RESPONSE=$(curl -v -H "Authorization: Bearer $ACCESS_TOKEN" "$APPVIEW_BASE/api/test/whoami" 2>&1)
echo "Response:"
echo "$WHOAMI_RESPONSE" | grep -E "(\{|\}|success|error|message)" || echo "$WHOAMI_RESPONSE"
echo

# Test /api/test/session
echo "🔐 Testing /api/test/session:"
echo "curl -s -H \"Authorization: Bearer \$TOKEN\" \"$APPVIEW_BASE/api/test/session\""
SESSION_RESPONSE=$(curl -s -H "Authorization: Bearer $ACCESS_TOKEN" "$APPVIEW_BASE/api/test/session")
echo "$SESSION_RESPONSE" | jq '.' 2>/dev/null || echo "$SESSION_RESPONSE"
echo

# Test public endpoint for comparison (no auth required)
echo "🌍 Testing /api/test/public (no auth required):"
echo "curl -s \"$APPVIEW_BASE/api/test/public\""
PUBLIC_RESPONSE=$(curl -s "$APPVIEW_BASE/api/test/public")
echo "$PUBLIC_RESPONSE" | jq '.' 2>/dev/null || echo "$PUBLIC_RESPONSE"
echo

echo "✅ Endpoint testing complete!"

#!/bin/bash

# AIP Flutter OAuth Client Registration Script
# This script registers the Flutter mobile app as a public OAuth client
# with the AIP OAuth server using RFC 7591 dynamic client registration.

set -e

# Configuration
AIP_BASE_URL="${AIP_BASE_URL:-http://localhost:8081}"
REGISTRATION_ENDPOINT="${AIP_BASE_URL}/oauth/clients/register"
CLIENT_ID="${CLIENT_ID:-grainflutter}"
CLIENT_NAME="${CLIENT_NAME:-Grain Flutter App}"
SOFTWARE_ID="${SOFTWARE_ID:-social.grain.flutter}"
SOFTWARE_VERSION="${SOFTWARE_VERSION:-1.0.0}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 AIP Flutter OAuth Client Registration Script${NC}"
echo "================================================"
echo ""

# Function to check if AIP server is running
check_aip_server() {
    echo -e "${BLUE}🔍 Checking if AIP server is running at ${AIP_BASE_URL}...${NC}"

    if curl -s "${AIP_BASE_URL}/.well-known/oauth-authorization-server" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ AIP server is running${NC}"
    else
        echo -e "${RED}❌ AIP server is not running at ${AIP_BASE_URL}${NC}"
        echo "Please start the AIP server first:"
        echo "  cd aip && cargo run"
        exit 1
    fi
}

# Function to register the Flutter client
register_flutter_client() {
    echo -e "${BLUE}📝 Registering Flutter client: ${CLIENT_NAME}${NC}"

    # Create the registration request JSON for a public client
    local request_json=$(cat <<EOF
{
    "client_id": "${CLIENT_ID}",
    "client_name": "${CLIENT_NAME}",
    "redirect_uris": ["grainflutter://oauth/callback"],
    "grant_types": ["authorization_code", "refresh_token"],
    "response_types": ["code"],
    "token_endpoint_auth_method": "none",
    "application_type": "native",
    "software_id": "${SOFTWARE_ID}",
    "software_version": "${SOFTWARE_VERSION}",
    "scope": "atproto:atproto",
    "code_challenge_methods_supported": ["S256"],
    "require_auth_time": false,
    "default_max_age": 86400,
    "client_uri": "https://grain.social",
    "policy_uri": "https://grain.social/privacy",
    "tos_uri": "https://grain.social/terms"
}
EOF
)

    echo -e "${YELLOW}Registration Request:${NC}"
    echo "$request_json" | jq '.' 2>/dev/null || echo "$request_json"
    echo ""

    # Make the registration request
    echo -e "${BLUE}🔗 Sending registration request to: ${REGISTRATION_ENDPOINT}${NC}"

    # Create temporary files for response
    local temp_response=$(mktemp)

    # Make the request and capture response and status code separately
    local status_code=$(curl -s -w "%{http_code}" \
        -o "$temp_response" \
        -X POST \
        -H "Content-Type: application/json" \
        -d "$request_json" \
        "$REGISTRATION_ENDPOINT")

    local response_body=$(cat "$temp_response")

    # Clean up temp files
    rm -f "$temp_response"

    if [[ "$status_code" == "200" || "$status_code" == "201" ]]; then
        echo -e "${GREEN}✅ Flutter client registered successfully!${NC}"
        echo -e "${YELLOW}Registration Response:${NC}"
        echo "$response_body" | jq '.' 2>/dev/null || echo "$response_body"

        # Extract key information
        local registered_client_id=$(echo "$response_body" | jq -r '.client_id // empty' 2>/dev/null)
        local registration_token=$(echo "$response_body" | jq -r '.registration_access_token // empty' 2>/dev/null)

        if [[ -n "$registered_client_id" ]]; then
            echo ""
            echo -e "${GREEN}📋 Flutter App Configuration Summary:${NC}"
            echo "  Client ID: $registered_client_id"
            echo "  Redirect URI: grainflutter://oauth/callback"
            echo "  Grant Types: authorization_code, refresh_token"
            echo "  Response Types: code"
            echo "  Authentication: none (public client)"
            echo "  Application Type: native"
            echo "  PKCE: Required (S256)"
            echo "  Scope: atproto"
            echo "  Software ID: $SOFTWARE_ID"
            echo "  Software Version: $SOFTWARE_VERSION"

            if [[ -n "$registration_token" ]]; then
                echo ""
                echo -e "${YELLOW}🔑 Registration access token (save for client management):${NC}"
                echo "  Registration Token: $registration_token"
            fi

            echo ""
            echo -e "${GREEN}✅ Your Flutter app is now configured to use:${NC}"
            echo "  - Client ID: $registered_client_id"
            echo "  - Redirect URI: grainflutter://oauth/callback"
            echo "  - Authorization Code flow with PKCE (S256)"
            echo "  - Automatic token refresh"
        fi

        return 0
    else
        echo -e "${RED}❌ Registration failed (HTTP $status_code)${NC}"
        echo -e "${RED}Error Response:${NC}"
        echo "$response_body" | jq '.' 2>/dev/null || echo "$response_body"
        return 1
    fi
}

# Function to show usage
show_usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "This script registers the Flutter mobile app as a public OAuth client"
    echo "with PKCE support for secure authorization code flow."
    echo ""
    echo "Options:"
    echo "  -h, --help           Show this help message"
    echo "  --client-id ID       Custom client ID (default: grainflutter)"
    echo "  --client-name NAME   Custom client name (default: Grain Flutter App)"
    echo "  --software-id ID     Custom software ID (default: social.grain.flutter)"
    echo "  --version VERSION    Software version (default: 1.0.0)"
    echo ""
    echo "Environment Variables:"
    echo "  AIP_BASE_URL  - Base URL of AIP server (default: http://localhost:8081)"
    echo ""
    echo "Example:"
    echo "  $0"
    echo "  $0 --client-id myflutter --client-name \"My Flutter App\""
    echo "  AIP_BASE_URL=https://aip.example.com $0"
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            show_usage
            exit 0
            ;;
        --client-id)
            CLIENT_ID="$2"
            shift 2
            ;;
        --client-name)
            CLIENT_NAME="$2"
            shift 2
            ;;
        --software-id)
            SOFTWARE_ID="$2"
            shift 2
            ;;
        --version)
            SOFTWARE_VERSION="$2"
            shift 2
            ;;
        *)
            echo -e "${RED}❌ Unknown option: $1${NC}"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

# Main execution
main() {
    # Check if jq is available for JSON formatting
    if command -v jq > /dev/null 2>&1; then
        echo -e "${BLUE}📦 JSON formatting available (jq found)${NC}"
    else
        echo -e "${YELLOW}⚠️  Install 'jq' for better JSON formatting${NC}"
    fi

    echo -e "${BLUE}Configuration:${NC}"
    echo "  AIP Base URL: $AIP_BASE_URL"
    echo "  Client ID: $CLIENT_ID"
    echo "  Client Name: $CLIENT_NAME"
    echo "  Software ID: $SOFTWARE_ID"
    echo "  Software Version: $SOFTWARE_VERSION"
    echo ""

    # Check if AIP server is running
    check_aip_server
    echo ""

    # Register the Flutter client
    if register_flutter_client; then
        echo ""
        echo -e "${GREEN}🎉 Flutter client registration completed successfully!${NC}"
        echo ""
        echo -e "${BLUE}Next steps:${NC}"
        echo "1. The Flutter app auth.dart is already configured with client ID: $CLIENT_ID"
        echo "2. Make sure AIP_URL in flutter/.env points to your AIP instance"
        echo "3. Build and run the Flutter app - OAuth flow should work automatically"
        echo "4. Users will be redirected to AIP for authentication and back to the app"
        echo ""
        echo -e "${YELLOW}Flutter Configuration Notes:${NC}"
        echo "• URL Scheme: grainflutter:// (already configured in manifests)"
        echo "• Auth Flow: Authorization Code + PKCE (S256)"
        echo "• Token Management: Automatic refresh when needed"
        echo "• Security: No client secret needed (public client)"
    else
        echo ""
        echo -e "${RED}❌ Flutter client registration failed${NC}"
        exit 1
    fi
}

# Run the main function
main "$@"

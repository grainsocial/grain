#!/bin/bash

# Test Flutter OAuth Client Registration
# This script verifies that the Flutter client is properly registered with AIP

set -e

# Configuration
AIP_BASE_URL="${AIP_BASE_URL:-http://localhost:8081}"
CLIENT_ID="${CLIENT_ID:-grainflutter}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}🧪 Testing Flutter OAuth Client Registration${NC}"
echo "============================================="
echo ""

# Function to test OAuth discovery endpoint
test_oauth_discovery() {
    echo -e "${BLUE}🔍 Testing OAuth discovery endpoint...${NC}"
    
    local discovery_url="${AIP_BASE_URL}/.well-known/oauth-authorization-server"
    local response=$(curl -s "$discovery_url" 2>/dev/null || echo "")
    
    if [[ -n "$response" ]]; then
        echo -e "${GREEN}✅ OAuth discovery endpoint accessible${NC}"
        
        # Check for required endpoints
        local auth_endpoint=$(echo "$response" | jq -r '.authorization_endpoint // empty' 2>/dev/null)
        local token_endpoint=$(echo "$response" | jq -r '.token_endpoint // empty' 2>/dev/null)
        local revoke_endpoint=$(echo "$response" | jq -r '.revocation_endpoint // empty' 2>/dev/null)
        
        if [[ -n "$auth_endpoint" && -n "$token_endpoint" ]]; then
            echo -e "${GREEN}✅ Required OAuth endpoints found${NC}"
            echo "  Authorization: $auth_endpoint"
            echo "  Token: $token_endpoint"
            [[ -n "$revoke_endpoint" ]] && echo "  Revocation: $revoke_endpoint"
        else
            echo -e "${RED}❌ Missing required OAuth endpoints${NC}"
            return 1
        fi
        
        # Check PKCE support
        local pkce_methods=$(echo "$response" | jq -r '.code_challenge_methods_supported[]? // empty' 2>/dev/null)
        if echo "$pkce_methods" | grep -q "S256"; then
            echo -e "${GREEN}✅ PKCE S256 support confirmed${NC}"
        else
            echo -e "${YELLOW}⚠️  PKCE S256 support not explicitly listed${NC}"
        fi
        
        return 0
    else
        echo -e "${RED}❌ OAuth discovery endpoint not accessible${NC}"
        return 1
    fi
}

# Function to test authorization endpoint with Flutter parameters
test_authorization_endpoint() {
    echo -e "${BLUE}🔍 Testing authorization endpoint with Flutter parameters...${NC}"
    
    # Generate test PKCE parameters
    local code_verifier=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-43 2>/dev/null || echo "test_code_verifier_12345678901234567890123")
    local code_challenge=$(echo -n "$code_verifier" | openssl dgst -sha256 -binary | openssl base64 | tr -d "=+/" 2>/dev/null || echo "test_code_challenge")
    local state=$(openssl rand -hex 16 2>/dev/null || echo "test_state_1234567890abcdef")
    
    local auth_url="${AIP_BASE_URL}/oauth/authorize"
    local params="response_type=code&client_id=${CLIENT_ID}&redirect_uri=grainflutter://oauth/callback&scope=atproto&state=${state}&code_challenge=${code_challenge}&code_challenge_method=S256&login_hint=test@example.com"
    
    echo -e "${YELLOW}Test Authorization URL:${NC}"
    echo "${auth_url}?${params}"
    echo ""
    
    # Test if the authorization endpoint accepts our parameters (should return 200 or redirect)
    local status_code=$(curl -s -w "%{http_code}" -o /dev/null "${auth_url}?${params}" 2>/dev/null || echo "000")
    
    if [[ "$status_code" == "200" || "$status_code" == "302" || "$status_code" == "301" ]]; then
        echo -e "${GREEN}✅ Authorization endpoint accepts Flutter parameters (HTTP $status_code)${NC}"
        echo "  This indicates the client registration is working correctly"
        return 0
    elif [[ "$status_code" == "400" ]]; then
        echo -e "${YELLOW}⚠️  Authorization endpoint returned HTTP 400${NC}"
        echo "  This might indicate missing client registration or invalid parameters"
        echo "  Run register-flutter-client.sh to register the client first"
        return 1
    else
        echo -e "${RED}❌ Authorization endpoint test failed (HTTP $status_code)${NC}"
        return 1
    fi
}

# Function to show Flutter app configuration
show_flutter_config() {
    echo -e "${BLUE}📱 Flutter App Configuration Status${NC}"
    echo ""
    
    # Check if Flutter auth.dart exists and contains our client ID
    local flutter_auth_file="../flutter/lib/auth.dart"
    if [[ -f "$flutter_auth_file" ]]; then
        echo -e "${GREEN}✅ Flutter auth.dart found${NC}"
        
        if grep -q "grainflutter" "$flutter_auth_file"; then
            echo -e "${GREEN}✅ Client ID 'grainflutter' configured in auth.dart${NC}"
        else
            echo -e "${YELLOW}⚠️  Client ID might not be configured correctly in auth.dart${NC}"
        fi
        
        if grep -q "grainflutter://oauth/callback" "$flutter_auth_file"; then
            echo -e "${GREEN}✅ Redirect URI configured in auth.dart${NC}"
        else
            echo -e "${YELLOW}⚠️  Redirect URI might not be configured correctly${NC}"
        fi
    else
        echo -e "${RED}❌ Flutter auth.dart not found${NC}"
    fi
    
    # Check Android manifest
    local android_manifest="../flutter/android/app/src/main/AndroidManifest.xml"
    if [[ -f "$android_manifest" ]]; then
        echo -e "${GREEN}✅ Android manifest found${NC}"
        
        if grep -q "grainflutter" "$android_manifest"; then
            echo -e "${GREEN}✅ URL scheme configured in Android manifest${NC}"
        else
            echo -e "${RED}❌ URL scheme not configured in Android manifest${NC}"
        fi
    else
        echo -e "${YELLOW}⚠️  Android manifest not found${NC}"
    fi
    
    # Check iOS Info.plist
    local ios_plist="../flutter/ios/Runner/Info.plist"
    if [[ -f "$ios_plist" ]]; then
        echo -e "${GREEN}✅ iOS Info.plist found${NC}"
        
        if grep -q "grainflutter" "$ios_plist"; then
            echo -e "${GREEN}✅ URL scheme configured in iOS Info.plist${NC}"
        else
            echo -e "${RED}❌ URL scheme not configured in iOS Info.plist${NC}"
        fi
    else
        echo -e "${YELLOW}⚠️  iOS Info.plist not found${NC}"
    fi
}

# Function to show next steps
show_next_steps() {
    echo ""
    echo -e "${BLUE}🚀 Next Steps for Flutter OAuth Testing${NC}"
    echo ""
    echo "1. Register the Flutter client (if not done already):"
    echo "   ./register-flutter-client.sh"
    echo ""
    echo "2. Configure Flutter environment:"
    echo "   cd ../flutter"
    echo "   echo 'AIP_URL=${AIP_BASE_URL}' >> .env"
    echo ""
    echo "3. Build and run the Flutter app:"
    echo "   flutter run"
    echo ""
    echo "4. Test the OAuth flow:"
    echo "   - Open the app"
    echo "   - Enter a username"
    echo "   - You should be redirected to AIP for authentication"
    echo "   - After authentication, you should be redirected back to the app"
    echo ""
    echo -e "${YELLOW}🔧 Troubleshooting:${NC}"
    echo "• If authorization fails: Check client registration and AIP server logs"
    echo "• If redirect fails: Verify URL scheme in Android/iOS manifests"
    echo "• If token exchange fails: Check AIP server OAuth endpoints"
}

# Main execution
main() {
    echo -e "${BLUE}Configuration:${NC}"
    echo "  AIP Base URL: $AIP_BASE_URL"
    echo "  Client ID: $CLIENT_ID"
    echo ""
    
    # Test OAuth discovery
    if test_oauth_discovery; then
        echo ""
    else
        echo ""
        echo -e "${RED}❌ OAuth discovery test failed - please check AIP server${NC}"
        exit 1
    fi
    
    # Test authorization endpoint
    if test_authorization_endpoint; then
        echo ""
    else
        echo ""
    fi
    
    # Show Flutter configuration status
    show_flutter_config
    
    # Show next steps
    show_next_steps
}

# Check for help flag
if [[ "$1" == "--help" || "$1" == "-h" ]]; then
    echo "Usage: $0"
    echo ""
    echo "This script tests the Flutter OAuth client registration with AIP."
    echo ""
    echo "Environment Variables:"
    echo "  AIP_BASE_URL  - Base URL of AIP server (default: http://localhost:8081)"
    echo "  CLIENT_ID     - Flutter client ID (default: grainflutter)"
    exit 0
fi

# Run the main function
main "$@"
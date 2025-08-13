#!/bin/bash

# AIP Device Client Registration Script
# This script demonstrates how to register a CLI/native device application
# with the AIP OAuth server using RFC 7591 dynamic client registration.

set -e

# Configuration
AIP_BASE_URL="${AIP_BASE_URL:-http://localhost:8081}"
REGISTRATION_ENDPOINT="${AIP_BASE_URL}/oauth/clients/register"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 AIP Device Client Registration Script${NC}"
echo "================================================"

# Function to check if AIP server is running
check_aip_server() {
    echo -e "${BLUE}🔍 Checking if AIP server is running at ${AIP_BASE_URL}...${NC}"
    
    if curl -s "${AIP_BASE_URL}/.well-known/oauth-authorization-server" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ AIP server is running${NC}"
    else
        echo -e "${RED}❌ AIP server is not running at ${AIP_BASE_URL}${NC}"
        echo "Please start the AIP server first:"
        echo "  cd /path/to/aip && cargo run"
        exit 1
    fi
}

# Function to register a device client
register_device_client() {
    local client_name="$1"
    local software_id="$2"
    local software_version="$3"
    
    echo -e "${BLUE}📝 Registering device client: ${client_name}${NC}"
    
    # Create the registration request JSON
    local request_json=$(cat <<EOF
{
    "client_name": "${client_name}",
    "grant_types": ["urn:ietf:params:oauth:grant-type:device_code"],
    "response_types": ["device_code"],
    "token_endpoint_auth_method": "none",
    "application_type": "native",
    "software_id": "${software_id}",
    "software_version": "${software_version}"
}
EOF
)
    
    echo -e "${YELLOW}Request JSON:${NC}"
    echo "$request_json" | jq '.' 2>/dev/null || echo "$request_json"
    echo ""
    
    # Make the registration request
    echo -e "${BLUE}🔗 Sending registration request to: ${REGISTRATION_ENDPOINT}${NC}"
    
    # Create temporary files for response
    local temp_response=$(mktemp)
    local temp_headers=$(mktemp)
    
    # Make the request and capture response and status code separately
    local status_code=$(curl -s -w "%{http_code}" \
        -o "$temp_response" \
        -X POST \
        -H "Content-Type: application/json" \
        -d "$request_json" \
        "$REGISTRATION_ENDPOINT")
    
    local response_body=$(cat "$temp_response")
    
    # Clean up temp files
    rm -f "$temp_response" "$temp_headers"
    
    if [[ "$status_code" == "200" || "$status_code" == "201" ]]; then
        echo -e "${GREEN}✅ Device client registered successfully!${NC}"
        echo -e "${YELLOW}Registration Response:${NC}"
        echo "$response_body" | jq '.' 2>/dev/null || echo "$response_body"
        
        # Extract key information
        local client_id=$(echo "$response_body" | jq -r '.client_id // empty' 2>/dev/null)
        local registration_token=$(echo "$response_body" | jq -r '.registration_access_token // empty' 2>/dev/null)
        
        if [[ -n "$client_id" ]]; then
            echo ""
            echo -e "${GREEN}📋 CLI Configuration Summary:${NC}"
            echo "  Client ID: $client_id"
            echo "  Grant Types: device_code, refresh_token"
            echo "  Authentication: none (public client)"
            echo "  Application Type: native"
            echo "  Software ID: $software_id"
            echo "  Software Version: $software_version"
            
            if [[ -n "$registration_token" ]]; then
                echo ""
                echo -e "${YELLOW}🔑 Save this registration access token for client management:${NC}"
                echo "  Registration Token: $registration_token"
            fi
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
    echo "Usage: $0 [CLIENT_NAME] [SOFTWARE_ID] [SOFTWARE_VERSION]"
    echo ""
    echo "Examples:"
    echo "  $0 \"atproto-cli v1.2.0\" \"com.example.atproto-cli\" \"1.2.0\""
    echo "  $0 \"MyApp CLI\" \"com.mycompany.myapp-cli\" \"2.1.0\""
    echo ""
    echo "Environment Variables:"
    echo "  AIP_BASE_URL  - Base URL of AIP server (default: http://localhost:8081)"
    echo ""
    echo "The script will register a native device application that can use the device code flow."
}

# Main execution
main() {
    # Check for help flag
    if [[ "$1" == "--help" || "$1" == "-h" ]]; then
        show_usage
        exit 0
    fi
    
    # Check if jq is available for JSON formatting
    if command -v jq > /dev/null 2>&1; then
        echo -e "${BLUE}📦 JSON formatting available (jq found)${NC}"
    else
        echo -e "${YELLOW}⚠️  Install 'jq' for better JSON formatting${NC}"
    fi
    
    # Set default values or use provided arguments
    local client_name="${1:-atproto-cli v1.2.0}"
    local software_id="${2:-com.example.atproto-cli}"
    local software_version="${3:-1.2.0}"
    
    echo -e "${BLUE}Configuration:${NC}"
    echo "  AIP Base URL: $AIP_BASE_URL"
    echo "  Client Name: $client_name"
    echo "  Software ID: $software_id"
    echo "  Software Version: $software_version"
    echo ""
    
    # Check if AIP server is running
    check_aip_server
    
    # Register the device client
    if register_device_client "$client_name" "$software_id" "$software_version"; then
        echo ""
        echo -e "${GREEN}🎉 Device client registration completed successfully!${NC}"
        echo ""
        echo -e "${BLUE}Next steps for CLI integration:${NC}"
        echo "1. Use the client_id in your CLI application"
        echo "2. Implement device code flow (RFC 8628)"
        echo "3. Use 'none' authentication method (public client)"
        echo "4. Request device_code and refresh_token grant types"
    else
        echo ""
        echo -e "${RED}❌ Device client registration failed${NC}"
        exit 1
    fi
}

# Run the main function
main "$@"
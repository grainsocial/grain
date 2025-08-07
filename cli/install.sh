#!/bin/bash

set -e

echo "🌾 Installing Grain CLI..."

# Detect OS and architecture
OS=$(uname -s | tr '[:upper:]' '[:lower:]')
ARCH=$(uname -m)

# Map architecture names
case $ARCH in
    x86_64)
        ARCH="x86_64"
        ;;
    arm64|aarch64)
        ARCH="aarch64"
        ;;
    *)
        echo "❌ Unsupported architecture: $ARCH"
        exit 1
        ;;
esac

# Set GitHub repository (replace with your actual repo)
REPO="grainsocial/grain"
BINARY_NAME="grain-${OS}-${ARCH}"

echo "📦 Downloading Grain CLI for ${OS}-${ARCH}..."

# Download pre-built binary
if ! curl -L "https://github.com/${REPO}/releases/latest/download/${BINARY_NAME}" -o grain; then
    echo "❌ Pre-built binary not available for ${OS}-${ARCH}"
    echo "Please build from source instead:"
    echo "  cargo build --release"
    exit 1
fi

# Make executable
chmod +x grain

# Install to system
echo "🔗 Installing to /usr/local/bin (requires sudo)..."
sudo mv grain /usr/local/bin/

echo "✅ Grain CLI installed successfully!"
echo "📖 Run 'grain --help' to get started"
echo "🔐 Run 'grain login' to authenticate"

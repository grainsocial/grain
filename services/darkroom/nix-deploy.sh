#!/usr/bin/env bash

set -e

echo "🔨 Building darkroom with Nix..."
nix build .#darkroomImg

echo "📦 Loading Docker image..."
./result | docker image load

echo "🏷️ Tagging image for Fly.io..."
docker image tag darkroom:latest registry.fly.io/grain-darkroom:latest

echo "🚀 Pushing to Fly.io registry..."
docker push registry.fly.io/grain-darkroom:latest

echo "✅ Build and push complete!"
echo "Deploy with: flyctl deploy -c fly.toml -a grain-darkroom"

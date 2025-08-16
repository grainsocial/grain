#!/bin/bash
set -e

echo "🔧 Updating SQLx query cache for both SQLite and PostgreSQL..."

# Change to the aip directory if not already there
cd "$(dirname "$0")/.."

# Remove existing .sqlx folder
if [ -d .sqlx ]; then
    echo "🗑️  Removing existing .sqlx folder..."
    rm -rf .sqlx
fi

# Clean up any existing temporary caches
rm -rf .sqlx-sqlite .sqlx-postgres

echo "🗄️  Generating SQLite query cache..."
export SQLX_OFFLINE=false
export DATABASE_URL="sqlite:///tmp/aip-sqlx-cache.db"

# Create SQLite database and run migrations
sqlx database create
sqlx migrate run --source migrations/sqlite

# Generate SQLite cache
cargo sqlx prepare --database-url="$DATABASE_URL" -- --no-default-features --features sqlite,embed

# Save SQLite cache
mv .sqlx .sqlx-sqlite

echo "🐘 Generating PostgreSQL query cache..."

# Start PostgreSQL in Docker for cache generation
echo "Starting temporary PostgreSQL container..."
POSTGRES_CONTAINER="aip-sqlx-postgres-temp"
docker run -d --name "$POSTGRES_CONTAINER" \
    -e POSTGRES_DB=aip_cache \
    -e POSTGRES_USER=aip \
    -e POSTGRES_PASSWORD=aip_cache_password \
    -p 5433:5432 \
    postgres:15

# Wait for PostgreSQL to be ready
echo "Waiting for PostgreSQL to be ready..."
sleep 5

export DATABASE_URL="postgresql://aip:aip_cache_password@localhost:5433/aip_cache"

# Create PostgreSQL database and run migrations
sqlx database create
sqlx migrate run --source migrations/postgres

# Generate PostgreSQL cache
cargo sqlx prepare --database-url="$DATABASE_URL" -- --no-default-features --features postgres,embed

# Save PostgreSQL cache
mv .sqlx .sqlx-postgres

# Stop and remove PostgreSQL container
echo "Stopping PostgreSQL container..."
docker stop "$POSTGRES_CONTAINER"
docker rm "$POSTGRES_CONTAINER"

echo "🔀 Merging SQLite and PostgreSQL caches..."

# Create merged .sqlx directory
mkdir -p .sqlx

# Copy all files from both caches, PostgreSQL takes precedence for conflicts
cp -r .sqlx-sqlite/* .sqlx/
cp -r .sqlx-postgres/* .sqlx/

# Clean up temporary directories
rm -rf .sqlx-sqlite .sqlx-postgres

echo "✅ SQLx cache updated successfully!"
echo "📋 Summary:"
echo "   - Generated SQLite query cache"
echo "   - Generated PostgreSQL query cache" 
echo "   - Merged both caches into .sqlx/"

echo ""
echo "🔍 Cache contents:"
find .sqlx -name "*.json" | wc -l | xargs echo "   - Total query files:"
ls -la .sqlx

echo ""
echo "💡 Next steps:"
echo "   1. Test both database builds: nix build .#aip-sqlite && nix build .#aip-postgres"
echo "   2. If successful, commit the updated .sqlx folder:"
echo "      git add .sqlx"
echo "      git commit -m 'Update SQLx query cache for SQLite and PostgreSQL'"
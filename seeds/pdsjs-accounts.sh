#!/usr/bin/env bash
# Give the two pds.js dev PDSes an account each.
#
# pds.js hosts one account per instance and has no signup endpoint that works
# over plain http — its server-side onboarding bakes an https:// endpoint into
# the genesis PLC operation, which nothing local can reach. So identities are
# minted the way the runclub example mints them: pds.js's own setup script,
# which registers a did:plc naming the PDS URL verbatim and then hands the key
# to the server through /init.
#
# Needs a pds.js checkout. Point PDSJS_DIR at it if it isn't ~/code/pds.js.
#
#   docker compose up -d
#   ./seeds/pdsjs-accounts.sh
#
# Private keys land in data/, which is gitignored. Re-running against a PDS
# that already has an account fails at /init; `docker compose down -v` first.
set -euo pipefail

PDSJS_DIR="${PDSJS_DIR:-$HOME/code/pds.js}"
PLC_URL="${PLC_URL:-http://localhost:2582}"

# setup.js reads this from the environment and sends it to /init, which an
# empty server demands before it will adopt an identity. Matches the
# PDS_PASSWORD both containers are started with in docker-compose.yml.
export PDS_PASSWORD="${PDS_PASSWORD:-dev-password}"

if [ ! -f "$PDSJS_DIR/scripts/setup.js" ]; then
  echo "No pds.js checkout at $PDSJS_DIR — set PDSJS_DIR to one." >&2
  exit 1
fi

mkdir -p data/pdsjs
cd data/pdsjs

# The hostnames match docker-compose.yml's extra_hosts, so the URL baked into
# each DID document reaches the same PDS from the host and from inside the
# other container. Plain localhost would not: inside a container it is the
# container.
for entry in "spacehost|http://pdsjs-a.localhost:2584" "spacemember|http://pdsjs-b.localhost:2585"; do
  handle="${entry%%|*}"
  pds="${entry##*|}"

  if [ -f "credentials-$handle.json" ]; then
    echo "$handle already registered — skipping"
    continue
  fi

  # An initialized PDS refuses /init, and its signing key only exists in the
  # credentials file this script writes — so a server holding an account we
  # have no key for is unrecoverable, not retryable.
  if curl -fsS -m 5 "$pds/xrpc/com.atproto.server.describeServer" | grep -q '"did":"did:plc:'; then
    echo "$pds already hosts an account but credentials-$handle.json is missing." >&2
    echo "Wipe it and start over:" >&2
    echo "  docker compose rm -sfv pdsjs-a pdsjs-b" >&2
    echo "  docker volume rm ${COMPOSE_PROJECT_NAME:-bujumbura}_pdsjs_a_data ${COMPOSE_PROJECT_NAME:-bujumbura}_pdsjs_b_data" >&2
    exit 1
  fi

  # --relay-url is pointed at the local PDS on purpose: setup.js announces the
  # new host to a relay, and its default is the public one, which has no
  # business hearing about localhost.
  node "$PDSJS_DIR/scripts/setup.js" \
    --pds "$pds" \
    --plc-url "$PLC_URL" \
    --relay-url "${RELAY_URL:-http://localhost:2583}" \
    --handle "$handle"
done

echo
echo "Accounts (log in to grain with the DID — the dev relay cannot resolve these handles):"
for f in credentials-*.json; do
  node -e "const c=require('./$f');console.log(\`  \${c.handle.padEnd(24)} \${c.did}  \${c.pdsUrl}\`)"
done

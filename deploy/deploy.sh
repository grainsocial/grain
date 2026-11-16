#!/usr/bin/env bash
# Builds grain-serve on a host from this checkout and (re)starts it there.
#
#   deploy/deploy.sh <ssh destination> <domain>
#   GRAIN_HOST=root@host GRAIN_DOMAIN=grain.social deploy/deploy.sh
#
# or with those in deploy/local.env (see local.env.example).
#
# The image is built by the host's own docker, over SSH, from the root's
# Dockerfile, so nothing is cross-compiled here and no registry is
# involved. The build caches stay on the host, so a second deploy rebuilds
# only what changed.
#
# With no step named it does all of it. The steps, for a deploy workflow
# to build while the commit's checks run and roll out once they pass:
#
# - build: builds the image as a candidate, grain-serve:build-<commit>,
#   leaving grain-serve:current and what runs as they are, and removes any
#   other candidate an earlier deploy left;
# - up: makes the candidate grain-serve:current and restarts what changed;
# - drop: removes the candidate, for a deploy that will not go up.
#
# The commit is KNOTLESS_RUN_SHA, as knotless-run sets it, or HEAD.
#
# On a host whose docker drives cgroups (v2) with systemd, the build's
# steps run in the cgroup /system.slice/grain-serve-build, made here, with
# a cpu.weight (and io.weight) of 100, so that what serves comes first.
# GRAIN_BUILD_CGROUP names another parent; set empty, none.
#
# Optional, each written to the host's /etc/grain-serve/.env for
# docker-compose.yml: GRAIN_PROXY_NETWORK (grain-serve), the docker
# network the reverse proxy reaches grain-serve and its pages on;
# GRAIN_DATA (/mnt/data/grain-serve), its state on the host;
# GRAIN_JETSTREAM, the Jetstream it follows (set empty for none);
# GRAIN_BACKFILL, the collection directories it backfills from (set empty
# for none); GRAIN_CDN, grain's imgproxy; GRAIN_BSKY_APPVIEW;
# GRAIN_SIGN_UP_PDS; GRAIN_GROUP_HOST, the group host groups are
# started on; GRAIN_CARRY_COOKIES_UNTIL; GRAIN_APNS_KEY_ID,
# GRAIN_APNS_TEAM_ID, GRAIN_APNS_TOPIC and GRAIN_FCM_PROJECT_ID;
# GRAIN_ADMIN_DIDS, the accounts that moderate; GRAIN_LOG, what serve
# logs, as RUST_LOG takes it (info).
#
# The secrets are not sent from here: /etc/grain-serve/serve.env on the
# host holds them (deploy/README.md), and the push key files are under
# GRAIN_DATA/certs.
#
# serve and pages are moved with no downtime by deploy/rollout.sh: a new
# container beside the old, the old stopped once the new is healthy; a
# serve whose new build would migrate the index is stopped and started.

set -euo pipefail
cd "$(dirname "$0")/.."
# Settings for one's own host, kept out of the repository.
[ -f deploy/local.env ] && { set -a; . deploy/local.env; set +a; }

STEP=all
case "${1:-}" in build | up | drop) STEP=$1 && shift ;; esac
DEST="${1:-${GRAIN_HOST:-}}"
DOMAIN="${2:-${GRAIN_DOMAIN:-}}"
[ -n "$DEST" ] && [ -n "$DOMAIN" ] || { sed -n '4,5p' "$0" >&2; exit 2; }
NETWORK="${GRAIN_PROXY_NETWORK:-grain-serve}"
DATA="${GRAIN_DATA:-/mnt/data/grain-serve}"
SSH="ssh -o StrictHostKeyChecking=accept-new $DEST"
COMMIT="${KNOTLESS_RUN_SHA:-$(git rev-parse HEAD 2>/dev/null || echo local)}"
CANDIDATE="grain-serve:build-${COMMIT:0:12}"

# Says "$*" with the time and commit, here and in the host's
# /var/log/grain-serve-deploy.log, where rollout.sh adds its own lines: a
# freeze can be lined up against a deploy there.
say() {
  local line
  line="$(date -u +%Y-%m-%dT%H:%M:%SZ) ${COMMIT:0:12} → $*"
  echo "$line"
  printf '%s\n' "$line" | $SSH 'cat >> /var/log/grain-serve-deploy.log' 2>/dev/null || true
}

# Builds the candidate, behind the rest of the host where it can.
build() {
  # Candidates earlier deploys left: deploys go one at a time, so none of
  # them is still to go up.
  # shellcheck disable=SC2029
  $SSH "docker images --format '{{.Repository}}:{{.Tag}}' grain-serve | grep '^grain-serve:build-' | grep -vxF '$CANDIDATE' | xargs -r docker rmi >/dev/null || true"
  local cgroup
  if [ -n "${GRAIN_BUILD_CGROUP+set}" ]; then
    cgroup=$GRAIN_BUILD_CGROUP
  else
    # docker's buildkit puts each step's container in a cgroup of its own,
    # by path even under systemd. Given a parent, <parent>/buildkit/<id>.
    cgroup=$($SSH sh -s <<'SH'
[ "$(docker info --format '{{.CgroupDriver}} {{.CgroupVersion}}')" = "systemd 2" ] || exit 0
dir=/sys/fs/cgroup/system.slice/grain-serve-build
{ mkdir -p "$dir" && echo 100 >"$dir/cpu.weight"; } 2>/dev/null || exit 0
{ echo 100 >"$dir/io.weight"; } 2>/dev/null || true
echo /system.slice/grain-serve-build
SH
    )
  fi
  say "building $CANDIDATE on $DEST${cgroup:+, in $cgroup}"
  local began=$SECONDS
  DOCKER_HOST="ssh://$DEST" docker build ${cgroup:+--cgroup-parent "$cgroup"} \
    --build-arg "GRAIN_COMMIT=$COMMIT" -t "$CANDIDATE" .
  say "built $CANDIDATE in $((SECONDS - began))s"
  # buildkit keeps every layer it ever built, with no cap of its own. Keep
  # the 20 GB used last, which hold the cargo cache mounts this build read.
  $SSH "docker builder prune -f --max-used-space 20GB >/dev/null || true"
}

drop() {
  # shellcheck disable=SC2029
  $SSH "docker rmi '$CANDIDATE' >/dev/null 2>&1 || true"
  say "removed $CANDIDATE"
}

case "$STEP" in
  build)
    build
    exit
    ;;
  drop)
    drop
    exit
    ;;
  all) build ;;
esac

say "making $CANDIDATE grain-serve:current on $DEST"
# shellcheck disable=SC2029
$SSH "
  set -e
  docker image inspect '$CANDIDATE' >/dev/null 2>&1 || { echo 'no $CANDIDATE on the host: deploy.sh build first' >&2; exit 2; }
  docker tag '$CANDIDATE' grain-serve:current
  docker rmi '$CANDIDATE' >/dev/null
"

say "preparing $DEST"
$SSH "
  set -e
  mkdir -p /etc/grain-serve '$DATA' '$DATA/certs'
  chown 1000:1000 '$DATA'
  docker network inspect '$NETWORK' >/dev/null 2>&1 || docker network create '$NETWORK'
"
{
  echo "GRAIN_DOMAIN=$DOMAIN"
  echo "GRAIN_PROXY_NETWORK=$NETWORK"
  echo "GRAIN_DATA=$DATA"
  # Set, even empty: empty turns Jetstream, backfill or the Bluesky
  # appview off, where unset is compose's default.
  [ -z "${GRAIN_JETSTREAM+set}" ] || echo "GRAIN_JETSTREAM=$GRAIN_JETSTREAM"
  [ -z "${GRAIN_BACKFILL+set}" ] || echo "GRAIN_BACKFILL=$GRAIN_BACKFILL"
  [ -z "${GRAIN_BSKY_APPVIEW+set}" ] || echo "GRAIN_BSKY_APPVIEW=$GRAIN_BSKY_APPVIEW"
  for name in GRAIN_CDN GRAIN_SIGN_UP_PDS GRAIN_GROUP_HOST GRAIN_CARRY_COOKIES_UNTIL GRAIN_APNS_KEY_ID \
    GRAIN_APNS_TEAM_ID GRAIN_APNS_TOPIC GRAIN_FCM_PROJECT_ID GRAIN_ADMIN_DIDS GRAIN_LOG; do
    [ -z "${!name:-}" ] || echo "$name=${!name}"
  done
} | $SSH 'cat > /etc/grain-serve/.env'
scp -q -o StrictHostKeyChecking=accept-new deploy/docker-compose.yml deploy/rollout.sh "$DEST:/etc/grain-serve/"

# pages and serve roll over with no gap (rollout.sh). Each script sent to
# the host is one { } group, read whole before it runs, with stdin from
# /dev/null: nothing it runs can take the rest of the script as its input.
say "starting"
$SSH sh -s <<'SH'
{
  set -e
  cd /etc/grain-serve
  docker compose config --quiet
  sh rollout.sh pages serve
  docker compose up -d --remove-orphans
  docker compose ps
} </dev/null
SH

# Each deploy leaves the image it replaced untagged: remove those no
# container still runs.
say "removing images no container runs and no tag names"
$SSH "docker image prune -f >/dev/null || true"

say "done: https://$DOMAIN, once the proxy on $NETWORK serves it"

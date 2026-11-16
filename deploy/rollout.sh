#!/bin/sh
# Moves the services named onto what docker-compose.yml beside this script
# now says, one at a time, with no gap in between:
#
#   /etc/grain-serve/rollout.sh pages serve
#
# deploy.sh copies it to the host and runs it there. For each service that
# changed, a second container starts beside the running one, under the
# same names on the same networks; once its healthcheck passes, the old
# one is stopped, which finishes the requests it has (SIGTERM, then
# stop_grace_period), and removed. Until then both answer: the proxy and
# the services beside them reach a service by its name, which docker's DNS
# gives as every running container's address, and a dial to one not yet
# listening, or no longer, is refused and goes to the other.
#
# A new container that is not healthy within GRAIN_ROLLOUT_TIMEOUT
# seconds (180) is removed, the old one is left serving, and this fails.
#
# serve is rolled only if the new build keeps the index (`grain-serve
# --check-index`): both have it open while they overlap, and a build that
# migrates its tables would change them under the old one. Then serve is
# stopped and started instead, down until the new one listens. A new
# build that cannot answer the check, or finds the index past its own
# tables, is not started at all.

set -eu
cd "$(dirname "$0")"
TIMEOUT="${GRAIN_ROLLOUT_TIMEOUT:-180}"
# Where each line said is kept too, with its time, for a freeze to be
# lined up against a deploy: GRAIN_DEPLOY_LOG, beside deploy.sh's.
LOG="${GRAIN_DEPLOY_LOG:-/var/log/grain-serve-deploy.log}"

# Says "$*" with the time, here and in $LOG.
say() {
  line="$(date -u +%Y-%m-%dT%H:%M:%SZ) → $*"
  echo "$line"
  echo "$line" >>"$LOG" 2>/dev/null || true
}

# The service's containers, running or not, oldest first.
containers() {
  docker compose ps -aq "$1" | xargs -r docker inspect -f '{{.Created}} {{.Id}}' | sort | cut -d' ' -f2
}

# Whether container $1 is what the compose file now makes of service $2.
current() {
  [ "$(docker inspect -f '{{.Image}}' "$1")" = "$(docker image inspect -f '{{.Id}}' "$(docker inspect -f '{{.Config.Image}}' "$1")")" ] &&
    [ "$(docker inspect -f '{{index .Config.Labels "com.docker.compose.config-hash"}}' "$1")" = "$(docker compose config --hash "$2" | cut -d' ' -f2)" ] &&
    [ "$(docker inspect -f '{{.State.Running}}' "$1")" = true ]
}

# Waits for container $1 to pass its healthcheck, or to be running if it
# has none; fails if it does not within TIMEOUT.
healthy() {
  waited=0
  WAITED=0
  while [ "$waited" -lt "$TIMEOUT" ]; do
    case "$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$1")" in
      healthy | running) WAITED=$waited && return 0 ;;
    esac
    sleep 1
    waited=$((waited + 1))
  done
  return 1
}

roll() {
  svc=$1
  old=$(containers "$svc")
  if [ -z "$old" ]; then
    say "$svc: starting"
    docker compose up -d --no-deps "$svc"
    healthy "$(containers "$svc")" || { say "$svc never turned healthy" >&2; exit 1; }
    return
  fi
  if [ "$(echo "$old" | wc -l)" -eq 1 ] && current "$old" "$svc"; then
    say "$svc: unchanged"
    return
  fi
  if [ "$svc" = serve ]; then
    check=$(docker compose run --rm --no-deps -T -e RUST_LOG=off serve grain-serve --check-index /data/index.db 2>&1 || true)
    case "$check" in
      *"keeps it"*) ;;
      *"would migrate it"*)
        say "serve: $check"
        say "serve: so the old one stops first: down until the new one listens"
        docker compose up -d --no-deps --force-recreate serve
        healthy "$(containers serve)" || { say "serve never turned healthy" >&2; exit 1; }
        return
        ;;
      *)
        say "serve: the new build could not check the index; keeping the old one" >&2
        echo "$check" >&2
        exit 1
        ;;
    esac
  fi
  say "$svc: starting a new one beside $(echo "$old" | cut -c1-12 | tr '\n' ' ')"
  docker compose up -d --no-deps --no-recreate --scale "$svc=$(($(echo "$old" | wc -l) + 1))" "$svc"
  new=$(containers "$svc" | grep -vxF "$old")
  say "$svc: started $(echo "$new" | cut -c1-12)"
  if ! healthy "$new"; then
    say "$svc: the new one never turned healthy; keeping the old one" >&2
    docker logs --tail 50 "$new" >&2 || true
    docker rm -f "$new" >/dev/null
    exit 1
  fi
  say "$svc: healthy after ${WAITED}s; stopping the old one"
  # shellcheck disable=SC2086
  docker stop $old >/dev/null
  # shellcheck disable=SC2086
  docker rm $old >/dev/null
  say "$svc: the old one stopped"
}

for svc in "$@"; do
  roll "$svc"
done

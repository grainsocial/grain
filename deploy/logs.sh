#!/usr/bin/env bash
# Reads what grain-serve logs on the host (deploy/README.md, Logs):
#
#   deploy/logs.sh [serve|pages|deploys] [--since 30m] [--follow] [jq filter]
#
#   deploy/logs.sh serve 'select(.duration_ms > 1000)'
#   deploy/logs.sh serve --since 2h 'select(.level == "WARN" or .level == "ERROR")'
#   deploy/logs.sh pages --follow
#   deploy/logs.sh deploys
#
# They are read from the host's journal, so a container a rollout removed
# is read too. serve logs JSON lines, each run through the jq filter (`.`
# if none); lines that are not JSON are left out. pages logs plain text,
# and deploys is the host's /var/log/grain-serve-deploy.log, each shown
# as is. The host is GRAIN_HOST, from deploy/local.env, else grain's.

set -euo pipefail
cd "$(dirname "$0")/.."
[ -f deploy/local.env ] && { set -a; . deploy/local.env; set +a; }
DEST="${GRAIN_HOST:-root@167.233.237.163}"
SVC="${1:-serve}"
[ $# -eq 0 ] || shift
SINCE=30m
FOLLOW=
while [ $# -gt 0 ]; do
  case "$1" in
    --since) SINCE=$2 && shift 2 ;;
    --follow) FOLLOW=--follow && shift ;;
    *) break ;;
  esac
done
FILTER="${1:-.}"
SSH="ssh -o StrictHostKeyChecking=accept-new $DEST"
# This project's lines, as written, since then: journalctl takes `-30m`.
JOURNAL="journalctl --no-pager -o cat --since '-$SINCE' ${FOLLOW:+--follow} COM_DOCKER_COMPOSE_PROJECT=grain-serve"

case "$SVC" in
  deploys)
    # shellcheck disable=SC2029
    $SSH "tail -n 100 $FOLLOW /var/log/grain-serve-deploy.log"
    ;;
  serve)
    # Every container of the service, gone or running, both while a
    # rollout overlaps them.
    # shellcheck disable=SC2029
    $SSH "$JOURNAL COM_DOCKER_COMPOSE_SERVICE=serve" |
      jq -R -c --unbuffered "fromjson? | $FILTER"
    ;;
  pages)
    # shellcheck disable=SC2029
    $SSH "$JOURNAL COM_DOCKER_COMPOSE_SERVICE=pages"
    ;;
  *)
    sed -n '4p' "$0" >&2
    exit 2
    ;;
esac

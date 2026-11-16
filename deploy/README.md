# Deploying grain-serve

grain-serve and its pages run from one image, the root's `Dockerfile`, as two
services of the compose project in `deploy/docker-compose.yml`: `serve`,
grain-serve on 2600, and `pages`, the SvelteKit app in `web/` under
adapter-node on 2601. `deploy/deploy.sh` builds the image on the host and
rolls both over with `deploy/rollout.sh`, as knotless's deploy does.

```sh
cp deploy/local.env.example deploy/local.env   # GRAIN_HOST, GRAIN_DOMAIN, ...
just deploy                                    # deploy/deploy.sh
just logs serve 'select(.level == "WARN")'    # deploy/logs.sh
```

main deploys itself: on each push, `.knotless/workflows/deploy.yml` runs
`deploy/deploy.sh build` on the host while the commit's checks run, then
`deploy/deploy.sh up` once `check`, `test`, `web` and `lexicons` have all
passed, or `deploy/deploy.sh drop` when one fails or main has moved on.
Its `env:` is production's `deploy/local.env`: deploy.sh writes the host's
`/etc/grain-serve/.env` from it, whole, so a setting left out there is
unset on the host.

## On grain's host

grain's host (`~/code/hetzner-infra`, `stacks/grain`) runs one compose
project in `/etc/grain`: Caddy, the PDS, imgproxy and porxie. grain-serve
is a project of its own beside it, in `/etc/grain-serve`, as knotless's is
in `/etc/knotless`: deploy.sh writes `/etc/grain-serve/.env` and copies
`docker-compose.yml` and `rollout.sh` there, and keeps its state in
`GRAIN_DATA` (`/mnt/data/grain-serve`): `index.db`, and the push key files
under `certs/`. The index began as the old server's database, imported
once with the image's `grain-import` before serve first started on it.

The secrets are on the host alone, in `/etc/grain-serve/serve.env`
(mode 600), never in the repository or the deploy's environment:

```sh
GRAIN_CDN_KEY=<hex>            # imgproxy's IMGPROXY_KEY
GRAIN_CDN_SALT=<hex>           # imgproxy's IMGPROXY_SALT
GRAIN_APNS_KEY_FILE=/data/certs/AuthKey.p8
GRAIN_FCM_KEY_FILE=/data/certs/firebase.json
CLOUDFLARE_ACCOUNT_ID=<id>
CLOUDFLARE_AI_TOKEN=<token>    # Workers AI only, for Clef
```

What is not a secret is a flag in `docker-compose.yml`, set from `.env`
(`GRAIN_JETSTREAM`, `GRAIN_BACKFILL`, `GRAIN_CDN`, `GRAIN_APNS_*`, ...:
deploy.sh's header lists them). Empty turns a part off.

### The proxy

TLS is Caddy's, in hetzner-infra. It reaches grain-serve on the external
docker network `GRAIN_PROXY_NETWORK` (`grain-serve`), which deploy.sh
makes, by the alias `grain-serve`. hetzner-infra's compose puts Caddy on
that network, as it puts it on `knotless`, and its Caddyfile sends grain's
domain there:

```caddyfile
grain.social, www.grain.social {
	import cf_tls
	reverse_proxy grain-serve:2600
	encode gzip zstd
}
```

grain-serve hands the pages, on the project's own network, every request
it does not answer itself (`--web http://pages:2601`), as knotless-serve
does, so the proxy knows of nothing else.

Both services are reached by name, which docker's DNS answers with every
running container's address, so a rollout's two containers both answer
until the old one stops, and a dial to one not listening goes to the other.

### Deploys without downtime

`rollout.sh pages serve` moves each service in turn: a second container
starts beside the running one, and the old one is stopped once the new
one's healthcheck (`/healthz` for serve, `/_app/version.json` for pages)
passes, or the new one is removed and the old one kept if it never does
within `GRAIN_ROLLOUT_TIMEOUT` (180s). serve is rolled only if the new
build keeps the index as it is, which `grain-serve --check-index
/data/index.db` says: a build whose migrations would change the tables
under the old one stops the old one first, down until the new one
listens; a build older than the index is not started.

## Monitoring

- `/healthz` answers `ok` while grain-serve listens: what docker's
  healthcheck and rollout.sh wait on.
- `/_status` answers 200, or 503, with JSON saying what does not hold:
  Jetstream connected and bringing events in the last two minutes, the
  index answering a read, and the disk under it with room (under 15% free
  is told of, under 5% fails). It says the `version` and `commit` running,
  the commit being the one deploy.sh built (`GRAIN_COMMIT`). It is never
  cached (`no-store`). A monitor off the host polls it.

## Logs

serve and pages log to the host's journal (the `journald` driver,
`x-logging` in docker-compose.yml), so a container's lines outlive it.
Each names its project and service (`COM_DOCKER_COMPOSE_PROJECT=grain-serve`,
`COM_DOCKER_COMPOSE_SERVICE`). deploy.sh and rollout.sh add a line with
the time for each step of a deploy to `/var/log/grain-serve-deploy.log`.
What serve logs, and `/metrics` and `PUT /log` on `--metrics`
(`127.0.0.1:9464`, inside the container), is in
[docs/observability.md](../docs/observability.md).

```sh
just logs serve --since 2h 'select(.level == "WARN" or .level == "ERROR")'
just logs pages --follow
just logs deploys
```

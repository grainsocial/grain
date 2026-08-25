# hatk project

This is an AT Protocol application built with [hatk](https://github.com/hatk-dev/hatk).
Read the project's lexicons in `lexicons/` to understand the data model.
Types are generated from lexicons into `hatk.generated.ts` — never edit this file directly.

## Project structure

| Directory   | Purpose                                                                             |
| ----------- | ----------------------------------------------------------------------------------- |
| `lexicons/` | AT Protocol lexicon schemas (JSON). Defines collections and XRPC methods            |
| `server/`   | All server-side code: feeds, XRPC handlers, hooks, labels, OG routes, setup scripts |
| `app/`      | SvelteKit frontend (routes, components, styles)                                     |
| `seeds/`    | Test data seeding scripts for local development                                     |
| `test/`     | Test files (vitest). Run with `vp test`                                             |
| `public/`   | Static files served at the root                                                     |

## Key files

- `hatk.config.ts` — project configuration (see `defineConfig` for type info)
- `hatk.generated.ts` — auto-generated server types and helpers. Regenerate with `hatk generate types`
- `hatk.generated.client.ts` — auto-generated client-safe types and `callXrpc`. Never import `hatk.generated.ts` from frontend code

## The `$hatk` alias

Server files in `server/` import from `$hatk`:

```ts
import { defineFeed, views, type Status } from "$hatk";
```

SvelteKit routes and components import from `$hatk/client`:

```ts
import { callXrpc, getViewer } from "$hatk/client";
```

`$hatk` resolves to `hatk.generated.ts` and `$hatk/client` to `hatk.generated.client.ts`.
The Vite plugin handles this in dev/build. In tests and production, a Node.js module resolve hook handles it.

## Commands

Run `npx hatk --help` for the full list of commands.

Use `npx hatk generate` to scaffold new feeds, xrpc handlers, labels, and lexicons
rather than creating files manually. These generate files with the correct imports.

After modifying lexicons, always run `npx hatk generate types` to update the generated types.

## Running

- `npm run dev` — start dev server (hatk + SvelteKit + PDS)
- `npm run build` — build for production (SvelteKit outputs to `build/`)
- `npm start` — start production server (hatk + SvelteKit via `build/handler.js`)
- `npm test` — run tests

## Permissioned spaces in dev

Shared galleries run on permissioned data (proposal 0016), which the reference
PDS on 2583 does not serve. `docker compose` also brings up two pds.js
instances, on 2584 and 2585, with `PDS_ENABLE_SPACES=true`. Two, because pds.js
hosts one account per instance and a space is only interesting once a member's
repo lives on a host the authority does not control.

```sh
docker compose up -d
./seeds/pdsjs-accounts.sh   # needs a pds.js checkout; PDSJS_DIR if not ~/code/pds.js
```

The script prints a DID per account. **Log in with the DID, not the handle** —
handle resolution goes through the dev relay, which is the PDS on 2583, and it
has never heard of these accounts.

Both instances are addressed as `pdsjs-a.localhost` / `pdsjs-b.localhost` rather
than `localhost`. A member's PDS notifies the authority's PDS directly on every
space write, so both have to reach each other by the hostname in the DID
document, and `localhost` inside a container is that container. macOS resolves
`*.localhost` to 127.0.0.1, and `extra_hosts` maps the same names to the host
gateway inside the containers, so one name works from everywhere.

The image defaults to `atcr.io/chadtmiller.com/pds.js:latest`, which needs
`docker login atcr.io` (handle + app password). To run a local build instead:

```sh
docker build -t pds.js:local ~/code/pds.js
PDSJS_IMAGE=pds.js:local docker compose up -d
```

Space writes never reach a firehose, so nothing these accounts do in a space is
indexed by the appview. That is the protocol working as designed, not a dev-env
limitation — the app assembles a space by reading member repos directly.

### The second implementation

pds.js is not the only server that serves spaces. [zds](https://tangled.org/zat.dev/zds)
does too, and it is stricter, so it is the one that finds our assumptions:

- It validates the requested OAuth scope against the `scope` in our published
  client metadata document. Conditional scopes widen the request past that
  document unless the extra scopes are registered on the client too — see
  `spaceScopes` in `hatk.config.ts`.
- `com.atproto.simplespace.createSpace` requires `did`, and reads `policy` and
  `appAccess` from a nested `config` with the policy as a bare string.
- Space reads name the repo `repo`, never `did`. pds.js hosts one account and
  falls back to it, which hides the difference.
- `com.atproto.space.listRepos` is credential-only. A session does not work
  there even for the account that owns the space.

When touching the space client, check a call against both servers' handlers:
`packages/spaces/src/handlers/` in pds.js, `src/atproto/space.zig` in zds.

## Production debugging

Production is a single Hetzner host, `167.233.237.163`, running the appview,
the PDS, imgproxy, porxie, Caddy and the pds.js check runner as Docker Compose
services under `/etc/grain`. Infrastructure lives in `~/code/hetzner-infra`;
`docs/migration-plan.md` there is the record of how it got that way.

```sh
ssh root@167.233.237.163
docker compose -f /etc/grain/docker-compose.yml ps
docker compose -f /etc/grain/docker-compose.yml logs -f grain
grain-deploy          # rebuild the appview from GitHub main, restart
```

### Querying the database

The database is at `/mnt/data/grain/grain.db` on the host, mounted into the
container as `/data/grain.db`. `sqlite3` and `duckdb` live **inside** the image,
not on the host, so a query runs in a throwaway container:

```sh
docker run --rm -v /mnt/data/grain:/data --entrypoint sh grain:current -c '
  sqlite3 /data/grain.db "SELECT COUNT(*) FROM [social.grain.photo];"
'
```

Use `docker run`, not `docker compose run`. The grain service has a `build:`
context, so compose rebuilds the appview from source before it will give you a
shell — several minutes to run one query.

The appview holds a write lock while indexing. A large batch of statements can
sit behind it indefinitely: pass `-cmd ".timeout 30000"`, keep transactions
small, and expect a bulk import to take far longer than the row count suggests.
Table names contain dots, so bracket them: `[social.grain.photo]`.

### What the appview cannot rebuild

Everything under a collection name is re-derivable — backfill fetches it from
the network. The underscore-prefixed tables are not: `_oauth_keys` (change them
and every session is void), `_oauth_sessions`, `_push_tokens`, `_preferences`,
`_labels`, `_mutes`, `_reports`, `_space_invites`, `_space_support`, and the
`status` column of `_repos`, which is where an admin takedown lives.

`_repos` is the trap: the row is mostly backfill bookkeeping that rebuilds
itself, but `status` is administrator intent that nothing reconstructs. Treating
the table as derived once silently reinstated three taken-down accounts.

Backups run nightly to `/var/backups/grain` and offsite to Bunny; the PDS blob
bucket mirrors from R2 to Bunny weekly.

## Extracting reusable types from lexicons

When an XRPC output has inline objects you want to reference independently (e.g. in component props or `$state`), extract them as a named `ref` in the lexicon. The codegen will export a standalone type.

**Before** — inline object, no reusable type:

```json
"output": {
  "schema": {
    "type": "object",
    "properties": {
      "links": {
        "type": "array",
        "items": {
          "type": "object",
          "required": ["service", "label", "url"],
          "properties": { "service": { "type": "string" }, ... }
        }
      }
    }
  }
}
```

**After** — extract as a named def, reference with `#ref`:

```json
"output": {
  "schema": {
    "type": "object",
    "properties": {
      "links": {
        "type": "array",
        "items": { "type": "ref", "ref": "#externalLink" }
      }
    }
  }
},
"externalLink": {
  "type": "object",
  "required": ["service", "label", "url"],
  "properties": { "service": { "type": "string" }, ... }
}
```

Then run `npx hatk generate types`. The generated code will export `ExternalLink` as its own type, importable from `$hatk/client`:

```ts
import { callXrpc, type ExternalLink } from "$hatk/client";
let links: ExternalLink[] = $state([]);
```

If the type name collides with a component import (e.g. `ExternalLink.svelte`), alias it:

```ts
import ExternalLink from "$lib/components/molecules/ExternalLink.svelte";
import { type ExternalLink as ExternalLinkType } from "$hatk/client";
```

## Custom indexes

hatk auto-creates indexes on `indexed_at DESC`, `did`, and child table columns. For app-specific queries (e.g. ordering by `played_time`), add custom indexes in a setup script:

```ts
// server/setup/create-indexes.ts
import { defineSetup } from "$hatk";

export default defineSetup(async (ctx) => {
  const { db } = ctx;
  await db.run(
    `CREATE INDEX IF NOT EXISTS idx_fm_teal_alpha_feed_play_played_time ON "fm.teal.alpha.feed.play"(played_time DESC)`,
  );
});
```

Setup scripts run on every startup before the server accepts requests. Use `CREATE INDEX IF NOT EXISTS` so they're idempotent. To create an index on prod immediately without redeploying, use the `docker run` pattern above.

### SQLite datetime comparison gotcha

SQLite's `datetime('now', '-4 hours')` returns space-separated format (`2026-03-16 12:00:00`) while ISO timestamps use `T` separator (`2026-03-16T12:00:00Z`). String comparison breaks because `T` > space. Use `strftime` for correct comparisons:

```sql
-- WRONG: matches too many rows
WHERE played_time >= datetime('now', '-4 hours')

-- CORRECT: ISO format matches stored timestamps
WHERE played_time >= strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-4 hours')
```

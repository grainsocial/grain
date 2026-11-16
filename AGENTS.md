# hatk project

This is an AT Protocol application built with [hatk](https://github.com/hatk-dev/hatk).
Read the project's lexicons in `lexicons/` to understand the data model.
Types are generated from lexicons into `hatk.generated.ts` — never edit this file directly.

## Landing a change

grain is kept on knotless, at `knotless://grain.social/grain`. GitHub and
Tangled are mirrors that `mirror.yml` fast-forwards from main; nothing is
opened or pushed there.

- Build and test on the runner, not on this machine: several agents
  building here at once have brought it down. Open the pull early, push to
  its branch as you go, and read what its checks say (or use the `checks`
  tool over MCP):

  ```sh
  knotless checks knotless://grain.social/grain --pull <uri> --wait <secs> --log
  ```

  Run something here only for a loop the runner is too slow for, such as
  one test being fixed, in one checkout at a time.

- A pull's title and body follow `.knotless/pull.md`, which
  `knotless template knotless://grain.social/grain pull` prints.
- review.knotless.dev reviews every open pull by the owner or a
  collaborator, at each head pushed. Read its review with `knotless show`
  and answer it by pushing, or in a comment saying why not.
- Nothing lands on main until the owner says so for that pull: main
  deploys to production once its checks pass. Open the pull and stop.
- Work that should not reach main yet goes on a feature branch,
  `feature/<name>`, cut from main. Its parts are pulls into it, which
  `check` and `test` run on as they do on pulls into main, and which are
  reviewed the same way. Nothing deploys from a feature branch. Keep one
  pull open from it into main, unqueued, as the check that the whole of it
  still passes there, and merge main into the feature branch as main
  moves.

`feature/rust` holds the move off hatk onto a Rust server modelled on
knotless: one pull into it per step of the plan.

## The Rust tests

The Rust tests run against the reference PDS, `@atproto/pds` from npm with
a PLC directory, which `harness/pds.mjs` starts on free ports (on the Node
`harness/.node-version` names). A test binary starts its own unless
`GRAIN_TEST_NET` names one that is up; `crates/grain/tests/common` makes an
account per test, and has `harness/authorize.mjs` approve OAuth logins as
the browser, with `harness/tls-proxy.mjs` putting a confidential client at
`https://client.grain.internal`, a name the harness resolves to 127.0.0.1.

The `test` check (`.knotless/workflows/test.yml`) runs them all,
instrumented, through `harness/cov.mjs`, and fails:

- under the coverage gate in `harness/cov.json`, lines and functions in
  percent. It is where the workspace stands, not knotless's 100%: raise it
  with the tests that reach more, never lower it. The log shows each file
  short of 100%, and then each line it counts as missed, by the function
  it is in, or `never called` where no instance of it ran. A binary that
  fails once and passes when run again is logged
  `FLAKY: <net> <binary> <test>`: fix it. One failing now and then while
  it is fixed can be quarantined in `harness/quarantine.json` (`net`,
  `binary`, `test`, `until`): failing only there it is logged
  `QUARANTINED` and passes, until the day named. A binary still running
  at its limit, three times its last time and never under ten minutes,
  is killed and fails.
- on any XRPC answer grain-serve's tests received that its lexicon in
  `lexicons/` does not allow (`harness/answers.mjs`): an output that is not
  valid, a parameter it does not declare, a failure that is not
  `{error, message}`, a method no lexicon names. The serve tests call the
  server through `crates/grain-serve/tests/common`, which keeps each answer
  under `GRAIN_ANSWERS`; a new method's tests go through it too.
  `harness/answers-test.sh` checks that the check names wrong answers.
- on any query of the index the tests ran that scans a table growing with
  the network, or sorts many of its rows, as SQLite would plan it at
  prod's size (`harness/plans.mjs`). With `GRAIN_PLANS` naming a
  directory, the index hands each statement it runs to a planner, its
  tables said to be prod's size, a million rows for each of `GROWING`
  (`crates/grain-serve/src/index/plans.rs`). Give the query an index, or
  one that uses the index there. A scan meant to be, of a few rows an
  operator reads now and then, says so in its SQL with why,
  `-- scans: photo, as only the operator asks`, where review sees it; a
  sort, `-- sorts: photo, …`. To see the plans while fixing one, run its tests
  with `GRAIN_PLANS=<dir>` and `node harness/plans.mjs <dir>`.

A run that passed is kept in `/opt/testcache` on the runner
(`COV_STORE`): a test binary the same byte for byte as one that passed,
against the same harness and with every workspace binary it ran the same,
is not run again, and its profile, answers and plans count. Should the
gate fall short with stored runs, they are made again, fresh.

The test binaries named `spaces` run against the reference PDS on the
permissioned spaces alpha instead, built from the atproto commit
`test.yml` names, as knotless's are: `GRAIN_DEV_ENV` names its built
`packages/dev-env`, which `harness/pds.mjs` then runs, and without it they
pass trivially. For a loop here, build that commit once as `test.yml`
does and run `just pds` with `GRAIN_DEV_ENV` set.

`check.yml` runs fmt and clippy. For a loop here, `just setup` once, `just
pds` in the background, then `just t <cargo test args>` on that PDS. Never
run `just cov` here: the check runs it.

## The end-to-end flows

The `e2e` check (`.knotless/workflows/e2e.yml`) runs grain-serve and the web's
build together, as the deploy does, and drives them in Chromium with
Playwright (`harness/e2e/`): `setup.mjs` makes the world (the PDS and PLC from
`harness/pds.mjs`, grain-serve behind `harness/tls-proxy.mjs`, the pages
behind it), `flows.spec.mjs` logs in through the PDS's approval page and
reads each write back on the page and at the PDS, and `spaces.spec.mjs` runs
over the spaces alpha. A failed flow's screenshot is among the check's
outputs, and its log prints the page's accessibility snapshot, what the
browser said, and the servers' logs. `just e2e` runs it; leave it to the
check, as it builds grain-serve and the web.

## Lexicons

A new or changed schema under `lexicons/social/grain` follows the Lexicon
Style Guide (https://atproto.com/guides/lexinomicon) and passes `just lex`,
which the `lexicons` check (`.knotless/workflows/lexicons.yml`) runs:
goat's linter, less the warnings kept on purpose (`id` and `type` as field
names, which Bluesky's views use too, and the permissioned-space schemas
goat v0.2.6 cannot read), then `harness/lexicons.mjs`. That checks what the
linter does not see: `knownValues` rather than `enum`; objects in new
arrays rather than bare values; open unions; a description on every
`main`; a `maxLength` on strings without a format in what people write
(records, procedure input, and the shapes either names); accounts by DID,
not handle, unless a DID is beside it. And that every schema only grows
from main's, as the branch left main, since main's are the ones published:
a schema already published is evolved, not changed, with new fields
optional and nothing removed, renamed, retyped, made required or
narrowed. A bound or a DID that a published field lacks is left as it is,
for the same reason. Fix anything either says, or say why not.

It reads grain's own schemas, less `unspecced/` and the admin methods only
the old server serves (`OLD` in the script), which go at cutover rather
than be brought up to the guide; the other namespaces under `lexicons/`
are copies of others' schemas. What this branch has that the guide would
have otherwise, not yet published, is in its `PENDING`, to be fixed
before main.

Still by hand: no `required` a reader could do without, since it can never
be dropped; a description on any field whose name does not say what it
holds; `maxGraphemes` beside `maxLength` for text people read; reuse of
`social.grain.defs` and `com.atproto.repo.strongRef` over new shapes.

Publishing a schema does not reach every PDS. `@atproto/pds` validates writes
against copies compiled into the server (`validateRecord` in
`packages/pds/src/repo/prepare.ts`), and its `social.grain.photo` requires
`alt`, so a photo with no description sends `alt: ""`. A write has to stay
valid against what those servers ship until they upgrade.

## Project structure

| Directory   | Purpose                                                                             |
| ----------- | ----------------------------------------------------------------------------------- |
| `lexicons/` | AT Protocol lexicon schemas (JSON). Defines collections and XRPC methods            |
| `server/`   | All server-side code: feeds, XRPC handlers, hooks, labels, OG routes, setup scripts |
| `web/`      | SvelteKit frontend: `web/src` (routes, components, styles), `web/static` (assets)   |
| `seeds/`    | Test data seeding scripts for local development                                     |
| `test/`     | Test files (vitest). Run with `vp test`                                             |

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

## The vitest overrides

`vp test` runs Vitest, but vite-plus pins it to an exact version — 0.3.0 depends
on `vitest@4.1.11` and on every `@vitest/*` package at that same exact version.
Moving to Vitest 5 therefore takes an `overrides` block in `package.json` that
lifts the whole set together; overriding `vitest` alone leaves `@vitest/expect`
and friends at 4.x against a 5.x runner, which breaks at import time.

Two entries are there only to keep `npm install` resolvable, not because we use
them. `@vitest/browser-playwright` and `@vitest/browser-webdriverio` are optional
peers of vite-plus at 4.1.11, and Vitest 5 wants `>=5.0.0`; webdriverio has no
5.0.0 release yet, so it is pinned to `5.0.0-rc.1`. Vitest browser mode is unused
here — the browser tests in `test/browser/` are plain Playwright, run separately
with `npm run test:browser`.

Drop the whole block once vite-plus ships a release built on Vitest 5.

## Running

The `Justfile` holds the recipes, as knotless's does; `just` lists them.

- `just dev` — grain-serve on 2600, its index in `target/dev`, fed from
  Jetstream, and the web at `http://127.0.0.1:3000` in front of it
  (logging in takes `just dev <public url>`)
- `just dev-live` — the web against a deployed grain-serve, read-only
- `just serve <flags>` — grain-serve alone; `just web` builds the pages
  into `build/`, and `just pages` runs them against `just serve`
- `just test`, `just t <cargo test args>` — the Rust tests; `npm test` the
  Node ones, which the `web` check runs with `npm run check`

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

The reference `@atproto/pds` alpha has no `simplespace` since
`0.0.0-spaces-alpha-20261029171913`: a space is created with
`com.atproto.space.createSpace` (`spaceType`, `skey`, and a `policy` such as
`{$type: "com.atproto.memberspace.policy"}`), and its member list kept with
`com.atproto.memberspace.putMember`, `removeMember` and `listMembers`, where
`read` and `write` are required. `server/spaces/client.ts` asks for those names
first and falls back to `simplespace` on a 404 or 501.

- Space reads name the repo `repo`, never `did`. pds.js hosts one account and
  falls back to it, which hides the difference.
- `com.atproto.space.listRepos` is credential-only. A session does not work
  there even for the account that owns the space.

When touching the space client, check a call against both servers' handlers:
`packages/spaces/src/handlers/` in pds.js, `src/atproto/space.zig` in zds.

## Photo writes always send `alt`

`@atproto/pds` validates writes against schemas compiled into the server, not
the ones grain.social publishes (`validateRecord` in
`packages/pds/src/repo/prepare.ts`). Its copy of `social.grain.photo` requires
`alt`, so a photo without it is refused. Send `alt: ""` when there is no
description.

The same goes for any schema change: publishing it does not reach these servers.
A write has to stay valid against the copy they ship until they upgrade.

## Minimum app versions

`web/static/app-version.json`, served at `https://grain.social/app-version.json`,
is the oldest build of each app this server still serves. grain-serve hands the
path to the pages, which answer it from `web/static`. The iOS and Android apps
read it on launch and on returning to the foreground, and a build below its
minimum shows a full-screen "Update Grain" that cannot be dismissed. Each app
remembers the last minimum it read, so a blocked build stays blocked offline.

The numbers are build numbers, not marketing versions: `ios.minimumBuild` is
`CFBundleVersion` (`CURRENT_PROJECT_VERSION` in grain-ios's `project.yml`),
`android.minimumVersionCode` is `versionCode`. `0` blocks nothing. Raise one
only once the build it names is live in its store, or people are told to
install an update they cannot get.

## Production debugging

Production is a single Hetzner host, `167.233.237.163`. grain-serve and its
pages run there as the compose project `/etc/grain-serve`, which
`.knotless/workflows/deploy.yml` deploys from main with `deploy/deploy.sh`
(`deploy/README.md`). Beside it, hetzner-infra's project `/etc/grain` runs
the PDS, imgproxy, porxie, Caddy and the pds.js check runner.
Infrastructure lives in `~/code/hetzner-infra`; `docs/migration-plan.md`
there is the record of how it got that way.

```sh
just logs serve --since 2h 'select(.level == "WARN" or .level == "ERROR")'
just logs pages --follow
just logs deploys     # each deploy's steps, from /var/log/grain-serve-deploy.log
ssh root@167.233.237.163 docker compose -f /etc/grain-serve/docker-compose.yml ps
curl -s https://grain.social/_status
```

### Querying the index

The index is `/mnt/data/grain-serve/index.db` on the host, mounted into the
containers as `/data/index.db`, one SQLite file in WAL mode. The image has
no `sqlite3`, but its Node has `node:sqlite`, so a query runs in a
throwaway container of the running image, as its own user (uid 1000, who
owns the directory):

```sh
docker run --rm -v /mnt/data/grain-serve:/data grain-serve:current node -e '
  const db = new (require("node:sqlite").DatabaseSync)("/data/index.db", { readOnly: true });
  db.exec("PRAGMA busy_timeout = 30000");
  console.table(db.prepare("SELECT COUNT(*) AS n FROM photo").all());
'
```

serve holds the write lock while indexing: open it read-only, and keep any
write small.

### What the appview cannot rebuild

The record tables (`gallery`, `photo`, `favorite`, `repo`, ...) are
re-derivable: backfill fetches them from the network. These are not:
`oauth_key` (change it and every web session is void), `web_session`,
`carried_cookie_key` (the old server's cookie key, read until
`--carry-cookies-until`), `push_token`, `preference`, `notification_pref`,
`notification_seen`, `label`, `mute`, `report`, `story_view`,
`space_support`, `space_invite`, and `takedown`, which is where an admin
takedown lives.

`takedown` is the trap: it reads as moderation bookkeeping beside tables
backfill fills again, but each row is administrator intent that nothing
reconstructs. Lose it and the accounts it names come back.

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

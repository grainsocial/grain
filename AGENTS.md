# grain

grain is a photo sharing app on the AT Protocol. grain-serve, the Rust
server in `crates/grain-serve`, is its appview, the web's server side, push
and backfill; the web pages are the SvelteKit app in `web/`, which
grain-serve hands what it does not answer itself. The schemas are in
`lexicons/`.

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

It reads grain's own schemas, less `unspecced/` and the admin methods
grain-serve does not serve (`UNSERVED` in the script), which stay as
published rather than be brought up to the guide; the other namespaces
under `lexicons/` are copies of others' schemas. What this branch has that
the guide would have otherwise, not yet published, is in its `PENDING`, to
be fixed before main.

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

| Path                 | Purpose                                                                        |
| -------------------- | ------------------------------------------------------------------------------ |
| `crates/grain`       | grain's core library and the `grain` CLI, shared by the server, CLI and MCP    |
| `crates/grain-serve` | grain-serve: the appview, the web's server side, push and backfill             |
| `crates/grain-mcp`   | An MCP server for grain's moderation                                           |
| `web/`               | SvelteKit pages: `web/src` (routes, components, styles), `web/static` (assets) |
| `test/`              | The web's unit tests (Vitest), `npm test`                                      |
| `lexicons/`          | AT Protocol lexicon schemas (JSON): records and XRPC methods                   |
| `harness/`           | The reference PDS the Rust tests run against, the checks' scripts, and e2e     |
| `deploy/`            | The production deploy: compose project, `deploy.sh`, `logs.sh`                 |
| `docs/`              | Notes on grain-serve, such as its observability                                |

The web is built from the root's `package.json`, `svelte.config.js`,
`vite.config.ts` and `tsconfig.json`; `npm run lex` generates its lexicon
types into `web/src/lib/lexicons` (ignored by git) from `lexicons/`.

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
here.

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
  web's, which the `web` check runs with `npm run check`

## Permissioned spaces on other servers

Groups run on permissioned spaces (proposal 0016). The tests run them on the
reference PDS's spaces alpha (`GRAIN_DEV_ENV`, above), but it is not the only
server that serves them: pds.js and [zds](https://tangled.org/zat.dev/zds) do
too, and zds is the stricter, so it is the one that finds our assumptions:

- It validates the requested OAuth scope against the `scope` in our published
  client metadata document. Scopes asked for only of PDSes that serve spaces
  widen the request past that document unless they are registered on the
  client too: `REGISTERED` in `crates/grain-serve/src/login.rs` holds them all.
- `com.atproto.simplespace.createSpace` requires `did`, and reads `policy` and
  `appAccess` from a nested `config` with the policy as a bare string.

The reference `@atproto/pds` alpha has no `simplespace` since
`0.0.0-spaces-alpha-20261029171913`: a space is created with
`com.atproto.space.createSpace` (`spaceType`, `skey`, and a `policy` such as
`{$type: "com.atproto.memberspace.policy"}`), and its member list kept with
`com.atproto.memberspace.putMember`, `removeMember` and `listMembers`, where
`read` and `write` are required. `Admin` in `crates/grain/src/space.rs` asks
for those names first and the `simplespace` ones when the PDS has no such
method.

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
`carried_cookie_key` (the key of the previous server's session cookies, read until
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

Then `npm run lex` regenerates `web/src/lib/lexicons`, where `ExternalLink` is a type of its own in that schema's module:

```ts
import type { ExternalLink } from "$lib/lexicons/social/grain/actor/defs.ts";
let links: ExternalLink[] = $state([]);
```

If the type name collides with a component import (e.g. `ExternalLink.svelte`), alias it:

```ts
import ExternalLink from "$lib/components/molecules/ExternalLink.svelte";
import type { ExternalLink as ExternalLinkType } from "$lib/lexicons/social/grain/actor/defs.ts";
```

## SQLite datetime comparison gotcha

SQLite's `datetime('now', '-4 hours')` returns space-separated format (`2026-03-16 12:00:00`) while ISO timestamps use `T` separator (`2026-03-16T12:00:00Z`). String comparison breaks because `T` > space. Use `strftime` for correct comparisons:

```sql
-- WRONG: matches too many rows
WHERE created_at >= datetime('now', '-4 hours')

-- CORRECT: ISO format matches stored timestamps
WHERE created_at >= strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-4 hours')
```

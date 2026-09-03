# Server test coverage

**Goal: 80% statement coverage of `server/**/*.ts`.**
Baseline when this started, 2026-09-03: **30.68%** (623/2030 statements).

This file is the running state of that work. Each pass updates the ledger at the
bottom, so the next pass can start by reading it instead of re-deriving where
things stand.

## How to measure

```sh
npm run test:coverage
```

Coverage runs from `vitest.coverage.config.ts`, not `vite.config.ts` — the
reason is in the header comment of that file and in "The vitest overrides" in
AGENTS.md. Scope is `server/**/*.ts` only: `app/lib` is browser code with no DOM
test setup and `.svelte` files cannot be instrumented at all right now, so
counting either would only inflate the denominator with unreachable lines.

The config carries a **ratchet**: `thresholds.autoUpdate` rewrites the floor to
whatever the suite actually reached on each run. Coverage can go up and never
quietly slide back. The rewritten numbers are part of the commit.

## How to add tests here

Match `test/`, don't invent a second style.

- `startTestServer` from `@hatk/hatk/test` gives a real server over a real
  SQLite database. Seed rows with `db.run`, then assert on `server.fetch` of the
  XRPC route. `test/cameras.test.ts` and `test/locations.test.ts` are the
  clearest models.
- Helper modules that are pure functions get imported and called directly —
  `test/formatLocation.test.ts` and `test/tid.test.ts` are the model.
- Table names contain dots, so bracket them in SQL: `[social.grain.photo]`.
- Test what the code is _for_, not the lines. A test that only walks a branch to
  move a number is worse than no test, because it locks in whatever the code
  does today. Every test should be able to fail for a reason someone would care
  about.
- `test/spaces.live.test.ts` is skipped by default — it needs live pds.js
  instances. Leave it that way.

## Order of work

Ranked by uncovered statements, which is roughly the ratio of number-moved to
effort. Refreshed each pass from `coverage/coverage-summary.json`, so this is
current state, not the original snapshot.

| area             | uncovered | of   | covered |
| ---------------- | --------- | ---- | ------- |
| `server/xrpc`    | 624       | 1022 | 38.9%   |
| `server/og`      | 180       | 184  | 2.2%    |
| `server/hooks`   | 118       | 125  | 5.6%    |
| `server/feeds`   | 114       | 244  | 53.3%   |
| `server/spaces`  | 92        | 122  | 24.6%   |
| `server/hydrate` | 69        | 146  | 52.7%   |
| `server/helpers` | 62        | 175  | 64.6%   |
| `server/filters` | 0         | 2    | 100%    |
| `server/labels`  | 0         | 4    | 100%    |

Biggest single files still outstanding:

| file                                 | uncovered | covered |
| ------------------------------------ | --------- | ------- |
| `server/feeds/foryou.ts`             | 99/99     | 0.0%    |
| `server/og/collage.ts`               | 81/85     | 4.7%    |
| `server/xrpc/getNotifications.ts`    | 80/172    | 53.5%   |
| `server/hydrate/stories.ts`          | 53/53     | 0.0%    |
| `server/spaces/client.ts`            | 53/78     | 32.0%   |
| `server/xrpc/mentionSearch.ts`       | 44/45     | 2.2%    |
| `server/hooks/on-commit-favorite.ts` | 40/42     | 4.8%    |
| `server/xrpc/getStory.ts`            | 40/40     | 0.0%    |
| `server/og/gallery.ts`               | 37/37     | 0.0%    |
| `server/og/profile.ts`               | 36/36     | 0.0%    |

`server/feeds` is down to `foryou.ts` alone — the other seven feeds are covered
by `test/galleryFeeds.test.ts` and `test/locationFeed.test.ts`.

## Known hard spots

Recorded as they are hit, so a later pass does not rediscover them.

- `server/og/*` renders images and loads fonts. Covering it probably means
  asserting on the generated SVG/element tree rather than a rendered bitmap.
- `server/spaces/*` talks to a remote PDS over DPoP. `client.ts` and `dpop.ts`
  need the transport stubbed; the live path already has
  `test/spaces.live.test.ts` and should stay there.
- `server/hooks/*` are firehose commit handlers. They take a commit event and a
  db, so they should be callable directly without a server.
- Feeds are reached at `/xrpc/dev.hatk.getFeed?feed=<name>`, and answer
  `{ items, cursor }` where each item is a hydrated gallery view. There is no
  per-feed lexicon to read; `app/lib/queries.ts` is the list of what each feed
  takes for parameters.
- `_mutes` is not created by the test harness (it lives in `server/setup`), so
  any test touching mutes has to `CREATE TABLE IF NOT EXISTS` it first. Several
  existing tests already do; copy one.
- The `actor` feed orders on `created_at` while `/recent` and the rest order on
  `sort_at` (`min(created_at, indexed_at)`). A gallery with a skewed future
  `createdAt` therefore heads a profile grid but not the home feed. This is
  asserted as-is in `test/galleryFeeds.test.ts`; it looks unintended, and
  changing it should start by deciding which of the two is right.
- H3 fixtures have to be real cells — `getResolution` throws on a made-up
  string and the city-level path swallows that in a `catch`, so an invalid cell
  silently drops out of results instead of failing. Generate them with
  `latLngToCell(lat, lng, 10)` and `cellToParent(cell, 5)`.
- `location.ts` has an unreachable guard: the `aliases.length === 0` branch
  that drops a country interpretation cannot fire, because `normalizeCountry`
  falls back to returning the upper-cased input and only returns null for an
  empty string, while `parts` is already `.filter(Boolean)`-ed. It is harmless
  defence against `normalizeCountry` changing, but it cannot be covered and
  should not be chased. The reachable version of that case — a one-word name
  that is not a country, like "Waldport" — is tested instead.

## Ledger

| date       | statements | delta | what landed                                                                                |
| ---------- | ---------- | ----- | ------------------------------------------------------------------------------------------ |
| 2026-09-03 | 30.68%     | —     | baseline; coverage tooling wired up                                                        |
| 2026-09-03 | 33.34%     | +2.66 | `recent`, `following`, `hashtag`, `actor` and `camera` feeds — `test/galleryFeeds.test.ts` |
| 2026-09-03 | 37.88%     | +4.54 | the `location` feed, all three of its lookup paths — `test/locationFeed.test.ts`           |

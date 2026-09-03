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
| `server/xrpc`    | 555       | 1022 | 45.7%   |
| `server/og`      | 180       | 184  | 2.2%    |
| `server/spaces`  | 92        | 122  | 24.6%   |
| `server/hooks`   | 36        | 125  | 71.2%   |
| `server/helpers` | 28        | 175  | 84.0%   |
| `server/feeds`   | 18        | 244  | 92.6%   |
| `server/hydrate` | 13        | 146  | 91.1%   |

Biggest single files still outstanding:

| file                                  | uncovered | covered |
| ------------------------------------- | --------- | ------- |
| `server/og/collage.ts`                | 81/85     | 4.7%    |
| `server/xrpc/getNotifications.ts`     | 80/172    | 53.5%   |
| `server/spaces/client.ts`             | 53/78     | 32.0%   |
| `server/xrpc/mentionSearch.ts`        | 44/45     | 2.2%    |
| `server/og/gallery.ts`                | 37/37     | 0.0%    |
| `server/og/profile.ts`                | 36/36     | 0.0%    |
| `server/xrpc/deleteGallery.ts`        | 35/35     | 0.0%    |
| `server/xrpc/getActorProfile.ts`      | 33/33     | 0.0%    |
| `server/xrpc/createPrivateGallery.ts` | 32/33     | 3.0%    |
| `server/xrpc/listSharedGalleries.ts`  | 32/32     | 0.0%    |

`server/feeds`, `server/hooks` and `server/hydrate` are done. What is left is
`server/og` (four renderers), `server/spaces` (a DPoP client that needs its
transport stubbed) and the long tail of `server/xrpc` handlers — which is the
biggest total but the most scattered.

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
- Two `startTestServer()` instances in one file are properly isolated, so a
  test file can hold several fixtures under separate `describe` blocks rather
  than one shared world. `test/foryouFeed.test.ts` uses three.
- Every feed query embeds `blockMuteFilter`, which names `_mutes`. A fixture
  that never creates that table gets a **500 from every feed request**, not a
  silently skipped mute check. Create it in each world's `beforeAll`.
- `foryou.ts` scores with a six-hour half life, so fixtures have to be dated
  relative to `Date.now()`. Anything pinned to a calendar date scores at or
  near zero across the board and the ranking stops discriminating.
- `foryou.ts` has one dead knob: `CORATER_DECAY` is 0, so the decay branch
  never runs and the `coratersSeenCount` map it feeds is maintained but has no
  effect. Not coverable without changing the constant.
- on-commit hooks are directly callable: `defineHook` returns `{ handler }`
  untouched, so a test can build the commit context by hand — real `db` from
  `startTestServer`, a `push` stub that collects messages, and a `lookup` stub,
  which the hooks use only to get the actor's display name. No firehose needed.
- `fireOnCommitHooks` catches a rejected hook and turns it into a log line, so
  **anything that throws inside a hook fails silently**. That is how a helper
  that could not parse went unnoticed in production; see the isBlockedOrMuted
  regression test in `test/commitHooks.test.ts`. When testing a hook, assert
  that it resolves, not only what it pushed.
- `social.grain.story` rows need `media` and `aspect_ratio`; both are NOT NULL.
- `_preferences` is another `server/setup` table the harness skips, alongside
  `_mutes`. Create it in `beforeAll` before touching notification prefs or
  badge counts.
- Lexicon-required parameters are enforced before a handler runs, so a handler's
  own `if (!param) return ok({})` guard for a required param is unreachable —
  the request gets a 400 instead. `getStories`, `getStoryArchive` and `getStory`
  all have one. Assert the 400; do not chase the guard.
- Child tables generated from array fields (e.g.
  `social.grain.story__labels_self_labels`) carry `parent_did` alongside
  `parent_uri`, and both are NOT NULL.
- Self-labels live in those child tables, not in `_labels`. So the SQL
  `hideLabelsFilter` does not see them, while the hydrators, which merge both,
  do. `getStoryAuthors` therefore counts a self-labelled story in `storyCount`
  even though `getStories` will not return it — asserted as it stands in
  `test/stories.test.ts`, but the two disagree.
- `getStoryArchive` applies its LIMIT in SQL and filters hidden stories
  afterwards in the hydrator, so **a page can come back shorter than the limit**
  and the cursor comes from the pre-filter row. A client has to page until the
  cursor is gone, not until a page looks short.
- `hydrateStories` wraps its `media` parse in a try/catch that cannot help:
  `ctx.blobUrl` parses the blob ref itself and throws on the raw string the
  catch assigns, so a story row with non-JSON media is a 500 either way. The
  neighbouring `aspect_ratio` fallback does work and is tested. Only reachable
  if something writes a malformed blob column, which the indexer does not.

## Ledger

| date       | statements | delta | what landed                                                                                                                    |
| ---------- | ---------- | ----- | ------------------------------------------------------------------------------------------------------------------------------ |
| 2026-09-03 | 30.68%     | —     | baseline; coverage tooling wired up                                                                                            |
| 2026-09-03 | 33.34%     | +2.66 | `recent`, `following`, `hashtag`, `actor` and `camera` feeds — `test/galleryFeeds.test.ts`                                     |
| 2026-09-03 | 37.88%     | +4.54 | the `location` feed, all three of its lookup paths — `test/locationFeed.test.ts`                                               |
| 2026-09-03 | 42.61%     | +4.73 | the `foryou` feed: scoring, cold start, windowing — `test/foryouFeed.test.ts`. `server/feeds` now 92.6%                        |
| 2026-09-03 | 48.17%     | +5.56 | the three on-commit hooks and their four helpers — `test/commitHooks.test.ts`. Found and fixed a live push-notification outage |
| 2026-09-03 | 54.48%     | +6.31 | the story surface: getStories, getStoryArchive, getStoryAuthors, getStory and the shared hydrator — `test/stories.test.ts`     |

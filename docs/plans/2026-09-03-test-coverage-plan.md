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
| `server/xrpc`    | 234       | 1022 | 77.1%   |
| `server/spaces`  | 92        | 122  | 24.6%   |
| `server/helpers` | 27        | 175  | 84.6%   |
| `server/feeds`   | 18        | 244  | 92.6%   |
| `server/hydrate` | 13        | 146  | 91.1%   |
| `server/og`      | 10        | 184  | 94.6%   |
| `server/hooks`   | 7         | 125  | 94.4%   |

Biggest single files still outstanding:

| file                              | uncovered | covered |
| --------------------------------- | --------- | ------- |
| `server/xrpc/getLocations.ts`     | 13/102    | 87.2%   |
| `server/helpers/resolveActor.ts`  | 12/13     | 7.7%    |
| `server/hydrate/galleries.ts`     | 12/83     | 85.5%   |
| `server/helpers/country.ts`       | 10/45     | 77.8%   |
| `server/xrpc/mentionSearch.ts`    | 9/45      | 80.0%   |
| `server/xrpc/getCommentThread.ts` | 5/56      | 91.1%   |
| `server/xrpc/getGallery.ts`       | 5/14      | 64.3%   |
| `server/xrpc/getStory.ts`         | 5/40      | 87.5%   |

**Spaces is out of scope** (decided 2026-09-03). Everything behind
`spaces/client.ts` — the private and shared gallery handlers, `getSpaceMembers`,
`addSpaceMember`, `getPrivateBlob`, `getSpaceSupport`, and the client and DPoP
modules themselves — needs a stubbed remote PDS to test, and other things
matter more. That is 304 statements, 12.5% covered.

Excluding it, the rest of `server/` is at **85.1%**, so the 80% goal is
comfortably reachable without touching spaces. What is left there: the three OG
renderers and their font loader, `searchActorsTypeahead`, and small remainders
in `getLocations`, `mentionSearch`, `hydrate/galleries` and `helpers/country`.

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
- `_mutes` is the **only** table the harness is missing. `_preferences`,
  `_oauth_sessions`, `_labels`, `_push_tokens` and the rest are all created —
  an earlier note here wrongly listed `_preferences` alongside `_mutes`. A
  `CREATE TABLE IF NOT EXISTS` for it is harmless but unnecessary.
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
- OG renderers return a satori element tree rather than a bitmap, and
  `defineOG` exposes it as `{ generate }`, so they can be called directly and
  asserted on without rasterising anything. Their context wants `lookup`,
  `blobUrl`, `getRecords` and `fetchImage`, none of which
  `startTestServer().feedContext()` supplies — see `test/ogCards.test.ts` for a
  set of stubs that work. Walk the returned tree for its strings and its
  `<img src>`s rather than asserting on the tree's shape, which is layout and
  changes freely.
- What each card draws is not what it tells a crawler. The profile card's
  description and the story card's handle appear only in `meta`, never on the
  card itself. Check both.
- `server/og/collage.ts` is the exception: `calculateCollageLayout` is a pure
  function over a seeded PRNG, and it is where most of `server/og` lives.
- `searchActorsTypeahead` calls `public.api.bsky.app` directly and merges the
  result with a local `search()`. It needs `fetch` stubbed and the hatk search
  index, so it is left for later — do not let it make a live request in tests.
- `getActorFavorites` is private to its own actor: it returns an empty list to
  everyone else rather than erroring, so a test has to name the viewer.
- `x NOT IN (subquery)` is NULL, not true, when `x` is NULL — so a nullable
  column filtered that way silently drops its NULL rows, _but only once the
  subquery is non-empty_. That made a real bug hide: mention notifications
  worked for anyone who had never commented and stopped the moment they did.
  `server/hydrate/comments.ts` already uses the safe idiom
  (`reply_to IS NULL OR ...`); prefer it anywhere a nullable column is filtered.
- getNotifications has two test files on purpose. `test/notifications.test.ts`
  keeps a deliberately small fixture for the moderation filtering and the
  unseen count; `test/notificationSources.test.ts` needs a much bigger one to
  reach all nine sources. Do not merge them — the small fixture's assertions
  are exact counts that any addition breaks.
- Procedures (POST) work through the same harness as queries: pass an init
  object as `server.fetchAs(did, path, { method, headers, body })`. See
  `test/actorProfile.test.ts`, which drives muteActor and then reads the flag
  back off getActorProfile.
- The on-login hook is callable exactly like the on-commit ones, but its
  context is bigger: `did`, `db`, `lookup`, `ensureRepo`, `createRecord`,
  `putRecord`, `deleteRecord`. It also reads the Bluesky profile straight off
  the user's PDS, so `fetch` has to be stubbed with `vi.stubGlobal`.
- Its two backgrounded calls — `ensureRepo` and the space-support probe — are
  fire-and-forget with `.catch()` attached, so neither can fail a test, but a
  `fetch` stub will see the probe's request too.
- Anything that writes to a PDS — `deleteRecord`, `createRecord`, `putRecord` —
  cannot be driven through `server.fetch`: the harness has no OAuth config and
  the request fails with "No OAuth config — cannot write to PDS" before
  reaching the handler's logic. Call the procedure directly instead;
  `defineProcedure` returns `{ handler }` untouched, exactly like `defineHook`.
  `test/deletion.test.ts` does this, passing a `deleteRecord` that records the
  calls rather than making them.
- `ctx.search` works as of `@hatk/hatk` alpha.82, which was published for this
  (hatk `2d836b4`): `createTestContext` never built the FTS shadow tables, so
  every query failed its BM25 phase with `no such table: _fts_...` — caught and
  recorded rather than thrown — and SQLite has no fuzzy phase to recover with.
  Every search answered empty in every project built on hatk.
- A record is only searchable if it was written through `insertRecord`, which is
  what maintains the index. That means `loadFixtures` and a YAML fixture
  directory; a raw `db.run` insert leaves the row present but unfindable, the
  same as in production. `test/search.test.ts` and `test/fixtures/search/` are
  the only place in the suite that works this way — everything else uses
  `db.run` because it does not need the index.
- Stubbing `fetch` in a test that also uses `server.fetch` has to pass
  non-matching requests through to the real one; the harness drives its own
  requests over real HTTP, so a stub that swallows everything breaks the request
  under test.
- Two things that look like harness limits but are not. `server.seed()` takes
  _options_ and returns helpers bound to a live PDS — it is for integration
  tests against the docker-compose stack, not for seeding the in-memory
  database, so calling it `seed(collection, rows)` silently does nothing.
  And the missing OAuth config is deliberate: the harness exposes
  `loadXrpc(name).handler` precisely so procedures that write to a PDS can be
  driven directly, which is what `test/deletion.test.ts` does (by importing the
  module; `loadXrpc` would be the more idiomatic route).
- `deleteGallery` builds the gallery uri from `viewer.did`, so naming someone
  else's rkey just addresses a gallery of yours that does not exist. The
  query's `AND did = $2` cannot be violated through the interface and removing
  it fails nothing — the construction is what makes it safe, not the condition.

## Ledger

| date       | statements | delta | what landed                                                                                                                                         |
| ---------- | ---------- | ----- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-09-03 | 30.68%     | —     | baseline; coverage tooling wired up                                                                                                                 |
| 2026-09-03 | 33.34%     | +2.66 | `recent`, `following`, `hashtag`, `actor` and `camera` feeds — `test/galleryFeeds.test.ts`                                                          |
| 2026-09-03 | 37.88%     | +4.54 | the `location` feed, all three of its lookup paths — `test/locationFeed.test.ts`                                                                    |
| 2026-09-03 | 42.61%     | +4.73 | the `foryou` feed: scoring, cold start, windowing — `test/foryouFeed.test.ts`. `server/feeds` now 92.6%                                             |
| 2026-09-03 | 48.17%     | +5.56 | the three on-commit hooks and their four helpers — `test/commitHooks.test.ts`. Found and fixed a live push-notification outage                      |
| 2026-09-03 | 54.48%     | +6.31 | the story surface: getStories, getStoryArchive, getStoryAuthors, getStory and the shared hydrator — `test/stories.test.ts`                          |
| 2026-09-03 | 62.95%     | +8.47 | the collage layout — `test/collageLayout.test.ts`; blocks, mutes, favorites and suggested follows — `test/actorLists.test.ts`                       |
| 2026-09-03 | 66.79%     | +3.84 | every getNotifications source, its preference filters and paging — `test/notificationSources.test.ts`. Found and fixed silent mention notifications |
| 2026-09-03 | 70.24%     | +3.45 | getActorProfile and the mute procedures — `test/actorProfile.test.ts`; the on-login hook — `test/onLoginHook.test.ts`                               |
| 2026-09-03 | 74.23%     | +3.99 | mentionSearch — `test/mentionSearch.test.ts`; deleteGallery and deleteAccount — `test/deletion.test.ts`                                             |
| 2026-09-03 | 75.76%     | +1.53 | the four search-backed endpoints, once hatk alpha.82 made them testable — `test/search.test.ts`                                                     |
| 2026-09-03 | **80.14%** | +4.38 | the three OG cards and the font loader — `test/ogCards.test.ts`. **Goal met.** Excluding spaces, 92.1%                                              |

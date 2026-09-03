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
effort. Feeds and og are the two big untouched blocks.

| area             | uncovered | of   | covered |
| ---------------- | --------- | ---- | ------- |
| `server/xrpc`    | 624       | 1022 | 38.9%   |
| `server/feeds`   | 242       | 244  | 0.8%    |
| `server/og`      | 180       | 184  | 2.2%    |
| `server/hooks`   | 118       | 125  | 5.6%    |
| `server/spaces`  | 92        | 122  | 24.6%   |
| `server/hydrate` | 78        | 146  | 46.6%   |
| `server/helpers` | 67        | 175  | 61.7%   |

Biggest single files at the start:

| file                                 | uncovered | covered |
| ------------------------------------ | --------- | ------- |
| `server/feeds/foryou.ts`             | 99/99     | 0.0%    |
| `server/feeds/location.ts`           | 90/90     | 0.0%    |
| `server/og/collage.ts`               | 81/85     | 4.7%    |
| `server/xrpc/getNotifications.ts`    | 80/172    | 53.5%   |
| `server/hydrate/stories.ts`          | 53/53     | 0.0%    |
| `server/spaces/client.ts`            | 53/78     | 32.0%   |
| `server/xrpc/mentionSearch.ts`       | 44/45     | 2.2%    |
| `server/hooks/on-commit-favorite.ts` | 40/42     | 4.8%    |
| `server/xrpc/getStory.ts`            | 40/40     | 0.0%    |
| `server/og/gallery.ts`               | 37/37     | 0.0%    |

## Known hard spots

Recorded as they are hit, so a later pass does not rediscover them.

- `server/og/*` renders images and loads fonts. Covering it probably means
  asserting on the generated SVG/element tree rather than a rendered bitmap.
- `server/spaces/*` talks to a remote PDS over DPoP. `client.ts` and `dpop.ts`
  need the transport stubbed; the live path already has
  `test/spaces.live.test.ts` and should stay there.
- `server/hooks/*` are firehose commit handlers. They take a commit event and a
  db, so they should be callable directly without a server.

## Ledger

| date       | statements | delta | what landed                         |
| ---------- | ---------- | ----- | ----------------------------------- |
| 2026-09-03 | 30.68%     | —     | baseline; coverage tooling wired up |

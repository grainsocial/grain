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

## Railway production debugging

The prod container has `sqlite3` and `duckdb` CLIs. Railway SSH doesn't support piped stdin or shell metacharacters (parentheses, quotes) reliably. Use the base64 script pattern:

```bash
# Write a shell script to /tmp
cat > /tmp/query.sh <<'EOF'
sqlite3 /data/teal.db "SELECT COUNT(*) FROM [fm.teal.alpha.feed.play];"
EOF

# Base64 encode and pipe through ssh
B64=$(base64 < /tmp/query.sh | tr -d '\n')
railway ssh "sh -c \"echo $B64 | base64 -d | sh\""
```

For multi-line SQL or queries with special characters, use heredocs inside the script:

```bash
cat > /tmp/query.sh <<'EOF'
sqlite3 /data/teal.db <<'EOSQL'
EXPLAIN QUERY PLAN
SELECT t.uri FROM [fm.teal.alpha.feed.play] t
ORDER BY t.played_time DESC LIMIT 50;
EOSQL
EOF
```

Use bracket quoting `[table.name]` instead of double quotes for table names inside the script to avoid escaping issues.

Common queries:

- List indexes: `sqlite3 /data/teal.db ".indexes"`
- Query plans: `EXPLAIN QUERY PLAN SELECT ...`
- Row counts: `SELECT COUNT(*) FROM [table]`
- Check FTS schema: `SELECT sql FROM sqlite_master WHERE name LIKE '%_fts%'`

The database lives at `/data/teal.db` (Railway volume mount). The app dir is `/app` but `node_modules` are pruned for production so `better-sqlite3` is not available for ad-hoc node scripts.

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

Setup scripts run on every startup before the server accepts requests. Use `CREATE INDEX IF NOT EXISTS` so they're idempotent. To create an index on prod immediately without redeploying, use the Railway SSH pattern above.

### SQLite datetime comparison gotcha

SQLite's `datetime('now', '-4 hours')` returns space-separated format (`2026-03-16 12:00:00`) while ISO timestamps use `T` separator (`2026-03-16T12:00:00Z`). String comparison breaks because `T` > space. Use `strftime` for correct comparisons:

```sql
-- WRONG: matches too many rows
WHERE played_time >= datetime('now', '-4 hours')

-- CORRECT: ISO format matches stored timestamps
WHERE played_time >= strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-4 hours')
```

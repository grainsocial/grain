# BaseContext: Shared Hydration Context

**Goal:** Extract a shared `BaseContext` type from hatk so hydrators work with both feed and XRPC contexts without manual field spreading or `as any` casts.

**Problem:** `HydrateContext` and `XrpcContext` share 90% of their fields (db, lookup, count, getRecords, labels, blobUrl, viewer). Hydrators that need to work with both must manually spread every field and cast. Adding `getRecords` to `XrpcContext` required touching four construction sites.

## Design

### BaseContext

Shared interface in `hydrate.ts`. Provides data access tools any hydrator needs.

```ts
export interface BaseContext {
  viewer: { did: string; handle?: string } | null;
  db: { query: (sql: string, params?: unknown[]) => Promise<unknown[]> };
  getRecords: <R = unknown>(collection: string, uris: string[]) => Promise<Map<string, Row<R>>>;
  lookup: <R = unknown>(
    collection: string,
    field: string,
    values: string[],
  ) => Promise<Map<string, Row<R>>>;
  count: (collection: string, field: string, values: string[]) => Promise<Map<string, number>>;
  labels: (uris: string[]) => Promise<Map<string, unknown[]>>;
  blobUrl: (
    did: string,
    ref: unknown,
    preset?: "avatar" | "banner" | "feed_thumbnail" | "feed_fullsize",
  ) => string | undefined;
}
```

`buildBaseContext(viewer)` constructs one. No items parameter — items are always a separate argument.

### XrpcContext extends BaseContext

Adds XRPC-specific fields: params, cursor, limit, search, resolve, exists, packCursor, unpackCursor, isTakendown, filterTakendownDids, db.run. Context construction in xrpc.ts and opengraph.ts reuses `buildBaseContext` and extends.

### Feed hydrate signature

Changes from `(ctx: HydrateContext<T>) => Promise<View[]>` to `(ctx: BaseContext, items: Row<T>[]) => Promise<View[]>`. `HydrateContext` is removed entirely.

### Hydrator reuse

XRPC handlers pass `ctx` directly to hydrators since `XrpcContext extends BaseContext`:

```ts
// Before
const galleries = await hydrateGalleries({
  items: result.records,
  viewer: ctx.viewer,
  db: ctx.db,
  getRecords: ctx.getRecords,
  lookup: ctx.lookup,
  count: ctx.count,
  labels: ctx.labels,
  blobUrl: ctx.blobUrl,
} as any);

// After
const galleries = await hydrateGalleries(ctx, result.records);
```

## Files to change

**hatk framework:**

- `hydrate.ts` — Add BaseContext, remove HydrateContext, buildBaseContext
- `xrpc.ts` — XrpcContext extends BaseContext, reuse buildBaseContext
- `opengraph.ts` — Reuse buildBaseContext
- `feeds.ts` — Hydrate signature, executeFeed, exports
- `cli.ts` — Codegen: BaseContext imports/exports, defineFeed overloads

**Template projects:**

- `server/feeds/_hydrate.ts` — Accept (ctx: BaseContext, items: Row<T>[])
- `server/feeds/*.ts` — Pass (ctx, items) to hydrate
- `server/xrpc/*.ts` — Pass ctx directly to hydrators

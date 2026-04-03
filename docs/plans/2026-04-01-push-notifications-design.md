# Push Notifications Design

## Overview

Add push notification support across three repos: hatk gains an `on-commit` hook primitive and push delivery infrastructure, grain wires notification events to push, and grain-native registers for and handles APNs.

## hatk: `on-commit` Hook Primitive

A new hook trigger type that fires after the firehose indexer writes a record to the database. Follows the existing `defineHook(event, handler)` pattern with an options object for declarative collection filtering.

```ts
// server/hooks/on-commit-favorite.ts
export default defineHook("on-commit", { collections: ["social.grain.favorite"] },
  async ({ action, collection, record, repo, uri, db, lookup, push }) => {
    // action: "create" | "delete"
    // collection: NSID that matched
    // record: the record value
    // repo: DID of the committing actor
    // uri: AT URI of the record
    // db: { query, run } — raw SQL access
    // lookup: typed record lookup (same as BaseContext)
    // push: push delivery interface
  }
)
```

The firehose indexer already processes commits in `flushBuffer()`. After `insertRecord` / `deleteRecord`, it invokes matching `on-commit` hooks filtered by `collections`. Multiple hooks can match the same commit. Hooks run async and non-blocking (same pattern as `runLabelRules`).

## hatk: Push Token Registration & Storage

### Database

```sql
CREATE TABLE _push_tokens (
  did       TEXT NOT NULL,
  token     TEXT NOT NULL,
  platform  TEXT NOT NULL,  -- "apns" for now, "fcm"/"web" later
  createdAt TEXT NOT NULL,
  PRIMARY KEY (did, token)
);
```

### Built-in XRPC Endpoints

- `social.hatk.push.registerToken` — accepts `{ token, platform }`, associates with authenticated viewer's DID. Handles duplicates via upsert.
- `social.hatk.push.unregisterToken` — accepts `{ token }`, removes it.

### Configuration

```ts
// hatk.config.ts
push: {
  apns: {
    keyFile: "./certs/AuthKey_XXXX.p8",
    keyId: "XXXX",
    teamId: "YYYY",
    bundleId: "com.grain.app",
  }
}
```

Push features are disabled entirely if no `push` config is present.

## hatk: `push.send()` Delivery

The `push` object is injected into hook handler context:

```ts
await push.send({
  did: string,                     // recipient's DID
  title: string,                   // notification title
  body: string,                    // notification body
  data?: Record<string, string>,   // custom payload (e.g. { uri, type })
  collapseId?: string,             // APNs collapse-id for grouping
})
```

Internals:

- Looks up all tokens for the DID in `_push_tokens`
- Builds APNs payload, sends via HTTP/2 to Apple's push gateway
- If Apple responds with invalid/expired token, deletes it from `_push_tokens` (self-cleaning)
- Fire-and-forget — delivery failures are logged via `emit()` but don't throw
- No queuing for v1. Hooks run async after flush (like label rules). A queue can be added behind the same API later.

## grain: Hook Implementations

One `on-commit` hook file per notification trigger:

```
server/hooks/
  on-login.ts                (existing)
  on-commit-favorite.ts      (new)
  on-commit-comment.ts       (new)
  on-commit-follow.ts        (new)
```

### Example: Favorites

```ts
export default defineHook("on-commit", { collections: ["social.grain.favorite"] },
  async ({ action, record, repo, db, lookup, push }) => {
    if (action !== "create") return
    const [gallery] = await db.query(
      `SELECT did AS author, uri FROM "social.grain.gallery" WHERE uri = $1`,
      [record.subject]
    )
    if (!gallery || gallery.author === repo) return
    const profiles = await lookup("app.bsky.actor.profile", "did", [repo])
    const actor = profiles.get(repo)
    await push.send({
      did: gallery.author,
      title: "New favorite",
      body: `${actor?.value.displayName ?? "Someone"} favorited your gallery`,
      data: { type: "gallery-favorite", uri: gallery.uri },
    })
  }
)
```

Comments and follows follow the same pattern. Mentions and replies parse facets or look up parent comment authors but use the same shape.

The existing `getNotifications` query is unchanged — it remains the source of truth for the notification list. Push alerts the user to come look.

## grain-native: APNs Registration & Handling

### Token Registration Flow

1. On app launch (after auth), call `UNUserNotificationCenter.requestAuthorization()`
2. On grant, call `UIApplication.shared.registerForRemoteNotifications()`
3. In `AppDelegate.didRegisterForRemoteNotificationsWithDeviceToken`, send the hex-encoded token to `social.hatk.push.registerToken` via XRPC client
4. Re-register on every app launch (token can change; server upserts)

### Handling Incoming Pushes

- Tap on a notification reads `data.type` and `data.uri` from the payload
- Routes to the appropriate view: gallery detail for favorites/comments, profile for follows

### Unregistration

- On logout, call `social.hatk.push.unregisterToken` to remove the token server-side

### Entitlements

- Add Push Notifications capability in Xcode
- Add `aps-environment` entitlement (development/production)
- Register bundle ID with APNs in Apple Developer portal

## What's NOT in v1

- No FCM / web push (table has `platform` column for future use)
- No queuing / retry system (async inline delivery, failures logged)
- No notification preferences / muting (all types push to all registered devices)
- No rich notifications (images, actions) — title + body + data only

import { describe, expect, test } from "vitest";

/**
 * A client metadata document's `scope` bounds what that client may ever ask
 * for. Conditional scopes widen a single authorization request past the base
 * set, and a PDS that checks the request against the document rejects the
 * whole thing when the widened request names a scope the document does not.
 * blacksky.app answers PAR with `400 scope "repo:social.grain.group.submission"
 * is not registered in the client metadata`; bsky.social does not check, so the
 * omission is invisible on the PDS most accounts are on.
 *
 * The cost of the mistake is not the feature — it is every login on such a PDS.
 */

/** The prod clients only exist when APP_DOMAIN is set, so set it before load. */
process.env.APP_DOMAIN = "grain.test";
const config = (await import("../hatk.config.ts")).default;

const clients = config.oauth?.clients ?? [];
const conditional = config.oauth?.conditionalScopes ?? [];

/** Scope strings are space-separated; each one is checked whole. */
const split = (scope: string) => scope.split(" ").filter(Boolean);

test("every client is registered, prod included", () => {
  expect(clients.map((c) => c.client_id)).toContain(
    "https://grain.test/oauth-client-metadata.json",
  );
  expect(clients.length).toBeGreaterThan(1);
});

test("the group scopes a conditional adds are registered somewhere", () => {
  const conditionalScopes = conditional.flatMap((c) => c.scopes).flatMap(split);
  expect(conditionalScopes).toContain("repo:social.grain.group.submission");
});

describe("conditional scopes are registered on every client", () => {
  for (const client of clients) {
    test(client.client_id, () => {
      const registered = new Set(split(client.scope));
      const missing = conditional
        .flatMap((c) => c.scopes)
        .flatMap(split)
        .filter((s) => !registered.has(s));
      expect(missing).toEqual([]);
    });
  }
});

test("the scopes a server-initiated login requests are registered too", () => {
  // `oauth.scopes` is what hatk builds its own authorization request from, so
  // it is bounded by the same document as anything a client asks for.
  const requested = (config.oauth?.scopes ?? []).flatMap(split);
  for (const client of clients) {
    const registered = new Set(split(client.scope));
    expect(requested.filter((s) => !registered.has(s))).toEqual([]);
  }
});

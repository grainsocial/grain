// Resolving the `:actor` route segment. A profile is linked by handle, so the
// loader turns a handle into a DID on every visit, and the result has to agree
// with what the page's own DID-keyed queries already know.

import { beforeEach, expect, test, vi } from "vitest";
import { QueryClient } from "@tanstack/svelte-query";

const ALICE = "did:plc:alice";
const FOLLOW_URI = `at://did:plc:me/social.grain.graph.follow/1`;

let following: string | undefined;
let fetches = 0;

// Mocked by resolved path: the $hatk and $lib aliases resolve before vi.mock matches.
vi.mock("../hatk.generated.client.ts", () => ({
  callXrpc: async (_nsid: string, _input: unknown) => {
    fetches++;
    return {
      did: ALICE,
      cid: "cid-alice",
      handle: "alice.test",
      followersCount: following ? 1 : 0,
      viewer: following ? { following } : {},
    };
  },
}));

const { resolveRouteActor } = await import("../app/lib/actor.ts");
const { actorProfileQuery } = await import("../app/lib/queries.ts");

const profileIn = (qc: QueryClient, actor: string) =>
  qc.getQueryData(actorProfileQuery(actor).queryKey) as any;

beforeEach(() => {
  following = undefined;
  fetches = 0;
});

test("a DID passes through without a request", async () => {
  const qc = new QueryClient();
  expect(await resolveRouteActor(qc, ALICE, "did:plc:me")).toBe(ALICE);
  expect(fetches).toBe(0);
});

test("a handle resolves to a DID and seeds the profile under the DID key", async () => {
  const qc = new QueryClient();
  expect(await resolveRouteActor(qc, "alice.test", "did:plc:me")).toBe(ALICE);
  expect(profileIn(qc, ALICE).handle).toBe("alice.test");
});

test("a revisit resolves from the remembered DID, leaving no second copy", async () => {
  const qc = new QueryClient();
  await resolveRouteActor(qc, "alice.test", "did:plc:me");
  expect(profileIn(qc, "alice.test")).toBeUndefined();
  expect(fetches).toBe(1);

  await resolveRouteActor(qc, "alice.test", "did:plc:me");
  expect(fetches).toBe(1);
});

test("revisiting the route keeps a follow the page already learned about", async () => {
  const qc = new QueryClient();
  const did = await resolveRouteActor(qc, "alice.test", "did:plc:me");

  // The viewer follows: the write is indexed before it returns, and the page's
  // own query refetches its DID-keyed profile.
  following = FOLLOW_URI;
  await qc.fetchQuery({ ...actorProfileQuery(did, "did:plc:me"), staleTime: 0 });
  expect(profileIn(qc, did).viewer.following).toBe(FOLLOW_URI);

  // Off to the feed and back, inside the profile query's stale window.
  expect(await resolveRouteActor(qc, "alice.test", "did:plc:me")).toBe(did);
  expect(profileIn(qc, did).viewer.following).toBe(FOLLOW_URI);
});

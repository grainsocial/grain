// getActorProfile, and the mute procedures that one of its fields reports on.
//
// The part worth pinning down is the viewer block: it carries the relationship
// between the two accounts, and a block on either side has to hide the follow
// relationship rather than merely sitting alongside it.

import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { startTestServer } from "@hatk/hatk/test";

const ALICE = "did:plc:alice"; // the viewer
const BOB = "did:plc:bob"; // mutual follow with Alice
const CAROL = "did:plc:carol"; // taken down
const DAVE = "did:plc:dave"; // no profile record, handle only
const ERIN = "did:plc:erin"; // blocked Alice
const FRANK = "did:plc:frank"; // Alice blocked him
const GINA = "did:plc:gina"; // for muting

let server: any;

const profilePath = (actor: string, extra = "") =>
  `/xrpc/social.grain.unspecced.getActorProfile?actor=${encodeURIComponent(actor)}${extra}`;

async function profile(actor: string, as?: string, extra = "") {
  const path = profilePath(actor, extra);
  const res = as ? await server.fetchAs(as, path) : await server.fetch(path);
  expect(res.status).toBe(200);
  return res.json();
}

async function post(nsid: string, body: unknown, as?: string) {
  const path = `/xrpc/${nsid}`;
  const init = {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  };
  return as ? server.fetchAs(as, path, init) : server.fetch(path, init);
}

async function follow(did: string, subject: string) {
  await server.db.run(
    `INSERT INTO "social.grain.graph.follow" (uri, cid, did, indexed_at, subject, created_at)
     VALUES ($1, $2, $3, 'i', $4, '2026-01-01')`,
    [
      `at://${did}/social.grain.graph.follow/${subject.split(":").pop()}`,
      `cid-f-${did}-${subject}`,
      did,
      subject,
    ],
  );
}

async function block(did: string, subject: string) {
  await server.db.run(
    `INSERT INTO "social.grain.graph.block" (uri, cid, did, indexed_at, subject, created_at)
     VALUES ($1, $2, $3, 'i', $4, '2026-01-01')`,
    [
      `at://${did}/social.grain.graph.block/${subject.split(":").pop()}`,
      `cid-b-${did}-${subject}`,
      did,
      subject,
    ],
  );
}

beforeAll(async () => {
  server = await startTestServer();
  const { db } = server;

  await db.run(
    `CREATE TABLE IF NOT EXISTS _mutes (
       did TEXT NOT NULL, subject TEXT NOT NULL, created_at TEXT NOT NULL,
       PRIMARY KEY (did, subject)
     )`,
  );

  for (const [did, handle, status] of [
    [ALICE, "alice.test", "active"],
    [BOB, "bob.test", "active"],
    [CAROL, "carol.test", "takendown"],
    [DAVE, "dave.test", "active"],
    [ERIN, "erin.test", "active"],
    [FRANK, "frank.test", "active"],
    [GINA, "gina.test", "active"],
  ]) {
    await db.run(`INSERT INTO _repos (did, status, handle) VALUES ($1, $2, $3)`, [
      did,
      status,
      handle,
    ]);
  }

  // Dave has no profile record, so he falls back to his handle.
  for (const [did, name] of [
    [ALICE, "Alice A"],
    [BOB, "Bob Ross"],
    [CAROL, "Carol C"],
    [ERIN, "Erin E"],
    [FRANK, "Frank F"],
    [GINA, "Gina G"],
  ]) {
    await db.run(
      `INSERT INTO "social.grain.actor.profile" (uri, cid, did, indexed_at, display_name, description, created_at)
       VALUES ($1, $2, $3, 'i', $4, $5, '2026-02-02')`,
      [
        `at://${did}/social.grain.actor.profile/self`,
        `cid-p-${did}`,
        did,
        name,
        `${name} writes here`,
      ],
    );
  }

  // Bob has two galleries; the count comes off the record table directly.
  for (const id of ["g1", "g2"]) {
    await db.run(
      `INSERT INTO "social.grain.gallery" (uri, cid, did, indexed_at, title, created_at)
       VALUES ($1, $2, $3, 'i', $4, '2026-03-01')`,
      [`at://${BOB}/social.grain.gallery/${id}`, `cid-${id}`, BOB, id],
    );
  }

  // Bob is followed by Alice, Erin and Frank, and follows Alice back.
  await follow(ALICE, BOB);
  await follow(ERIN, BOB);
  await follow(FRANK, BOB);
  await follow(BOB, ALICE);

  // Alice and Frank follow each other, and then Alice blocks him.
  await follow(ALICE, FRANK);
  await follow(FRANK, ALICE);
  await block(ALICE, FRANK);

  // Alice and Erin follow each other, and Erin blocks Alice.
  await follow(ALICE, ERIN);
  await follow(ERIN, ALICE);
  await block(ERIN, ALICE);
});

afterAll(async () => await server?.close());

describe("getActorProfile", () => {
  test("returns the profile record's own fields", async () => {
    const p = await profile(BOB);
    expect(p).toMatchObject({
      did: BOB,
      cid: `cid-p-${BOB}`,
      handle: "bob.test",
      displayName: "Bob Ross",
      description: "Bob Ross writes here",
      createdAt: "2026-02-02",
    });
  });

  test("counts galleries, followers and follows", async () => {
    const p = await profile(BOB);
    expect(p.galleryCount).toBe(2);
    expect(p.followersCount).toBe(3); // Alice, Erin, Frank
    expect(p.followsCount).toBe(1); // just Alice
  });

  test("accepts a handle in place of a did", async () => {
    expect((await profile("bob.test")).did).toBe(BOB);
  });

  test("rejects a handle nobody holds", async () => {
    const res = await server.fetch(profilePath("nobody.test"));
    expect(res.status).toBe(400);
  });

  test("returns only a stub for a taken-down account", async () => {
    const p = await profile(CAROL);
    expect(p).toEqual({ did: CAROL, handle: CAROL, cid: "" });
    expect(p.displayName).toBeUndefined();
  });

  test("falls back to the repo handle when there is no profile record", async () => {
    const p = await profile(DAVE);
    expect(p).toMatchObject({ did: DAVE, handle: "dave.test", cid: "" });
    expect(p.displayName).toBeUndefined();
    expect(p.galleryCount).toBe(0);
  });

  test("carries no viewer block when nobody is asking", async () => {
    expect((await profile(BOB)).viewer).toBeUndefined();
  });

  test("carries no viewer block when you ask about yourself", async () => {
    expect((await profile(ALICE, ALICE)).viewer).toBeUndefined();
  });

  test("reports a mutual follow in both directions", async () => {
    const p = await profile(BOB, ALICE);
    expect(p.viewer.following).toBe(`at://${ALICE}/social.grain.graph.follow/bob`);
    expect(p.viewer.followedBy).toBe(`at://${BOB}/social.grain.graph.follow/alice`);
  });

  test("hides the follow relationship when the viewer blocked them", async () => {
    // Alice and Frank followed each other before she blocked him. The block is
    // reported; the follows are not, in either direction.
    const p = await profile(FRANK, ALICE);
    expect(p.viewer.blocking).toBe(`at://${ALICE}/social.grain.graph.block/frank`);
    expect(p.viewer.following).toBeUndefined();
    expect(p.viewer.followedBy).toBeUndefined();
  });

  test("hides it just the same when they blocked the viewer", async () => {
    const p = await profile(ERIN, ALICE);
    expect(p.viewer.blockedBy).toBe(true);
    expect(p.viewer.blocking).toBeUndefined();
    expect(p.viewer.following).toBeUndefined();
    expect(p.viewer.followedBy).toBeUndefined();
  });

  test("takes the viewer from a query parameter when there is no session", async () => {
    const p = await profile(BOB, undefined, `&viewer=${encodeURIComponent(ALICE)}`);
    expect(p.viewer.following).toBe(`at://${ALICE}/social.grain.graph.follow/bob`);
  });
});

describe("muteActor and unmuteActor", () => {
  test("a mute shows up on the muted account's profile, and lifting it removes it", async () => {
    expect((await profile(GINA, ALICE)).viewer).toBeUndefined();

    const muted = await post("social.grain.graph.muteActor", { actor: GINA }, ALICE);
    expect(muted.status).toBe(200);
    expect((await profile(GINA, ALICE)).viewer).toEqual({ muted: true });

    const unmuted = await post("social.grain.graph.unmuteActor", { actor: GINA }, ALICE);
    expect(unmuted.status).toBe(200);
    expect((await profile(GINA, ALICE)).viewer).toBeUndefined();
  });

  test("muting twice is not an error", async () => {
    expect((await post("social.grain.graph.muteActor", { actor: GINA }, ALICE)).status).toBe(200);
    expect((await post("social.grain.graph.muteActor", { actor: GINA }, ALICE)).status).toBe(200);
    const rows = await server.db.query(`SELECT * FROM _mutes WHERE did = $1 AND subject = $2`, [
      ALICE,
      GINA,
    ]);
    expect(rows).toHaveLength(1);
    await post("social.grain.graph.unmuteActor", { actor: GINA }, ALICE);
  });

  test("unmuting someone you never muted is not an error", async () => {
    expect((await post("social.grain.graph.unmuteActor", { actor: BOB }, ALICE)).status).toBe(200);
  });

  test("refuses to let you mute yourself", async () => {
    const res = await post("social.grain.graph.muteActor", { actor: ALICE }, ALICE);
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  test("both require a session", async () => {
    expect(
      (await post("social.grain.graph.muteActor", { actor: GINA })).status,
    ).toBeGreaterThanOrEqual(400);
    expect(
      (await post("social.grain.graph.unmuteActor", { actor: GINA })).status,
    ).toBeGreaterThanOrEqual(400);
  });
});

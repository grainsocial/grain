// The spam label rule's handling of Bridgy Fed accounts. hatk runs label
// rules as a live write is indexed, and the test harness has no path that
// does, so the rule is called directly against the harness database.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from "vitest";
import { startTestServer } from "@hatk/hatk/test";
import spam from "../server/labels/spam";
import { isBridgedHandle } from "../server/helpers/bridged";

const BRIDGED = "did:plc:bridged";
const LOCAL = "did:plc:local";

let server: Awaited<ReturnType<typeof startTestServer>>;

function evaluate(did: string, collection: string, rkey = "r1") {
  return spam.evaluate!({
    db: server.db,
    record: { uri: `at://${did}/${collection}/${rkey}`, cid: "cid", did, collection, value: {} },
  });
}

beforeAll(async () => {
  server = await startTestServer();
  await server.db.run(
    `INSERT INTO _repos (did, status, handle) VALUES ($1, 'active', $2), ($3, 'active', $4)`,
    [BRIDGED, "Someone.mastodon.social.ap.brid.gy", LOCAL, "alice.test"],
  );
});

beforeEach(async () => await server.db.run(`DELETE FROM _labels`));
afterAll(async () => await server?.close());

describe("isBridgedHandle", () => {
  test("matches a Bridgy Fed fediverse handle, whatever its case", () => {
    expect(isBridgedHandle("someone.mastodon.social.ap.brid.gy")).toBe(true);
    expect(isBridgedHandle("MDT.mast.lat.AP.brid.gy")).toBe(true);
  });

  test("does not match other handles, or none", () => {
    expect(isBridgedHandle("alice.bsky.social")).toBe(false);
    expect(isBridgedHandle("ap.brid.gy.example.com")).toBe(false);
    expect(isBridgedHandle(null)).toBe(false);
  });
});

describe("spam label rule", () => {
  test("labels a bridged account's gallery, story and comment", async () => {
    expect(await evaluate(BRIDGED, "social.grain.gallery")).toEqual(["spam"]);
    expect(await evaluate(BRIDGED, "social.grain.story")).toEqual(["spam"]);
    expect(await evaluate(BRIDGED, "social.grain.comment")).toEqual(["spam"]);
  });

  test("leaves the bridged account's other records alone", async () => {
    expect(await evaluate(BRIDGED, "social.grain.photo")).toEqual([]);
    expect(await evaluate(BRIDGED, "social.grain.actor.profile")).toEqual([]);
  });

  test("leaves everyone else's posts alone", async () => {
    expect(await evaluate(LOCAL, "social.grain.gallery")).toEqual([]);
    expect(await evaluate("did:plc:unknown", "social.grain.gallery")).toEqual([]);
  });

  test("does not overrule an admin who unhid the post", async () => {
    const uri = `at://${BRIDGED}/social.grain.gallery/r1`;
    await server.db.run(
      `INSERT INTO _labels (src, uri, val, neg, cts) VALUES ('self', $1, 'spam', 0, '2026-10-21'),
                                                          ('admin', $1, 'spam', 1, '2026-10-22')`,
      [uri],
    );
    expect(await evaluate(BRIDGED, "social.grain.gallery")).toEqual([]);
  });
});

import { afterEach, describe, expect, test, vi } from "vitest";
import { LABEL_DEFINITIONS, REPORT_REASONS } from "$lib/labels";
import {
  applyWrites,
  createRecord,
  createWrite,
  deleteRecord,
  deleteWrite,
  putRecord,
  uploadBlob,
} from "$lib/utils/records";
import { getRecordAtPds, pdsOf } from "$lib/pds";

type Sent = { url: string; init: RequestInit };

function server(answer: (url: string) => unknown = () => ({})) {
  const sent: Sent[] = [];
  vi.stubGlobal("window", {});
  vi.stubGlobal("fetch", async (url: string, init: RequestInit = {}) => {
    sent.push({ url, init });
    return new Response(JSON.stringify(answer(url)), { status: 200 });
  });
  return sent;
}

const body = (s: Sent) => JSON.parse(s.init.body as string);

afterEach(() => vi.unstubAllGlobals());

describe("reports", () => {
  test("every label a report can name has the reason grain-serve files under it", () => {
    for (const def of LABEL_DEFINITIONS) expect(REPORT_REASONS[def.identifier]).toBeTruthy();
    expect(REPORT_REASONS.csae).toMatch(/#reasonChildSafety/);
    expect(REPORT_REASONS.copyright).toBe("social.grain.moderation.defs#reasonCopyright");
  });
});

describe("writes", () => {
  test("each goes to its social.grain.repo method, without a repo", async () => {
    const sent = server(() => ({ uri: "at://did:plc:a/social.grain.favorite/1", cid: "c" }));
    const record = { subject: "at://x", createdAt: "t" };
    const made = await createRecord({ collection: "social.grain.favorite", record });
    await putRecord({ collection: "social.grain.actor.profile", rkey: "self", record });
    await deleteRecord({ collection: "social.grain.favorite", rkey: "1" });
    expect(made.uri).toBe("at://did:plc:a/social.grain.favorite/1");
    expect(sent.map((s) => s.url)).toEqual([
      "/xrpc/social.grain.repo.createRecord",
      "/xrpc/social.grain.repo.putRecord",
      "/xrpc/social.grain.repo.deleteRecord",
    ]);
    expect(body(sent[0])).toEqual({ collection: "social.grain.favorite", record });
    expect(body(sent[1])).toMatchObject({ rkey: "self" });
    expect(body(sent[2])).toEqual({ collection: "social.grain.favorite", rkey: "1" });
  });

  test("applyWrites names grain's write types, and sends none for no writes", async () => {
    const sent = server(() => ({ results: [] }));
    await applyWrites([]);
    expect(sent).toHaveLength(0);
    await applyWrites([
      createWrite("social.grain.gallery", "a", { title: "t" }),
      deleteWrite("social.grain.photo", "b"),
    ]);
    expect(sent[0].url).toBe("/xrpc/social.grain.repo.applyWrites");
    expect(body(sent[0]).writes.map((w: { $type: string }) => w.$type)).toEqual([
      "social.grain.repo.applyWrites#create",
      "social.grain.repo.applyWrites#delete",
    ]);
  });

  test("a blob goes up as its bytes", async () => {
    const sent = server(() => ({ blob: { $type: "blob" } }));
    const blob = new Blob([new Uint8Array([1])], { type: "image/jpeg" });
    expect((await uploadBlob(blob)).blob).toEqual({ $type: "blob" });
    expect(sent[0].url).toBe("/xrpc/social.grain.repo.uploadBlob");
    expect(sent[0].init.body).toBe(blob);
  });
});

describe("pds", () => {
  test("finds a PDS by the DID document, and reads a record there", async () => {
    const sent = server((url) =>
      url.startsWith("https://plc.directory/")
        ? { service: [{ id: "#atproto_pds", serviceEndpoint: "https://pds.test/" }] }
        : { uri: "at://did:plc:pds1/social.grain.actor.profile/self", value: { avatar: 1 } },
    );
    expect(await pdsOf("did:plc:pds1")).toBe("https://pds.test");
    const got = await getRecordAtPds("at://did:plc:pds1/social.grain.actor.profile/self");
    expect(got?.value).toEqual({ avatar: 1 });
    expect(sent.at(-1)!.url).toBe(
      "https://pds.test/xrpc/com.atproto.repo.getRecord?repo=did%3Aplc%3Apds1&collection=social.grain.actor.profile&rkey=self",
    );
    expect(sent.filter((s) => s.url.startsWith("https://plc.directory/"))).toHaveLength(1);
  });

  test("a did:web's document is at its host", async () => {
    const sent = server(() => ({
      service: [{ type: "AtprotoPersonalDataServer", serviceEndpoint: "https://web.test" }],
    }));
    expect(await pdsOf("did:web:example.com")).toBe("https://web.test");
    expect(sent[0].url).toBe("https://example.com/.well-known/did.json");
  });
});

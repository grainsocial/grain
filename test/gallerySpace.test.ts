// A gallery's space on the author's PDS, asked for under the reference alpha's
// names first and pds.js's and zds's simplespace names when those aren't served.
import { describe, expect, test, vi } from "vitest";
import {
  addGalleryReader,
  createGallerySpace,
  listGalleryMembers,
} from "../server/spaces/client.ts";

const AUTHOR = "did:plc:author";
const READER = "did:plc:reader";
const SPACE = `at://${AUTHOR}/space/social.grain.privateGallery/g1`;

/** A PDS that serves only `served`, answering anything else as `missing` does. */
function pdsServing(served: string[], missing = 501) {
  return vi.fn(async (nsid: string) => {
    if (served.includes(nsid)) return { members: [{ did: READER }] };
    throw Object.assign(new Error("MethodNotImplemented"), { status: missing });
  });
}

describe("a gallery's space", () => {
  test("is made with the reference alpha's createSpace and a memberspace policy", async () => {
    const pds = pdsServing(["com.atproto.space.createSpace"]);
    await createGallerySpace(pds, AUTHOR, "g1");
    expect(pds).toHaveBeenCalledTimes(1);
    expect(pds).toHaveBeenCalledWith("com.atproto.space.createSpace", {
      method: "POST",
      body: {
        spaceType: "social.grain.privateGallery",
        skey: "g1",
        policy: { $type: "com.atproto.memberspace.policy" },
      },
    });
  });

  test("falls back to simplespace, in the shape pds.js and zds read", async () => {
    for (const missing of [404, 501]) {
      const pds = pdsServing(["com.atproto.simplespace.createSpace"], missing);
      await createGallerySpace(pds, AUTHOR, "g1");
      expect(pds).toHaveBeenLastCalledWith("com.atproto.simplespace.createSpace", {
        method: "POST",
        body: expect.objectContaining({
          did: AUTHOR,
          type: "social.grain.privateGallery",
          config: expect.objectContaining({ policy: "member-list" }),
        }),
      });
    }
  });

  test("doesn't fall back past a refusal", async () => {
    const pds = vi.fn(async () => {
      throw Object.assign(new Error("SpaceAlreadyExists"), { status: 400 });
    });
    await expect(createGallerySpace(pds, AUTHOR, "g1")).rejects.toThrow("SpaceAlreadyExists");
    expect(pds).toHaveBeenCalledTimes(1);
  });

  test("lets a reader read and not write", async () => {
    const pds = pdsServing(["com.atproto.memberspace.putMember"]);
    await addGalleryReader(pds, SPACE, READER);
    expect(pds).toHaveBeenCalledWith("com.atproto.memberspace.putMember", {
      method: "POST",
      body: { space: SPACE, did: READER, read: true, write: false },
    });
  });

  test("adds a reader with pds.js's addMember where that's what's served", async () => {
    const pds = pdsServing(["com.atproto.simplespace.addMember"]);
    await addGalleryReader(pds, SPACE, READER);
    expect(pds).toHaveBeenLastCalledWith("com.atproto.simplespace.addMember", {
      method: "POST",
      body: { space: SPACE, did: READER },
    });
  });

  test("lists members under either name", async () => {
    for (const name of [
      "com.atproto.memberspace.listMembers",
      "com.atproto.simplespace.listMembers",
    ]) {
      const body = await listGalleryMembers(pdsServing([name]), SPACE, 100);
      expect(body.members).toEqual([{ did: READER }]);
    }
  });
});

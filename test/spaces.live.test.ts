// The permissioned-space read path, against the two pds.js instances docker
// compose brings up. Skipped unless SPACES_LIVE=1, since it needs them running:
//
//   docker compose up -d && ./seeds/pdsjs-accounts.sh
//   SPACES_LIVE=1 npx vitest run test/spaces.live.test.ts
//
// What it proves is the part that cannot be checked against a mock: that a
// reader who owns none of the data can mint a credential from a space they were
// added to and pull records and blobs out of a host they have no session on,
// with DPoP proofs this code signs itself.

import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, test } from "vitest";
import {
  fetchSpaceBlob,
  listSpaceRecords,
  listSpaceRepos,
  type PdsCall,
  spaceUri,
} from "../server/spaces/client.ts";

const live = process.env.SPACES_LIVE === "1";
const CREDS = "data/pdsjs";
const PASSWORD = "dev-password";

type Account = { did: string; handle: string; pdsUrl: string };

/** A PdsCall backed by a password session — what ctx.pds is in production. */
function pdsCallFor(account: Account, jwt: string): PdsCall {
  return async (nsid, options) => {
    const method = options?.method ?? "GET";
    const url = new URL(`${account.pdsUrl}/xrpc/${nsid}`);
    for (const [k, v] of Object.entries(options?.params ?? {})) {
      if (v !== undefined) url.searchParams.append(k, String(v));
    }
    const res = await fetch(url, {
      method,
      headers: {
        authorization: `Bearer ${jwt}`,
        ...(method === "POST" ? { "content-type": "application/json" } : {}),
      },
      body: method === "POST" ? JSON.stringify(options?.body ?? {}) : undefined,
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`${nsid} → ${res.status} ${text}`);
    return text ? JSON.parse(text) : {};
  };
}

async function login(account: Account): Promise<string> {
  const res = await fetch(`${account.pdsUrl}/xrpc/com.atproto.server.createSession`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ identifier: account.did, password: PASSWORD }),
  });
  if (!res.ok) throw new Error(`login failed for ${account.handle}: ${await res.text()}`);
  return ((await res.json()) as { accessJwt: string }).accessJwt;
}

// One PNG pixel, so the blob round trip compares real bytes.
const PIXEL = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

describe.skipIf(!live)("permissioned spaces, live", () => {
  let author: Account;
  let reader: Account;
  let authorPds: PdsCall;
  let readerPds: PdsCall;
  let space: string;
  let closedSpace: string;
  let photoCid: string;

  beforeAll(async () => {
    author = JSON.parse(readFileSync(`${CREDS}/credentials-spacehost.json`, "utf8"));
    reader = JSON.parse(readFileSync(`${CREDS}/credentials-spacemember.json`, "utf8"));
    authorPds = pdsCallFor(author, await login(author));
    readerPds = pdsCallFor(reader, await login(reader));

    // A gallery is a space: skey is the gallery's rkey, authority is its author.
    const skey = `test${Date.now().toString(36)}`;
    space = spaceUri(author.did, skey);

    await authorPds("com.atproto.simplespace.createSpace", {
      method: "POST",
      body: {
        type: "social.grain.gallery",
        skey,
        policy: { $type: "com.atproto.simplespace.defs#memberListPolicy" },
        appAccess: { $type: "com.atproto.simplespace.defs#open" },
      },
    });
    await authorPds("com.atproto.simplespace.addMember", {
      method: "POST",
      body: { space, did: reader.did },
    });

    // A second gallery the reader is never added to, so the refusal below is
    // about membership rather than about a space that does not exist.
    const closedSkey = `closed${Date.now().toString(36)}`;
    closedSpace = spaceUri(author.did, closedSkey);
    await authorPds("com.atproto.simplespace.createSpace", {
      method: "POST",
      body: {
        type: "social.grain.gallery",
        skey: closedSkey,
        policy: { $type: "com.atproto.simplespace.defs#memberListPolicy" },
        appAccess: { $type: "com.atproto.simplespace.defs#open" },
      },
    });
    await authorPds("com.atproto.space.createRecord", {
      method: "POST",
      body: {
        space: closedSpace,
        repo: author.did,
        collection: "social.grain.photo",
        record: {
          $type: "social.grain.photo",
          photo: {
            $type: "blob",
            ref: { $link: "bafkreiplaceholder" },
            mimeType: "image/png",
            size: 1,
          },
          alt: "not for you",
          aspectRatio: { width: 1, height: 1 },
          createdAt: new Date().toISOString(),
        },
      },
    });

    // Blobs in a space record are ordinary account blobs, uploaded the ordinary
    // way. Only reading them back goes through the space.
    const upload = await fetch(`${author.pdsUrl}/xrpc/com.atproto.repo.uploadBlob`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${await login(author)}`,
        "content-type": "image/png",
      },
      body: PIXEL,
    });
    const { blob } = (await upload.json()) as { blob: { ref: { $link: string } } };
    photoCid = blob.ref.$link;

    await authorPds("com.atproto.space.applyWrites", {
      method: "POST",
      body: {
        space,
        repo: author.did,
        writes: [
          {
            $type: "com.atproto.space.applyWrites#create",
            collection: "social.grain.gallery",
            rkey: skey,
            value: {
              $type: "social.grain.gallery",
              title: "A private gallery",
              createdAt: new Date().toISOString(),
            },
          },
          {
            $type: "com.atproto.space.applyWrites#create",
            collection: "social.grain.photo",
            rkey: "photo1",
            value: {
              $type: "social.grain.photo",
              photo: blob,
              alt: "one pixel",
              aspectRatio: { width: 1, height: 1 },
              createdAt: new Date().toISOString(),
            },
          },
          {
            $type: "com.atproto.space.applyWrites#create",
            collection: "social.grain.gallery.item",
            rkey: "item1",
            value: {
              $type: "social.grain.gallery.item",
              gallery: `at://${author.did}/social.grain.gallery/${skey}`,
              item: `at://${author.did}/social.grain.photo/photo1`,
              position: 0,
              createdAt: new Date().toISOString(),
            },
          },
        ],
      },
    });
  }, 60_000);

  test("the author reads their own repo through their own session", async () => {
    const items = await listSpaceRecords(
      authorPds,
      author.did,
      space,
      author.did,
      "social.grain.gallery.item",
    );

    expect(items).toHaveLength(1);
    expect(items[0].value.position).toBe(0);
  });

  test("a member reads the author's repo with a space credential", async () => {
    // The reader has no session on the author's PDS at all. Everything here
    // rests on the credential the authority issued and the DPoP proof we sign.
    const photos = await listSpaceRecords(
      readerPds,
      reader.did,
      space,
      author.did,
      "social.grain.photo",
    );

    expect(photos).toHaveLength(1);
    expect(photos[0].value.alt).toBe("one pixel");
  });

  test("a member reads the writer set from the authority", async () => {
    const repos = await listSpaceRepos(readerPds, reader.did, space);

    expect(repos.map((r) => r.did)).toContain(author.did);
  });

  test("a member reads a blob the space references", async () => {
    const res = await fetchSpaceBlob(readerPds, reader.did, space, author.did, photoCid);
    const bytes = Buffer.from(await res.arrayBuffer());

    expect(bytes.equals(PIXEL)).toBe(true);
  });

  test("a non-member is refused a space that exists and holds records", async () => {
    // The author can read it, so the space and the record are real; the reader
    // is simply not on its member list. The refusal is the authority's — it
    // will not mint a credential — so the repo host is never even asked.
    const own = await listSpaceRecords(
      authorPds,
      author.did,
      closedSpace,
      author.did,
      "social.grain.photo",
    );
    expect(own).toHaveLength(1);

    await expect(
      listSpaceRecords(readerPds, reader.did, closedSpace, author.did, "social.grain.photo"),
    ).rejects.toMatchObject({ status: 403 });
  });
});

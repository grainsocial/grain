// Posts a step of the notice in posts.json as grain.social: a story on
// Grain, or a post on Bluesky with its image and reply.
//
//   GRAIN_SOCIAL_PASSWORD=<app password> node marketing/update/post.mjs <step> [--dry-run]
//
// The app password is grain.social's, never kept in the repository. A step
// already posted, the same text or the same image among the account's
// latest records, is not posted again. --dry-run logs in and says what it
// would post, and posts nothing.

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const { account, images, steps } = JSON.parse(
  await readFile(path.join(here, "posts.json"), "utf8"),
);
const [name, flag] = process.argv.slice(2);
const dry = flag === "--dry-run";
const step = steps[name];
if (!step) {
  console.error(
    `usage: node marketing/update/post.mjs <${Object.keys(steps).join("|")}> [--dry-run]`,
  );
  process.exit(2);
}
const password = process.env.GRAIN_SOCIAL_PASSWORD;
if (!password) {
  console.error("GRAIN_SOCIAL_PASSWORD: grain.social's app password");
  process.exit(2);
}

const doc = await (await fetch(`https://plc.directory/${account}`)).json();
const pds = doc.service.find((s) => s.id === "#atproto_pds").serviceEndpoint;

async function xrpc(method, { body, query, type = "application/json", token } = {}) {
  const url = new URL(`/xrpc/${method}`, pds);
  for (const [k, v] of Object.entries(query ?? {})) url.searchParams.set(k, v);
  const res = await fetch(url, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      ...(body === undefined ? {} : { "content-type": type }),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body:
      body === undefined ? undefined : type === "application/json" ? JSON.stringify(body) : body,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method}: ${res.status} ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : {};
}

const session = await xrpc("com.atproto.server.createSession", {
  body: { identifier: account, password },
});
const token = session.accessJwt;
console.log(`logged in as ${session.handle} on ${pds}`);

const latest = async (collection) =>
  (
    await xrpc("com.atproto.repo.listRecords", {
      query: { repo: account, collection, limit: "50" },
      token,
    })
  ).records;

async function upload(file) {
  const bytes = await readFile(path.join(here, file));
  return (await xrpc("com.atproto.repo.uploadBlob", { body: bytes, type: "image/png", token }))
    .blob;
}

async function create(collection, record) {
  if (dry) {
    console.log(`would create ${collection}:`, JSON.stringify(record, null, 2));
    return { uri: "(dry run)", cid: "(dry run)" };
  }
  const out = await xrpc("com.atproto.repo.createRecord", {
    body: { repo: account, collection, record },
    token,
  });
  console.log(`created ${out.uri}`);
  return out;
}

const now = () => new Date().toISOString();

if (step.story) {
  const { width, height } = images[step.story];
  const stories = await latest("social.grain.story");
  if (dry) {
    console.log(
      `${stories.length} recent stories; would upload ${step.story} and post it as a story`,
    );
    await create("social.grain.story", {
      $type: "social.grain.story",
      media: "(blob)",
      aspectRatio: { width, height },
      createdAt: now(),
    });
  } else {
    const media = await upload(step.story);
    const posted = stories.find((r) => r.value.media?.ref?.$link === media.ref.$link);
    if (posted) console.log(`already posted: ${posted.uri}`);
    else
      await create("social.grain.story", {
        $type: "social.grain.story",
        media,
        aspectRatio: { width, height },
        createdAt: now(),
      });
  }
} else {
  const posted = (await latest("app.bsky.feed.post")).find((r) => r.value.text === step.text);
  if (posted) {
    console.log(`already posted: ${posted.uri}`);
    process.exit(0);
  }
  const record = { $type: "app.bsky.feed.post", text: step.text, langs: ["en"], createdAt: now() };
  if (step.image) {
    const { width, height, alt } = images[step.image];
    record.embed = {
      $type: "app.bsky.embed.images",
      images: [
        { image: dry ? "(blob)" : await upload(step.image), alt, aspectRatio: { width, height } },
      ],
    };
  }
  const root = await create("app.bsky.feed.post", record);
  if (step.reply) {
    const ref = { uri: root.uri, cid: root.cid };
    await create("app.bsky.feed.post", {
      $type: "app.bsky.feed.post",
      text: step.reply,
      langs: ["en"],
      reply: { root: ref, parent: ref },
      createdAt: now(),
    });
  }
}

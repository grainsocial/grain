#!/usr/bin/env node
// Live end-to-end check for mention push hooks. Drives the local PDS via
// XRPC, then inspects the _mention_pushes dedup table directly.
//
// Requirements:
//   1. docker compose up    (PDS + PLC + postgres on :2583/:2582)
//   2. npm run dev          (hatk + SvelteKit on :3000)
//   3. Test accounts seeded (alice.test, bob.test, carol.test) — created
//      automatically by `npx hatk seed`, or by running this script (it
//      will try to createAccount and ignore "already exists").
//
// Run:   node scripts/test-mentions-live.mjs
//
// Not part of the vitest suite — requires a running stack and writes to
// the dev DB.

import { execSync } from "node:child_process";
const PDS = process.env.PDS_URL || "http://localhost:2583";
const DB = process.env.GRAIN_DB || "data/grain.db";
const PASSWORD = "password";

function sql(q) {
  return execSync(`sqlite3 ${DB} ${JSON.stringify(q)}`, { encoding: "utf8" }).trim();
}

async function ensureAccount(handle) {
  const create = await fetch(`${PDS}/xrpc/com.atproto.server.createAccount`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ handle, password: PASSWORD, email: `${handle.split(".")[0]}@test.invalid` }),
  });
  if (!create.ok) {
    const t = await create.text();
    if (!/already|taken/i.test(t)) console.warn(`createAccount(${handle}): ${t}`);
  }
  const ses = await fetch(`${PDS}/xrpc/com.atproto.server.createSession`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier: handle, password: PASSWORD }),
  });
  if (!ses.ok) throw new Error(`session(${handle}): ${await ses.text()}`);
  return await ses.json();
}

async function putRecord(session, collection, rkey, record) {
  const r = await fetch(`${PDS}/xrpc/com.atproto.repo.putRecord`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.accessJwt}` },
    body: JSON.stringify({
      repo: session.did,
      collection,
      rkey,
      record: { $type: collection, ...record },
    }),
  });
  if (!r.ok) throw new Error(`putRecord ${collection}/${rkey}: ${await r.text()}`);
  return await r.json();
}

async function waitFor(check, label, timeoutMs = 8000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (check()) return true;
    await new Promise((r) => setTimeout(r, 250));
  }
  console.error(`  ✗ TIMEOUT waiting for ${label}`);
  return false;
}

function mentionFacet(did, text, tag) {
  const start = Buffer.byteLength(text.slice(0, text.indexOf(tag)));
  return {
    index: { byteStart: start, byteEnd: start + Buffer.byteLength(tag) },
    features: [{ $type: "app.bsky.richtext.facet#mention", did }],
  };
}

let passed = 0, failed = 0;
function record(label, ok) {
  console.log(`  ${ok ? "✓" : "✗"} ${label}`);
  if (ok) passed++; else failed++;
}

console.log("=== Mention push hooks: live test ===\n");

const alice = await ensureAccount("alice.test");
const bob = await ensureAccount("bob.test");
const carol = await ensureAccount("carol.test");
console.log(`alice = ${alice.did}\nbob   = ${bob.did}\ncarol = ${carol.did}\n`);

// --- 1. Single mention on create ---
{
  console.log("1. Create gallery mentioning bob");
  const rkey = "live-1-" + Date.now().toString(36);
  const uri = `at://${alice.did}/social.grain.gallery/${rkey}`;
  sql(`DELETE FROM _mention_pushes WHERE record_uri = '${uri}'`);
  const desc = "hi @bob.test";
  await putRecord(alice, "social.grain.gallery", rkey, {
    title: "step 1", description: desc,
    facets: [mentionFacet(bob.did, desc, "@bob.test")],
    createdAt: new Date().toISOString(),
  });
  await waitFor(
    () => sql(`SELECT COUNT(*) FROM _mention_pushes WHERE record_uri = '${uri}'`) === "1",
    "step 1 row",
  );
  const rows = sql(`SELECT recipient_did FROM _mention_pushes WHERE record_uri = '${uri}'`);
  record("bob has exactly one row", rows === bob.did);
  console.log();
}

// --- 2/3/4. Edit semantics ---
{
  console.log("2. Edit adds carol; bob's row preserved");
  const rkey = "live-edit-" + Date.now().toString(36);
  const uri = `at://${alice.did}/social.grain.gallery/${rkey}`;
  sql(`DELETE FROM _mention_pushes WHERE record_uri = '${uri}'`);
  // Initial: bob only
  let desc = "hey @bob.test";
  await putRecord(alice, "social.grain.gallery", rkey, {
    title: "edit", description: desc,
    facets: [mentionFacet(bob.did, desc, "@bob.test")],
    createdAt: new Date().toISOString(),
  });
  await waitFor(
    () => sql(`SELECT COUNT(*) FROM _mention_pushes WHERE record_uri = '${uri}'`) === "1",
    "initial bob row",
  );
  const bobTs1 = sql(`SELECT created_at FROM _mention_pushes WHERE record_uri = '${uri}' AND recipient_did = '${bob.did}'`);

  // Edit: bob + carol
  desc = "hey @bob.test and @carol.test";
  await putRecord(alice, "social.grain.gallery", rkey, {
    title: "edit", description: desc,
    facets: [mentionFacet(bob.did, desc, "@bob.test"), mentionFacet(carol.did, desc, "@carol.test")],
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  });
  await waitFor(
    () => sql(`SELECT COUNT(*) FROM _mention_pushes WHERE record_uri = '${uri}'`) === "2",
    "carol added",
  );
  const bobTs2 = sql(`SELECT created_at FROM _mention_pushes WHERE record_uri = '${uri}' AND recipient_did = '${bob.did}'`);
  record("bob's row timestamp preserved across edit", bobTs1 === bobTs2);
  record("carol added by edit", sql(`SELECT recipient_did FROM _mention_pushes WHERE record_uri = '${uri}' AND recipient_did = '${carol.did}'`) === carol.did);

  console.log("3. No-op edit (same facets) → no new rows");
  await putRecord(alice, "social.grain.gallery", rkey, {
    title: "edit", description: desc,
    facets: [mentionFacet(bob.did, desc, "@bob.test"), mentionFacet(carol.did, desc, "@carol.test")],
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  });
  await new Promise((r) => setTimeout(r, 2500));
  record("row count still 2", sql(`SELECT COUNT(*) FROM _mention_pushes WHERE record_uri = '${uri}'`) === "2");

  console.log("4. Remove all mentions, then re-add bob → no fresh push");
  await putRecord(alice, "social.grain.gallery", rkey, {
    title: "edit", description: "no mentions",
    facets: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  });
  await new Promise((r) => setTimeout(r, 1500));
  desc = "hey @bob.test";
  await putRecord(alice, "social.grain.gallery", rkey, {
    title: "edit", description: desc,
    facets: [mentionFacet(bob.did, desc, "@bob.test")],
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  });
  await new Promise((r) => setTimeout(r, 2500));
  const bobTs3 = sql(`SELECT created_at FROM _mention_pushes WHERE record_uri = '${uri}' AND recipient_did = '${bob.did}'`);
  record("bob's row timestamp unchanged after remove+re-add", bobTs1 === bobTs3);
  console.log();
}

// --- 5. 5-cap (over-cap → nobody) ---
{
  console.log("5. 6 unique mentions → push to nobody");
  const rkey = "live-cap6-" + Date.now().toString(36);
  const uri = `at://${alice.did}/social.grain.gallery/${rkey}`;
  sql(`DELETE FROM _mention_pushes WHERE record_uri = '${uri}'`);
  const dids = Array.from({ length: 6 }, (_, i) => `did:plc:fake${i}aaaaaaaaaaaaaaaaaaaa`);
  const tags = dids.map((_, i) => `@u${i}.test`);
  const desc = "spam: " + tags.join(" ");
  const facets = dids.map((did, i) => mentionFacet(did, desc, tags[i]));
  await putRecord(alice, "social.grain.gallery", rkey, {
    title: "cap6", description: desc, facets, createdAt: new Date().toISOString(),
  });
  await new Promise((r) => setTimeout(r, 3000));
  record("indexed", sql(`SELECT COUNT(*) FROM "social.grain.gallery" WHERE uri = '${uri}'`) === "1");
  record("0 mention rows", sql(`SELECT COUNT(*) FROM _mention_pushes WHERE record_uri = '${uri}'`) === "0");
  console.log();
}

// --- 6. 5 at-cap → fires to all 5 ---
{
  console.log("6. 5 unique mentions (at cap) → push to all 5");
  const rkey = "live-cap5-" + Date.now().toString(36);
  const uri = `at://${alice.did}/social.grain.gallery/${rkey}`;
  sql(`DELETE FROM _mention_pushes WHERE record_uri = '${uri}'`);
  const dids = Array.from({ length: 5 }, (_, i) => `did:plc:fake${i}aaaaaaaaaaaaaaaaaaaa`);
  const tags = dids.map((_, i) => `@u${i}.test`);
  const desc = "five: " + tags.join(" ");
  const facets = dids.map((did, i) => mentionFacet(did, desc, tags[i]));
  await putRecord(alice, "social.grain.gallery", rkey, {
    title: "cap5", description: desc, facets, createdAt: new Date().toISOString(),
  });
  await new Promise((r) => setTimeout(r, 3000));
  record("5 mention rows", sql(`SELECT COUNT(*) FROM _mention_pushes WHERE record_uri = '${uri}'`) === "5");
  console.log();
}

// --- 7. Comment-mention smoke (no DB side effect, just verify hook runs cleanly) ---
{
  console.log("7. Comment with mention indexes without error");
  const galleryRkey = "live-cm-host-" + Date.now().toString(36);
  const galleryUri = `at://${alice.did}/social.grain.gallery/${galleryRkey}`;
  await putRecord(alice, "social.grain.gallery", galleryRkey, {
    title: "host", description: "no mentions",
    createdAt: new Date().toISOString(),
  });
  await waitFor(
    () => sql(`SELECT COUNT(*) FROM "social.grain.gallery" WHERE uri = '${galleryUri}'`) === "1",
    "host gallery indexed",
  );
  const commentRkey = "live-cm-" + Date.now().toString(36);
  const commentUri = `at://${alice.did}/social.grain.comment/${commentRkey}`;
  const text = "thinking of @bob.test";
  await putRecord(alice, "social.grain.comment", commentRkey, {
    subject: galleryUri, text,
    facets: [mentionFacet(bob.did, text, "@bob.test")],
    createdAt: new Date().toISOString(),
  });
  await waitFor(
    () => sql(`SELECT COUNT(*) FROM "social.grain.comment" WHERE uri = '${commentUri}'`) === "1",
    "comment indexed",
  );
  record("comment indexed", sql(`SELECT COUNT(*) FROM "social.grain.comment" WHERE uri = '${commentUri}'`) === "1");
  console.log();
}

console.log(`=== ${passed}/${passed + failed} live checks passed ===`);
process.exit(failed === 0 ? 0 : 1);

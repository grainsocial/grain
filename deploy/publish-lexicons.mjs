// Publishes grain's lexicons as atproto resolves them: a TXT record
// `_lexicon.<authority>` naming the account, for each authority
// (`_lexicon.photo.grain.social` for `social.grain.photo.*`), and in that
// account a com.atproto.lexicon.schema record for each lexicon, keyed by
// its NSID. Only the lexicons whose authority is in LEX_ZONE are grain's:
// the rest of lexicons/ (app.bsky, dev.hatk, ...) are copies of other
// publishers' and are left to them.
//
// It adds and updates what is new or changed, and deletes what the
// repository no longer has: a schema of its namespaces, and a `_lexicon`
// record naming the account for an authority none of them uses now. The
// rest of the account and the zone it leaves alone.
//
// A PDS that validates records resolves these schemas, not the copies in
// this repository, so a schema left stale here rejects writes the appview
// accepts.
//
//   node deploy/publish-lexicons.mjs            # says what it would do
//   node deploy/publish-lexicons.mjs --write
//
// LEX_DID is the account; LEX_PASSWORD, an app password of its, writes the
// schemas, and CLOUDFLARE_API_TOKEN, with Zone:DNS:Edit on LEX_ZONE, the
// DNS. Without the token it reads the DNS as resolvers see it, writes the
// schemas anyway, and then fails, naming each record still to make: a
// schema whose authority does not resolve yet is harmless, and one that
// does is fixed without waiting for the DNS.
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

const COLLECTION = "com.atproto.lexicon.schema";
const ROOT = new URL("../lexicons", import.meta.url).pathname;
const write = process.argv.includes("--write");
const {
  LEX_DID: did,
  LEX_ZONE: zone = "grain.social",
  LEX_PASSWORD,
  CLOUDFLARE_API_TOKEN: cfToken,
} = process.env;
if (!did) throw new Error("LEX_DID names the account to publish into");

async function* files(dir) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) yield* files(p);
    else if (e.name.endsWith(".json")) yield p;
  }
}

// DNS. An NSID's authority is all but its name, reversed into a domain:
// each has a `_lexicon` record of its own, since resolution never walks up.
const authority = (nsid) => nsid.split(".").slice(0, -1).reverse().join(".");
const inZone = (d) => d === zone || d.endsWith(`.${zone}`);

const shipped = new Map();
for await (const p of files(ROOT)) {
  const doc = JSON.parse(await readFile(p, "utf8"));
  if (inZone(authority(doc.id))) shipped.set(doc.id, doc);
}
if (!shipped.size) throw new Error(`no lexicon under lexicons/ has an authority in ${zone}`);

async function json(url, init = {}) {
  const res = await fetch(url, init);
  if (!res.ok)
    throw new Error(
      `${init.method ?? "GET"} ${url.split("?")[0]}: ${res.status} ${await res.text()}`,
    );
  return res.json();
}

const domains = [...new Set([...shipped.keys()].map(authority))].sort();
const wanted = `did=${did}`;

// The zone's `_lexicon` TXT records, from Cloudflare with a token, else as
// a resolver sees them now, over DNS-over-HTTPS rather than through what
// this machine has cached.
const cf = (path, init = {}) =>
  json(`https://api.cloudflare.com/client/v4/${path}`, {
    ...init,
    headers: { authorization: `Bearer ${cfToken}`, "content-type": "application/json" },
  });
let zoneId;
const records = []; // { name, content, id? }
if (cfToken) {
  zoneId = (await cf(`zones?${new URLSearchParams({ name: zone })}`)).result[0]?.id;
  if (!zoneId) throw new Error(`the token sees no zone ${zone}`);
  for (let page = 1; ; page++) {
    const { result, result_info } = await cf(
      `zones/${zoneId}/dns_records?type=TXT&per_page=500&page=${page}`,
    );
    for (const r of result)
      if (r.name.startsWith("_lexicon."))
        records.push({ id: r.id, name: r.name, content: r.content.replace(/^"|"$/g, "") });
    if (page >= result_info.total_pages) break;
  }
} else {
  for (const domain of domains) {
    const name = `_lexicon.${domain}`;
    const { Answer = [] } = await json(
      `https://cloudflare-dns.com/dns-query?${new URLSearchParams({ name, type: "TXT" })}`,
      {
        headers: { accept: "application/dns-json" },
      },
    );
    // Each string of a record quoted, and a long one split into several.
    for (const a of Answer.filter((a) => a.type === 16))
      records.push({
        name,
        content: [...a.data.matchAll(/"((?:[^"\\]|\\.)*)"/g)].map((m) => m[1]).join(""),
      });
  }
}
const dnsAdd = [];
const dnsFix = [];
for (const domain of domains) {
  const name = `_lexicon.${domain}`;
  const mine = records.filter((r) => r.name === name && r.content.startsWith("did="));
  if (mine.some((r) => r.content === wanted)) continue;
  if (mine.length) dnsFix.push(...mine);
  else dnsAdd.push(name);
}
// Only records naming this account: another's `_lexicon` in the zone is
// some other publisher's.
const dnsGone = records.filter(
  (r) => r.content === wanted && !domains.includes(r.name.slice("_lexicon.".length)),
);
for (const name of dnsAdd) console.log(`  ${name}  TXT "${wanted}"  new`);
for (const r of dnsFix) console.log(`  ${r.name}  TXT "${wanted}"  updated, from "${r.content}"`);
for (const r of dnsGone) console.log(`  ${r.name}  TXT  removed`);

// Schemas. What the account holds now of the namespaces published from
// here: the first two segments of every NSID shipped (`dev.knotless`).
const { service = [] } = await json(
  did.startsWith("did:web:")
    ? `https://${did.slice(8)}/.well-known/did.json`
    : `https://plc.directory/${did}`,
);
const pds = service.find(
  (s) => s.id === "#atproto_pds" || s.id === `${did}#atproto_pds`,
)?.serviceEndpoint;
if (!pds) throw new Error(`${did} names no PDS`);
const xrpc = (method, { query, body, token } = {}) =>
  json(`${pds}/xrpc/${method}${query ? `?${new URLSearchParams(query)}` : ""}`, {
    method: body ? "POST" : "GET",
    headers: {
      ...(token && { authorization: `Bearer ${token}` }),
      ...(body && { "content-type": "application/json" }),
    },
    body: body && JSON.stringify(body),
  });

const roots = new Set([...shipped.keys()].map((id) => id.split(".").slice(0, 2).join(".")));
const ours = (nsid) => [...roots].some((r) => nsid.startsWith(`${r}.`));
const held = new Map();
let cursor;
do {
  const page = await xrpc("com.atproto.repo.listRecords", {
    query: { repo: did, collection: COLLECTION, limit: "100", ...(cursor && { cursor }) },
  });
  for (const r of page.records) {
    const rkey = r.uri.split("/").pop();
    if (ours(rkey)) held.set(rkey, r.value);
  }
  cursor = page.records.length ? page.cursor : undefined;
} while (cursor);

// JSON with its keys sorted, to compare a record with its file whatever
// order the PDS hands its keys back in.
const canon = (v) =>
  Array.isArray(v)
    ? v.map(canon)
    : v && typeof v === "object"
      ? Object.fromEntries(
          Object.keys(v)
            .filter((k) => k !== "$type" || v.$type !== COLLECTION)
            .sort()
            .map((k) => [k, canon(v[k])]),
        )
      : v;
const same = (a, b) => JSON.stringify(canon(a)) === JSON.stringify(canon(b));
const put = [...shipped.keys()]
  .filter((id) => !held.has(id) || !same(held.get(id), shipped.get(id)))
  .sort();
const gone = [...held.keys()].filter((id) => !shipped.has(id)).sort();
for (const id of put) console.log(`  ${id}  ${held.has(id) ? "updated" : "new"}`);
for (const id of gone) console.log(`  ${id}  removed`);

const dnsChanges = dnsAdd.length + dnsFix.length + dnsGone.length;
console.log(
  `DNS: ${dnsChanges} to change. Schemas in ${did} at ${pds}: ` +
    `${put.length} to put, ${gone.length} to delete, ${shipped.size - put.length} unchanged.`,
);
if (!write || (!dnsChanges && !put.length && !gone.length)) process.exit(0);
if ((put.length || gone.length) && !LEX_PASSWORD)
  throw new Error("LEX_PASSWORD is needed to write the schemas");

// The DNS that names the account first, then the schemas, then what no
// longer resolves: a resolver never meets a record pointing at nothing new.
// Without a token the DNS is left for last, to be made by hand.
const txt = (name) => ({
  type: "TXT",
  name,
  content: `"${wanted}"`,
  ttl: 1,
  comment: "lexicon authority",
});
if (cfToken)
  for (const name of dnsAdd)
    await cf(`zones/${zoneId}/dns_records`, { method: "POST", body: JSON.stringify(txt(name)) });
if (cfToken)
  for (const r of dnsFix)
    await cf(`zones/${zoneId}/dns_records/${r.id}`, {
      method: "PUT",
      body: JSON.stringify(txt(r.name)),
    });

if (put.length || gone.length) {
  const session = await xrpc("com.atproto.server.createSession", {
    body: { identifier: did, password: LEX_PASSWORD },
  });
  if (session.did !== did) throw new Error(`signed in as ${session.did}, not ${did}`);
  const token = session.accessJwt;
  for (const id of put)
    await xrpc("com.atproto.repo.putRecord", {
      token,
      body: {
        repo: did,
        collection: COLLECTION,
        rkey: id,
        record: { $type: COLLECTION, ...shipped.get(id) },
      },
    });
  for (const id of gone)
    await xrpc("com.atproto.repo.deleteRecord", {
      token,
      body: { repo: did, collection: COLLECTION, rkey: id },
    });
}

if (dnsChanges && !cfToken) {
  console.log(
    `schemas published; the DNS needs CLOUDFLARE_API_TOKEN, or these records made by hand in ${zone}:`,
  );
  for (const name of dnsAdd) console.log(`  ${name}  TXT "${wanted}"`);
  for (const r of dnsFix) console.log(`  ${r.name}  TXT "${wanted}"  (now "${r.content}")`);
  for (const r of dnsGone) console.log(`  ${r.name}  TXT  delete`);
  process.exit(1);
}
for (const r of dnsGone) await cf(`zones/${zoneId}/dns_records/${r.id}`, { method: "DELETE" });
console.log("published");

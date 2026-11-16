// What grain-serve answers over XRPC, against the lexicons that say what
// it answers: each answer its tests received, as harness/cov.mjs gathers
// them in a directory (lines of `{path, status, body}`, which the tests
// write under GRAIN_ANSWERS). A query's output must be valid for its
// lexicon, a failure must be XRPC's `{error, message}`, every parameter
// asked must be one it declares, and a method that answers must have a
// lexicon. As knotless's harness/answers.mjs.
//
//   node harness/answers.mjs <dir> [lexicons dir]
//
// The lexicons are those under lexicons/ unless another directory is
// given, as harness/answers-test.sh gives its own to check this script.

import { readdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const { Lexicons, jsonToLex } = createRequire(import.meta.url)("@atproto/lexicon");

const [dir, lexiconDir = join(root, "lexicons")] = process.argv.slice(2);
if (!dir) {
  console.error("usage: node harness/answers.mjs <dir> [lexicons dir]");
  process.exit(2);
}

const files = (d) =>
  readdirSync(d, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? files(join(d, e.name)) : e.name.endsWith(".json") ? [join(d, e.name)] : [],
  );
const lexicons = new Lexicons();
// A document @atproto/lexicon cannot take, such as a kind it does not
// know yet, is said and left out: what it would hold reads as no lexicon.
for (const f of files(lexiconDir)) {
  try {
    lexicons.add(JSON.parse(readFileSync(f, "utf8")));
  } catch (e) {
    console.log(`left out ${relative(root, f)}: ${e.message.split("\n")[0]}`);
  }
}

/// What atproto services answer at `_health`, which no lexicon names: the
/// running version.
const health = (body) => (typeof body.version === "string" ? [] : ["_health answers {version}"]);

let lines = [];
try {
  lines = readdirSync(dir).flatMap((f) =>
    readFileSync(join(dir, f), "utf8").split("\n").filter(Boolean),
  );
} catch (e) {
  if (e.code !== "ENOENT") throw e;
}
const problems = [];
// A path asked again and again is said once.
const said = new Set();
let checked = 0;
for (const line of lines) {
  const { path, status, body } = JSON.parse(line);
  const url = new URL(path, "http://grain");
  const nsid = url.pathname.match(/^\/xrpc\/(.+)$/)?.[1];
  if (!nsid) continue;
  const say = (what) => {
    const p = `${url.pathname} ${status}: ${what}`;
    if (!said.has(p)) problems.push(`${path} (${status}): ${what}`);
    said.add(p);
  };
  checked++;
  if (status !== 200) {
    if (typeof body?.error !== "string" || typeof body?.message !== "string")
      say("a failure is {error, message}");
    continue;
  }
  if (nsid === "_health") {
    health(body).forEach(say);
    continue;
  }
  const def = lexicons.getDef(nsid);
  if (!def || !["query", "procedure"].includes(def.type)) {
    say("no lexicon names this method");
    continue;
  }
  const declared = Object.keys(def.parameters?.properties ?? {});
  for (const name of url.searchParams.keys())
    if (!declared.includes(name)) say(`${name} is no parameter of ${nsid}`);
  // An answer that is not JSON, such as a blob, is the lexicon's encoding
  // to say, not this script's.
  if (body === undefined) continue;
  // Read as atproto reads JSON: a {$link} is a CID, a blob's JSON a blob.
  try {
    lexicons.assertValidXrpcOutput(nsid, jsonToLex(body));
  } catch (e) {
    say(e.message);
  }
}

for (const p of problems) console.log(p);
if (problems.length) process.exit(1);
console.log(`answers: ${checked} XRPC answers the tests received are as their lexicons say`);

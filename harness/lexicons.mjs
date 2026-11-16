// The lexicons, as the Lexicon Style Guide and AGENTS.md ("Lexicons") ask:
// goat's lint, less the warnings kept on purpose; what that lint does not
// see; and that each one only grows from what `base` has, since a schema
// already published is evolved, never changed, with records and clients
// written to it out there.
//
//   node harness/lexicons.mjs [base]    base: a git revision; where this
//                                       branch left origin/main if that
//                                       exists, else none
//
// Prints each problem as `nsid#def.path: what`, failing if there is any.
//
// It reads grain's own, under lexicons/social/grain, less those grain-serve
// does not serve (UNSERVED), which are kept as published rather than
// brought up to the guide: unspecced/, and the admin methods grain-serve
// does not answer. The other namespaces under lexicons/ are copies of
// others' schemas, theirs to keep.

import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dir = join(root, "lexicons", "social", "grain");

// What grain-serve does not serve, by path under lexicons/social/grain,
// a directory ending in `/`. Each comes out of here as grain-serve
// answers it.
const UNSERVED = [
  "unspecced/",
  "admin/actOnReview.json",
  "admin/addRepos.json",
  "admin/getInfo.json",
  "admin/getReviewQueue.json",
  "admin/getReviewStats.json",
  "admin/listRepos.json",
  "admin/removeRepos.json",
  "admin/resyncRepos.json",
  "admin/searchRecords.json",
  "admin/startScan.json",
];
const unserved = (file) => {
  const at = relative(dir, file).split("\\").join("/");
  return UNSERVED.some((o) => (o.endsWith("/") ? at.startsWith(o) : at === o));
};

/// Every lexicon file under `d` this checks, by its absolute path.
const files = (d) =>
  readdirSync(d, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory()
      ? files(join(d, e.name))
      : e.name.endsWith(".json") && !unserved(join(d, e.name))
        ? [join(d, e.name)]
        : [],
  );

const git = (...args) =>
  execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });

// What is published is main's (publish-lexicons.yml). A branch is judged
// from where it left main, on what it changed: a feature branch behind
// main has not taken back what main added since. A pull into main is
// checked merged with it, so that is main itself.
const base =
  process.argv[2] ??
  (() => {
    try {
      return git("merge-base", "HEAD", "origin/main").trim();
    } catch {
      return null;
    }
  })();

// Closed unions kept on purpose: applyWrites' are com.atproto.repo's, a
// write of a kind the server does not know being one it cannot apply.
const closed = new Set([
  "social.grain.repo.applyWrites#main.input.writes[]",
  "social.grain.repo.applyWrites#main.output.results[]",
]);

// What this branch has that the guide would have otherwise, not yet
// published (none of it is on main), each to be fixed before it is, or
// to come out of here with a reason to keep it. Once fixed, an entry
// matches nothing and goes.
// - Spaces' and pools' inputs, which the pulls bringing them to
//   grain-serve bound.
// - Arrays of bare values that grain-serve and the web already read and
//   write: each made an array of objects in a pull of its own, with the
//   code on both sides.
const PENDING = new Set([
  "social.grain.group.deleteComment#main.input.rkey",
  "social.grain.group.deleteGallery#main.input.rkey",
  "social.grain.group.defs#photoInput.alt",
  "social.grain.server.getSpaceSupport#main.output.missing",
  "social.grain.admin.defs#reviewItem.classifiers",
  "social.grain.gallery.defs#cameraItem.thumbs",
  "social.grain.gallery.defs#locationItem.h3Cells",
  "social.grain.gallery.defs#locationItem.thumbs",
  "social.grain.story.markViewed#main.input.stories",
  "social.grain.sync.indexRecords#main.input.uris",
  "social.grain.sync.indexRecords#main.output.indexed",
  "social.grain.sync.indexRecords#main.output.notFound",
]);

const problems = [];
const say = (at, what) => PENDING.has(at) || problems.push(`${at}: ${what}`);

const checked = files(dir);
const docs = new Map(checked.map((f) => [f, JSON.parse(readFileSync(f, "utf8"))]));

// goat (github.com/bluesky-social/goat), one finding a line, less what is
// kept on purpose:
// - `id` and `type` as field names, which goat warns are reserved
//   somewhere: they are what Bluesky's own views name them (a report's
//   `id`, a label definition's), and published.
// - permissioned spaces, which goat v0.2.6 does not know: a schema of
//   `type: space` it cannot parse, and the `space` resource of a
//   permission set. Those are linted by hand until goat does.
const kept = new Set([
  "field-name-syntax",
  "lexicon-schema unsupported permission resource: space",
]);
const spaces = checked.filter((f) => docs.get(f).defs?.main?.type === "space");
let linted;
try {
  const args = [
    "lex",
    "lint",
    "--json",
    ...checked.filter((f) => !spaces.includes(f)).map((f) => relative(root, f)),
  ];
  linted = execFileSync("goat", args, {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });
} catch (e) {
  if (e.code === "ENOENT") {
    console.log(
      "goat is not installed: brew install goat, or a release from github.com/bluesky-social/goat",
    );
    process.exit(1);
  }
  linted = e.stdout;
}
for (const line of linted.split("\n").filter(Boolean)) {
  const found = JSON.parse(line);
  const name = found["lint-name"];
  if (kept.has(name) || kept.has(`${name} ${found.message}`)) continue;
  say(found.nsid, `${name}: ${found.message}`);
}

/// Walks every schema in `def`, calling `visit(schema, path)`.
const walk = (schema, path, visit) => {
  if (!schema || typeof schema !== "object") return;
  visit(schema, path);
  if (schema.record) walk(schema.record, `${path}.record`, visit);
  for (const [k, v] of Object.entries(schema.properties ?? {})) walk(v, `${path}.${k}`, visit);
  if (schema.items) walk(schema.items, `${path}[]`, visit);
  for (const part of ["parameters", "input", "output", "message"]) {
    const p = schema[part];
    if (p) walk(p.schema ?? p, `${path}.${part}`, visit);
  }
};

/// The lexicon files `base` has that this checks, by path from the root.
const published = () =>
  git("ls-tree", "-r", "--name-only", base, "--", relative(root, dir))
    .split("\n")
    .filter((f) => f.endsWith(".json") && !unserved(join(root, f)));

// Every schema's path in `base`. What would narrow one of these is left as
// it is: it is published, and only grows (below).
const paths = new Set();
if (base) {
  for (const file of published()) {
    const before = JSON.parse(git("show", `${base}:${file}`));
    for (const [name, def] of Object.entries(before.defs ?? {}))
      walk(def, `${before.id}#${name}`, (_, path) => paths.add(path));
  }
}

// What people write: records, what is sent in, and every shape either
// names, followed through its refs. What the server answers it bounds
// itself, wherever the shape is defined: a defs file of grain's holds
// answers' items as often as records' parts.
const defOf = new Map();
for (const doc of docs.values())
  for (const [name, def] of Object.entries(doc.defs ?? {})) defOf.set(`${doc.id}#${name}`, def);
const written = new Set();
const follow = (schema, id) =>
  walk(schema, id, (s) => {
    for (const r of [s.ref, ...(s.refs ?? [])].filter(Boolean)) {
      const at = r.startsWith("#") ? `${id.split("#")[0]}${r}` : r.includes("#") ? r : `${r}#main`;
      if (written.has(at) || !defOf.has(at)) continue;
      written.add(at);
      follow(defOf.get(at), at);
    }
  });
for (const doc of docs.values()) {
  const main = doc.defs?.main;
  if (main?.type === "record") {
    written.add(`${doc.id}#main`);
    follow(main, `${doc.id}#main`);
  }
  if (main?.input?.schema) follow(main.input.schema, `${doc.id}#main`);
}

// The style AGENTS.md asks for, of every schema now; of what bounds or
// retypes a field, of those new since `base`.
const now = new Map();
for (const [file, doc] of docs) {
  now.set(relative(root, file), doc);
  for (const [name, def] of Object.entries(doc.defs ?? {})) {
    const at = `${doc.id}#${name}`;
    if (name === "main" && !def.description) say(at, "a main def needs a description");
    walk(def, at, (s, path) => {
      const kept = written.has(at) || path.includes(".input");
      const fresh = !paths.has(path);
      if (s.enum) say(path, "knownValues, not enum: an enum can never grow");
      if (
        kept &&
        fresh &&
        s.type === "string" &&
        !s.format &&
        !s.enum &&
        !s.knownValues &&
        s.maxLength === undefined &&
        s.const === undefined
      )
        say(path, "a string without a format needs a maxLength");
      if (s.type === "union" && s.closed && !closed.has(path)) say(path, "unions stay open");
      // A handle shown beside the account's DID, as Bluesky's views show
      // one, names no one by it.
      const props = Object.entries(s.properties ?? {});
      const did = props.some(([, p]) => p.format === "did");
      for (const [k, p] of props)
        if (fresh && !did && p.type === "string" && p.format === "handle")
          say(`${path}.${k}`, "accounts by DID, not handle");
    });
  }
}

// What each schema in `base` was, against what it is now.
const shape = (s) =>
  JSON.stringify({ type: s.type, format: s.format, ref: s.ref, refs: s.refs?.slice().sort() });
const loosened = (before, after, path) => {
  if (!before || !after) return;
  if (shape(before) !== shape(after) && !(before.type === "union" && after.type === "union")) {
    say(path, `was ${shape(before)}, now ${shape(after)}: a field is never retyped`);
    return;
  }
  if (before.type === "union") {
    for (const r of before.refs ?? [])
      if (!(after.refs ?? []).includes(r)) say(path, `the union lost ${r}`);
  }
  for (const k of ["maxLength", "maxGraphemes", "maxSize", "maximum"]) {
    if (after[k] !== undefined && (before[k] === undefined || after[k] < before[k]))
      say(
        path,
        `${k} went from ${before[k] ?? "none"} to ${after[k]}: what was valid must stay so`,
      );
  }
  for (const k of ["minLength", "minGraphemes", "minimum"]) {
    if (after[k] !== undefined && (before[k] === undefined || after[k] > before[k]))
      say(
        path,
        `${k} went from ${before[k] ?? "none"} to ${after[k]}: what was valid must stay so`,
      );
  }
  if (before.enum)
    for (const v of before.enum)
      if (!(after.enum ?? [v]).includes(v)) say(path, `the enum lost ${v}`);
  if (before.const !== undefined && after.const !== before.const)
    say(path, "a const never changes");
  const was = new Set(before.required ?? []);
  for (const r of after.required ?? [])
    if (!was.has(r)) say(path, `${r} is required now: only new optional fields`);
  for (const [k, v] of Object.entries(before.properties ?? {})) {
    if (!after.properties?.[k]) say(`${path}.${k}`, "a field is never removed or renamed");
    else loosened(v, after.properties[k], `${path}.${k}`);
  }
  loosened(before.items, after.items, `${path}[]`);
  loosened(before.record, after.record, `${path}.record`);
  for (const part of ["parameters", "input", "output", "message"]) {
    const b = before[part]?.schema ?? before[part];
    const a = after[part]?.schema ?? after[part];
    if (b && !a) say(`${path}.${part}`, "removed");
    else if (b?.type) loosened(b, a, `${path}.${part}`);
  }
};

// Schemas taken out on purpose, each named here as it goes, which a
// change may remove: what is said of each is why.
const RETIRED = new Set([]);

if (base) {
  for (const file of published()) {
    const before = JSON.parse(git("show", `${base}:${file}`));
    const after = now.get(file);
    if (!after && RETIRED.has(before.id)) continue;
    if (!after) {
      say(before.id, `removed since ${base}`);
      continue;
    }
    for (const [name, def] of Object.entries(before.defs ?? {})) {
      const at = `${before.id}#${name}`;
      if (!after.defs?.[name]) say(at, `removed since ${base}`);
      else loosened(def, after.defs[name], at);
    }
  }
}

// Arrays hold objects, which can grow fields, rather than bare values,
// which cannot: of arrays new since `base`, as those before it are kept.
// A query's parameters are the exception: XRPC lets them hold only values.
if (base) {
  for (const doc of now.values()) {
    for (const [name, def] of Object.entries(doc.defs ?? {})) {
      walk(def, `${doc.id}#${name}`, (s, path) => {
        const param = path.includes(".parameters.");
        const bare =
          s.type === "array" && !param && !["object", "ref", "union"].includes(s.items?.type);
        if (bare && !paths.has(path))
          say(path, "an array holds objects, which can grow, not bare values");
      });
    }
  }
}

for (const p of problems) console.log(p);
if (problems.length) process.exit(1);
console.log(`lexicons: as the guide asks${base ? `, and only grown since ${base}` : ""}`);

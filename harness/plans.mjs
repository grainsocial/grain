// The scans of tables that grow with the network, and sorts of many of
// their rows, the index's queries made in grain-serve's tests, as
// harness/cov.mjs gathers them in a directory
// (crates/grain-serve/src/index/plans.rs writes a line of `{scans, sorts,
// plan, sql}` for each statement, as SQLite would plan it at prod's
// size). Fails on any: each wants an index, a query that uses one, or,
// for one meant to be, `-- scans: <table>` or `-- sorts: <table>` in its
// SQL, with why.
//
//   node harness/plans.mjs <dir>

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const [dir] = process.argv.slice(2);
if (!dir) {
  console.error("usage: node harness/plans.mjs <dir>");
  process.exit(2);
}
const found = new Map();
for (const f of existsSync(dir) ? readdirSync(dir) : []) {
  for (const line of readFileSync(join(dir, f), "utf8").split("\n").filter(Boolean)) {
    const p = JSON.parse(line);
    found.set(p.sql, p);
  }
}
if (!found.size) {
  console.log("no query scans or sorts a growing table");
  process.exit(0);
}
// A statement's first lines are enough to find it by.
const head = (sql) => {
  const lines = sql
    .trim()
    .split("\n")
    .map((l) => l.trim());
  return lines.slice(0, 12).join("\n    ") + (lines.length > 12 ? "\n    …" : "");
};
for (const p of found.values()) {
  const what = [
    p.scans.length && `scans ${p.scans.join(", ")}`,
    p.sorts?.length && `sorts ${p.sorts.join(", ")}`,
  ].filter(Boolean);
  console.log(
    `\n${what.join(", ")}:\n    ${head(p.sql)}\n  planned as:\n    ${p.plan.join("\n    ")}`,
  );
}
console.log(`
${found.size} ${found.size === 1 ? "query scans or sorts" : "queries scan or sort"} a table that grows with the network, as SQLite would plan ${found.size === 1 ? "it" : "them"} at prod's size.
Give each an index to use, or a query that uses one (an expression index wants the
expression as written, and a column compared to it without its affinity: \`= +p.uri\`).
A sort of many rows wants them found in the order asked, by an index that
leads with what is searched by equality, or driven from the table sorted
(\`CROSS JOIN\` sets the order). One meant to be says so in its SQL, with
why: \`-- scans: <table>, <why>\` or \`-- sorts: <table>, <why>\`.`);
process.exit(1);

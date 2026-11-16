// The tests under the coverage gate, against the reference PDS: what
// `just cov` and the test check run, as knotless's harness/cov.mjs.
//
//   node harness/cov.mjs [ignore regex]
//
// What it ignores is the justfile's `ignore` unless given: tests, the
// harness, examples and the standard library. The gate is
// harness/cov.json's `lines` and `functions`, in percent: where the
// workspace stands, raised as it rises, until it is 100 as knotless's is.
//
// The tests are built once, instrumented, and each test binary is run
// against a harness, several at a time, rather than one after another as
// `cargo test` would: harnesses shared by every binary, as `just pds` is.
// The longest runs, as the last run timed them, start first. A binary that
// fails is run once more: passing then, it is reported FLAKY, with its
// first failure, and passes. Failing again only in tests
// harness/quarantine.json names, until the day it names, it is reported
// QUARANTINED, test by test, and passes too: a test known to fail now and
// then while it is fixed fails no change. Each is then run alone until it
// passes, three times at most, so that the lines only it reaches still
// count.
//
// The report reads this build's binaries alone, and the profiles of their
// runs: never another build's, which a shared target may still hold. It
// gathers the XRPC answers the runs received, under GRAIN_ANSWERS, into
// target/llvm-cov-target/cov-report/answers for harness/answers.mjs, and
// the scans of growing tables the index's queries made, under
// GRAIN_PLANS, into cov-report/plans for harness/plans.mjs.
//
// COV_STORE names a directory to keep passing runs in, as CI's harness
// workflow does: a run is skipped when one of the same test binary, byte
// for byte, passed against the same harness, with every workspace binary
// it ran the same too, and its profile is reused (see `stored` below).
// Should the gate then fall short, the stored runs are made again, fresh,
// and the gate read again: a line only some runs reach is not lost to a
// store that kept one that missed it. COV_STORE_KEEP is how many runs it
// keeps, newest used first.
//
// A run that goes on past its limit, three times its last time and never
// under ten minutes, or COV_TIMEOUT seconds, is killed and fails without
// a second run: a test that hangs fails the check in minutes, and the log
// names it ("has been running for over 60 seconds").
//
// The test binaries named `spaces` run against the reference PDS on the
// permissioned spaces alpha, which GRAIN_DEV_ENV names a built dev-env of
// (harness/pds.mjs); every other against the npm one, the stock PDS, the
// two side by side. Without GRAIN_DEV_ENV they run against the npm one
// too, and pass trivially. Each binary goes against one net: the stock
// PDS is what grain's accounts are on, and the alpha answers as it does
// but for spaces, which only the `spaces` binaries reach, so a binary
// against both would reach nothing more and cost a run.
//
// COV_JOBS sets how many run at once; COV_HARNESSES how many stock PDSes
// they share, a run going to the one with the fewest at the time;
// COV_CLEAN=1 builds every workspace crate again first; COV_ONLY=a,b runs
// only the test binaries named (failing the gate); COV_TOOLCHAIN names the
// toolchain, stable unless it says otherwise, as CI's image's is named
// for its version.

import { execFileSync, spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  closeSync,
  copyFileSync,
  cpSync,
  createReadStream,
  existsSync,
  linkSync,
  mkdirSync,
  openSync,
  readdirSync,
  readFileSync,
  readSync,
  renameSync,
  rmSync,
  statSync,
  utimesSync,
  writeFileSync,
} from "node:fs";
import { availableParallelism } from "node:os";
import { basename, dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const [ignore = "(tests/|harness/|examples/|rustlib/)"] = process.argv.slice(2);
const gateAt = JSON.parse(readFileSync(join(root, "harness/cov.json"), "utf8"));
const toolchain = process.env.COV_TOOLCHAIN || "stable";
const cargo = ["run", toolchain, "cargo"];
const jobs = Number(process.env.COV_JOBS) || Math.max(2, Math.floor(availableParallelism() / 2));
const only = process.env.COV_ONLY?.split(",");
const store = process.env.COV_STORE && resolve(process.env.COV_STORE);
const keep = Number(process.env.COV_STORE_KEEP) || 300;
const devEnv = process.env.GRAIN_DEV_ENV || "";
const started = Date.now();
const took = () => `${((Date.now() - started) / 1000).toFixed(0)}s`;

/// Runs `rustup run <toolchain> cargo <args>`, its output shown, failing with it.
const run = (args, env = process.env) => {
  const r = spawnSync("rustup", [...cargo, ...args], { cwd: root, env, stdio: "inherit" });
  if (r.status !== 0) process.exit(r.status ?? 1);
  return r;
};

// What cargo-llvm-cov sets to build and run instrumented, in its own
// target directory, as `cargo llvm-cov` uses.
const target = join(root, "target/llvm-cov-target");
const shown = spawnSync("rustup", [...cargo, "llvm-cov", "show-env", "--sh"], {
  cwd: root,
  env: { ...process.env, CARGO_TARGET_DIR: target },
  encoding: "utf8",
});
if (shown.status !== 0) {
  console.error(
    `cargo llvm-cov show-env failed (is cargo-llvm-cov installed? \`just setup\`):\n${shown.stderr}`,
  );
  process.exit(1);
}
const env = { ...process.env, CARGO_TARGET_DIR: target };
for (const [, k, v] of shown.stdout.matchAll(/^export ([A-Z_0-9]+)=(.*)$/gm))
  env[k] = v.replace(/^'(.*)'$/, "$1");

// The tools beside the toolchain's rustc: llvm-size and llvm-profdata.
const rustc = (...args) =>
  execFileSync("rustup", ["run", toolchain, "rustc", ...args], { encoding: "utf8" });
const host = rustc("-vV").match(/^host: (.*)$/m)[1];
const tools = join(rustc("--print", "sysroot").trim(), "lib/rustlib", host, "bin");

if (process.env.COV_CLEAN) run(["llvm-cov", "clean", "--workspace"]);
// Each run's profiles go to a directory of its own.
const runsDir = join(target, "cov-runs");
rmSync(runsDir, { recursive: true, force: true });

// The harnesses start while the tests build, and are stopped unused if
// every run is in the store.
mkdirSync(join(root, "target"), { recursive: true });
const harness = (name, devEnv = "") => {
  const file = join(root, `target/cov-net-${name}.json`);
  // What the PDS logs, which tests provoke on purpose, is kept out of the way.
  const logged = join(root, `target/cov-net-${name}.log`);
  let child;
  const start = () =>
    new Promise((ok, fail) => {
      const log = openSync(logged, "w");
      child = spawn("node", [join(root, "harness/pds.mjs")], {
        cwd: root,
        env: { ...process.env, GRAIN_DEV_ENV: devEnv },
        stdio: ["pipe", "pipe", log],
      });
      let out = "";
      child.stdout.on("data", (d) => {
        out += d;
        if (!out.includes("\n")) return;
        writeFileSync(file, out);
        ok(file);
      });
      // Its log's end goes with it, as where it ran, in CI, is gone after.
      child.on("exit", (code) => {
        const end = readFileSync(logged, "utf8").split("\n").slice(-40).join("\n");
        fail(
          new Error(
            `the ${name} harness exited with ${code}: target/cov-net-${name}.log ends\n${end}`,
          ),
        );
      });
    });
  // The dev-env picks free ports and then binds them, so harnesses
  // starting side by side can collide: it starts again on fresh ones.
  const up = start()
    .catch(() => start())
    .catch(() => start());
  up.catch(() => {});
  return { up, busy: 0, stop: () => child.stdin.end() };
};
// The stock PDS, COV_HARNESSES of it, and the alpha, where there is one.
const nets = {
  stock: Array.from({ length: Number(process.env.COV_HARNESSES) || 1 }, (_, i) =>
    harness(String(i)),
  ),
};
if (devEnv) nets.spaces = [harness("spaces", devEnv)];
/// The net a test binary runs against (see the top).
const netFor = (t) => (devEnv && t.name.split(" ")[0] === "spaces" ? "spaces" : "stock");
const stop = () =>
  Object.values(nets)
    .flat()
    .forEach((n) => n.stop());
process.on("exit", stop);

// Every test binary, and the package it is in: cargo runs each there.
const built = spawnSync(
  "rustup",
  [...cargo, "test", "--workspace", "--locked", "--no-run", "--message-format=json"],
  {
    cwd: root,
    env,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
    maxBuffer: 1 << 28,
  },
);
if (built.status !== 0) process.exit(built.status ?? 1);
const ours = new Set(
  JSON.parse(
    execFileSync("rustup", [...cargo, "metadata", "--no-deps", "--format-version", "1"], {
      cwd: root,
      encoding: "utf8",
      maxBuffer: 1 << 26,
    }),
  ).packages.map((p) => p.id),
);
// This build's executables of our own: each test binary, and each binary
// a test may run.
const made = built.stdout
  .split("\n")
  .filter((l) => l.startsWith("{"))
  .map((l) => JSON.parse(l))
  .filter((m) => m.reason === "compiler-artifact" && m.executable && ours.has(m.package_id))
  .map((m) => ({
    exe: m.executable,
    dir: dirname(m.manifest_path),
    pkg: m.package_id,
    test: !!m.profile.test,
    name: m.profile.test ? `${m.target.name} (${m.target.kind[0]})` : m.target.name,
  }));
const tests = made.filter((m) => m.test && (!only || only.includes(m.name.split(" ")[0])));
const bins = made.filter((m) => !m.test);
console.log(`built ${tests.length} test binaries in ${took()}`);

const sha = (file) =>
  new Promise((ok, fail) => {
    const h = createHash("sha256");
    createReadStream(file)
      .on("data", (d) => h.update(d))
      .on("end", () => ok(h.digest("hex")))
      .on("error", fail);
  });
await Promise.all(made.map(async (m) => (m.sha = await sha(m.exe))));

// Which executables a profile may be of: those whose sections are the
// sizes its header gives for counters and names.
const shape = new Map();
const sized = execFileSync(join(tools, "llvm-size"), ["-A", ...made.map((m) => m.exe)], {
  encoding: "utf8",
  maxBuffer: 1 << 24,
});
for (const block of sized.split(/\n(?=\S.* :\s*$)/m)) {
  const file = block.match(/^(\S.*?)\s*:\s*$/m)?.[1];
  const size = (s) => Number(block.match(new RegExp(`^_*${s}\\s+(\\d+)`, "m"))?.[1]);
  const k = `${size("llvm_prf_cnts") / 8}:${size("llvm_prf_names")}`;
  shape.set(k, [...(shape.get(k) ?? []), ...made.filter((m) => m.exe === file)]);
}
// The raw profile's header, as of version 10: counters, then names.
const header = (file) => {
  const b = Buffer.alloc(80);
  const fd = openSync(file, "r");
  readSync(fd, b, 0, 80, 0);
  closeSync(fd);
  return (b.readBigUInt64LE(8) & 0xffffffffn) === 10n ? b : undefined;
};
const counters = (file) => header(file)?.readBigUInt64LE(40);
const profiled = (file) => {
  const b = header(file);
  return b && shape.get(`${b.readBigUInt64LE(40)}:${b.readBigUInt64LE(72)}`);
};

// What else a run's outcome rests on: the harness and what it runs on,
// the PDS each net is, and this script, which sets the runs' environment.
const hashOf = (...parts) => createHash("sha256").update(parts.join("\0")).digest("hex");
const version = (cmd) => execFileSync(cmd, ["--version"], { encoding: "utf8" }).trim();
const harnessed = hashOf(
  ...[
    "harness/cov.mjs",
    "harness/pds.mjs",
    "harness/tls-proxy.mjs",
    "harness/authorize.mjs",
    "harness/package-lock.json",
  ].map((f) => readFileSync(join(root, f), "utf8")),
  version("node"),
  version("git"),
);
const netOf = {
  stock: "",
  spaces: `${process.env.ATPROTO_COMMIT ?? resolve(devEnv || ".")} ${process.env.ALPHA_BUILD ?? ""}`,
};
// A run's key, and the binaries besides its own it rests on: those of its
// own package always, as one may be stopped before it writes a profile,
// and those it was seen to run.
const keyOf = (t, net) => hashOf(t.sha, harnessed, net, netOf[net]);
const depOf = (m) => `${m.test ? "test" : "bin"} ${m.name}`;
const own = (t) =>
  Object.fromEntries(bins.filter((b) => b.pkg === t.pkg).map((b) => [depOf(b), b.sha]));
const now = Object.fromEntries(made.map((m) => [depOf(m), m.sha]));

// The report's own directory: this build's executables, linked, and the
// profiles of this build's runs, fresh or from the store.
const report = join(target, "cov-report");
rmSync(report, { recursive: true, force: true });
mkdirSync(join(report, "debug/deps"), { recursive: true });
for (const m of new Map(made.map((m) => [m.sha, m])).values()) {
  // Named as cargo names them, as the report finds them by name.
  const to = join(
    report,
    "debug/deps",
    `${basename(m.exe).replace(/-[0-9a-f]+$/, "")}-${m.sha.slice(0, 16)}`,
  );
  try {
    linkSync(m.exe, to);
  } catch {
    copyFileSync(m.exe, to);
  }
}
let profiles = 0;
const profile = (file) => copyFileSync(file, join(report, `run-${profiles++}.profraw`));
/// Copies each file of `dir`, if there is one, into `into`, numbered.
const gather = (into) => {
  mkdirSync(into);
  let n = 0;
  return (dir) => {
    if (!existsSync(dir)) return;
    for (const f of readdirSync(dir)) copyFileSync(join(dir, f), join(into, `run-${n++}.jsonl`));
  };
};
// The XRPC answers the runs received, fresh or from the store, for
// harness/answers.mjs to hold to the lexicons.
const answer = gather(join(report, "answers"));
// The scans of growing tables the index's queries made, as
// crates/grain-serve/src/index/plans.rs finds them, for harness/plans.mjs.
const plan = gather(join(report, "plans"));

/// A stored pass for this run, if every binary it rests on is as it was:
/// its profile goes to the report, and it is not run.
const stored = (r) => {
  if (!store) return false;
  const dir = join(store, r.key);
  try {
    const kept = JSON.parse(readFileSync(join(dir, "result.json"), "utf8"));
    if (!Object.entries(kept.deps).every(([d, s]) => now[d] === s)) return false;
    if (kept.profiled) profile(join(dir, "run.profdata"));
    answer(join(dir, "answers"));
    plan(join(dir, "plans"));
    utimesSync(dir, new Date(), new Date());
    r.line = kept.line;
    return true;
  } catch {
    return false;
  }
};

const timed = join(target, "cov-times.json");
let times = {};
try {
  times = JSON.parse(readFileSync(timed, "utf8"));
} catch {}
const timeKey = (t) => `${t.net} ${t.name}`;
/// How long a run of `t` may go on, in ms (see the top).
const limitOf = (t) =>
  Number(process.env.COV_TIMEOUT) * 1000 || Math.max(600_000, 3 * (times[timeKey(t)] ?? 0));
const all = tests.map((t) => {
  const net = netFor(t);
  return { ...t, net, key: keyOf(t, net) };
});
const reused = all.filter(stored);
// The longest first, as the last run timed them, so that the last to
// finish is not one started late: the integration tests before the rest
// where there is no time yet.
const guess = (t) => times[timeKey(t)] ?? (t.name.endsWith("(test)") ? 1e9 : 0);
const runs = all.filter((r) => !reused.includes(r)).sort((a, b) => guess(b) - guess(a));
console.log(
  `${reused.length} of ${all.length} runs passed before, as they are now, ${runs.length} to run`,
);
if (reused.length)
  console.log(`  passed before: ${reused.map((r) => `${r.net} ${r.name}`).join(", ")}`);

const bringUp = async () => {
  for (const n of Object.values(nets).flat()) n.file = await n.up;
  console.log(`harnesses up in ${took()}`);
};
if (runs.length) await bringUp();

let dirs = 0;
/// One binary against one harness, its output kept to show if it fails,
/// its profiles in a directory of their own.
const one = (t, args = []) =>
  new Promise((ok) => {
    const profiles = join(runsDir, String(dirs++));
    mkdirSync(profiles, { recursive: true });
    const answers = `${profiles}-answers`;
    rmSync(answers, { recursive: true, force: true });
    const plans = `${profiles}-plans`;
    rmSync(plans, { recursive: true, force: true });
    const began = Date.now();
    // The least busy harness of its net.
    const net = nets[t.net].reduce((a, b) => (b.busy < a.busy ? b : a));
    net.busy++;
    const child = spawn(t.exe, args, {
      cwd: t.dir,
      env: {
        ...env,
        LLVM_PROFILE_FILE: join(profiles, "%p-%m.profraw"),
        GRAIN_TEST_NET: net.file,
        CARGO_MANIFEST_DIR: t.dir,
        GRAIN_ANSWERS: answers,
        GRAIN_PLANS: plans,
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let out = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (out += d));
    const limit = limitOf(t);
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, limit);
    // On close, not exit: the output is all read by then.
    child.on("close", (code) => {
      clearTimeout(timer);
      net.busy--;
      if (timedOut) out += `\nkilled: still running after ${Math.round(limit / 1000)}s\n`;
      ok({
        ...t,
        code: timedOut ? "timeout" : code,
        timedOut,
        out,
        ms: Date.now() - began,
        profiles,
        answers,
        plans,
      });
    });
  });

/// Keeps a passing run: its profiles merged into one, and what it ran.
const keepRun = (r, line) => {
  const raws = readdirSync(r.profiles).map((f) => join(r.profiles, f));
  const deps = own(r);
  for (const f of raws) {
    // One with no counters counts nothing, and is of no binary of ours.
    if (counters(f) === 0n) continue;
    const of = profiled(f);
    // A profile of no executable this build made: kept out of the store.
    if (!of)
      return console.log(
        `not stored: ${r.net} ${r.name} wrote ${basename(f)}, of no binary this build made`,
      );
    for (const m of of) if (m.exe !== r.exe) deps[depOf(m)] = m.sha;
  }
  const tmp = join(store, `.tmp-${process.pid}-${r.key}`);
  rmSync(tmp, { recursive: true, force: true });
  mkdirSync(tmp, { recursive: true });
  if (raws.length)
    execFileSync(join(tools, "llvm-profdata"), [
      "merge",
      "-sparse",
      ...raws,
      "-o",
      join(tmp, "run.profdata"),
    ]);
  if (existsSync(r.answers)) cpSync(r.answers, join(tmp, "answers"), { recursive: true });
  if (existsSync(r.plans)) cpSync(r.plans, join(tmp, "plans"), { recursive: true });
  const result = { deps, line, profiled: raws.length > 0, at: new Date().toISOString() };
  writeFileSync(join(tmp, "result.json"), JSON.stringify(result));
  rmSync(join(store, r.key), { recursive: true, force: true });
  renameSync(tmp, join(store, r.key));
};

// Tests failing now and then, while they are fixed: each by net, binary
// and test, with why and the last day it holds. Past that day it fails
// as any test does.
const today = new Date().toISOString().slice(0, 10);
const quarantine = JSON.parse(readFileSync(join(root, "harness/quarantine.json"), "utf8")).filter(
  (q) => {
    if (q.until >= today) return true;
    console.log(`quarantine over since ${q.until}: ${q.net} ${q.binary} ${q.test}`);
    return false;
  },
);
/// The tests `r` failed, if every one is quarantined; none otherwise.
const quarantined = (r) => {
  const names = [...r.out.matchAll(/^test (\S+) \.\.\. FAILED$/gm)].map((m) => m[1]);
  const held = (n) =>
    quarantine.some((q) => q.net === r.net && q.binary === r.name && q.test === n);
  return !r.timedOut && names.length && names.every(held) ? names : [];
};

const failed = [];
/// Runs each of `list`, `jobs` at a time, keeping those that pass.
const runAll = async (list) => {
  let next = 0;
  await Promise.all(
    Array.from({ length: jobs }, async () => {
      while (next < list.length) {
        const first = await one(list[next++]);
        // One that hung would hang again.
        const r = first.code === 0 || first.timedOut ? first : await one(first);
        const line = r.timedOut
          ? "killed, still running at its limit"
          : (r.out.match(/^test result: .*$/m)?.[0] ?? `exited with ${r.code}`);
        const held = r.code === 0 ? [] : quarantined(r);
        const said = r.code === 0 ? "ok  " : held.length ? "HELD" : "FAIL";
        console.log(`${said} ${r.net.padEnd(6)} ${r.name}: ${line}`);
        for (const n of held) console.log(`QUARANTINED: ${r.net} ${r.name} ${n}`);
        if (r.code !== 0 && !held.length) {
          failed.push(first, r);
          continue;
        }
        times[timeKey(r)] = r.ms;
        for (const f of readdirSync(r.profiles)) profile(join(r.profiles, f));
        answer(r.answers);
        plan(r.plans);
        if (held.length) {
          // Failed only where it is known to: counted, never stored. What
          // only a held test reaches is not reached when it fails, so each
          // is run alone, up to three times, for a run that passes.
          for (const n of held) {
            let alone;
            for (let i = 0; i < 3 && alone?.code !== 0; i++) alone = await one(r, [n, "--exact"]);
            const passed = alone.code === 0 ? "passed" : "failed";
            console.log(`${passed} alone: ${r.net} ${r.name} ${n}`);
            if (alone.code === 0)
              for (const f of readdirSync(alone.profiles)) profile(join(alone.profiles, f));
          }
          console.log(
            `---- its runs, which failed:\n${first.out}\n----\n${r.out}\n---- end of ${r.net} ${r.name}`,
          );
        } else if (r !== first) {
          // Passed only the second time: it says so, plainly, and is not stored.
          const names = [...first.out.matchAll(/^test (\S+) \.\.\. FAILED$/gm)].map((m) => m[1]);
          for (const n of names.length ? names : ["(the binary itself)"])
            console.log(`FLAKY: ${r.net} ${r.name} ${n}`);
          console.log(
            `---- its first run, which failed:\n${first.out}\n---- end of ${r.net} ${r.name}`,
          );
        } else if (store) keepRun(r, line);
      }
    }),
  );
  writeFileSync(timed, JSON.stringify(times, null, 1));
  for (const r of failed) console.log(`\n---- ${r.net} ${r.name}\n${r.out}`);
  if (failed.length) process.exit(1);
};
await runAll(runs);
// The harnesses are kept while a run may yet be made again (see below).
if (!reused.length) stop();
console.log(`ran ${runs.length} in ${took()}`);

// The store keeps the runs used last, up to its bound.
if (store && existsSync(store)) {
  const entries = readdirSync(store)
    .filter((e) => !e.startsWith("."))
    .map((e) => ({ e, at: statSync(join(store, e)).mtimeMs }))
    .sort((a, b) => b.at - a.at);
  for (const { e } of entries.slice(keep)) rmSync(join(store, e), { recursive: true, force: true });
  const stale = readdirSync(store).filter(
    (e) => e.startsWith(".tmp-") && !e.startsWith(`.tmp-${process.pid}-`),
  );
  for (const e of stale)
    if (Date.now() - statSync(join(store, e)).mtimeMs > 3600e3)
      rmSync(join(store, e), { recursive: true, force: true });
}

// The table goes to a file, and only its total and the files short of
// 100% are shown, with the lines they miss: a table of every file would
// push the misses out of what CI's log keeps.
const table = join(report, "report.txt");
const reportEnv = { ...env, CARGO_LLVM_COV_TARGET_DIR: report, CARGO_LLVM_COV_BUILD_DIR: report };
const gate = () => {
  const r = spawnSync(
    "rustup",
    [
      ...cargo,
      "llvm-cov",
      "report",
      "--output-path",
      table,
      "--ignore-filename-regex",
      ignore,
      "--fail-under-lines",
      String(gateAt.lines),
      "--fail-under-functions",
      String(gateAt.functions),
      "--show-missing-lines",
    ],
    { cwd: root, env: reportEnv, stdio: "inherit" },
  );
  const rows = existsSync(table) ? readFileSync(table, "utf8").split("\n") : [];
  const cols = (l) => l.trim().split(/\s+/);
  const short = (l) => cols(l).length > 9 && (cols(l)[5] !== "0" || cols(l)[8] !== "0");
  const shortRows = rows.slice(1).filter((l) => !l.startsWith("TOTAL") && short(l));
  console.log([rows[0], ...shortRows, ...rows.filter((l) => l.startsWith("TOTAL"))].join("\n"));
  console.log(
    `gate: ${gateAt.lines}% of lines, ${gateAt.functions}% of functions (harness/cov.json)`,
  );
  if (r.status !== 0) missed(shortRows.map((l) => cols(l)[0]));
  return r.status ?? 1;
};

/// Says each line the gate counts as missed, by file and by the function
/// it is in. The table counts a function's lines once for all its
/// instances, a generic's or a macro's, at the instance that reaches the
/// most of them, and counts a line again for each function it is in: the
/// lines are read here the same way, so the list is the table's misses
/// and no more, though another instance of a generic reaches a line its
/// best one does not.
const missed = (short) => {
  const json = join(report, "missed.json");
  spawnSync(
    "rustup",
    [
      ...cargo,
      "llvm-cov",
      "report",
      "--json",
      "--output-path",
      json,
      "--ignore-filename-regex",
      ignore,
    ],
    { cwd: root, env: reportEnv, stdio: "inherit" },
  );
  if (!existsSync(json)) return;
  // A region: line and column it starts and ends at, its count, its
  // file, the file it expands, and its kind, 0 being code.
  const at = (f) => relative(root, f.filenames[0]);
  const first = (f) => f.regions.find((r) => r[5] === 0);
  // The lines an instance misses: where each code region starts that no
  // reached region in the same file covers. A macro's call is an
  // expansion region, and one reached reaches its line.
  const misses = (f) => {
    const here = f.regions.filter((r) => r[5] === 0);
    const lines = here.filter((r) => r[7] === 0).map((r) => r[0]);
    return [...new Set(lines.filter((l) => !here.some((r) => r[4] > 0 && r[0] <= l && l <= r[2])))];
  };
  // The instances of one function start at the same place.
  const groups = new Map();
  for (const f of JSON.parse(readFileSync(json, "utf8")).data[0].functions) {
    const start = first(f);
    if (!start || !short.some((s) => at(f).endsWith(s))) continue;
    const key = `${at(f)}:${start[0]}:${start[1]}`;
    groups.set(key, [...(groups.get(key) ?? []), f]);
  }
  const out = [];
  for (const fs of groups.values()) {
    const f = fs[0];
    if (!fs.some((f) => f.count)) {
      out.push([at(f), first(f)[0], `${f.name}, never called`]);
      continue;
    }
    const best = fs
      .filter((f) => f.count)
      .map((f) => ({ f, lines: misses(f) }))
      .reduce((a, b) => (b.lines.length < a.lines.length ? b : a));
    for (const l of best.lines) out.push([at(best.f), l, best.f.name]);
  }
  console.log("Uncovered:");
  out.sort((a, b) => a[0].localeCompare(b[0]) || a[1] - b[1]);
  for (const [file, line, name] of out) console.log(`  ${file}:${line} in ${name}`);
};

let status = gate();
// A line some runs reach and others do not, as a race decides, can be
// one no stored run reached: the stored runs are made again, fresh, and
// the report read again, rather than fail a change that did not touch it.
if (status !== 0 && reused.length) {
  console.log(`short with ${reused.length} runs stored: running them again`);
  await bringUp();
  await runAll(reused);
  status = gate();
}
stop();
if (status !== 0) process.exit(status);
console.log(`coverage in ${took()}`);

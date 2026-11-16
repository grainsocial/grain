// Before the flows: a world of their own. The reference PDS and a PLC
// directory (harness/pds.mjs) with alice, bob and carol on it, alice with a
// Bluesky profile and the others with none; grain-serve over an index of
// its own, behind the https front the PDS sends logins back to
// (harness/tls-proxy.mjs), handing the pages to the web's build, as
// deploy/docker-compose.yml runs the two. Where the pages are and who is in
// the world go to the flows in E2E_WORLD. Returns the teardown.
//
// Each server's output goes to target/e2e/logs, for the check to show when
// a flow fails.

import { spawn } from "node:child_process";
import { createWriteStream, mkdirSync, mkdtempSync, openSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";

/// The repository's root.
export const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
/// Where the servers' output goes.
export const logs = join(root, "target/e2e/logs");

/// The profile alice has on Bluesky, which her first login seeds her grain
/// profile from.
export const BLUESKY_PROFILE = {
  displayName: "Alice Liddell",
  description: "Photographs from down the rabbit hole.",
};

/// A port free a moment ago.
const free = () =>
  new Promise((done, fail) => {
    const server = createServer();
    server.on("error", fail);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      server.close(() => done(port));
    });
  });

/// `command` with `args`, its output kept under `name` in the logs; its
/// first line of output, when `first` is asked for.
const start = (name, command, args, { env = {}, first = false } = {}) => {
  const fd = openSync(join(logs, `${name}.log`), "w");
  const child = spawn(command, args, {
    cwd: root,
    env: { ...process.env, ...env },
    stdio: ["pipe", first ? "pipe" : fd, fd],
  });
  child.on("error", (e) => console.error(`${name}: ${e}`));
  if (!first) return { child };
  const lines = createInterface({ input: child.stdout });
  const line = new Promise((done, fail) => {
    lines.once("line", done);
    child.once("exit", () => fail(new Error(`${name} exited before it was up: see ${name}.log`)));
  }).then((said) => {
    // The rest of what it says, after the line, to its log.
    lines.on("line", (more) => rest.write(`${more}\n`));
    return said;
  });
  const rest = createWriteStream(null, { fd });
  return { child, line };
};

/// Until `url` answers ok, or `what` gives up after a minute.
const until = async (what, url) => {
  const end = Date.now() + 60_000;
  while (Date.now() < end) {
    const ok = await fetch(url).then(
      (r) => r.ok,
      () => false,
    );
    if (ok) return;
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`${what} did not come up at ${url}: see target/e2e/logs`);
};

/// `account`'s session at `pds`, logged in with its password.
export const session = async (pds, account) => {
  const res = await fetch(`${pds}/xrpc/com.atproto.server.createSession`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ identifier: account.handle, password: account.password }),
  });
  if (!res.ok) throw new Error(`createSession ${account.handle}: ${await res.text()}`);
  return (await res.json()).accessJwt;
};

export default async function setup() {
  mkdirSync(logs, { recursive: true });
  const children = [];
  const stop = () => {
    for (const child of children.reverse()) child.kill();
  };
  try {
    // The PDS on the spaces alpha when GRAIN_DEV_ENV names it.
    const pds = start("pds", "node", ["harness/pds.mjs", "--accounts", "alice,bob,carol"], {
      first: true,
    });
    children.push(pds.child);
    const net = JSON.parse(await pds.line);
    const [alice] = net.accounts;
    const token = await session(net.pds, alice);
    const put = await fetch(`${net.pds}/xrpc/com.atproto.repo.putRecord`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({
        repo: alice.did,
        collection: "app.bsky.actor.profile",
        rkey: "self",
        record: { $type: "app.bsky.actor.profile", ...BLUESKY_PROFILE },
      }),
    });
    if (!put.ok) throw new Error(`alice's Bluesky profile: ${await put.text()}`);

    const [serve, web] = [await free(), await free()];
    const { cert, key, host } = net.client;
    const proxy = start("tls-proxy", "node", ["harness/tls-proxy.mjs", cert, key, String(serve)], {
      first: true,
    });
    children.push(proxy.child);
    const base = `https://${host}:${(await proxy.line).trim()}`;

    const dir = mkdtempSync(join(tmpdir(), "grain-e2e-"));
    const server = start(
      "grain-serve",
      join(root, "target/debug/grain-serve"),
      [
        ["--listen", `127.0.0.1:${serve}`],
        ["--index", join(dir, "index.db")],
        ["--public-url", base],
        ["--sign-up-pds", net.pds],
        // Backfill, as production runs it, reads each account a login
        // starts tracking and learns its handle; here from its PDS, with
        // no mirror, and the PDS for a directory, which lists no one.
        ["--backfill", net.pds],
        ["--backfill-mirror", ""],
        ["--web", `http://127.0.0.1:${web}`],
      ].flat(),
      {
        env: {
          GRAIN_CONFIG_DIR: join(dir, "config"),
          GRAIN_CACHE_DIR: join(dir, "cache"),
          GRAIN_PLC_URL: net.plc,
          GRAIN_HANDLE_RESOLVER: net.pds,
          // The PDS is on loopback, over http.
          GRAIN_ALLOW_PRIVATE: "1",
          GRAIN_CA_CERTS: cert,
          RUST_LOG: "info",
        },
      },
    );
    children.push(server.child);
    // The pages, as `just pages` runs them, at the public URL: ORIGIN is
    // what a page's own address is taken to be, as the front says it.
    const pages = start("web", "node", ["build"], {
      env: {
        HOST: "127.0.0.1",
        PORT: String(web),
        ORIGIN: base,
        GRAIN_SERVE_URL: `http://127.0.0.1:${serve}`,
      },
    });
    children.push(pages.child);
    await until("grain-serve", `http://127.0.0.1:${serve}/healthz`);
    await until("the pages", `http://127.0.0.1:${web}/support/terms`);

    process.env.E2E_WORLD = JSON.stringify({
      base,
      host,
      pds: net.pds,
      plc: net.plc,
      spaces: net.spaces,
      accounts: net.accounts,
    });
  } catch (e) {
    stop();
    throw e;
  }
  return stop;
}

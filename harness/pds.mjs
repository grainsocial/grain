// Runs the reference PDS (@atproto/pds via @atproto/dev-env) and a PLC
// directory on free ports, creates test accounts, prints one JSON line
// describing them, and shuts down when stdin closes. As knotless's
// harness/pds.mjs.
//
//   node harness/pds.mjs [--accounts alice,bob] [--rate-limits]
//
// GRAIN_DEV_ENV names a built dev-env package to use instead of the npm
// one: an atproto checkout's packages/dev-env on the permissioned spaces
// alpha, for the tests of groups. The alpha's PDS migrates an account's
// database every time it opens it, which costs a read more than the read:
// here each is migrated the first time only. The line printed says
// `spaces: true` for a PDS on the alpha.
//
// A confidential OAuth client, as grain-serve is, is reached by the PDS
// only over https at a hostname. So the harness makes a certificate for
// CLIENT_HOST, trusts it, and resolves that name to 127.0.0.1; tests put
// harness/tls-proxy.mjs in front of a client with it.

import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, realpathSync } from "node:fs";
import { createRequire } from "node:module";
import { AsyncLocalStorage } from "node:async_hooks";
import { tmpdir } from "node:os";
import dns from "node:dns";
import tls from "node:tls";

const here = dirname(fileURLToPath(import.meta.url));
// The PDS's better-sqlite3 is built for the Node harness/.node-version
// names, as CI's is; on another major it fails to load, saying only that
// two ABI numbers differ.
const pinned = readFileSync(join(here, ".node-version"), "utf8").trim();
if (process.versions.node.split(".")[0] !== pinned.split(".")[0]) {
  console.error(
    `harness/pds.mjs runs on Node ${pinned}, as harness/.node-version says, not ${process.version}`,
  );
  process.exit(1);
}
const devEnv = process.env.GRAIN_DEV_ENV && resolve(here, "..", process.env.GRAIN_DEV_ENV);
const { TestNetworkNoAppView } = await import(
  devEnv ? pathToFileURL(join(devEnv, "dist/index.js")).href : "@atproto/dev-env"
);
if (devEnv) await migrateOnce(devEnv);

/// Has the PDS that the dev-env at `dir` runs migrate each account's
/// database on its first opening alone, rather than on every one: the
/// same modules it loads, patched before it starts.
async function migrateOnce(dir) {
  const index = createRequire(join(dir, "package.json")).resolve("@atproto/pds");
  const dist = dirname(realpathSync(index));
  const load = (file) => import(pathToFileURL(join(dist, file)).href);
  const { ActorStore } = await load("actor-store/actor-store.js");
  const { Migrator } = await load("db/migrator.js");
  const opened = new Set();
  const again = new AsyncLocalStorage();
  const open = ActorStore.prototype.openDb;
  ActorStore.prototype.openDb = async function (did) {
    const { dbLocation } = await this.getLocation(did);
    const db = await again.run(opened.has(dbLocation), () => open.call(this, did));
    opened.add(dbLocation);
    return db;
  };
  const migrate = Migrator.prototype.migrateToLatestOrThrow;
  Migrator.prototype.migrateToLatestOrThrow = function () {
    return again.getStore() ? Promise.resolve([]) : migrate.call(this);
  };
}

const CLIENT_HOST = "client.grain.internal";
const certs = mkdtempSync(join(tmpdir(), "grain-tls-"));
const cert = join(certs, "cert.pem");
const key = join(certs, "key.pem");
execFileSync(
  "openssl",
  [
    "req",
    "-x509",
    "-newkey",
    "ec",
    "-pkeyopt",
    "ec_paramgen_curve:prime256v1",
    "-nodes",
    "-keyout",
    key,
    "-out",
    cert,
    "-days",
    "7",
    "-subj",
    `/CN=${CLIENT_HOST}`,
    "-addext",
    `subjectAltName=DNS:${CLIENT_HOST}`,
  ],
  { stdio: "ignore" },
);
tls.setDefaultCACertificates([...tls.getCACertificates("default"), readFileSync(cert, "utf8")]);
const lookup = dns.lookup;
dns.lookup = (hostname, options, callback) => {
  if (typeof options === "function") [callback, options] = [options, {}];
  if (hostname !== CLIENT_HOST) return lookup(hostname, options, callback);
  return options?.all
    ? callback(null, [{ address: "127.0.0.1", family: 4 }])
    : callback(null, "127.0.0.1", 4);
};

const arg = (name) => {
  const i = process.argv.indexOf(name);
  return i === -1 ? undefined : process.argv[i + 1];
};
const names = (arg("--accounts") ?? "seed").split(",").filter(Boolean);

const net = await TestNetworkNoAppView.create({
  pds: {
    hostname: "localhost",
    rateLimitsEnabled: process.argv.includes("--rate-limits"),
  },
});

const accounts = [];
for (const name of names) {
  const password = `${name}-password`;
  const res = await fetch(`${net.pds.url}/xrpc/com.atproto.server.createAccount`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: `${name}@test.com`, handle: `${name}.test`, password }),
  });
  if (!res.ok) throw new Error(`createAccount ${name}: ${await res.text()}`);
  const { did, handle } = await res.json();
  accounts.push({ handle, did, password });
}

const described = await fetch(`${net.pds.url}/xrpc/com.atproto.server.describeServer`).then((res) =>
  res.json(),
);

// A login asking for a space's scope has its PDS read the space's
// declaration, a lexicon, which it resolves by DNS and keeps; the alpha's
// is given grain's and opensocial's as they are published, kept as just
// resolved, so it resolves none.
if (described.spacesAlpha === true) {
  const lexicon = (name) => JSON.parse(readFileSync(join(here, "..", "lexicons", name), "utf8"));
  const declarations = [
    lexicon("social/grain/group.json"),
    {
      lexicon: 1,
      id: "fyi.opensocial.members",
      defs: {
        main: {
          type: "space",
          key: "literal:self",
          name: "Group: members",
          description: "Roles, who holds them, the authz config, and the space index.",
          collections: [
            "fyi.opensocial.permissions",
            "fyi.opensocial.space",
            "fyi.opensocial.role",
            "fyi.opensocial.membership",
            "fyi.opensocial.acceptance",
            "fyi.opensocial.access",
          ],
        },
      },
    },
  ];
  const now = new Date().toISOString();
  for (const doc of declarations) {
    await net.pds.ctx.accountManager.db.db
      .insertInto("lexicon")
      .values({
        nsid: doc.id,
        createdAt: now,
        updatedAt: now,
        lastSucceededAt: now,
        uri: `at://did:plc:harness/com.atproto.lexicon.schema/${doc.id}`,
        lexicon: JSON.stringify(doc),
      })
      .execute();
  }
}

console.log(
  JSON.stringify({
    pds: net.pds.url,
    plc: net.plc.url,
    spaces: described.spacesAlpha === true,
    client: { host: CLIENT_HOST, cert, key },
    accounts,
  }),
);

const shutdown = async () => {
  await net.close();
  process.exit(0);
};
process.stdin.on("end", shutdown);
process.stdin.on("close", shutdown);
process.stdin.resume();
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

// Stands in for the user's browser on the reference PDS's authorization
// page: signs in, approves (or rejects) the request, and follows the
// redirect back to the client, and on from there. As knotless's
// harness/authorize.mjs, less its cookies.
//
//   node harness/authorize.mjs <handle> <password> [--reject] [--create]
//       [--stop] [--ca <cert>] <authorize-url>
//
// A command-line login runs it as GRAIN_BROWSER, with the URL last. With
// --ca, it reaches the harness's client hostname as pds.mjs does: at
// 127.0.0.1, trusting that certificate. It speaks plain node:http(s), as
// fetch sets the sec-fetch-* headers itself.
//
// With --stop, it goes no further than the redirect back to the client,
// and prints where that sends the browser: for a client that answers only
// in the browser that started the login, by a cookie this one lacks.
//
// With --create, it signs up as <handle> with <password> rather than
// signing in, as the page a request with prompt=create shows asks.

import { request as http } from "node:http";
import { request as https } from "node:https";
import { readFileSync } from "node:fs";

const args = process.argv.slice(2);
const reject = args.includes("--reject");
const create = args.includes("--create");
const stop = args.includes("--stop");
const at = args.indexOf("--ca");
const ca = at === -1 ? undefined : readFileSync(args.splice(at, 2)[1]);
const flags = ["--reject", "--create", "--stop"];
const [username, password, url] = args.filter((a) => !flags.includes(a));
const authorize = new URL(url);
const origin = authorize.origin;
const api = `${origin}/@atproto/oauth-provider/~api`;

const jar = new Map();
const cookies = () => [...jar].map(([name, value]) => `${name}=${value}`).join("; ");

// The client hostname, as pds.mjs resolves it.
const local = (_hostname, options, callback) =>
  options?.all
    ? callback(null, [{ address: "127.0.0.1", family: 4 }])
    : callback(null, "127.0.0.1", 4);

// One request: its status, headers and body.
const send = (url, { method = "GET", headers = {}, body } = {}) =>
  new Promise((done, fail) => {
    const secure = new URL(url).protocol === "https:";
    const tls = secure ? { ca, lookup: local } : {};
    const req = (secure ? https : http)(url, { method, headers, ...tls }, (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () =>
        done({
          status: res.statusCode,
          headers: res.headers,
          body: Buffer.concat(chunks).toString(),
        }),
      );
    });
    req.on("error", fail);
    req.end(body);
  });

const keep = (res) => {
  for (const cookie of res.headers["set-cookie"] ?? []) {
    const [pair] = cookie.split(";");
    const at = pair.indexOf("=");
    jar.set(pair.slice(0, at), pair.slice(at + 1));
  }
};

const page = await send(authorize, {
  headers: {
    "sec-fetch-mode": "navigate",
    "sec-fetch-dest": "document",
    "sec-fetch-site": "cross-site",
  },
});
keep(page);
// A request the server refuses goes straight back to the client.
if (page.headers.location) {
  if (stop) {
    console.log(new URL(page.headers.location, authorize).href);
    process.exit(0);
  }
  await send(page.headers.location);
  process.exit(0);
}
if (page.status !== 200) throw new Error(`authorize page: ${page.status} ${page.body}`);

// `token`, an ephemeral token a sign-in or sign-up not remembered on the
// device answers, stands in for the device's session.
const call = async (endpoint, body, token) => {
  const res = await send(`${api}${endpoint}`, {
    method: "POST",
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      "content-type": "application/json",
      "sec-fetch-mode": "same-origin",
      "sec-fetch-site": "same-origin",
      origin,
      referer: authorize.href,
      "x-csrf-token": jar.get("csrf-token"),
      cookie: cookies(),
    },
    body: JSON.stringify(body),
  });
  keep(res);
  if (res.status !== 200) throw new Error(`${endpoint}: ${res.status} ${res.body}`);
  return JSON.parse(res.body);
};

let done;
if (reject) {
  done = await call("/reject", {});
} else {
  // Signing up takes no `remember` on every provider: one that is not
  // remembered answers an ephemeral token to consent with.
  const { account, ephemeralToken } = create
    ? await call("/sign-up", {
        locale: "en",
        handle: username,
        email: `${username}@test.com`,
        password,
      })
    : await call("/sign-in", {
        locale: "en",
        username,
        password,
        remember: true,
      });
  done = await call("/consent", { did: account.did }, ephemeralToken);
}

const back = await send(done.url, {
  headers: {
    "sec-fetch-mode": "navigate",
    "sec-fetch-dest": "document",
    "sec-fetch-site": "same-origin",
    referer: authorize.href,
    cookie: cookies(),
  },
});
let location = back.headers.location;
if (!location) throw new Error(`redirect: ${back.status} ${back.body}`);
if (stop) {
  console.log(new URL(location, done.url).href);
  process.exit(0);
}
// The client may send the browser on again, as a site sends it back to
// the page its login started on.
let here = done.url;
for (let hops = 0; location && hops < 5; hops++) {
  here = new URL(location, here).href;
  const res = await send(here);
  location = res.headers.location;
}

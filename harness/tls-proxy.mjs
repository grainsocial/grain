// An https front for a client under test, at the harness's client
// hostname, passing every request on to it over plain http.
//
//   node harness/tls-proxy.mjs <cert> <key> <target port>
//
// Prints the port it listens on, and exits when stdin closes.

import { readFileSync } from "node:fs";
import { createServer } from "node:https";
import { request } from "node:http";

const [cert, key, target] = process.argv.slice(2);

const server = createServer({ cert: readFileSync(cert), key: readFileSync(key) }, (req, res) => {
  const upstream = request(
    { host: "127.0.0.1", port: target, path: req.url, method: req.method, headers: req.headers },
    (answer) => {
      res.writeHead(answer.statusCode, answer.headers);
      answer.pipe(res);
    },
  );
  upstream.on("error", () => res.writeHead(502).end());
  req.pipe(upstream);
});

server.listen(0, "127.0.0.1", () => console.log(server.address().port));
process.stdin.on("end", () => process.exit(0));
process.stdin.on("close", () => process.exit(0));
process.stdin.resume();

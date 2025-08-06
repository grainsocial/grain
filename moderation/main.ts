import type { Label } from "$lexicon/types/com/atproto/label/defs.ts";
import type { Labels } from "$lexicon/types/com/atproto/label/subscribeLabels.ts";
import { cborEncode, noUndefinedVals } from "@atproto/common";
import { Keypair, Secp256k1Keypair } from "@atproto/crypto";
import { stringifyLex } from "@atproto/lexicon";
import { assertEquals, assertExists } from "@std/assert";
import { DatabaseSync } from "node:sqlite";
import * as ui8 from "uint8arrays";

if (import.meta.main) {
  const cfg = await createConfig();
  const db = createDb(cfg);
  const modService = createModService(db);
  const handler = createHandler(modService);

  Deno.serve({
    port: cfg.port,
    onListen() {
      console.log(`Listening on http://localhost:${cfg.port}`);
    },
    onError(err) {
      console.error("Error occurred:", err);
      return new Response("Internal Server Error", {
        status: 500,
      });
    },
  }, handler);

  Deno.addSignalListener("SIGINT", () => {
    console.log("Shutting down server...");
    Deno.exit(0);
  });
}

type Config = {
  port: number;
  databaseUrl: string;
  signingKey: string;
};

export async function createConfig(): Promise<Config> {
  return {
    port: Number(Deno.env.get("MOD_SERVICE_PORT")) || 8080,
    databaseUrl: Deno.env.get("MOD_SERVICE_DATABASE_URL") ?? ":memory:",
    signingKey: Deno.env.get("MOD_SERVICE_SIGNING_KEY") ??
      await createSigningKey(),
  };
}

async function createSigningKey() {
  const serviceKeypair = await Secp256k1Keypair.create({ exportable: true });
  return ui8.toString(await serviceKeypair.export(), "hex");
}

// Track all connected WebSocket clients for label subscriptions
const labelSubscribers = new Set<WebSocket>();

export function broadcastLabel(label: LabelRow) {
  // Only broadcast if this label is active (not negated, not expired, and latest)
  // Gather all labels for this (src, uri, val) and check if this is the latest and not negated/expired
  // For simplicity, assume label is already the latest for this key
  if (label.exp && new Date(label.exp).getTime() < Date.now()) return;
  if (label.neg) return;
  const msg = stringifyLex({
    seq: label.id,
    labels: [formatLabel(label)],
  } as Labels);
  for (const ws of labelSubscribers) {
    try {
      ws.send(msg);
    } catch (e) {
      console.error("Error sending label to subscriber:", e);
      labelSubscribers.delete(ws);
    }
  }
}

export async function handleSubscribeLabels(
  req: Request,
  modService: ReturnType<typeof createModService>,
): Promise<Response> {
  const { searchParams } = new URL(req.url);
  const cursorParam = searchParams.get("cursor");
  const cursor = cursorParam ? parseInt(cursorParam, 10) : 0;
  if (cursorParam && Number.isNaN(cursor)) {
    return new Response(
      JSON.stringify({ error: "Cursor must be an integer" }),
      { status: 400 },
    );
  }
  const { response, socket } = Deno.upgradeWebSocket(req);
  // On open, send all labels after the cursor (including negations and expired)
  socket.onopen = () => {
    try {
      const { rows } = modService.getLabels({
        patterns: [],
        sources: [],
        limit: 1000,
        cursor,
      });
      // Send ALL rows, not just active (per ATProto spec)
      for (const row of rows) {
        const msg = stringifyLex({
          seq: row.id,
          labels: [formatLabel(row)],
        } as Labels);
        socket.send(msg);
      }
      labelSubscribers.add(socket);
      const userAgent = req.headers.get("user-agent");
      const origin = req.headers.get("origin");
      console.log(
        `New subscriber connected, total: ${labelSubscribers.size}, user-agent: ${userAgent}, origin: ${origin}, time: ${
          new Date().toISOString()
        }`,
      );
    } catch (e) {
      console.error("Error sending initial labels:", e);
      socket.close();
    }
  };
  socket.onclose = () => {
    labelSubscribers.delete(socket);
  };
  return response;
}

// Filter for active (non-negated, non-expired) labels
// Used for API hydration only. For the WebSocket stream, send all labels (including negations and expired).
function filterActiveLabels(labels: LabelRow[]): LabelRow[] {
  const now = Date.now();
  const latest: Record<string, LabelRow> = {};
  for (const label of labels) {
    if (label.exp && new Date(label.exp).getTime() < now) continue;
    const key = `${label.src}|${label.uri}|${label.val}`;
    if (!latest[key] || new Date(label.cts) > new Date(latest[key].cts)) {
      latest[key] = label;
    }
  }
  return Object.values(latest).filter((label) => !label.neg);
}

function createHandler(
  modService: ReturnType<typeof createModService>,
) {
  return async (req: Request): Promise<Response> => {
    const url = new URL(req.url);
    const pathname = url.pathname;

    if (
      pathname === "/xrpc/com.atproto.label.subscribeLabels" &&
      req.headers.get("upgrade")?.toLowerCase() === "websocket"
    ) {
      return await handleSubscribeLabels(req, modService);
    } else if (
      req.method === "GET" && pathname === "/xrpc/com.atproto.label.queryLabels"
    ) {
      // Parse query params
      const uriPatternsParam = url.searchParams.getAll("uriPatterns");
      const sourcesParam = url.searchParams.getAll("sources");
      const cursorParam = url.searchParams.get("cursor");
      const limitParam = url.searchParams.get("limit");

      const uriPatterns: string[] = uriPatternsParam.length
        ? uriPatternsParam
        : [];
      const sources: string[] = sourcesParam.length ? sourcesParam : [];
      const cursor = cursorParam ? parseInt(cursorParam, 10) : 0;
      if (cursorParam && Number.isNaN(cursor)) {
        return new Response(
          JSON.stringify({
            error: "Cursor must be an integer",
          }),
          { status: 400 },
        );
      }
      const limit = limitParam ? parseInt(limitParam, 10) : 50;
      if (Number.isNaN(limit) || limit < 1 || limit > 250) {
        return new Response(
          JSON.stringify({
            error: "Limit must be an integer between 1 and 250",
          }),
          { status: 400 },
        );
      }

      // Handle wildcards and SQL LIKE
      const patterns = uriPatterns.includes("*")
        ? []
        : uriPatterns.map((pattern) => {
          pattern = pattern.replace(/%/g, "").replace(/_/g, "\\_");
          const starIndex = pattern.indexOf("*");
          if (starIndex === -1) return pattern;
          if (starIndex !== pattern.length - 1) {
            return undefined; // Only trailing wildcards supported
          }
          return pattern.slice(0, -1) + "%";
        }).filter(Boolean) as string[];

      const { rows: labelRows, nextCursor } = modService.getLabels({
        patterns,
        sources,
        limit,
        cursor,
      });
      const activeLabels = filterActiveLabels(labelRows);
      const formattedRows = activeLabels.map(formatLabel);
      return new Response(
        stringifyLex({ cursor: nextCursor, labels: formattedRows }),
        {
          headers: { "content-type": "application/json" },
        },
      );
    } else if (req.method === "GET" && pathname === "/health") {
      // Use the modService's DB to check health
      modService.getLabels({
        patterns: [],
        sources: [],
        limit: 1,
        cursor: 0,
      });
      return new Response(JSON.stringify({ version: "0.1.0" }), {
        headers: { "content-type": "application/json" },
      });
    } else if (pathname.startsWith("/xrpc/")) {
      return new Response("Method Not Implemented", { status: 501 });
    }

    return new Response("Not Found", { status: 404 });
  };
}

export function createDb(cfg: Config) {
  const db = new DatabaseSync(cfg.databaseUrl);

  db.exec(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS labels (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      src TEXT NOT NULL,
      uri TEXT NOT NULL,
      cid TEXT,
      val TEXT NOT NULL,
      neg BOOLEAN DEFAULT FALSE,
      cts DATETIME NOT NULL,
      exp DATETIME,
      sig BLOB
    );
  `);

  return db;
}

export type LabelRow = {
  id: number;
  src: string;
  uri: string;
  cid: string | null;
  val: string;
  neg: boolean;
  cts: string;
  exp: string | null;
  sig: Uint8Array;
};

type UnsignedLabel = Omit<Label, "sig">;
type SignedLabel = Label & { sig: Uint8Array };

export function createModService(db: DatabaseSync) {
  return {
    insertLabel: (label: SignedLabel) => {
      const result = db.prepare(
        `INSERT INTO labels (src, uri, cid, val, neg, cts, exp, sig)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        label.src,
        label.uri,
        label.cid ?? null,
        label.val,
        label.neg ? 1 : 0,
        label.cts,
        label.exp ?? null,
        label.sig,
      );
      return result.lastInsertRowid as number;
    },
    getLabels: (opts: {
      patterns: string[];
      sources: string[];
      limit: number;
      cursor: number;
    }): { rows: LabelRow[]; nextCursor: string } => {
      const { patterns, sources, limit, cursor } = opts;
      const conditions: string[] = [];
      const params: (string | number | Uint8Array | null)[] = [];
      if (patterns.length) {
        conditions.push(
          "(" + patterns.map(() => "uri LIKE ?").join(" OR ") + ")",
        );
        params.push(...patterns);
      }
      if (sources.length) {
        conditions.push(`src IN (${sources.map(() => "?").join(", ")})`);
        params.push(...sources);
      }
      if (cursor) {
        conditions.push("id > ?");
        params.push(cursor);
      }
      params.push(limit);
      const whereClause = conditions.length
        ? `WHERE ${conditions.join(" AND ")}`
        : "";
      const sql = `SELECT * FROM labels ${whereClause} ORDER BY id ASC LIMIT ?`;
      const stmt = db.prepare(sql);
      const rows = stmt.all(...params) as unknown[];
      function rowToLabelRow(row: unknown): LabelRow {
        if (typeof row !== "object" || row === null) {
          throw new Error("Invalid row");
        }
        const r = row as Record<string, unknown>;
        const src = typeof r.src === "string" ? r.src : "";
        const uri = typeof r.uri === "string" ? r.uri : "";
        let cid: string | null = null;
        if (typeof r.cid === "string") cid = r.cid;
        const val = typeof r.val === "string" ? r.val : "";
        const cts = typeof r.cts === "string" ? r.cts : "";
        let exp: string | null = null;
        if (typeof r.exp === "string") exp = r.exp;
        const neg = typeof r.neg === "boolean" ? r.neg : Number(r.neg) === 1;
        let sig: Uint8Array;
        if (r.sig instanceof Uint8Array) sig = r.sig;
        else if (Array.isArray(r.sig)) sig = new Uint8Array(r.sig);
        else sig = new Uint8Array();
        const id = typeof r.id === "number" ? r.id : Number(r.id);
        return { id, src, uri, cid, val, neg, cts, exp, sig };
      }
      const labelRows = rows.map(rowToLabelRow);
      let nextCursor = "0";
      if (rows.length > 0) {
        const lastId = (rows[rows.length - 1] as Record<string, unknown>).id;
        nextCursor = typeof lastId === "string" || typeof lastId === "number"
          ? String(lastId)
          : "0";
      }
      return { rows: labelRows, nextCursor };
    },
  };
}

export function createLabel(
  cfg: Config,
  modService: ReturnType<typeof createModService>,
) {
  return async (
    label: UnsignedLabel,
  ) => {
    const serviceSigningKey = cfg.signingKey;
    if (!serviceSigningKey) {
      throw new Error("MOD_SERVICE_SIGNING_KEY is not set");
    }
    const signingKey = await Secp256k1Keypair.import(serviceSigningKey);

    const signed = await signLabel(label, signingKey);

    const id = modService.insertLabel(signed);
    // Broadcast the label to all subscribers after insert
    const labelRow: LabelRow = {
      id: Number(id),
      src: signed.src,
      uri: signed.uri,
      cid: signed.cid ?? null,
      val: signed.val,
      neg: signed.neg === true, // ensure boolean
      cts: signed.cts,
      exp: signed.exp ?? null,
      sig: signed.sig,
    };
    broadcastLabel(labelRow);
  };
}

const formatLabel = (row: LabelRow): Label => {
  return noUndefinedVals(
    {
      ver: 1,
      src: row.src,
      uri: row.uri,
      cid: row.cid === "" || row.cid === null ? undefined : row.cid,
      val: row.val,
      neg: row.neg === true ? true : undefined,
      cts: row.cts,
      exp: row.exp ?? undefined,
      sig: row.sig ? new Uint8Array(row.sig) : undefined,
    } satisfies Label,
  ) as unknown as Label;
};

const signLabel = async (
  label: Label,
  signingKey: Keypair,
): Promise<SignedLabel> => {
  const { ver, src, uri, cid, val, neg, cts, exp } = label;
  const reformatted = noUndefinedVals(
    {
      ver: ver ?? 1,
      src,
      uri,
      cid,
      val,
      neg: neg === true ? true : undefined,
      cts,
      exp,
    } satisfies Label,
  ) as unknown as Label;

  const bytes = cborEncode(reformatted);
  const sig = await signingKey.sign(bytes);
  return {
    ...reformatted,
    sig,
  };
};

Deno.test("insertLabel inserts a signed label and returns an id", async () => {
  const cfg = await createConfig();
  const db = createDb(cfg);
  const modService = createModService(db);

  const label = {
    src: "did:example:alice",
    uri: "at://did:example:bob/app.bsky.feed.post/123",
    val: "spam",
    neg: false,
    cts: new Date().toISOString(),
    sig: new Uint8Array([1, 2, 3]),
  };

  const id = modService.insertLabel(label);
  assertExists(id);

  // Check that the label is in the database
  const row = db.prepare("SELECT * FROM labels WHERE id = ?").get(id);
  assertExists(row);
  assertEquals(row.src, label.src);
  assertEquals(row.uri, label.uri);
  assertEquals(row.val, label.val);
  assertEquals(row.neg, 0);
  assertEquals(row.sig, label.sig);
});

Deno.test("signLabel produces a valid signature", async () => {
  const cfg = await createConfig();
  const keyHex = cfg.signingKey;
  const signingKey = await Secp256k1Keypair.import(keyHex);

  const label: Label = {
    ver: 1,
    src: "did:example:alice",
    uri: "at://did:example:bob/app.bsky.feed.post/123",
    val: "spam",
    cts: new Date().toISOString(),
  };

  const signed = await signLabel(label, signingKey);

  assertExists(signed.sig);
  assertEquals(signed.src, label.src);
  assertEquals(signed.uri, label.uri);
  assertEquals(signed.val, label.val);
});

Deno.test("getLabels retrieves labels with filtering and pagination", async () => {
  const cfg = await createConfig();
  const db = createDb(cfg);
  const modService = createModService(db);

  // Insert some test labels
  for (let i = 1; i <= 10; i++) {
    modService.insertLabel({
      src: "did:example:alice",
      uri: `at://did:example:bob/app.bsky.feed.post/${i}`,
      val: i % 2 === 0 ? "spam" : "scam",
      neg: false,
      cts: new Date().toISOString(),
      sig: new Uint8Array([1, 2, 3]),
    });
  }

  // Retrieve labels with limit and cursor
  const { rows, nextCursor } = modService.getLabels({
    patterns: ["at://did:example:bob/app.bsky.feed.post/%"],
    sources: ["did:example:alice"],
    limit: 5,
    cursor: 0,
  });

  assertEquals(rows.length, 5);
  assertEquals(nextCursor, "5");

  // Retrieve next page
  const { rows: nextRows } = modService.getLabels({
    patterns: ["at://did:example:bob/app.bsky.feed.post/%"],
    sources: ["did:example:alice"],
    limit: 5,
    cursor: parseInt(nextCursor, 10),
  });

  assertEquals(nextRows.length, 5);
});

export type ModService = ReturnType<typeof createModService>;

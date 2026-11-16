// grain's XRPC client, as knotless's web has its own: each call names its
// method's schema from src/lib/lexicons, which `npm run lex` makes with
// @atproto/lex from lexicons/, and is typed by it.
//
//   query<typeof getProfile.main>("social.grain.actor.getProfile", { actor }, fetch)
//   call<typeof updateSeen.main>("social.grain.notification.updateSeen", { seenAt })
//   upload<typeof uploadBlob.main>("social.grain.repo.uploadBlob", blob)
//
// Calls go to `/xrpc/<nsid>` on the page's own origin. In the browser that is
// grain-serve, behind the same host; on the server the fetch passed in is
// SvelteKit's, which hooks.server.ts sends on to grain-serve with the
// browser's cookie.

import type {
  InferInput,
  InferMethodInputBody,
  InferMethodOutputBody,
  LexErrorData,
  Procedure,
  Query,
} from "@atproto/lex";

export type Fetch = typeof globalThis.fetch;

/** What the query `Q` answers. */
export type Answer<Q extends Query> = InferMethodOutputBody<Q, never>;

/** What the query `Q` is asked with, its defaults left to the server. */
export type Asked<Q extends Query> = InferInput<Q["parameters"]>;

/** What the procedure `P` takes. */
export type Input<P extends Procedure> = InferMethodInputBody<P, never>;

/** What the procedure `P` answers. */
export type Output<P extends Procedure> = InferMethodOutputBody<P, never>;

/** A call grain-serve refused, or that never reached it. */
export class XrpcError extends Error {
  /** The HTTP status, 0 for one that never reached the server. */
  readonly status: number;
  /** The error's name, as the server gave it (`InvalidRequest`, ...). */
  readonly error?: string;
  /** Why, as the server said. */
  readonly reason?: string;

  constructor(nsid: string, status: number, body?: Partial<LexErrorData> | null) {
    super(`XRPC ${nsid} failed: ${status}`);
    this.name = "XrpcError";
    this.status = status;
    if (typeof body?.error === "string") this.error = body.error;
    if (typeof body?.message === "string") this.reason = body.message;
  }
}

/** What happens to a call the browser makes once the session has ended. */
let unauthorized: ((nsid: string) => void) | null = null;

/** Sets what a browser's call answered 401 does, besides failing. */
export function onUnauthorized(handler: ((nsid: string) => void) | null): void {
  unauthorized = handler;
}

/** A query's parameters as its address has them: an array's values each under its name. */
export function searched(params: object | undefined): string {
  const query = new URLSearchParams();
  for (const [k, v] of Object.entries(params ?? {})) {
    for (const one of v == null ? [] : [v].flat()) query.append(k, String(one));
  }
  return query.size ? `?${query}` : "";
}

/** Bytes as atproto's JSON writes them, `{"$bytes": base64}`; anything else as it is. */
function lexJson(_: string, value: unknown): unknown {
  if (!(value instanceof Uint8Array)) return value;
  let text = "";
  for (const b of value) text += String.fromCharCode(b);
  return { $bytes: btoa(text) };
}

async function send<T>(nsid: string, path: string, init: RequestInit, fetch?: Fetch): Promise<T> {
  const browser = typeof window !== "undefined";
  if (!fetch && !browser) {
    throw new Error(`xrpc ${nsid}: on the server, pass the load's fetch`);
  }
  let res: Response;
  try {
    res = await (fetch ?? globalThis.fetch)(path, init);
  } catch {
    throw new XrpcError(nsid, 0);
  }
  if (!res.ok) {
    const failure: Partial<LexErrorData> | null = await res.json().catch(() => null);
    if (browser && res.status === 401) unauthorized?.(nsid);
    throw new XrpcError(nsid, res.status, failure);
  }
  const text = await res.text();
  return (text ? JSON.parse(text) : {}) as T;
}

/**
 * What the XRPC query `Q`, by its NSID `nsid`, answers `params` with. On the
 * server `fetch` is the load's or the request's own, which carries the cookie.
 */
export function query<Q extends Query>(
  nsid: Q["nsid"],
  params: Asked<Q>,
  fetch?: Fetch,
): Promise<Answer<Q>> {
  return send(nsid, `/xrpc/${nsid}${searched(params)}`, {}, fetch);
}

/** What the XRPC procedure `P`, by its NSID `nsid`, answers `input` with. */
export function call<P extends Procedure>(
  nsid: P["nsid"],
  input: Input<P>,
  fetch?: Fetch,
): Promise<Output<P>> {
  const init = {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input ?? {}, lexJson),
  };
  return send(nsid, `/xrpc/${nsid}`, init, fetch);
}

/** What the XRPC procedure `P` answers `body` with, sent as its own bytes and type. */
export function upload<P extends Procedure>(
  nsid: P["nsid"],
  body: Blob,
  fetch?: Fetch,
): Promise<Output<P>> {
  const init = {
    method: "POST",
    headers: { "content-type": body.type || "application/octet-stream" },
    body,
  };
  return send(nsid, `/xrpc/${nsid}`, init, fetch);
}

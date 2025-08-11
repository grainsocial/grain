import { TID } from "@atproto/common";
import { stringifyLex } from "@atproto/lexicon";
import { AtUri } from "@atproto/syntax";
import { assert } from "@std/assert";
import { importJWK, SignJWT } from "jose";
import { randomBytes } from "node:crypto";
import type { ATProtoSession } from "../aip/atproto-session.ts";
import type { BffConfig } from "../types.d.ts";
import type { IndexService } from "./indexing.ts";

interface ParsedDPoPKey {
  kty: string;
  crv: string;
  x: string;
  y: string;
  d?: string;
}

/**
 * Generate a DPoP proof JWT for a given HTTP request
 */
export async function generateDPoPProof(
  method: string,
  url: string,
  dpopKey: ParsedDPoPKey,
  accessToken?: string,
  nonce?: string,
): Promise<string> {
  try {
    // Validate the key has required fields
    if (
      !dpopKey.kty || !dpopKey.crv || !dpopKey.x || !dpopKey.y || !dpopKey.d
    ) {
      throw new Error("Invalid DPoP key format. Missing required fields.");
    }

    // Determine algorithm based on curve
    const alg = dpopKey.crv === "P-256"
      ? "ES256"
      : dpopKey.crv === "P-384"
      ? "ES384"
      : dpopKey.crv === "secp256k1"
      ? "ES256K"
      : "ES256";

    // Import the private key for signing
    const privateKeyJWK = {
      ...dpopKey,
      alg: alg,
      use: "sig",
    };

    const privateKey = await importJWK(privateKeyJWK, alg);

    // Create public key JWK (without private components)
    const publicJWK = {
      kty: dpopKey.kty,
      crv: dpopKey.crv,
      x: dpopKey.x,
      y: dpopKey.y,
    };

    // Generate unique JTI (JWT ID)
    const jti = randomBytes(16).toString("hex");

    // Current timestamp
    const iat = Math.floor(Date.now() / 1000) - 30;
    const exp = iat + 300;

    // Build the DPoP proof payload
    const payload: Record<string, unknown> = {
      jti,
      htm: method.toUpperCase(),
      htu: url,
      iat,
      exp,
    };

    // Add nonce if provided
    if (nonce) {
      payload.nonce = nonce;
    }

    // Add access token hash if provided
    if (accessToken) {
      const crypto = await import("node:crypto");
      const hash = crypto.createHash("sha256").update(accessToken).digest(
        "base64url",
      );
      payload.ath = hash;
    }

    // Create and sign the JWT
    const jwt = await new SignJWT(payload)
      .setProtectedHeader({
        typ: "dpop+jwt",
        alg: alg,
        jwk: publicJWK,
      })
      .sign(privateKey);

    return jwt;
  } catch (error) {
    throw new Error(`Failed to generate DPoP proof: ${error}`);
  }
}

/**
 * Make an authenticated request to the PDS using DPoP
 */
export async function makeDPoPRequest(
  session: ATProtoSession,
  method: string,
  path: string,
  body?: any | File,
  customHeaders?: Record<string, string>,
): Promise<Response> {
  const url = `${session.pds_endpoint}${path}`;

  // Parse the DPoP key
  let dpopKey: ParsedDPoPKey;
  try {
    if (typeof session.dpop_jwk === "string") {
      dpopKey = JSON.parse(session.dpop_jwk);
    } else {
      dpopKey = session.dpop_jwk as ParsedDPoPKey;
    }
  } catch (error) {
    throw new Error(`Failed to parse DPoP key: ${error}`);
  }

  // First attempt without nonce
  let dpopProof = await generateDPoPProof(
    method,
    url,
    dpopKey,
    session.access_token,
  );

  const headers: Record<string, string> = {
    "Authorization": `${session.token_type} ${session.access_token}`,
    "DPoP": dpopProof,
    ...customHeaders,
  };

  // Set default Content-Type for JSON if not specified and body is not File
  if (!customHeaders?.["Content-Type"] && !(body instanceof File)) {
    headers["Content-Type"] = "application/json";
  }

  let response = await fetch(url, {
    method,
    headers,
    body: body instanceof File
      ? body
      : (body ? JSON.stringify(body) : undefined),
  });

  // Handle DPoP nonce requirement
  if (response.status === 401) {
    try {
      const errorData = await response.json();
      if (errorData.error === "use_dpop_nonce") {
        // Get nonce from DPoP-Nonce header
        const nonce = response.headers.get("DPoP-Nonce");
        if (nonce) {
          // Retry with nonce
          dpopProof = await generateDPoPProof(
            method,
            url,
            dpopKey,
            session.access_token,
            nonce,
          );

          headers["DPoP"] = dpopProof;

          response = await fetch(url, {
            method,
            headers,
            body: body instanceof File
              ? body
              : (body ? JSON.stringify(body) : undefined),
          });
        }
      }
    } catch (_parseError) {
      // If we can't parse the error, continue with original error handling
    }
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `PDS request failed: ${response.status} ${response.statusText}: ${errorText}`,
    );
  }

  return response;
}

export function createRecord(
  getSession: () => Promise<ATProtoSession>,
  indexService: IndexService,
  cfg: BffConfig,
) {
  return async (
    collection: string,
    data: { [_ in string]: unknown },
    self: boolean = false,
  ) => {
    const session = await getSession();
    const did = session.did;
    const rkey = self ? "self" : TID.nextStr();

    if (!did) {
      throw new Error("Session does not contain valid DID");
    }

    const record = {
      $type: collection,
      ...data,
    };

    assert(cfg.lexicons.assertValidRecord(collection, record));

    const response = await makeDPoPRequest(
      session,
      "POST",
      "/xrpc/com.atproto.repo.createRecord",
      {
        repo: did,
        collection,
        rkey,
        record,
        validate: false,
      },
    );

    const responseData = await response.json();

    const uri = `at://${did}/${collection}/${rkey}`;
    indexService.insertRecord({
      uri,
      cid: responseData.cid.toString(),
      did,
      collection,
      json: stringifyLex(record),
      indexedAt: new Date().toISOString(),
    });
    return uri;
  };
}

export function createRecords(
  getSession: () => Promise<ATProtoSession>,
  indexService: IndexService,
  cfg: BffConfig,
) {
  return async (creates: {
    collection: string;
    rkey?: string;
    data: { [_ in string]: unknown };
  }[]) => {
    const session = await getSession();
    const did = session.did;
    if (!did) throw new Error("Session does not contain valid DID");

    const records = creates.map(({ collection, data }) => ({
      $type: collection,
      ...data,
    }));

    creates = creates.map((c) => ({
      ...c,
      rkey: c.rkey || TID.nextStr(),
    }));

    creates.forEach(({ collection }, i) => {
      assert(cfg.lexicons.assertValidRecord(collection, records[i]));
    });

    const results: string[] = [];

    try {
      const response = await makeDPoPRequest(
        session,
        "POST",
        "/xrpc/com.atproto.repo.applyWrites",
        {
          repo: did,
          validate: false,
          writes: creates.map(({ collection, rkey, data }) => ({
            $type: "com.atproto.repo.applyWrites#create",
            collection,
            rkey,
            value: data,
          })),
        },
      );

      const responseData = await response.json();
      const cidMap = new Map<string, string>();

      for (const result of responseData?.results ?? []) {
        if (result.$type === "com.atproto.repo.applyWrites#createResult") {
          cidMap.set(result.uri, result.cid);
        }
      }

      for (let i = 0; i < creates.length; i++) {
        const { collection, rkey } = creates[i];
        const record = records[i];

        const uri = `at://${did}/${collection}/${rkey}`;

        indexService.insertRecord({
          uri,
          cid: cidMap.get(uri) ?? "",
          did,
          collection,
          json: stringifyLex(record),
          indexedAt: new Date().toISOString(),
        });

        results.push(uri);
      }
    } catch (error) {
      console.error("Error creating records:", error);
      throw new Error("Failed to create records");
    }
    return results;
  };
}

export function updateRecord(
  getSession: () => Promise<ATProtoSession>,
  indexService: IndexService,
  cfg: BffConfig,
) {
  return async (
    collection: string,
    rkey: string,
    data: { [_ in string]: unknown },
  ) => {
    const session = await getSession();
    const did = session.did;

    if (!did) {
      throw new Error("Session does not contain valid DID");
    }

    const record = {
      $type: collection,
      ...data,
    };

    assert(cfg.lexicons.assertValidRecord(collection, record));

    const response = await makeDPoPRequest(
      session,
      "POST",
      "/xrpc/com.atproto.repo.putRecord",
      {
        repo: did,
        collection,
        rkey,
        record,
        validate: false,
      },
    );

    const responseData = await response.json();

    const uri = `at://${did}/${collection}/${rkey}`;
    indexService.updateRecord({
      uri,
      cid: responseData.cid.toString(),
      did,
      collection,
      json: stringifyLex(record),
      indexedAt: new Date().toISOString(),
    });
    return uri;
  };
}

export function updateRecords(
  getSession: () => Promise<ATProtoSession>,
  indexService: IndexService,
  cfg: BffConfig,
) {
  return async (updates: {
    collection: string;
    rkey: string;
    data: { [_ in string]: unknown };
  }[]) => {
    const session = await getSession();
    const did = session.did;
    if (!did) throw new Error("Session does not contain valid DID");

    const records = updates.map(({ collection, data }) => ({
      $type: collection,
      ...data,
    }));

    updates.forEach(({ collection }, i) => {
      assert(cfg.lexicons.assertValidRecord(collection, records[i]));
    });

    const results: string[] = [];

    try {
      const response = await makeDPoPRequest(
        session,
        "POST",
        "/xrpc/com.atproto.repo.applyWrites",
        {
          repo: did,
          validate: false,
          writes: updates.map(({ collection, rkey, data }) => ({
            $type: "com.atproto.repo.applyWrites#update",
            collection,
            rkey,
            value: data,
          })),
        },
      );

      const responseData = await response.json();
      const cidMap = new Map<string, string>();

      for (const result of responseData?.results ?? []) {
        if (result.$type === "com.atproto.repo.applyWrites#updateResult") {
          cidMap.set(result.uri, result.cid);
        }
      }

      for (let i = 0; i < updates.length; i++) {
        const { collection, rkey } = updates[i];
        const record = records[i];

        const uri = `at://${did}/${collection}/${rkey}`;

        indexService.updateRecord({
          uri,
          cid: cidMap.get(uri) ?? "",
          did,
          collection,
          json: stringifyLex(record),
          indexedAt: new Date().toISOString(),
        });

        results.push(uri);
      }
    } catch (error) {
      console.error("Error updating records:", error);
      throw new Error("Failed to update records");
    }
    return results;
  };
}

export function deleteRecord(
  getSession: () => Promise<ATProtoSession>,
  indexService: IndexService,
) {
  return async (uri: string) => {
    const session = await getSession();
    const did = session.did;

    if (!did) {
      throw new Error("Session does not contain valid DID");
    }

    const atUri = new AtUri(uri);
    await makeDPoPRequest(
      session,
      "POST",
      "/xrpc/com.atproto.repo.deleteRecord",
      {
        repo: did,
        collection: atUri.collection,
        rkey: atUri.rkey,
      },
    );

    indexService.deleteRecord(atUri.toString());
  };
}

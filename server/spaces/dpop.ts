// The key grain presents a space credential with (RFC 9449).
//
// A space credential reads a whole space, and its holder presents it to every
// repo host in that space — so the authority binds it to a key rather than
// issuing a bearer token, and each request carries a fresh proof signed by that
// key. A host handed a bearer credential to serve its own repo could otherwise
// replay it against every other host.
//
// The key needs no registration anywhere, so it is generated per process and
// never persisted. A restart invalidates every credential minted against it,
// which costs one round trip to mint another.

let keyPair: CryptoKeyPair | null = null;
let publicJwk: JsonWebKey | null = null;
let thumbprint: string | null = null;

function b64url(bytes: ArrayBuffer | Uint8Array): string {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = "";
  for (const b of view) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlJson(value: unknown): string {
  return b64url(new TextEncoder().encode(JSON.stringify(value)));
}

async function ensureKey(): Promise<{ pair: CryptoKeyPair; jwk: JsonWebKey; jkt: string }> {
  if (keyPair && publicJwk && thumbprint) {
    return { pair: keyPair, jwk: publicJwk, jkt: thumbprint };
  }

  keyPair = (await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, false, [
    "sign",
    "verify",
  ])) as CryptoKeyPair;

  const exported = (await crypto.subtle.exportKey("jwk", keyPair.publicKey)) as JsonWebKey;
  publicJwk = { kty: exported.kty, crv: exported.crv, x: exported.x, y: exported.y };

  // RFC 7638: SHA-256 over the required members, lexicographically ordered,
  // with no whitespace. The member order below is that order for an EC key.
  const canonical = JSON.stringify({
    crv: publicJwk.crv,
    kty: publicJwk.kty,
    x: publicJwk.x,
    y: publicJwk.y,
  });
  thumbprint = b64url(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonical)));

  return { pair: keyPair, jwk: publicJwk, jkt: thumbprint };
}

/** The thumbprint a credential is bound to. Stable for the life of the process. */
export async function dpopJkt(): Promise<string> {
  return (await ensureKey()).jkt;
}

/**
 * A proof covering one request.
 *
 * `ath` binds the proof to the credential it is presented with, and is omitted
 * when asking for a credential — a delegation token is an authorization grant
 * rather than an access token, so there is nothing to hash yet.
 */
export async function dpopProof(method: string, url: string, credential?: string): Promise<string> {
  const { pair, jwk } = await ensureKey();

  // htu is the request URI with query and fragment stripped, per RFC 9449.
  const htu = new URL(url);
  htu.search = "";
  htu.hash = "";

  const header = { typ: "dpop+jwt", alg: "ES256", jwk };
  const payload: Record<string, unknown> = {
    jti: crypto.randomUUID(),
    htm: method.toUpperCase(),
    htu: htu.toString(),
    iat: Math.floor(Date.now() / 1000),
  };
  if (credential) {
    payload.ath = b64url(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(credential)),
    );
  }

  const signingInput = `${b64urlJson(header)}.${b64urlJson(payload)}`;
  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    pair.privateKey,
    new TextEncoder().encode(signingInput),
  );
  return `${signingInput}.${b64url(signature)}`;
}

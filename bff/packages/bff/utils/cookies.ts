export async function signCookie(value: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(value),
  );

  return btoa(String.fromCharCode(...new Uint8Array(signature)));
}

export async function verifyCookie(
  signedValue: string,
  secret: string,
): Promise<boolean> {
  const [value, signature] = signedValue.split("|");
  const expectedSignature = await signCookie(value, secret);
  return signature === expectedSignature;
}

export async function parseCookie(
  signedValue: string,
  secret: string,
): Promise<string | undefined> {
  const [value, _signature] = signedValue.split("|");
  if (await verifyCookie(signedValue, secret)) {
    return atob(value);
  }
  return undefined;
}
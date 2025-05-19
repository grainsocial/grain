export const PUBLIC_URL = Deno.env.get("BFF_PUBLIC_URL") ??
  "http://localhost:8080";
export const GOATCOUNTER_URL = Deno.env.get("GOATCOUNTER_URL");

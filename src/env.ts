export const PUBLIC_URL = Deno.env.get("BFF_PUBLIC_URL") ??
  "http://localhost:8080";
export const GOATCOUNTER_URL = Deno.env.get("GOATCOUNTER_URL");
export const USE_CDN = Deno.env.get("USE_CDN") === "true";
export const PDS_HOST_URL = Deno.env.get("PDS_HOST_URL");

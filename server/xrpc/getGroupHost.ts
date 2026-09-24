import { defineQuery } from "$hatk";
import { provisioningHost } from "../helpers/groupHost.ts";

/** Where this Grain starts groups, for the form that names one. */
export default defineQuery("social.grain.unspecced.getGroupHost", async (ctx) => {
  const host = await provisioningHost().catch(() => undefined);
  return ctx.ok(host ? { url: host.url, handleDomain: host.handleDomain } : {});
});

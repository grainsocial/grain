// Structured data for the home page. The Organization's sameAs is the download
// surface a search engine sees, and the site offers an Android visitor nothing
// else: no banner mechanism exists on that platform other than the in-page one,
// and the app ships on both stores.

import { describe, expect, test } from "vitest";
import { siteJsonLd } from "../app/lib/seo.ts";

describe("siteJsonLd", () => {
  test("the organization lists both app stores", () => {
    const graph = siteJsonLd("https://grain.social")["@graph"] as { "@type": string }[];
    const org = graph.find((node) => node["@type"] === "Organization") as { sameAs: string[] };
    expect(org.sameAs).toContain("https://apps.apple.com/app/id6747730230");
    expect(org.sameAs).toContain("https://play.google.com/store/apps/details?id=social.grain");
  });
});

import { expect, test } from "vitest";
import { readdirSync } from "node:fs";
import { resolve } from "node:path";
import csae from "../server/labels/csae";
import { HIDE_LABELS } from "../server/labels/_hidden";

test("csae is published as a Child Safety report category", () => {
  expect(csae.definition.identifier).toBe("csae");
  expect(csae.definition.locales?.[0].name).toBe("Child Safety");
  expect(csae.definition.defaultSetting).toBe("hide");
  expect(HIDE_LABELS.has("csae")).toBe(true);
});

test("csae is not the first definition, so it is never the pre-selected reason", () => {
  // Mirrors hatk's loader: server/labels/*.{ts,js}, no leading underscore, sorted.
  const files = readdirSync(resolve(process.cwd(), "server/labels"))
    .filter((f) => (f.endsWith(".ts") || f.endsWith(".js")) && !f.startsWith("_"))
    .sort();
  console.log("ORDER:", files.join(", "));
  expect(files[0]).not.toBe("csae.ts");
  expect(files).toContain("csae.ts");
});

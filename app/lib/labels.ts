import type { LabelDefinition } from "$hatk/client";
import { callXrpc } from "$hatk/client";

/** Shared TanStack query options for label definitions — cached indefinitely. */
export const labelDefsQuery = () => ({
  queryKey: ["describeLabels"] as const,
  queryFn: async () => {
    const res = await callXrpc("dev.hatk.describeLabels");
    return (res.definitions ?? []) as LabelDefinition[];
  },
  staleTime: Infinity,
});

/** Fallback behaviors for well-known atproto labels not defined on the server. */
const ATPROTO_FALLBACKS: Record<string, { blurs: string; defaultSetting: string; name: string }> = {
  porn: { blurs: "media", defaultSetting: "warn", name: "Adult Content" },
  nsfl: { blurs: "media", defaultSetting: "hide", name: "NSFL" },
  "dmca-violation": { blurs: "content", defaultSetting: "hide", name: "DMCA Violation" },
  doxxing: { blurs: "content", defaultSetting: "hide", name: "Doxxing" },
  "!hide": { blurs: "content", defaultSetting: "hide", name: "Hidden" },
  "!warn": { blurs: "content", defaultSetting: "warn", name: "Warning" },
};

export type LabelAction = "hide" | "warn-content" | "warn-media" | "badge" | "none";

function displayName(def: LabelDefinition): string {
  return def.locales?.[0]?.name ?? def.identifier;
}

function toAction(blurs: string, defaultSetting: string): LabelAction {
  if (defaultSetting === "hide") {
    return blurs === "none" ? "warn-content" : "hide";
  }
  if (defaultSetting === "warn") {
    return blurs === "media" ? "warn-media" : blurs === "content" ? "warn-content" : "badge";
  }
  return "badge";
}

function actionSeverity(action: LabelAction): number {
  switch (action) {
    case "hide":
      return 4;
    case "warn-content":
      return 3;
    case "warn-media":
      return 2;
    case "badge":
      return 1;
    case "none":
      return 0;
  }
}

/**
 * Given record labels and the server's label definitions, returns the most
 * restrictive moderation action. Falls back to well-known atproto labels
 * for any identifier not in the definitions list.
 */
export function resolveLabels(
  labels: Array<{ val: string; neg?: boolean }> | undefined,
  definitions: LabelDefinition[],
): {
  action: LabelAction;
  label: string;
  name: string;
} {
  if (!labels?.length) return { action: "none", label: "", name: "" };

  const defMap = new Map(definitions.map((d) => [d.identifier, d]));
  const active = labels.filter((l) => !l.neg);

  let worst: { action: LabelAction; label: string; name: string } = {
    action: "none",
    label: "",
    name: "",
  };

  for (const l of active) {
    const def = defMap.get(l.val);
    const fallback = ATPROTO_FALLBACKS[l.val];
    const blurs = def?.blurs ?? fallback?.blurs;
    const setting = def?.defaultSetting ?? fallback?.defaultSetting;
    if (!blurs || !setting) continue;

    const action = toAction(blurs, setting);
    const name = def ? displayName(def) : (fallback?.name ?? l.val);

    if (actionSeverity(action) > actionSeverity(worst.action)) {
      worst = { action, label: l.val, name };
    }
  }

  return worst;
}

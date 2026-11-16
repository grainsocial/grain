import type { LabelValueDefinition } from "$lib/lexicons/com/atproto/label/defs.ts";

type LabelDefinition = LabelValueDefinition;

function label(
  identifier: string,
  severity: string,
  blurs: string,
  defaultSetting: string,
  name: string,
  description: string,
): LabelDefinition {
  return {
    identifier,
    severity,
    blurs,
    defaultSetting,
    locales: [{ lang: "en", name, description }],
  };
}

/**
 * The labels grain gives out, as grain-serve defines them
 * (`grain::labels::DEFINITIONS`), in its order: the reasons a report names and
 * the warnings a post carries. grain-serve publishes them only to its admins.
 */
export const LABEL_DEFINITIONS: LabelDefinition[] = [
  label(
    "copyright",
    "alert",
    "content",
    "hide",
    "Copyright Violation",
    "Content that infringes on copyright or intellectual property.",
  ),
  label(
    "csae",
    "alert",
    "content",
    "hide",
    "Child Safety",
    "Sexual content involving a minor, or the exploitation, grooming or endangerment of a child.",
  ),
  label("gore", "alert", "media", "hide", "Graphic Media", "Graphic or violent imagery."),
  label(
    "harassment",
    "alert",
    "none",
    "warn",
    "Harassment",
    "Targeted harassment, bullying, or hate speech.",
  ),
  label(
    "misleading",
    "inform",
    "none",
    "warn",
    "Misleading",
    "Impersonation, misinformation, or deceptive content.",
  ),
  label("nudity", "inform", "media", "warn", "Nudity", "Content containing nudity."),
  label(
    "other",
    "none",
    "none",
    "ignore",
    "Other",
    "Content that does not fit other report categories.",
  ),
  label(
    "sexual",
    "inform",
    "media",
    "warn",
    "Sexual Content",
    "Unwanted or mislabeled sexual content.",
  ),
  label("spam", "inform", "content", "hide", "Spam", "Unwanted or repetitive promotional content."),
];

/**
 * The `reasonType` a report for each label names, the one grain-serve files
 * under that label (`grain::labels::label_for`): atproto's where it has one,
 * Ozone's for graphic media and child safety, grain's own for the rest.
 */
export const REPORT_REASONS: Record<string, string> = {
  copyright: "social.grain.moderation.defs#reasonCopyright",
  csae: "tools.ozone.report.defs#reasonChildSafetyOther",
  gore: "tools.ozone.report.defs#reasonViolenceGraphicContent",
  harassment: "com.atproto.moderation.defs#reasonRude",
  misleading: "com.atproto.moderation.defs#reasonMisleading",
  nudity: "social.grain.moderation.defs#reasonNudity",
  other: "com.atproto.moderation.defs#reasonOther",
  sexual: "com.atproto.moderation.defs#reasonSexual",
  spam: "com.atproto.moderation.defs#reasonSpam",
};

/** Shared TanStack query options for label definitions, cached indefinitely. */
export const labelDefsQuery = () => ({
  queryKey: ["labelDefinitions"] as const,
  queryFn: async () => LABEL_DEFINITIONS,
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

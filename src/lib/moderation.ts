import {
  Label,
  LabelValueDefinition,
} from "$lexicon/types/com/atproto/label/defs.ts";
import { AtUri } from "@atproto/syntax";
import { BffContext } from "@bigmoves/bff";
import { State } from "../state.ts";

export type ModerationDecsion = {
  name: string;
  description: string;
  labeledBy: string;
  blurs: string;
  isMe: boolean;
  src: string;
  val: string;
};

export async function moderateGallery(labels: Label[], ctx: BffContext<State>) {
  const did = ctx.currentUser?.did;
  const labelDefinitions = await ctx.getLabelerDefinitions();

  for (const label of labels ?? []) {
    const labelSubject = new AtUri(label.uri).hostname;
    const labelerAtpData = await ctx.didResolver.resolveAtprotoData(label.src);
    // Try labelDefinitions first, then fallback to atprotoLabelValueDefinitions
    let defs = labelDefinitions[label.src]?.labelValueDefinitions?.filter((
      def,
    ) => def.identifier === label.val);
    if (
      (!defs || defs.length === 0) && atprotoLabelValueDefinitions[label.val]
    ) {
      defs = [atprotoLabelValueDefinitions[label.val]];
    }
    if (defs && defs.length > 0) {
      const enLocale = defs[0].locales?.find((locale) => locale.lang === "en");
      if (enLocale) {
        return {
          name: enLocale.name,
          description: enLocale.description,
          labeledBy: labelerAtpData.handle ?? label.src,
          blurs: defs[0].blurs ?? "",
          isMe: labelSubject === did,
          src: label.src,
          val: label.val,
        };
      }
    }
  }
  return undefined;
}

export async function isLabeler(did: string, ctx: BffContext<State>) {
  const labelDefinitions = await ctx.getLabelerDefinitions();
  return Object.keys(labelDefinitions).includes(did);
}

export const atprotoLabelValueDefinitions: Record<
  string,
  LabelValueDefinition
> = {
  porn: {
    blurs: "media",
    severity: "high",
    identifier: "porn",
    adultOnly: true,
    defaultSetting: "hide",
    locales: [
      {
        lang: "en",
        name: "Adult Content",
        description: "Explicit sexual images.",
      },
    ],
  },
  sexual: {
    blurs: "media",
    severity: "high",
    identifier: "porn",
    adultOnly: true,
    defaultSetting: "hide",
    locales: [
      {
        lang: "en",
        name: "Sexually Suggestive",
        description: "Does not include nudity.",
      },
    ],
  },
  nudity: {
    blurs: "media",
    severity: "high",
    identifier: "porn",
    adultOnly: true,
    defaultSetting: "hide",
    locales: [
      {
        lang: "en",
        name: "Non-sexual Nudity",
        description: "E.g. artistic nudes.",
      },
    ],
  },
};

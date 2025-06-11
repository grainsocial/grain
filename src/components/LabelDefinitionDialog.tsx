import { LabelValueDefinition } from "$lexicon/types/com/atproto/label/defs.ts";
import { Dialog } from "@bigmoves/bff/components";
import { profileLink } from "../utils.ts";

export function LabelDefinitionDialog({
  labelValueDefinition,
  labelByHandle,
}: Readonly<{
  labelValueDefinition: LabelValueDefinition;
  labelByHandle: string;
}>) {
  const enLocale = labelValueDefinition.locales?.find(
    (locale) => locale.lang === "en",
  );
  return (
    <Dialog id="mod-decision-dialog" class="z-100">
      <Dialog.Content class="dark:bg-zinc-950 relative gap-2">
        <Dialog.X class="fill-zinc-950 dark:fill-zinc-50" />
        <Dialog.Title>{enLocale?.name}</Dialog.Title>
        <p>{enLocale?.description}</p>
        <p>
          Source:{" "}
          <a
            href={profileLink(labelByHandle)}
            class="text-sky-500 hover:underline"
          >
            @{labelByHandle}
          </a>
        </p>
      </Dialog.Content>
    </Dialog>
  );
}

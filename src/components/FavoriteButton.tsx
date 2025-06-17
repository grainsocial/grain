import { Record as Favorite } from "$lexicon/types/social/grain/favorite.ts";
import { AtUri } from "@atproto/syntax";
import { WithBffMeta } from "@bigmoves/bff";
import { cn } from "@bigmoves/bff/components";
import { Button } from "./Button.tsx";

export function FavoriteButton({
  currentUserDid,
  favs = [],
  galleryUri,
}: Readonly<{
  currentUserDid?: string;
  favs: WithBffMeta<Favorite>[];
  galleryUri: string;
}>) {
  const isCreator = currentUserDid === new AtUri(galleryUri).hostname;
  const favUri = favs.find((s) => currentUserDid === s.did)?.uri;
  return (
    <Button
      variant="primary"
      class={cn(
        "self-start w-full sm:w-fit whitespace-nowrap",
        isCreator &&
          "bg-zinc-100 dark:bg-zinc-800 border-zinc-100 dark:border-zinc-800 text-zinc-950 dark:text-zinc-50",
      )}
      type="button"
      hx-post={`/actions/favorite?galleryUri=${galleryUri}${
        favUri ? "&favUri=" + favUri : ""
      }`}
      hx-target="this"
      hx-swap="outerHTML"
      disabled={isCreator}
    >
      <i
        class={cn("fa-heart", favUri || isCreator ? "fa-solid" : "fa-regular")}
      >
      </i>{" "}
      {favs.length}
    </Button>
  );
}

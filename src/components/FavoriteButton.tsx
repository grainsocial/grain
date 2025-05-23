import { Record as Favorite } from "$lexicon/types/social/grain/favorite.ts";
import { WithBffMeta } from "@bigmoves/bff";
import { Button, cn } from "@bigmoves/bff/components";

export function FavoriteButton({
  currentUserDid,
  favs = [],
  galleryUri,
}: Readonly<{
  currentUserDid?: string;
  favs: WithBffMeta<Favorite>[];
  galleryUri: string;
}>) {
  const favUri = favs.find((s) => currentUserDid === s.did)?.uri;
  return (
    <Button
      variant="primary"
      class="self-start w-full sm:w-fit whitespace-nowrap"
      type="button"
      hx-post={`/actions/favorite?galleryUri=${galleryUri}${
        favUri ? "&favUri=" + favUri : ""
      }`}
      hx-target="this"
      hx-swap="outerHTML"
    >
      <i class={cn("fa-heart", favUri ? "fa-solid" : "fa-regular")}></i>{" "}
      {favs.length}
    </Button>
  );
}

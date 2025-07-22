import { Record as Favorite } from "$lexicon/types/social/grain/favorite.ts";
import { BffContext, WithBffMeta } from "@bigmoves/bff";

export function createFavorite(
  subject: string,
  ctx: BffContext,
): Promise<string> {
  return ctx.createRecord<WithBffMeta<Favorite>>("social.grain.favorite", {
    subject,
    createdAt: new Date().toISOString(),
  });
}

import { ProfileView } from "$lexicon/types/social/grain/actor/defs.ts";
import { Un$Typed } from "$lexicon/util.ts";
import { cn } from "@bigmoves/bff/components";

export function ActorAvatar({
  profile,
  class: classProp,
}: Readonly<{ profile: Un$Typed<ProfileView>; class?: string }>) {
  return (
    <img
      src={profile.avatar}
      alt={profile.handle}
      title={profile.handle}
      class={cn("rounded-full object-cover", classProp)}
    />
  );
}

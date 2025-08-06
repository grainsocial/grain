import { ProfileView } from "$lexicon/types/social/grain/actor/defs.ts";
import { Un$Typed } from "$lexicon/util.ts";
import { cn } from "@bigmoves/bff/components";
import { DefaultLabelerAvatar } from "./DefaultLabelerAvatar.tsx";

export function LabelerAvatar({
  profile,
  size,
  class: classProp,
}: Readonly<
  { profile: Un$Typed<ProfileView>; size?: number; class?: string }
>) {
  return (
    profile.avatar
      ? (
        <img
          src={profile.avatar}
          alt={profile.handle}
          title={profile.handle}
          class={cn("rounded-full object-cover", classProp)}
          style={size ? { width: size, height: size } : undefined}
        />
      )
      : <DefaultLabelerAvatar size={size} class={classProp} />
  );
}

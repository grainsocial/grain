import { ProfileView } from "$lexicon/types/social/grain/actor/defs.ts";
import { Un$Typed } from "$lexicon/util.ts";
import { cn } from "@bigmoves/bff/components";
import { profileLink } from "../utils.ts";
import { ActorAvatar } from "./ActorAvatar.tsx";

export function ActorInfo(
  { class: classProp, profile, avatarSize = 28 }: Readonly<
    { class?: string; profile: Un$Typed<ProfileView>; avatarSize?: number }
  >,
) {
  return (
    <div class={cn("flex items-center gap-2 min-w-0", classProp)}>
      <ActorAvatar profile={profile} size={avatarSize} class="shrink-0" />
      <a
        href={profileLink(profile.handle)}
        class="hover:underline text-zinc-600 dark:text-zinc-500 truncate max-w-[300px] sm:max-w-[400px]"
      >
        <span class="text-zinc-950 dark:text-zinc-50 font-semibold text-">
          {profile.displayName || profile.handle}
        </span>{" "}
        <span class="truncate">@{profile.handle}</span>
      </a>
    </div>
  );
}

import { ProfileView } from "$lexicon/types/social/grain/actor/defs.ts";
import { Un$Typed } from "$lexicon/util.ts";
import { ActorAvatar } from "./ActorAvatar.tsx";

export function AvatarButton({
  profile,
}: Readonly<{ profile: Un$Typed<ProfileView> }>) {
  return (
    profile.avatar
      ? (
        <button
          type="button"
          class="cursor-pointer w-fit"
          hx-get={`/dialogs/avatar/${profile.handle}`}
          hx-trigger="click"
          hx-target="body"
          hx-swap="afterbegin"
        >
          <ActorAvatar
            profile={profile}
            size={64}
          />
        </button>
      )
      : <ActorAvatar profile={profile} size={64} />
  );
}

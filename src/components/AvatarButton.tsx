import { ProfileView } from "$lexicon/types/social/grain/actor/defs.ts";
import { Un$Typed } from "$lexicon/util.ts";

export function AvatarButton({
  profile,
}: Readonly<{ profile: Un$Typed<ProfileView> }>) {
  return (
    <button
      type="button"
      class="cursor-pointer"
      hx-get={`/dialogs/avatar/${profile.handle}`}
      hx-trigger="click"
      hx-target="body"
      hx-swap="afterbegin"
    >
      <img
        src={profile.avatar}
        alt={profile.handle}
        class="rounded-full object-cover size-16"
      />
    </button>
  );
}

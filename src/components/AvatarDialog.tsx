import { ProfileView } from "$lexicon/types/social/grain/actor/defs.ts";
import { Un$Typed } from "$lexicon/util.ts";
import { Dialog } from "@bigmoves/bff/components";
import { ActorAvatar } from "./ActorAvatar.tsx";

export function AvatarDialog({
  profile,
}: Readonly<{ profile: Un$Typed<ProfileView> }>) {
  return (
    <Dialog>
      <Dialog.X />
      <div
        class="w-[400px] h-[400px] flex flex-col p-4 z-10"
        _={Dialog._closeOnClick}
      >
        <ActorAvatar class="w-full h-full" profile={profile} />
      </div>
    </Dialog>
  );
}

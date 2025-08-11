import { ProfileView } from "$lexicon/types/dev/fly/bffbasic/defs.ts";
import { Dialog } from "@bigmoves/bff/components";

type Props = Readonly<{
  profile: ProfileView;
}>;

export function AvatarDialog({ profile }: Props) {
  return (
    <Dialog>
      <Dialog.X />
      <div
        class="w-[400px] h-[400px] flex flex-col p-4 z-10"
        _={Dialog._closeOnClick}
      >
        <img
          src={profile.avatar}
          alt={profile.handle}
          class="rounded-full w-full h-full object-cover"
        />
      </div>
    </Dialog>
  );
}

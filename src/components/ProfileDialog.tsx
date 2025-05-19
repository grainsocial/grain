import { ProfileView } from "$lexicon/types/social/grain/actor/defs.ts";
import { Button, Dialog, Input, Textarea } from "@bigmoves/bff/components";
import { AvatarForm } from "./AvatarForm.tsx";

export function ProfileDialog({
  profile,
}: Readonly<{
  profile: ProfileView;
}>) {
  return (
    <Dialog>
      <Dialog.Content class="dark:bg-zinc-950 relative">
        <Dialog.X class="fill-zinc-950 dark:fill-zinc-50" />
        <Dialog.Title>Edit my profile</Dialog.Title>
        <div>
          <AvatarForm src={profile.avatar} alt={profile.handle} />
        </div>
        <form
          hx-post="/actions/profile/update"
          hx-swap="none"
          _="on htmx:afterOnLoad trigger closeModal"
        >
          <div id="image-input" />
          <div class="mb-4 relative">
            <label htmlFor="displayName">Display Name</label>
            <Input
              type="text"
              required
              id="displayName"
              name="displayName"
              class="dark:bg-zinc-800 dark:text-white"
              value={profile.displayName}
              autoFocus
            />
          </div>
          <div class="mb-4 relative">
            <label htmlFor="description">Description</label>
            <Textarea
              id="description"
              name="description"
              rows={4}
              class="dark:bg-zinc-800 dark:text-white"
            >
              {profile.description}
            </Textarea>
          </div>
          <Button type="submit" variant="primary" class="w-full">
            Update
          </Button>
          <Button
            variant="secondary"
            type="button"
            class="w-full"
            _={Dialog._closeOnClick}
          >
            Cancel
          </Button>
        </form>
      </Dialog.Content>
    </Dialog>
  );
}

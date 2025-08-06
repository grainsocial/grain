import { ProfileView } from "$lexicon/types/social/grain/actor/defs.ts";
import { AvatarInput } from "./AvatarInput.tsx";
import { Button } from "./Button.tsx";
import { Dialog } from "./Dialog.tsx";
import { Input } from "./Input.tsx";
import { Label } from "./Label.tsx";
import { Textarea } from "./Textarea.tsx";

export function ProfileDialog({
  profile,
}: Readonly<{
  profile: ProfileView;
}>) {
  return (
    <Dialog>
      <Dialog.Content>
        <Dialog.X class="fill-zinc-950 dark:fill-zinc-50" />
        <Dialog.Title>Edit my profile</Dialog.Title>
        <form
          id="profile-form"
          hx-encoding="multipart/form-data"
          autocomplete="off"
          _="on submit
              halt the event
              put 'Updating...' into #submit-button.innerText
              add @disabled to #submit-button
              call Grain.profileDialog.updateProfile(me)
          on htmx:afterOnLoad
            put 'Update' into #submit-button.innerText
            remove @disabled from #submit-button
            if event.detail.xhr.status != 200
              alert('Error: ' + event.detail.xhr.responseText)
            else
              trigger closeDialog
            end"
        >
          <AvatarInput profile={profile} />
          <div class="mb-4 relative">
            <Label htmlFor="displayName">Display Name</Label>
            <Input
              type="text"
              id="displayName"
              name="displayName"
              placeholder="e.g. Ansel Lastname"
              value={profile.displayName}
              autoFocus
              autocomplete="off"
            />
          </div>
          <div class="mb-4 relative">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              name="description"
              placeholder="Tell us about yourself"
              rows={4}
              class="dark:bg-zinc-800 dark:text-white"
            >
              {profile.description}
            </Textarea>
          </div>
          <div class="flex flex-col gap-2">
            <Button
              type="submit"
              id="submit-button"
              variant="primary"
              class="w-full"
            >
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
          </div>
        </form>
      </Dialog.Content>
    </Dialog>
  );
}

import { AIP_ROUTES } from "@bigmoves/bff";
import { PDS_HOST_URL } from "../env.ts";
import { Button } from "./Button.tsx";
import { Dialog } from "./Dialog.tsx";

export function CreateAccountDialog({}: Readonly<{}>) {
  return (
    <Dialog id="photo-alt-dialog">
      <Dialog.Content>
        <Dialog.X class="fill-zinc-950 dark:fill-zinc-50" />
        <Dialog.Title>Choose your handle</Dialog.Title>
        <div className="flex flex-col space-y-4 my-10">
          <form hx-post={AIP_ROUTES.signup} hx-swap="none" class="w-full">
            <input
              type="hidden"
              name="pdsHostUrl"
              value="https://bsky.social"
            />
            <Button
              type="submit"
              variant="primary"
              class="w-full"
            >
              user.bsky.social
            </Button>
          </form>
          <form hx-post={AIP_ROUTES.signup} hx-swap="none" class="w-full">
            <input
              type="hidden"
              name="pdsHostUrl"
              value={PDS_HOST_URL}
            />
            <Button
              type="submit"
              variant="primary"
              class="w-full"
            >
              user.grain.social
            </Button>
          </form>
          <p>
            Note: <b>.grain.social</b> handles are currently invite only.
          </p>
        </div>
      </Dialog.Content>
    </Dialog>
  );
}

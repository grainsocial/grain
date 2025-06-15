import { AtUri } from "@atproto/syntax";
import { Dialog } from "@bigmoves/bff/components";

export function AddPhotosDialog() {
  return (
    <Dialog class="z-100">
      <Dialog.Content class="dark:bg-zinc-950 relative gap-4">
        <Dialog.Title>Add photos</Dialog.Title>
        <Dialog.X class="fill-zinc-950 dark:fill-zinc-50" />
        <ul class="divide-y divide-zinc-200 dark:divide-zinc-800 border-t border-b border-zinc-200 dark:border-zinc-800">
          {
            /* <li class="w-full hover:bg-zinc-200 dark:hover:bg-zinc-800">
            <button
              type="button"
              class="flex justify-between items-center text-left w-full px-2 py-4 focus:outline-2 focus:outline-sky-500 focus:outline-offset-[-2px]"
            >
              Add to "Steens"
            </button>
          </li> */
          }
          <li class="w-full hover:bg-zinc-200 dark:hover:bg-zinc-800">
            <button
              type="button"
              class="flex justify-between items-center text-left w-full px-2 py-4 focus:outline-2 focus:outline-sky-500 focus:outline-offset-[-2px]"
            >
              Create a new gallery
            </button>
          </li>
          <li class="w-full hover:bg-zinc-200 dark:hover:bg-zinc-800">
            <button
              type="button"
              class="flex justify-between items-center text-left w-full px-2 py-4 focus:outline-2 focus:outline-sky-500 focus:outline-offset-[-2px]"
            >
              Add to an existing gallery
            </button>
          </li>
          <li class="w-full hover:bg-zinc-200 dark:hover:bg-zinc-800">
            <button
              type="button"
              class="flex justify-between items-center text-left w-full px-2 py-4 focus:outline-2 focus:outline-sky-500 focus:outline-offset-[-2px]"
            >
              Add to "All Photos"
            </button>
          </li>
        </ul>
      </Dialog.Content>
    </Dialog>
  );
}

export function AddPhotosDialogButton(
  { photoUri }: Readonly<{ photoUri: string }>,
) {
  const rkey = new AtUri(photoUri).rkey;
  return (
    <button
      type="button"
      class="bg-zinc-950/50 z-10 absolute top-2 right-2 cursor-pointer size-4 flex items-center justify-center"
      hx-get={`/dialogs/photo/${rkey}/remove`}
      hx-trigger="click"
      hx-target="#layout"
      hx-swap="afterbegin"
      _="on click halt"
    >
      <i class="fas fa-close text-white"></i>
    </button>
  );
}

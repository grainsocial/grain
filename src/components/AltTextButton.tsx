import { AtUri } from "@atproto/syntax";

export function AltTextButton({ photoUri }: Readonly<{ photoUri: string }>) {
  return (
    <button
      type="button"
      class="bg-zinc-950 dark:bg-zinc-950 py-[1px] px-[3px] absolute top-2 left-2 cursor-pointer flex items-center justify-center text-xs text-white font-semibold z-10"
      hx-get={`/dialogs/photo/${new AtUri(photoUri).rkey}/alt`}
      hx-trigger="click"
      hx-target="#layout"
      hx-swap="afterbegin"
      _="on click halt"
    >
      <i class="fas fa-plus text-[10px] mr-1"></i> ALT
    </button>
  );
}

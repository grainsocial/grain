import { AtUri } from "@atproto/syntax";

export function PhotoExifButton({ photoUri }: Readonly<{ photoUri: string }>) {
  return (
    <div
      class="bg-zinc-950/50 dark:bg-zinc-950/50 py-[1px] px-[3px] absolute bottom-2 left-2 cursor-pointer flex items-center justify-center text-xs text-white font-semibold z-10"
      hx-get={`/dialogs/photo/${new AtUri(photoUri).rkey}/exif`}
      hx-trigger="click"
      hx-target="#layout"
      hx-swap="afterbegin"
      _="on click halt"
    >
      <i class="fas fa-camera text-[10px] mr-1"></i> EXIF
    </div>
  );
}

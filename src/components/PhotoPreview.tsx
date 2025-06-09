import { AtUri } from "@atproto/syntax";
import { AltTextButton } from "./AltTextButton.tsx";

export function PhotoPreview({
  src,
  uri,
}: Readonly<{
  src: string;
  uri?: string;
}>) {
  const rkey = uri ? new AtUri(uri).rkey : undefined;
  return (
    <div
      class="relative aspect-square bg-zinc-200 dark:bg-zinc-900"
      id={rkey}
    >
      {uri ? <AltTextButton photoUri={uri} /> : null}
      {uri
        ? (
          <button
            type="button"
            id={`delete-photo-${rkey}`}
            hx-delete={`/actions/photo/${new AtUri(uri).rkey}`}
            class="bg-zinc-950 z-10 absolute top-2 right-2 cursor-pointer size-4 flex items-center justify-center"
            _="on htmx:afterOnLoad remove me.parentNode"
          >
            <i class="fas fa-close text-white"></i>
          </button>
        )
        : null}
      <img
        src={src}
        alt=""
        data-state={uri ? "complete" : "pending"}
        class="absolute inset-0 w-full h-full object-contain data-[state=pending]:opacity-50"
      />
    </div>
  );
}

import { PhotoView } from "$lexicon/types/social/grain/photo/defs.ts";
import { AtUri } from "@atproto/syntax";

export function PhotoSelectButton({
  galleryUri,
  itemUris,
  photo,
}: Readonly<{
  galleryUri: string;
  itemUris: string[];
  photo: PhotoView;
}>) {
  return (
    <button
      hx-put={`/actions/gallery/${new AtUri(galleryUri).rkey}/${
        itemUris.includes(photo.uri) ? "remove-photo" : "add-photo"
      }/${new AtUri(photo.uri).rkey}`}
      hx-swap="outerHTML"
      type="button"
      data-added={itemUris.includes(photo.uri) ? "true" : "false"}
      class="group cursor-pointer relative aspect-square data-[added=true]:ring-2 ring-sky-500 disabled:opacity-50"
      _={`on htmx:beforeRequest add @disabled to me
     then on htmx:afterOnLoad
       remove @disabled from me
       if @data-added == 'true'
         set @data-added to 'false' 
         remove #photo-${new AtUri(photo.uri).rkey}
       else
         set @data-added to 'true'
       end`}
    >
      <div class="hidden group-data-[added=true]:block absolute top-2 right-2 z-30">
        <i class="fa-check fa-solid text-sky-500 z-10" />
      </div>
      <img
        src={photo.fullsize}
        alt={photo.alt}
        class="absolute inset-0 w-full h-full object-contain"
      />
    </button>
  );
}

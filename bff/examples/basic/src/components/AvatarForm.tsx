type Props = Readonly<{ src?: string; alt?: string }>;

export function AvatarForm(
  { src, alt }: Readonly<{ src?: string; alt?: string }>,
) {
  return (
    <form
      id="avatar-file-form"
      hx-post="/actions/avatar/upload-start"
      hx-target="#image-preview"
      hx-swap="innerHTML"
      hx-encoding="multipart/form-data"
      hx-trigger="change from:#file"
    >
      <label htmlFor="file">
        <span class="sr-only">Upload avatar</span>
        <div class="border rounded-full border-zinc-900 w-16 h-16 mx-auto mb-2 relative my-2 cursor-pointer">
          <div class="absolute bottom-0 right-0 bg-zinc-800 rounded-full w-5 h-5 flex items-center justify-center z-10">
            <i class="fa-solid fa-camera text-white text-xs"></i>
          </div>
          <div id="image-preview" class="w-full h-full">
            {src
              ? (
                <img
                  src={src}
                  alt={alt}
                  className="rounded-full w-full h-full object-cover"
                />
              )
              : null}
          </div>
        </div>
        <input
          class="hidden"
          type="file"
          id="file"
          name="file"
          accept="image/*"
        />
      </label>
    </form>
  );
}

import { Record as Profile } from "$lexicon/types/dev/fly/bffbasic/profile.ts";
import { BffContext, RouteHandler } from "@bigmoves/bff";

export const handler: RouteHandler = async (
  req,
  _params,
  ctx: BffContext,
) => {
  const { did, handle } = ctx.requireAuth();
  const formData = await req.formData();
  const displayName = formData.get("displayName") as string;
  const description = formData.get("description") as string;
  const file = formData.get("file") as File | null;

  const record = ctx.indexService.getRecord<Profile>(
    `at://${did}/dev.fly.bffbasic.profile/self`,
  );

  if (!record) {
    return new Response("Profile record not found", { status: 404 });
  }

  if (file) {
    try {
      const bytes = await file.arrayBuffer();
      const uint8Bytes = new Uint8Array(bytes);
      const blobRef = await ctx.uploadBlob(uint8Bytes, "image/jpeg");
      record.avatar = blobRef;
    } catch (e) {
      console.error("Failed to upload avatar:", e);
    }
  }

  try {
    await ctx.updateRecord<Profile>("dev.fly.bffbasic.profile", "self", {
      displayName,
      description,
      avatar: record.avatar,
    });
  } catch (e) {
    console.error("Error updating record:", e);
    const errorMessage = e instanceof Error
      ? e.message
      : "Unknown error occurred";
    return new Response(errorMessage, { status: 400 });
  }

  return ctx.redirect(`/profile/${handle}`);
};

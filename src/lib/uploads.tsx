import { Record as Photo } from "$lexicon/types/social/grain/photo.ts";
import { BffMiddleware, route, RouteHandler } from "@bigmoves/bff";
import { PhotoPreview } from "../components/PhotoPreview.tsx";
import { photoThumb } from "./photo.ts";

function uploadPhoto(): RouteHandler {
  return async (req, _params, ctx) => {
    const { did } = ctx.requireAuth();
    ctx.rateLimit({
      namespace: "upload",
      points: 1,
      limit: 50,
      window: 24 * 60 * 60 * 1000, // 24 hours
    });
    if (!ctx.agent) {
      return new Response("Agent has not been initialized", { status: 401 });
    }
    try {
      const formData = await req.formData();
      const file = formData.get("file") as File;
      const width = Number(formData.get("width")) || undefined;
      const height = Number(formData.get("height")) || undefined;
      if (!file) {
        return new Response("No file", { status: 400 });
      }
      // Check if file size exceeds 20MB limit
      const maxSizeBytes = 20 * 1000 * 1000; // 20MB in bytes
      if (file.size > maxSizeBytes) {
        return new Response("File too large. Maximum size is 20MB", {
          status: 400,
        });
      }
      const blobResponse = await ctx.agent.uploadBlob(file);
      const photoUri = await ctx.createRecord<Photo>("social.grain.photo", {
        photo: blobResponse.data.blob,
        aspectRatio: width && height
          ? {
            width,
            height,
          }
          : undefined,
        alt: "",
        createdAt: new Date().toISOString(),
      });
      return ctx.html(
        <PhotoPreview
          src={photoThumb(did, blobResponse.data.blob.ref.toString())}
          uri={photoUri}
        />,
      );
    } catch (e) {
      console.error("Error in uploadStart:", e);
      return new Response("Internal Server Error", { status: 500 });
    }
  };
}

export function photoUploadRoutes(): BffMiddleware[] {
  return [
    route(
      `/actions/photo/upload`,
      ["POST"],
      uploadPhoto(),
    ),
  ];
}

import { Record as Photo } from "$lexicon/types/social/grain/photo.ts";
import { BffMiddleware, route, RouteHandler } from "@bigmoves/bff";
import { BFFPhotoProcessor } from "@bigmoves/bff-photo-processor";
import { createCanvas, Image } from "@gfx/canvas";
import { VNode } from "preact";
import { PhotoPreview } from "./components/PhotoPreview.tsx";
import { photoThumb } from "./photo.ts";

export const photoProcessor = new BFFPhotoProcessor();

function uploadStart(
  routePrefix: string,
  cb: (params: { uploadId: string; src: string; done?: boolean }) => VNode,
): RouteHandler {
  return async (req, _params, ctx) => {
    ctx.requireAuth();
    ctx.rateLimit({
      namespace: "upload",
      points: 1,
      limit: 50,
      window: 24 * 60 * 60 * 1000, // 24 hours
    });
    try {
      const formData = await req.formData();
      const file = formData.get("file") as File;
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
      const dataUrl = await compressImageForPreview(file);
      if (!ctx.agent) {
        return new Response("No agent", { status: 400 });
      }
      await photoProcessor.initialize(ctx.agent);
      const uploadId = photoProcessor.startUpload(file);
      return ctx.html(
        <div
          id={`upload-id-${uploadId}`}
          hx-trigger="done"
          hx-get={`/actions/${routePrefix}/upload-done?uploadId=${uploadId}`}
          hx-target="this"
          hx-swap="outerHTML"
          class="h-full w-full"
        >
          <div
            hx-get={`/actions/${routePrefix}/upload-check-status?uploadId=${uploadId}`}
            hx-trigger="every 2000ms"
            hx-target="this"
            hx-swap="innerHTML"
            class="h-full w-full"
          >
            {cb({ uploadId, src: dataUrl })}
          </div>
        </div>,
      );
    } catch (e) {
      console.error("Error in uploadStart:", e);
      return new Response("Internal Server Error", { status: 500 });
    }
  };
}

function uploadCheckStatus(): RouteHandler {
  return (req, _params, ctx) => {
    ctx.requireAuth();
    const url = new URL(req.url);
    const searchParams = new URLSearchParams(url.search);
    const uploadId = searchParams.get("uploadId");
    if (!uploadId) return ctx.next();
    try {
      const meta = photoProcessor.getUploadStatus(uploadId);
      return new Response(
        null,
        {
          status: meta?.blobRef ? 200 : 204,
          headers: meta?.blobRef ? { "HX-Trigger": "done" } : {},
        },
      );
    } catch (e) {
      console.error("Error in uploadCheckStatus:", e);
      return new Response("Internal Server Error", { status: 500 });
    }
  };
}

function avatarUploadDone(
  cb: (params: { src: string; uploadId: string }) => VNode,
): RouteHandler {
  return (req, _params, ctx) => {
    const { did } = ctx.requireAuth();
    const url = new URL(req.url);
    const searchParams = new URLSearchParams(url.search);
    const uploadId = searchParams.get("uploadId");
    if (!uploadId) return ctx.next();
    const meta = photoProcessor.getUploadStatus(uploadId);
    if (!meta?.blobRef) return ctx.next();
    return ctx.html(
      cb({ src: photoThumb(did, meta.blobRef.ref.toString()), uploadId }),
    );
  };
}

function photoUploadDone(
  cb: (params: { src: string; uri: string }) => VNode,
): RouteHandler {
  return async (req, _params, ctx) => {
    const { did } = ctx.requireAuth();
    const url = new URL(req.url);
    const searchParams = new URLSearchParams(url.search);
    const uploadId = searchParams.get("uploadId");
    if (!uploadId) return ctx.next();
    try {
      const meta = photoProcessor.getUploadStatus(uploadId);
      if (!meta?.blobRef) return ctx.next();
      const photoUri = await ctx.createRecord<Photo>("social.grain.photo", {
        photo: meta.blobRef,
        aspectRatio: meta.dimensions?.width && meta.dimensions?.height
          ? {
            width: meta.dimensions.width,
            height: meta.dimensions.height,
          }
          : undefined,
        alt: "",
        createdAt: new Date().toISOString(),
      });
      return ctx.html(
        cb({
          src: photoThumb(did, meta.blobRef.ref.toString()),
          uri: photoUri,
        }),
      );
    } catch (e) {
      console.error("Error in photoUploadDone:", e);
      return new Response("Internal Server Error", { status: 500 });
    }
  };
}

export function photoUploadRoutes(): BffMiddleware[] {
  return [
    route(
      `/actions/photo/upload-start`,
      ["POST"],
      uploadStart(
        "photo",
        ({ src }) => <PhotoPreview src={src} />,
      ),
    ),
    route(
      `/actions/photo/upload-check-status`,
      ["GET"],
      uploadCheckStatus(),
    ),
    route(
      `/actions/photo/upload-done`,
      ["GET"],
      photoUploadDone(({ src, uri }) => (
        <PhotoPreview
          src={src}
          uri={uri}
        />
      )),
    ),
  ];
}

export function avatarUploadRoutes(): BffMiddleware[] {
  return [
    route(
      `/actions/avatar/upload-start`,
      ["POST"],
      uploadStart("avatar", ({ src }) => (
        <img
          src={src}
          alt=""
          data-state="pending"
          class="rounded-full w-full h-full object-cover data-[state=pending]:opacity-50"
        />
      )),
    ),
    route(
      `/actions/avatar/upload-check-status`,
      ["GET"],
      uploadCheckStatus(),
    ),
    route(
      `/actions/avatar/upload-done`,
      ["GET"],
      avatarUploadDone(({ src, uploadId }) => (
        <>
          <div hx-swap-oob="innerHTML:#image-input">
            <input type="hidden" name="uploadId" value={uploadId} />
          </div>
          <img
            src={src}
            alt=""
            class="rounded-full w-full h-full object-cover"
          />
        </>
      )),
    ),
  ];
}

function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as string);
    reader.onerror = (e) => reject(e);
    reader.readAsDataURL(file);
  });
}

function createImageFromDataURL(dataURL: string): Promise<Image> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.src = dataURL;
  });
}

async function compressImageForPreview(file: File): Promise<string> {
  const maxWidth = 500,
    maxHeight = 500,
    format = "jpeg";

  // Create an image from the file
  const dataUrl = await readFileAsDataURL(file);
  const img = await createImageFromDataURL(dataUrl);

  // Create a canvas with reduced dimensions
  const canvas = createCanvas(img.width, img.height);
  let width = img.width;
  let height = img.height;

  // Calculate new dimensions while maintaining aspect ratio
  if (width > height) {
    if (width > maxWidth) {
      height = Math.round((height * maxWidth) / width);
      width = maxWidth;
    }
  } else {
    if (height > maxHeight) {
      width = Math.round((width * maxHeight) / height);
      height = maxHeight;
    }
  }

  canvas.width = width;
  canvas.height = height;

  // Draw and compress the image
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Failed to get canvas context");
  }
  ctx.drawImage(img, 0, 0, width, height);

  // Convert to compressed image data URL
  return canvas.toDataURL(format);
}

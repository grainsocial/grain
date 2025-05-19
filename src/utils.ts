import { Record as BskyProfile } from "$lexicon/types/app/bsky/actor/profile.ts";
import { Record as Profile } from "$lexicon/types/social/grain/actor/profile.ts";
import { GalleryView } from "$lexicon/types/social/grain/gallery/defs.ts";
import { PhotoView } from "$lexicon/types/social/grain/photo/defs.ts";
import { AtUri } from "@atproto/syntax";
import { onSignedInArgs } from "@bigmoves/bff";
import { join } from "@std/path/join";
import {
  differenceInDays,
  differenceInHours,
  differenceInMinutes,
  differenceInWeeks,
} from "date-fns";
import { PUBLIC_URL } from "./env.ts";

export function formatRelativeTime(date: Date) {
  const now = new Date();
  const weeks = differenceInWeeks(now, date);
  if (weeks > 0) return `${weeks}w`;

  const days = differenceInDays(now, date);
  if (days > 0) return `${days}d`;

  const hours = differenceInHours(now, date);
  if (hours > 0) return `${hours}h`;

  const minutes = differenceInMinutes(now, date);
  return `${Math.max(1, minutes)}m`;
}

export function profileLink(handle: string) {
  return `/profile/${handle}`;
}

export function galleryLink(handle: string, galleryRkey: string) {
  return `/profile/${handle}/gallery/${galleryRkey}`;
}

export function photoDialogLink(gallery: GalleryView, image: PhotoView) {
  return `/dialogs/image?galleryUri=${gallery.uri}&imageCid=${image.cid}`;
}

export function publicGalleryLink(handle: string, galleryUri: string): string {
  return `${PUBLIC_URL}${galleryLink(handle, new AtUri(galleryUri).rkey)}`;
}

export async function onSignedIn({ actor, ctx }: onSignedInArgs) {
  await ctx.backfillCollections(
    [actor.did],
    [
      ...ctx.cfg.collections!,
      "app.bsky.actor.profile",
      "app.bsky.graph.follow",
    ],
  );

  const profileResults = ctx.indexService.getRecords<Profile>(
    "social.grain.actor.profile",
    {
      where: [{ field: "did", equals: actor.did }],
    },
  );

  const profile = profileResults.items[0];

  if (profile) {
    console.log("Profile already exists");
    return `/profile/${actor.handle}`;
  }

  const bskyProfileResults = ctx.indexService.getRecords<BskyProfile>(
    "app.bsky.actor.profile",
    {
      where: [{ field: "did", equals: actor.did }],
    },
  );

  const bskyProfile = bskyProfileResults.items[0];

  if (!bskyProfile) {
    console.error("Failed to get profile");
    return;
  }

  await ctx.createRecord<Profile>(
    "social.grain.actor.profile",
    {
      displayName: bskyProfile.displayName ?? undefined,
      description: bskyProfile.description ?? undefined,
      avatar: bskyProfile.avatar ?? undefined,
      createdAt: new Date().toISOString(),
    },
    true,
  );

  return "/onboard";
}

export async function generateStaticFilesHash(): Promise<Map<string, string>> {
  const staticFilesHash = new Map<string, string>();

  for (const entry of Deno.readDirSync(join(Deno.cwd(), "static"))) {
    if (
      entry.isFile &&
      (entry.name.endsWith(".js") || entry.name.endsWith(".css"))
    ) {
      const fileContent = await Deno.readFile(
        join(Deno.cwd(), "static", entry.name),
      );
      const hashBuffer = await crypto.subtle.digest("SHA-256", fileContent);
      const hash = Array.from(new Uint8Array(hashBuffer))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      staticFilesHash.set(entry.name, hash);
    }
  }

  return staticFilesHash;
}

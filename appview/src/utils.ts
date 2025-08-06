import { Record as BskyProfile } from "$lexicon/types/app/bsky/actor/profile.ts";
import { Record as Profile } from "$lexicon/types/social/grain/actor/profile.ts";
import { GalleryView } from "$lexicon/types/social/grain/gallery/defs.ts";
import { PhotoView } from "$lexicon/types/social/grain/photo/defs.ts";
import { AtUri } from "@atproto/syntax";
import { onSignedInArgs } from "@bigmoves/bff";
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

export function uploadPageLink(selectedGalleryRkey?: string) {
  return "/upload" +
    (selectedGalleryRkey ? "?gallery=" + selectedGalleryRkey : "");
}

export function profileLink(handleOrDid: string) {
  return `/profile/${handleOrDid}`;
}

export function followersLink(handle: string) {
  return `/profile/${handle}/followers`;
}

export function followingLink(handle: string) {
  return `/profile/${handle}/follows`;
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

export function bskyProfileLink(handle: string) {
  return `https://bsky.app/profile/${handle}`;
}

export async function onSignedIn({ actor, ctx }: onSignedInArgs) {
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

  // This should only happen once for new users
  await ctx.backfillCollections({
    externalCollections: [
      "app.bsky.actor.profile",
      "app.bsky.graph.follow",
      "sh.tangled.actor.profile",
      "sh.tangled.graph.follow",
    ],
    repos: [actor.did],
  });

  const bskyProfileResults = ctx.indexService.getRecords<BskyProfile>(
    "app.bsky.actor.profile",
    {
      where: [{ field: "did", equals: actor.did }],
    },
  );

  const bskyProfile = bskyProfileResults.items[0];

  if (!bskyProfile) {
    console.error("Failed to get bsky profile");
  }

  await ctx.createRecord<Profile>(
    "social.grain.actor.profile",
    {
      displayName: bskyProfile?.displayName ?? undefined,
      description: bskyProfile?.description ?? undefined,
      avatar: bskyProfile?.avatar ?? undefined,
      createdAt: new Date().toISOString(),
    },
    true,
  );

  return "/onboard";
}

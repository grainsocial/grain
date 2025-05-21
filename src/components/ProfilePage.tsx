import { ProfileView } from "$lexicon/types/social/grain/actor/defs.ts";
import { Record as Gallery } from "$lexicon/types/social/grain/gallery.ts";
import { GalleryView } from "$lexicon/types/social/grain/gallery/defs.ts";
import { isPhotoView } from "$lexicon/types/social/grain/photo/defs.ts";
import { Un$Typed } from "$lexicon/util.ts";
import { AtUri } from "@atproto/syntax";
import { Button, cn } from "@bigmoves/bff/components";
import { TimelineItem } from "../timeline.ts";
import { bskyProfileLink, galleryLink, profileLink } from "../utils.ts";
import { AvatarButton } from "./AvatarButton.tsx";
import { FollowButton } from "./FollowButton.tsx";
import { TimelineItem as Item } from "./TimelineItem.tsx";

export function ProfilePage({
  followUri,
  loggedInUserDid,
  timelineItems,
  profile,
  selectedTab,
  galleries,
}: Readonly<{
  followUri?: string;
  loggedInUserDid?: string;
  timelineItems: TimelineItem[];
  profile: Un$Typed<ProfileView>;
  selectedTab?: string;
  galleries?: GalleryView[];
}>) {
  const isCreator = loggedInUserDid === profile.did;
  const displayName = profile.displayName || profile.handle;
  return (
    <div class="px-4 mb-4" id="profile-page">
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between my-4">
        <div class="flex flex-col mb-4">
          <AvatarButton profile={profile} />
          <p class="text-2xl font-bold">{displayName}</p>
          <p class="text-zinc-600 dark:text-zinc-500">@{profile.handle}</p>
          {profile.description
            ? <p class="mt-2 sm:max-w-[600px]">{profile.description}</p>
            : null}
          <p>
            <a
              href={bskyProfileLink(profile.handle)}
              class="text-xs hover:underline"
            >
              <i class="fa-brands fa-bluesky text-sky-500" /> @{profile.handle}
            </a>
          </p>
        </div>
        {!isCreator && loggedInUserDid
          ? (
            <div class="flex self-start gap-2 w-full sm:w-fit flex-col sm:flex-row">
              <FollowButton followeeDid={profile.did} followUri={followUri} />
            </div>
          )
          : null}
        {isCreator
          ? (
            <div class="flex self-start gap-2 w-full sm:w-fit flex-col sm:flex-row">
              <Button variant="primary" class="w-full sm:w-fit" asChild>
                <a href="/upload">
                  <i class="fa-solid fa-upload mr-2" />
                  Upload
                </a>
              </Button>
              <Button
                variant="primary"
                type="button"
                hx-get="/dialogs/profile"
                hx-target="#layout"
                hx-swap="afterbegin"
                class="w-full sm:w-fit"
              >
                Edit Profile
              </Button>
              <Button
                variant="primary"
                type="button"
                class="w-full sm:w-fit"
                hx-get="/dialogs/gallery/new"
                hx-target="#layout"
                hx-swap="afterbegin"
              >
                Create Gallery
              </Button>
            </div>
          )
          : null}
      </div>
      <div class="my-4 space-x-2 w-full flex sm:w-fit" role="tablist">
        <button
          type="button"
          hx-get={profileLink(profile.handle)}
          hx-target="body"
          hx-swap="outerHTML"
          class={cn(
            "flex-1 py-2 px-4 cursor-pointer font-semibold",
            !selectedTab && "bg-zinc-100 dark:bg-zinc-800 font-semibold",
          )}
          role="tab"
          aria-selected="true"
          aria-controls="tab-content"
        >
          Activity
        </button>
        <button
          type="button"
          hx-get={profileLink(profile.handle) + "?tab=galleries"}
          hx-target="#profile-page"
          hx-swap="outerHTML"
          class={cn(
            "flex-1 py-2 px-4 cursor-pointer font-semibold",
            selectedTab === "galleries" && "bg-zinc-100 dark:bg-zinc-800",
          )}
          role="tab"
          aria-selected="false"
          aria-controls="tab-content"
        >
          Galleries
        </button>
      </div>
      <div id="tab-content" role="tabpanel">
        {!selectedTab
          ? (
            <ul class="space-y-4 relative divide-zinc-200 dark:divide-zinc-800 divide-y w-fit">
              {timelineItems.length
                ? (
                  timelineItems.map((item) => (
                    <Item item={item} key={item.itemUri} />
                  ))
                )
                : <li>No activity yet.</li>}
            </ul>
          )
          : null}
        {selectedTab === "galleries"
          ? (
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-4">
              {galleries?.length
                ? (
                  galleries.map((gallery) => (
                    <a
                      href={galleryLink(
                        gallery.creator.handle,
                        new AtUri(gallery.uri).rkey,
                      )}
                      class="cursor-pointer relative aspect-square"
                    >
                      {gallery.items?.length
                        ? (
                          <img
                            src={gallery.items?.filter(isPhotoView)?.[0]
                              ?.fullsize}
                            alt={gallery.items?.filter(isPhotoView)?.[0]?.alt}
                            class="w-full h-full object-cover"
                          />
                        )
                        : (
                          <div class="w-full h-full bg-zinc-200 dark:bg-zinc-900" />
                        )}
                      <div class="absolute bottom-0 left-0 bg-black/80 text-white p-2">
                        {(gallery.record as Gallery).title}
                      </div>
                    </a>
                  ))
                )
                : <p>No galleries yet.</p>}
            </div>
          )
          : null}
      </div>
    </div>
  );
}

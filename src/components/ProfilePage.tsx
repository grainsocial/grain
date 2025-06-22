import { LabelValueDefinition } from "$lexicon/types/com/atproto/label/defs.ts";
import { ProfileView } from "$lexicon/types/social/grain/actor/defs.ts";
import { Record as Gallery } from "$lexicon/types/social/grain/gallery.ts";
import { GalleryView } from "$lexicon/types/social/grain/gallery/defs.ts";
import { isPhotoView } from "$lexicon/types/social/grain/photo/defs.ts";
import { Un$Typed } from "$lexicon/util.ts";
import { Facet } from "@atproto/api";
import { AtUri } from "@atproto/syntax";
import { LabelerPolicies } from "@bigmoves/bff";
import { getGalleryCameras } from "../lib/gallery.ts";
import {
  atprotoLabelValueDefinitions,
  ModerationDecsion,
} from "../lib/moderation.ts";
import type { SocialNetwork } from "../lib/timeline.ts";
import {
  bskyProfileLink,
  followersLink,
  followingLink,
  galleryLink,
  profileLink,
} from "../utils.ts";
import { ActorAvatar } from "./ActorAvatar.tsx";
import { AvatarButton } from "./AvatarButton.tsx";
import { Button } from "./Button.tsx";
import { CameraBadges } from "./CameraBadges.tsx";
import { FollowButton } from "./FollowButton.tsx";
import { LabelDefinitionButton } from "./LabelDefinitionButton.tsx";
import { LabelerAvatar } from "./LabelerAvatar.tsx";
import { RenderFacetedText } from "./RenderFacetedText.tsx";

export type ProfileTabs = "favs" | "galleries" | "labels";

export function ProfilePage({
  followUri,
  followersCount,
  followingCount,
  userProfiles,
  loggedInUserDid,
  profile,
  descriptionFacets,
  selectedTab,
  galleries,
  galleryFavs,
  galleryModDecisionsMap = new Map(),
  isLabeler,
  labelerDefinitions,
}: Readonly<{
  followUri?: string;
  followersCount?: number;
  followingCount?: number;
  userProfiles: SocialNetwork[];
  actorProfiles: SocialNetwork[];
  loggedInUserDid?: string;
  profile: Un$Typed<ProfileView>;
  descriptionFacets?: Facet[];
  selectedTab?: ProfileTabs;
  galleries?: GalleryView[];
  galleryFavs?: GalleryView[];
  galleryModDecisionsMap?: Map<string, ModerationDecsion>;
  isLabeler?: boolean;
  labelerDefinitions?: LabelerPolicies;
}>) {
  const isCreator = loggedInUserDid === profile.did;
  const displayName = profile.displayName || profile.handle;
  const cameras = Array.from(
    new Set(galleries?.flatMap(getGalleryCameras) ?? []),
  );
  return (
    <div class="px-4 mb-4" id="profile-page">
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between my-4">
        <div class="flex flex-col mb-4">
          {isLabeler
            ? <LabelerAvatar profile={profile} size={64} />
            : <AvatarButton profile={profile} />}
          <p class="text-2xl font-bold">{displayName}</p>
          <p class="text-zinc-600 dark:text-zinc-500">@{profile.handle}</p>
          {!isLabeler && (
            <>
              <p class="space-x-1">
                <a href={followersLink(profile.handle)}>
                  <span class="font-semibold" id="followers-count">
                    {followersCount ?? 0}
                  </span>{" "}
                  <span class="text-zinc-600 dark:text-zinc-500">
                    followers
                  </span>
                </a>{" "}
                <a href={followingLink(profile.handle)}>
                  <span class="font-semibold" id="following-count">
                    {followingCount ?? 0}
                  </span>{" "}
                  <span class="text-zinc-600 dark:text-zinc-500">
                    following
                  </span>
                </a>{" "}
                <span class="font-semibold">{galleries?.length ?? 0}</span>
                <span class="text-zinc-600 dark:text-zinc-500">galleries</span>
              </p>
              <CameraBadges cameras={cameras} class="mt-2" />
            </>
          )}
          {profile.description
            ? (
              descriptionFacets
                ? (
                  <p class="mt-2 sm:max-w-[500px]">
                    <RenderFacetedText
                      text={profile.description}
                      facets={descriptionFacets}
                    />
                  </p>
                )
                : (
                  <p class="mt-2 sm:max-w-[500px]">
                    {profile.description}
                  </p>
                )
            )
            : null}
          <p>
            {userProfiles.includes("bluesky") && (
              <a
                href={bskyProfileLink(profile.handle)}
                class="text-xs hover:underline"
              >
                <i class="fa-brands fa-bluesky text-sky-500" />{" "}
                @{profile.handle}
              </a>
            )}
          </p>
        </div>
        {!isCreator && !isLabeler && loggedInUserDid
          ? (
            <div class="flex self-start gap-2 w-full sm:w-fit flex-col sm:flex-row">
              <FollowButton
                followeeDid={profile.did}
                followUri={followUri}
              />
            </div>
          )
          : null}
        {isCreator
          ? (
            <div class="flex self-start gap-2 w-full sm:w-fit flex-col sm:flex-row sm:flex-wrap sm:justify-end">
              <Button
                variant="secondary"
                class="w-full sm:w-fit whitespace-nowrap"
                asChild
              >
                <a href="/upload">
                  <i class="fa-solid fa-upload mr-2" />
                  Photo library
                </a>
              </Button>
              <Button
                variant="secondary"
                type="button"
                hx-get="/dialogs/profile"
                hx-target="#layout"
                hx-swap="afterbegin"
                class="w-full sm:w-fit whitespace-nowrap"
              >
                Edit profile
              </Button>
              <Button
                variant="primary"
                type="button"
                class="w-full sm:w-fit whitespace-nowrap"
                hx-get="/dialogs/gallery/new"
                hx-target="#layout"
                hx-swap="afterbegin"
              >
                Create gallery
              </Button>
            </div>
          )
          : null}
      </div>
      <div
        class="my-4 w-full flex sm:w-fit space-x-2 overflow-x-auto"
        role="tablist"
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        {isLabeler
          ? (
            <Button
              variant="tab"
              name="tab"
              class="flex-1"
              value="favs"
              hx-get={profileLink(profile.handle)}
              hx-target="#profile-page"
              hx-swap="outerHTML"
              role="tab"
              aria-selected={selectedTab === "labels"}
              aria-controls="tab-content"
            >
              Labels
            </Button>
          )
          : (
            <Button
              variant="tab"
              name="tab"
              class="flex-1"
              value="galleries"
              hx-get={profileLink(profile.handle)}
              hx-target="#profile-page"
              hx-swap="outerHTML"
              role="tab"
              aria-selected={selectedTab === "galleries"}
              aria-controls="tab-content"
            >
              Galleries
            </Button>
          )}

        {isCreator && (
          <Button
            variant="tab"
            name="tab"
            class="flex-1"
            value="favs"
            hx-get={profileLink(profile.handle)}
            hx-target="#profile-page"
            hx-swap="outerHTML"
            role="tab"
            aria-selected={selectedTab === "favs"}
            aria-controls="tab-content"
          >
            Favs
          </Button>
        )}
      </div>
      {selectedTab === "labels" && labelerDefinitions
        ? <LabelerPoliciesList defs={labelerDefinitions} />
        : null}
      {selectedTab === "galleries"
        ? (
          <div class="grid grid-cols-3 gap-1 mb-4">
            {galleries?.length
              ? (
                galleries.map((gallery) => (
                  <GalleryItem
                    key={gallery.uri}
                    gallery={gallery}
                    galleryModDecisionsMap={galleryModDecisionsMap}
                  />
                ))
              )
              : <p>No galleries yet.</p>}
          </div>
        )
        : null}
      {selectedTab === "favs"
        ? (
          <div class="grid grid-cols-3 gap-1 mb-4">
            {galleryFavs?.length
              ? (
                galleryFavs.map((gallery) => (
                  <GalleryFavItem
                    key={gallery.uri}
                    gallery={gallery}
                    galleryModDecisionsMap={galleryModDecisionsMap}
                  />
                ))
              )
              : <p>No favs yet.</p>}
          </div>
        )
        : null}
    </div>
  );
}

function LabelerPoliciesList({ defs }: Readonly<{ defs: LabelerPolicies }>) {
  if (!defs?.labelValues?.length) return <p>No labels yet.</p>;
  return (
    <ul class="space-y-4 relative divide-zinc-200 dark:divide-zinc-800 divide-y">
      {defs?.labelValues?.map((val) => {
        let def = defs?.labelValueDefinitions?.find((def) =>
          def.identifier === val
        );
        // Fallback to atproto definitions if not found
        def ??= atprotoLabelValueDefinitions[val];
        if (!def) return null;
        return <LabelValueDefinitionListItem key={def.identifier} def={def} />;
      })}
    </ul>
  );
}

function LabelValueDefinitionListItem({
  def,
}: Readonly<{ def: LabelValueDefinition }>) {
  const enLocale = def.locales.find((v) => v.lang === "en");
  return (
    <li class="flex flex-col pb-4 gap-2">
      <div class="font-semibold">{enLocale?.name}</div>
      <div>{enLocale?.description}</div>
      {def.adultOnly
        ? (
          <div class="flex items-center gap-2 text-sm">
            <i class="fa fa-info-circle" />{" "}
            <span>Adult content is disabled.</span>
          </div>
        )
        : null}
      <div class="text-sm">
        Default setting:{" "}
        <span class="font-semibold">
          {def.defaultSetting || "No default value set"}
        </span>
      </div>
    </li>
  );
}

function GalleryItem({
  gallery,
  galleryModDecisionsMap,
}: Readonly<{
  gallery: GalleryView;
  galleryModDecisionsMap: Map<string, ModerationDecsion>;
}>) {
  const modDecision = galleryModDecisionsMap.get(gallery.uri);
  return (
    <a
      href={galleryLink(
        gallery.creator.handle,
        new AtUri(gallery.uri).rkey,
      )}
      class="cursor-pointer relative aspect-3/4"
    >
      {modDecision && !modDecision.isMe
        ? (
          <div class="w-full h-full bg-zinc-200 dark:bg-zinc-900 p-2 text-sm">
            <i class="fa fa-circle-info text-zinc-500"></i> {modDecision.name}
            <div class="text-sm">
              Labeled by @{modDecision?.labeledBy || "unknown"}.{" "}
              <LabelDefinitionButton
                src={modDecision.src}
                val={modDecision.val}
              />
            </div>
          </div>
        )
        : gallery.items?.length
        ? (
          <img
            src={gallery.items?.filter(isPhotoView)?.[0]?.fullsize}
            alt={gallery.items?.filter(isPhotoView)?.[0]?.alt}
            class="w-full h-full object-cover"
          />
        )
        : <div class="w-full h-full bg-zinc-200 dark:bg-zinc-900" />}
      <div class="absolute sm:flex hidden bottom-0 left-0 bg-black/80 text-white p-2 items-center gap-2">
        {(gallery.record as Gallery).title}
      </div>
    </a>
  );
}

function GalleryFavItem({
  gallery,
  galleryModDecisionsMap,
}: Readonly<{
  gallery: GalleryView;
  galleryModDecisionsMap: Map<string, ModerationDecsion>;
}>) {
  return (
    <a
      href={galleryLink(
        gallery.creator.handle,
        new AtUri(gallery.uri).rkey,
      )}
      class="cursor-pointer relative aspect-3/4"
    >
      {gallery.items?.length
        ? (
          <img
            src={gallery.items?.filter(isPhotoView)?.[0]?.fullsize}
            alt={gallery.items?.filter(isPhotoView)?.[0]?.alt}
            class="w-full h-full object-cover"
          />
        )
        : <div class="w-full h-full bg-zinc-200 dark:bg-zinc-900" />}
      <div class="absolute bottom-0 left-0 bg-black/80 text-white p-2 hidden sm:flex items-center gap-2">
        <ActorAvatar profile={gallery.creator} size={20} />{" "}
        {(gallery.record as Gallery).title}
      </div>
    </a>
  );
}

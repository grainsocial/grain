import { Button, cn } from "@bigmoves/bff/components";
import { FollowMap } from "../lib/follow.ts";
import type { SocialNetwork } from "../lib/timeline.ts";
import { collectionForSource } from "./FollowsDialog.tsx";

export function FollowsButton({
  actorProfiles,
  followeeDid,
  followMap,
}: Readonly<
  {
    actorProfiles: SocialNetwork[];
    followeeDid: string;
    followMap: FollowMap;
  }
>) {
  const followSources = followMap
    ? (Object.keys(followMap) as Array<keyof typeof followMap>).filter(
      (source) => followMap[source] !== undefined,
    )
    : [];
  const isFollowing = followSources.length > 0;
  const totalSources = actorProfiles.length;
  const followingCount =
    actorProfiles.filter((source) =>
      !!followMap[collectionForSource(source) as keyof typeof followMap]
    ).length;
  return (
    <Button
      id="follows-button"
      variant="primary"
      class={cn(
        "w-full sm:w-fit whitespace-nowrap",
        isFollowing &&
          "bg-zinc-100 dark:bg-zinc-800 border-zinc-100 dark:border-zinc-800 text-zinc-950 dark:text-zinc-50",
      )}
      hx-get={`/dialogs/follows/${followeeDid}`}
      hx-trigger="click"
      hx-target="#layout"
      hx-swap="afterbegin"
      {...(isFollowing
        ? {
          children: (
            <>
              Following ({followingCount}/{totalSources})
            </>
          ),
        }
        : {
          children: (
            <>
              <i class="fa-solid fa-plus mr-2" />
              Follow ({followingCount}/{totalSources})
            </>
          ),
        })}
    />
  );
}

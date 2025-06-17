import { AtUri } from "@atproto/syntax";
import { cn } from "@bigmoves/bff/components";
import { Button } from "./Button.tsx";

export function FollowButton({
  followeeDid,
  followUri,
}: Readonly<{ followeeDid: string; load?: boolean; followUri?: string }>) {
  const isFollowing = followUri;
  return (
    <Button
      variant="primary"
      class={cn(
        "w-full sm:w-fit whitespace-nowrap",
        isFollowing &&
          "bg-zinc-100 dark:bg-zinc-800 border-zinc-100 dark:border-zinc-800 text-zinc-950 dark:text-zinc-50",
      )}
      {...(isFollowing
        ? {
          children: "Following",
          "hx-delete": `/actions/follow/${followeeDid}/${
            new AtUri(followUri).rkey
          }`,
        }
        : {
          children: (
            <>
              <i class="fa-solid fa-plus mr-2" />
              Follow
            </>
          ),
          "hx-post": `/actions/follow/${followeeDid}`,
        })}
      hx-trigger="click"
      hx-target="this"
      hx-swap="outerHTML"
    />
  );
}

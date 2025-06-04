import { Dialog } from "@bigmoves/bff/components";
import { type FollowMap } from "../lib/follow.ts";
import type { SocialNetwork } from "../lib/timeline.ts";
import { FollowButton } from "./FollowButton.tsx";

export function FollowsDialog(
  { sources, followeeDid, followMap }: Readonly<
    { sources: SocialNetwork[]; followeeDid: string; followMap: FollowMap }
  >,
) {
  return (
    <Dialog class="z-100" _="on closeDialog call window.location.reload()">
      <Dialog.Content class="dark:bg-zinc-950 relative">
        <Dialog.X />
        <Dialog.Title>Follow</Dialog.Title>
        <ul class="w-full my-4 space-y-2">
          {sources.map((source) => {
            const collection = collectionForSource(source);
            return (
              <li key={source} class="w-full">
                <FollowButton
                  class="sm:w-full"
                  collection={collection}
                  followeeDid={followeeDid}
                  followUri={followMap[collection as keyof FollowMap]}
                />
              </li>
            );
          })}
        </ul>
        <Dialog.Close class="w-full mt-2">
          Close
        </Dialog.Close>
      </Dialog.Content>
    </Dialog>
  );
}

export function collectionForSource(source: SocialNetwork): string {
  switch (source) {
    case "bluesky":
      return "app.bsky.graph.follow";
    case "grain":
      return "social.grain.graph.follow";
    case "tangled":
      return "sh.tangled.graph.follow";
    default:
      return "";
  }
}

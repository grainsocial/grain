import { Button, cn } from "@bigmoves/bff/components";
import type { SocialNetwork } from "../lib/timeline.ts";
import { formatGraphName } from "./Timeline.tsx";

export function FollowButton({
  followeeDid,
  followUri,
  collection,
  class: classProp,
}: Readonly<
  {
    followeeDid: string;
    followUri?: string;
    collection?: string;
    class?: string;
  }
>) {
  const isFollowing = followUri;
  let followPostUrl = `/actions/follow/${followeeDid}`;
  const hideCollectionParam = !collection ? "&hideCollection=true" : "";
  const followDeleteUrl = followUri
    ? `/actions/follow/${followeeDid}?uri=${
      encodeURIComponent(followUri)
    }${hideCollectionParam}`
    : undefined;
  if (collection) {
    followPostUrl += `?collection=${encodeURIComponent(collection)}`;
  } else {
    followPostUrl += `?collection=${
      encodeURIComponent("social.grain.graph.follow")
    }${hideCollectionParam}`;
  }
  const source = formatGraphName(sourceForCollection(collection || ""));

  return (
    <Button
      id="follow-botton"
      variant="primary"
      class={cn(
        "w-full sm:w-fit whitespace-nowrap",
        isFollowing &&
          "bg-zinc-100 dark:bg-zinc-800 border-zinc-100 dark:border-zinc-800 text-zinc-950 dark:text-zinc-50",
        classProp,
      )}
      {...(isFollowing
        ? {
          children: source ? `Following on ${source}` : "Following",
          "hx-delete": followDeleteUrl,
        }
        : {
          children: (
            <>
              <i class="fa-solid fa-plus mr-2" />
              {source ? `Follow on ${source}` : "Follow"}
            </>
          ),
          "hx-post": followPostUrl,
        })}
      hx-trigger="click"
      hx-target="this"
      hx-swap="outerHTML"
    />
  );
}

function sourceForCollection(collection: string): SocialNetwork | "" {
  switch (collection) {
    case "app.bsky.graph.follow":
      return "bluesky";
    case "social.grain.graph.follow":
      return "grain";
    case "sh.tangled.graph.follow":
      return "tangled";
    default:
      return "";
  }
}

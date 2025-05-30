import { cn } from "@bigmoves/bff/components";
import { type TimelineItem } from "../lib/timeline.ts";
import { Header } from "./Header.tsx";
import { TimelineItem as Item } from "./TimelineItem.tsx";

export function Timeline(
  { isLoggedIn, selectedTab, items }: Readonly<
    { isLoggedIn: boolean; selectedTab: string; items: TimelineItem[] }
  >,
) {
  return (
    <div class="px-4 mb-4" id="timeline-page">
      {isLoggedIn
        ? (
          <>
            <div class="my-4 pb-4 border-b border-zinc-200 dark:border-zinc-800">
              <div class="flex sm:w-fit">
                <button
                  type="button"
                  hx-get="/"
                  hx-target="body"
                  hx-swap="outerHTML"
                  class={cn(
                    "flex-1 py-2 px-4 cursor-pointer font-semibold",
                    !selectedTab &&
                      "bg-zinc-100 dark:bg-zinc-800 font-semibold",
                  )}
                  role="tab"
                  aria-selected={!selectedTab}
                  aria-controls="tab-content"
                >
                  Timeline
                </button>
                <button
                  type="button"
                  hx-get="/?tab=following"
                  hx-target="#timeline-page"
                  hx-swap="outerHTML"
                  class={cn(
                    "flex-1 py-2 px-4 cursor-pointer font-semibold",
                    selectedTab === "following" &&
                      "bg-zinc-100 dark:bg-zinc-800 font-semibold",
                  )}
                  role="tab"
                  aria-selected={selectedTab === "following"}
                  aria-controls="tab-content"
                  _="on click js document.title = 'Following — Grain'; end"
                >
                  Following
                </button>
              </div>
            </div>
            <div id="tab-content" role="tabpanel">
              <ul class="space-y-4 relative divide-zinc-200 dark:divide-zinc-800 divide-y w-fit">
                {items.map((item) => <Item item={item} key={item.itemUri} />)}
              </ul>
            </div>
          </>
        )
        : (
          <>
            <div class="my-4">
              <Header>Timeline</Header>
            </div>
            <ul class="space-y-4 relative divide-zinc-200 dark:divide-zinc-800 divide-y w-fit">
              {items.map((item) => <Item item={item} key={item.itemUri} />)}
            </ul>
          </>
        )}
    </div>
  );
}

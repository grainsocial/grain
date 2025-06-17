import { type TimelineItem } from "../lib/timeline.ts";
import { Button } from "./Button.tsx";
import { Header } from "./Header.tsx";
import { TimelineItem as Item } from "./TimelineItem.tsx";

export function Timeline(
  { isLoggedIn, selectedTab, items, actorProfiles, selectedGraph }: Readonly<
    {
      isLoggedIn: boolean;
      selectedTab: string;
      items: TimelineItem[];
      actorProfiles: string[];
      selectedGraph: string;
    }
  >,
) {
  return (
    <div class="px-4 mb-4" id="timeline-page">
      {isLoggedIn
        ? (
          <>
            <div class="my-4 pb-4 border-b border-zinc-200 dark:border-zinc-800">
              <div class="flex sm:w-fit">
                <Button
                  variant="tab"
                  class="flex-1"
                  hx-get={`/?graph=${selectedGraph}`}
                  hx-target="#timeline-page"
                  hx-swap="outerHTML"
                  role="tab"
                  aria-selected={!selectedTab}
                  aria-controls="tab-content"
                >
                  Timeline
                </Button>
                <Button
                  variant="tab"
                  class="flex-1"
                  hx-get={`/?tab=following&graph=${selectedGraph}`}
                  hx-target="#timeline-page"
                  hx-swap="outerHTML"
                  role="tab"
                  aria-selected={selectedTab === "following"}
                  aria-controls="tab-content"
                  _="on click js document.title = 'Following — Grain'; end"
                >
                  Following
                </Button>
              </div>
            </div>
            <div id="tab-content" role="tabpanel">
              {actorProfiles.length > 1 && selectedTab === "following"
                ? (
                  <form
                    hx-get="/"
                    hx-target="#timeline-page"
                    hx-swap="outerHTML"
                    hx-trigger="change from:#graph-filter"
                    class="mb-4 flex flex-col border-b border-zinc-200 dark:border-zinc-800 pb-4"
                  >
                    <label
                      htmlFor="graph-filter"
                      class="mb-1 font-medium sr-only"
                    >
                      Filter by AT Protocol Social Network
                    </label>

                    <input type="hidden" name="tab" value={selectedTab || ""} />

                    <select
                      id="graph-filter"
                      name="graph"
                      class="border rounded px-2 py-1 dark:bg-zinc-900 dark:border-zinc-700 max-w-md"
                    >
                      {actorProfiles.map((graph) => (
                        <option
                          value={graph}
                          key={graph}
                          selected={graph === selectedGraph}
                        >
                          {formatGraphName(graph)}
                        </option>
                      ))}
                    </select>
                  </form>
                )
                : null}
              <ul class="space-y-4 relative divide-zinc-200 dark:divide-zinc-800 divide-y sm:w-fit">
                {items.length > 0
                  ? items.map((item) => <Item item={item} key={item.itemUri} />)
                  : (
                    <li class="text-center">
                      No galleries by people you follow on{" "}
                      {formatGraphName(selectedGraph)} yet.
                    </li>
                  )}
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

export function formatGraphName(graph: string): string {
  return graph.charAt(0).toUpperCase() + graph.slice(1);
}

import { type TimelineItem } from "../timeline.ts";
import { Header } from "./Header.tsx";
import { TimelineItem as Item } from "./TimelineItem.tsx";

export function Timeline({ items }: Readonly<{ items: TimelineItem[] }>) {
  return (
    <div class="px-4 mb-4">
      <div class="my-4">
        <Header>Timeline</Header>
      </div>
      <ul class="space-y-4 relative divide-zinc-200 dark:divide-zinc-800 divide-y w-fit">
        {items.map((item) => <Item item={item} key={item.itemUri} />)}
      </ul>
    </div>
  );
}

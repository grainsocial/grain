import { cn } from "@bigmoves/bff/components";

export function CameraBadges(
  { cameras, class: classProp }: Readonly<
    { cameras: string[]; class?: string }
  >,
) {
  if (cameras.length === 0) return null;
  return (
    <div class={cn("flex gap-1", classProp)} id="camera-badges">
      {cameras.sort().map((camera) => (
        <span class="text-xs font-semibold bg-zinc-100 dark:bg-zinc-800 w-fit px-1">
          📷 {camera}
        </span>
      ))}
    </div>
  );
}

// <span class="text-xs font-semibold bg-zinc-100 dark:bg-zinc-800 w-fit px-1">
//   📷 {cameras.join(", ").replace(/, ([^,]*)$/, " & $1")}
// </span>

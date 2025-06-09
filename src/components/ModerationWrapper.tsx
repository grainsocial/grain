import { ComponentChildren } from "preact";
import { ModerationDecsion } from "../lib/moderation.ts";
import { LabelDefinitionButton } from "./LabelDefinitionButton.tsx";

type ModerationWrapperProps = Readonly<{
  class?: string;
  moderationDecision?: ModerationDecsion;
  children: ComponentChildren;
}>;

export function ModerationWrapper({
  class: classProp,
  moderationDecision,
  children,
}: ModerationWrapperProps) {
  const id = crypto.randomUUID();
  return (
    moderationDecision
      ? (
        moderationDecision.isMe
          ? (
            <div>
              <button
                type="button"
                hx-get={`/dialogs/label/${moderationDecision.src}/${moderationDecision.val}`}
                hx-trigger="click"
                hx-target="#layout"
                hx-swap="afterbegin"
                _="on click halt"
                class="flex items-center gap-2 bg-zinc-200 dark:bg-zinc-800 p-2 text-sm mb-2"
              >
                <i class="fa fa-circle-info text-zinc-500" />
                A label has been placed on this gallery
              </button>
              {children}
            </div>
          )
          : (
            <div
              id={`moderation-wrapper-${id}`}
              data-state="closed"
              class={classProp}
            >
              <div class="bg-zinc-200 dark:bg-zinc-800 p-4 w-full">
                <div class="flex items-center justify-between gap-2 w-full">
                  <div class="flex items-center gap-2">
                    <i class="fa fa-circle-info text-zinc-500"></i>
                    <span class="text-sm">{moderationDecision?.name}</span>
                  </div>
                  <button
                    type="button"
                    class="text-sm font-semibold cursor-pointer"
                    _={`
          on click
            toggle .hidden on #mod-content-${id}
            if my innerText is 'Show'
              put 'Hide' into me
              then put 'open' into @data-state of #moderation-wrapper-${id}
            else
              put 'Show' into me
              then put 'closed' into @data-state of #moderation-wrapper-${id}`}
                  >
                    Show
                  </button>
                </div>
              </div>
              <div class="text-sm my-2">
                Labeled by @{moderationDecision?.labeledBy || "unknown"}.{" "}
                <LabelDefinitionButton
                  src={moderationDecision.src}
                  val={moderationDecision.val}
                />
              </div>
              <div id={`mod-content-${id}`} class="hidden">
                {children}
              </div>
            </div>
          )
      )
      : children
  );
}

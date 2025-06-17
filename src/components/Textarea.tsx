import { cn } from "@bigmoves/bff/components";
import type { JSX } from "preact";

export type TextareaProps = JSX.TextareaHTMLAttributes<HTMLTextAreaElement>;

export function Textarea(props: TextareaProps): JSX.Element {
  const { class: classProp, ...rest } = props;
  const className = cn(
    "grain-input",
    classProp,
  );
  return <textarea class={className} {...rest} />;
}

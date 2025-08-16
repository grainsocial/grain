import type { JSX } from "preact";
import { cn } from "./utils.ts";

export type TextareaProps = JSX.TextareaHTMLAttributes<HTMLTextAreaElement>;

export function Textarea(props: TextareaProps): JSX.Element {
  const { class: classProp, ...rest } = props;
  const className = cn(
    "bff-input",
    classProp,
  );
  return <textarea class={className} {...rest} />;
}

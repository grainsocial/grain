import { cn } from "@bigmoves/bff/components";
import type { JSX } from "preact";

export type LabelProps = JSX.LabelHTMLAttributes<HTMLLabelElement>;

export function Label(props: LabelProps): JSX.Element {
  const { class: classProp, ...rest } = props;
  const className = cn(
    "grain-label",
    classProp,
  );
  return <label class={className} {...rest} />;
}

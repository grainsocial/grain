import { cn } from "@bigmoves/bff/components";
import type { JSX } from "preact";

export type InputProps = JSX.InputHTMLAttributes<HTMLInputElement>;

export function Input(props: InputProps): JSX.Element {
  const { class: classProp, ...rest } = props;
  const className = cn(
    "grain-input",
    classProp,
  );
  return <input class={className} {...rest} />;
}

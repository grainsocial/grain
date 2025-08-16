import type { JSX } from "preact";
import { cn } from "./utils.ts";

export type InputProps = JSX.InputHTMLAttributes<HTMLInputElement>;

export function Input(props: InputProps): JSX.Element {
  const { class: classProp, ...rest } = props;
  const className = cn(
    "bff-input",
    classProp,
  );
  return <input class={className} {...rest} />;
}

import { cloneElement, type JSX } from "preact";
import { cn } from "./utils.ts";

export type ButtonProps =
  & JSX.ButtonHTMLAttributes<HTMLButtonElement>
  & Readonly<{
    variant?: "primary" | "secondary" | "destructive";
    asChild?: boolean;
  }>;

export function Button(props: ButtonProps): JSX.Element {
  const { variant, class: classProp, asChild, children, ...rest } = props;
  const className = cn(
    "bff-btn",
    variant === "primary" && "bff-btn-primary",
    variant === "secondary" && "bff-btn-secondary",
    variant === "destructive" && "bff-btn-destructive",
    classProp,
  );
  if (
    asChild && children && typeof children === "object" && children !== null &&
    "type" in children
  ) {
    return cloneElement(children, {
      ...rest,
      ...children.props,
      class: cn(className, children.props.class),
    });
  }
  return <button class={className} {...rest}>{children}</button>;
}

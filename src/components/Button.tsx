import { cn } from "@bigmoves/bff/components";
import { cloneElement, type JSX } from "preact";

export type ButtonProps =
  & JSX.ButtonHTMLAttributes<HTMLButtonElement>
  & Readonly<{
    variant?: "primary" | "secondary" | "ghost" | "destructive" | "tab";
    asChild?: boolean;
  }>;

export function Button(props: ButtonProps): JSX.Element {
  const { variant, class: classProp, asChild, children, ...rest } = props;
  const className = cn(
    "grain-btn",
    variant === "primary" && "grain-btn-primary",
    variant === "secondary" && "grain-btn-secondary",
    variant === "ghost" && "grain-btn-ghost",
    variant === "destructive" && "grain-btn-destructive",
    variant === "tab" && "grain-btn-tab",
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

import { cn } from "@bigmoves/bff/components";
import { ComponentChildren, JSX } from "preact";

export function Header({
  children,
  class: classProp,
  ...props
}: Readonly<
  JSX.HTMLAttributes<HTMLHeadingElement> & { children: ComponentChildren }
>) {
  return (
    <h1 class={cn("text-xl font-semibold", classProp)} {...props}>
      {children}
    </h1>
  );
}

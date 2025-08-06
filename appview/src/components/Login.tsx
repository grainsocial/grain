import { cn } from "@bigmoves/bff/components";
import type { JSX } from "preact";
import { Button } from "./Button.tsx";
import { Input } from "./Input.tsx";

export type LoginProps =
  & JSX.HTMLAttributes<HTMLFormElement>
  & Readonly<{
    inputPlaceholder?: string;
    submitText?: string;
    infoText?: string;
    error?: string;
    errorClass?: string;
    infoClass?: string;
  }>;

export function Login(
  {
    inputPlaceholder = "Handle (e.g., user.bsky.social)",
    submitText = "Login with Bluesky",
    infoText = "",
    error,
    errorClass,
    infoClass,
    ...rest
  }: LoginProps,
): JSX.Element {
  return (
    <form
      id="login-form"
      hx-post="/oauth/login"
      hx-target="#login-form"
      hx-swap="outerHTML"
      {...rest}
      class={cn(
        "tw:mx-4 tw:sm:mx-0 tw:w-full tw:sm:max-w-[300px] tw:space-y-2",
        rest.class,
      )}
    >
      <div>
        <label htmlFor="handle" class="tw:sr-only">
          Handle
        </label>
        <Input
          id="handle"
          class="bg-white text-zinc-900"
          placeholder={inputPlaceholder}
          name="handle"
        />
      </div>
      <Button
        variant="primary"
        id="submit"
        type="submit"
        class="tw:w-full"
      >
        {submitText}
      </Button>
      {infoText && (
        <div class={cn("tw:text-sm tw:text", infoClass)}>
          {infoText}
        </div>
      )}
      <div className="tw:h-4">
        {error
          ? (
            <div className={cn("tw:text-sm tw:font-mono", errorClass)}>
              {error}
            </div>
          )
          : null}
      </div>
    </form>
  );
}

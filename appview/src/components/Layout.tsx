import { ProfileView } from "$lexicon/types/social/grain/actor/defs.ts";
import { Un$Typed } from "$lexicon/util.ts";
import { cn } from "@bigmoves/bff/components";
import type { FunctionalComponent, JSX } from "preact";
import { ActorAvatar } from "./ActorAvatar.tsx";
import { Button } from "./Button.tsx";

type LayoutProps = JSX.HTMLAttributes<HTMLDivElement> & {
  children: preact.ComponentChildren;
};

type LayoutContentProps = JSX.HTMLAttributes<HTMLDivElement> & {
  children: preact.ComponentChildren;
};

type LayoutNavProps = JSX.HTMLAttributes<HTMLDivElement> & {
  heading: string | preact.VNode;
  profile?: Un$Typed<ProfileView>;
  hasNotifications?: boolean;
};

const Layout: FunctionalComponent<LayoutProps> & {
  Content: FunctionalComponent<LayoutContentProps>;
  Nav: FunctionalComponent<LayoutNavProps>;
} = ({ children, class: classProp, ...props }) => {
  return (
    <div
      class={cn(
        "min-h-screen flex flex-col max-w-5xl mx-auto sm:border-x border-zinc-200 dark:border-zinc-800",
        classProp,
      )}
      {...props}
    >
      {children}
    </div>
  );
};

const LayoutContent: FunctionalComponent<LayoutContentProps> = (
  { children, class: classProp, ...props },
) => {
  return (
    <main
      class={cn(
        "flex-1 sm:pt-14", // pt-14 pushes content below the fixed nav
        classProp,
      )}
      {...props}
    >
      {children}
    </main>
  );
};

const LayoutNav: FunctionalComponent<LayoutNavProps> = (
  {
    heading,
    profile,
    hasNotifications,
    class: classProp,
    ...props
  },
) => {
  return (
    <nav
      class={cn(
        "sm:fixed sm:top-0 sm:left-0 sm:right-0 h-14 z-50 bg-white dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-800",
        classProp,
      )}
      {...props}
    >
      <div class="mx-auto max-w-5xl h-full flex items-center justify-between px-4">
        <div class="flex items-center space-x-4">
          <a href="/">
            {heading}
          </a>
        </div>
        <div class="flex space-x-2">
          {profile
            ? (
              <div class="flex items-center space-x-1 sm:space-x-2">
                <form hx-post="/logout" hx-swap="none" class="inline">
                  <Button type="submit" variant="secondary">Sign out</Button>
                </form>
                <Button
                  asChild
                  variant="ghost"
                >
                  <a href="/explore">
                    <i class="fas fa-search text-zinc-950 dark:text-zinc-50" />
                  </a>
                </Button>
                <Button
                  asChild
                  variant="ghost"
                  class="relative"
                >
                  <a href="/notifications">
                    <i class="fas fa-bell text-zinc-950 dark:text-zinc-50" />
                    {hasNotifications
                      ? (
                        <span class="absolute inline-flex items-center justify-center w-3 h-3 text-xs font-bold text-white bg-sky-500 rounded-full top-1 right-1" />
                      )
                      : null}
                  </a>
                </Button>
                <a href={`/profile/${profile.handle}`}>
                  <ActorAvatar profile={profile} size={32} />
                </a>
              </div>
            )
            : (
              <div class="flex items-center space-x-2">
                <Button
                  variant="secondary"
                  hx-get={`/dialogs/create-account`}
                  hx-trigger="click"
                  hx-target="body"
                  hx-swap="afterbegin"
                >
                  Create account
                </Button>
                <Button variant="primary" asChild>
                  <a href="/login">
                    Sign in
                  </a>
                </Button>
              </div>
            )}
        </div>
      </div>
    </nav>
  );
};

Layout.Content = LayoutContent;
Layout.Nav = LayoutNav;

export { Layout };

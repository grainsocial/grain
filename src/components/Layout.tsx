import { ProfileView } from "$lexicon/types/social/grain/actor/defs.ts";
import { Un$Typed } from "$lexicon/util.ts";
import { Button, cn } from "@bigmoves/bff/components";
import type { FunctionalComponent, JSX } from "preact";
import { ActorAvatar } from "./ActorAvatar.tsx";

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
        "h-full max-w-5xl mx-auto sm:border-x relative",
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
      class={cn("h-[calc(100vh-56px)] sm:overflow-y-auto", classProp)}
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
        "w-full border-b border-zinc-950 flex justify-between items-center px-4 h-14",
        classProp,
      )}
      {...props}
    >
      <div class="flex items-center space-x-4">
        <a href="/">
          {heading}
        </a>
      </div>
      <div class="space-x-2">
        {profile
          ? (
            <div class="flex items-center ts:space-x-1 sm:space-x-2">
              <form hx-post="/logout" hx-swap="none" class="inline">
                <Button type="submit" variant="secondary">Sign out</Button>
              </form>
              <Button
                asChild
                variant="secondary"
                class="relative pl-2"
              >
                <a href="/explore">
                  <i class="fas fa-search text-zinc-950 dark:text-zinc-50" />
                </a>
              </Button>
              <Button
                asChild
                variant="secondary"
                class="relative pl-2"
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
            <div class="flex items-center space-x-4">
              <form hx-post="/signup" hx-swap="none" class="inline">
                <Button variant="secondary" type="submit">
                  Create account
                </Button>
              </form>
              <Button variant="secondary" asChild>
                <a href="/login">
                  Sign in
                </a>
              </Button>
            </div>
          )}
      </div>
    </nav>
  );
};

Layout.Content = LayoutContent;
Layout.Nav = LayoutNav;

export { Layout };

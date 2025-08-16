import type { FunctionalComponent, JSX } from "preact";
import { Button } from "./Button.tsx";
import { cn } from "./utils.ts";

type LayoutProps = JSX.HTMLAttributes<HTMLDivElement> & {
  children: preact.ComponentChildren;
};

type LayoutContentProps = JSX.HTMLAttributes<HTMLDivElement> & {
  children: preact.ComponentChildren;
};

type LayoutNavProps = JSX.HTMLAttributes<HTMLDivElement> & {
  heading: string | preact.VNode;
  profile?: {
    handle: string;
    avatar?: string;
  };
  showSearch?: boolean;
  showNotifications?: boolean;
  hasNotifications?: boolean;
};

const Layout: FunctionalComponent<LayoutProps> & {
  Content: FunctionalComponent<LayoutContentProps>;
  Nav: FunctionalComponent<LayoutNavProps>;
} = ({ children, class: classProp, ...props }) => {
  return (
    <div
      class={cn(
        "tw:h-full tw:max-w-5xl tw:mx-auto tw:sm:border-x tw:relative",
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
      class={cn("tw:h-[calc(100vh-56px)] tw:sm:overflow-y-auto", classProp)}
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
    showNotifications,
    showSearch,
    hasNotifications,
    class: classProp,
    ...props
  },
) => {
  return (
    <nav
      class={cn(
        "tw:w-full tw:border-b tw:border-zinc-950 tw:flex tw:justify-between tw:items-center tw:px-4 tw:h-14",
        classProp,
      )}
      {...props}
    >
      <div class="tw:flex tw:items-center tw:space-x-4">
        <a href="/">
          {heading}
        </a>
      </div>
      <div class="tw:space-x-2">
        {profile
          ? (
            <div class="tw:flex tw:items-center ts:space-x-1 sm:tw:space-x-2">
              <form hx-post="/logout" hx-swap="none" class="inline">
                <Button type="submit" variant="secondary">Sign out</Button>
              </form>
              {showSearch
                ? (
                  <Button
                    asChild
                    variant="secondary"
                    class="tw:relative tw:pl-2"
                  >
                    <a href="/explore">
                      <i class="fas fa-search tw:text-zinc-950 tw:dark:text-zinc-50" />
                    </a>
                  </Button>
                )
                : null}
              {showNotifications
                ? (
                  <Button
                    asChild
                    variant="secondary"
                    class="tw:relative tw:pl-2"
                  >
                    <a href="/notifications">
                      <i class="fas fa-bell tw:text-zinc-950 tw:dark:text-zinc-50" />
                      {hasNotifications
                        ? (
                          <span class="tw:absolute tw:inline-flex tw:items-center tw:justify-center tw:w-3 tw:h-3 tw:text-xs tw:font-bold tw:text-white tw:bg-sky-500 tw:rounded-full tw:top-1 tw:right-1" />
                        )
                        : null}
                    </a>
                  </Button>
                )
                : null}
              <a href={`/profile/${profile.handle}`}>
                <img
                  src={profile.avatar}
                  alt={profile.handle}
                  class="tw:rounded-full tw:h-8 tw:w-8 tw:object-cover"
                />
              </a>
            </div>
          )
          : (
            <div class="tw:flex tw:items-center tw:space-x-4">
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

import { ProfileView } from "$lexicon/types/social/grain/actor/defs.ts";
import { Un$Typed } from "$lexicon/util.ts";
import { BffContext, RouteHandler } from "@bigmoves/bff";
import { ComponentChildren } from "preact";
import { ActorAvatar } from "../components/ActorAvatar.tsx";
import { Input } from "../components/Input.tsx";
import { LabelerAvatar } from "../components/LabelerAvatar.tsx";
import { searchActors } from "../lib/actor.ts";
import { getPageMeta } from "../meta.ts";
import type { State } from "../state.ts";

export const handler: RouteHandler = (
  req,
  _params,
  ctx: BffContext<State>,
) => {
  ctx.requireAuth();
  const url = new URL(req.url);
  const query = url.searchParams.get("q") ?? "";
  ctx.state.meta = [{ title: "Explore — Grain" }, ...getPageMeta("/explore")];
  if (query) {
    const profileViews = searchActors(query, ctx);
    if (req.headers.get("hx-request")) {
      if (profileViews.length === 0) {
        return ctx.html(<p>No results for "{query}"</p>);
      }
      return ctx.html(
        <SearchResults query={query} profileViews={profileViews} />,
      );
    } else {
      return ctx.render(
        <ExplorePage query={query}>
          <SearchResults query={query} profileViews={profileViews} />
        </ExplorePage>,
      );
    }
  }
  if (req.headers.get("hx-request")) {
    return ctx.html(<div />);
  }
  return ctx.render(
    <ExplorePage />,
  );
};

function ExplorePage(
  { query, children }: Readonly<
    { query?: string; children?: ComponentChildren }
  >,
) {
  return (
    <div class="px-4 mb-4 sm:max-w-[500px]">
      <div class="my-4">
        <Input
          name="q"
          placeholder="Search for users"
          hx-get="/explore"
          hx-target="#search-results"
          hx-trigger="input changed delay:500ms, keyup[key=='Enter']"
          hx-swap="innerHTML"
          hx-push-url="true"
          value={query}
          autoFocus
        />
      </div>
      <div id="search-results">
        {children}
      </div>
    </div>
  );
}

function SearchResults(
  { query, profileViews }: Readonly<
    { query: string; profileViews: Un$Typed<ProfileView>[] }
  >,
) {
  return (
    <>
      <p class="my-4">
        Search for "{query}"
      </p>
      <ul class="space-y-2">
        {profileViews.map((profile) => (
          <li key={profile.did}>
            <a class="flex items-center" href={`/profile/${profile.handle}`}>
              {/* @TODO remove hard-coded handler */}
              {profile.handle === "moderation.grain.social"
                ? <LabelerAvatar profile={profile} size={32} class="mr-2" />
                : <ActorAvatar profile={profile} size={32} class="mr-2" />}
              <div class="flex flex-col">
                <div class="font-semibold">
                  {profile.displayName || profile.handle}
                </div>
                <div class="text-sm text-zinc-600 dark:text-zinc-500">
                  @{profile.handle}
                </div>
              </div>
            </a>
          </li>
        ))}
      </ul>
    </>
  );
}

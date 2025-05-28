import { ProfileView } from "$lexicon/types/social/grain/actor/defs.ts";
import { Record as Profile } from "$lexicon/types/social/grain/actor/profile.ts";
import { Un$Typed } from "$lexicon/util.ts";
import { BffContext, RouteHandler, WithBffMeta } from "@bigmoves/bff";
import { Input } from "@bigmoves/bff/components";
import { ComponentChildren } from "preact";
import { profileToView } from "../actor.ts";
import { ActorAvatar } from "../components/ActorAvatar.tsx";
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
    const profileViews = doSearch(query, ctx);
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
          class="dark:bg-zinc-800 dark:text-white border-zinc-100 bg-zinc-100 dark:border-zinc-800"
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
              <ActorAvatar profile={profile} size={32} class="mr-2" />
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

function doSearch(query: string, ctx: BffContext<State>) {
  const actors = ctx.indexService.searchActors(query);

  const { items } = ctx.indexService.getRecords<WithBffMeta<Profile>>(
    "social.grain.actor.profile",
    {
      where: {
        OR: [
          ...(actors.length > 0
            ? [{
              field: "did",
              in: actors.map((actor) => actor.did),
            }]
            : []),
          {
            field: "displayName",
            contains: query,
          },
          {
            field: "did",
            contains: query,
          },
        ],
      },
    },
  );

  const profileMap = new Map<string, WithBffMeta<Profile>>();
  for (const item of items) {
    profileMap.set(item.did, item);
  }

  const actorMap = new Map();
  actors.forEach((actor) => {
    actorMap.set(actor.did, actor);
  });

  const profileViews = [];

  for (const actor of actors) {
    if (profileMap.has(actor.did)) {
      const profile = profileMap.get(actor.did)!;
      profileViews.push(profileToView(profile, actor.handle));
    }
  }

  for (const profile of items) {
    if (!actorMap.has(profile.did)) {
      const handle = ctx.indexService.getActor(profile.did)?.handle;
      if (!handle) continue;
      profileViews.push(profileToView(profile, handle));
    }
  }

  return profileViews;
}

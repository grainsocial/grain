import { BffContext, RouteHandler } from "@bigmoves/bff";
import { getCookies, setCookie } from "@std/http";
import { Timeline } from "../components/Timeline.tsx";
import { getActorProfiles } from "../lib/actor.ts";
import { getTimeline, SocialNetwork } from "../lib/timeline.ts";
import { getPageMeta } from "../meta.ts";
import type { State } from "../state.ts";

export const handler: RouteHandler = async (
  req,
  _params,
  ctx: BffContext<State>,
) => {
  const url = new URL(req.url);
  const tabSearchParam = url.searchParams.get("tab") || "";
  const graphSearchParam = url.searchParams.get("graph") as SocialNetwork ||
    "grain";
  const cookieState = getCookieState(ctx?.currentUser?.did, req.headers);
  const isHxRequest = req.headers.get("hx-request") !== null;
  const render = isHxRequest ? ctx.html : ctx.render;

  let tab;
  let graph: SocialNetwork = "grain";
  let headers: Record<string, string> = {};

  const actorProfiles = getActorProfiles(ctx?.currentUser?.did ?? "", ctx);

  if (!ctx.currentUser) {
    tab = "";
  } else if (!isHxRequest) {
    tab = cookieState.lastSelectedHomeFeed || "";
    graph = cookieState.lastSelectedFollowGraph || "grain";
  } else {
    tab = tabSearchParam || "";
    graph = graphSearchParam;
    headers = setCookieState(url.hostname, {
      did: ctx.currentUser.did,
      lastSelectedHomeFeed: tab,
      lastSelectedFollowGraph: graph,
    });
  }

  if (!graph && actorProfiles.length > 0) {
    graph = actorProfiles[0];
  }

  const items = await getTimeline(
    ctx,
    tab === "following" ? "following" : "timeline",
    graph,
  );

  if (tab === "following") {
    ctx.state.meta = [{ title: "Following — Grain" }, ...getPageMeta("")];
    return render(
      <Timeline
        isLoggedIn={!!ctx.currentUser}
        selectedTab={tab}
        items={items}
        selectedGraph={graph}
        actorProfiles={actorProfiles}
      />,
      headers,
    );
  }

  ctx.state.meta = [{ title: "Timeline — Grain" }, ...getPageMeta("")];

  return render(
    <Timeline
      isLoggedIn={!!ctx.currentUser}
      selectedTab={tab}
      items={items}
      selectedGraph={graph}
      actorProfiles={actorProfiles}
    />,
    headers,
  );
};

type GrainStorageState = {
  did?: string;
  lastSelectedHomeFeed?: string;
  lastSelectedFollowGraph?: SocialNetwork;
};

function setCookieState(
  hostname: string,
  state: GrainStorageState,
) {
  const headers = new Headers();
  setCookie(headers, {
    name: "grain_storage",
    value: btoa(JSON.stringify(state)),
    maxAge: 604800, // 7 days
    sameSite: "Lax",
    domain: hostname,
    path: "/",
    secure: true,
  });
  const headersRecord: Record<string, string> = {};
  headers.forEach((value, name) => {
    headersRecord[name] = value;
  });
  return headersRecord;
}

function getCookieState(
  did: string | undefined,
  headers: Headers,
): GrainStorageState {
  const cookies = getCookies(headers);
  if (!cookies.grain_storage) {
    return createDefaultCookieState(did);
  }
  const grainStorage = atob(cookies.grain_storage);
  if (grainStorage) {
    try {
      const parsed = JSON.parse(grainStorage);
      if (parsed.did && parsed.did !== did) {
        // If the did in the cookie doesn't match the current user, reset the state
        return createDefaultCookieState(did);
      }
      if (!parsed.did && did) {
        return createDefaultCookieState(did);
      }
      return parsed as GrainStorageState;
    } catch {
      return createDefaultCookieState(did);
    }
  }
  return createDefaultCookieState(did);
}

function createDefaultCookieState(
  did: string | undefined,
): GrainStorageState {
  return {
    did,
    lastSelectedHomeFeed: "",
    lastSelectedFollowGraph: "grain",
  };
}

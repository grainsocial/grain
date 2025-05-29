import { BffContext, RouteHandler } from "@bigmoves/bff";
import { getCookies, setCookie } from "@std/http";
import { Timeline } from "../components/Timeline.tsx";
import { getPageMeta } from "../meta.ts";
import type { State } from "../state.ts";
import { getTimeline } from "../timeline.ts";

export const handler: RouteHandler = (
  req,
  _params,
  ctx: BffContext<State>,
) => {
  const url = new URL(req.url);
  const tabSearchParam = url.searchParams.get("tab") || "";
  const cookieState = getCookieState(req.headers);
  let tab;
  let headers: Record<string, string> = {};

  if (!ctx.currentUser) {
    tab = "";
  } else if (!req.headers.get("hx-request")) {
    tab = cookieState.lastSelectedHomeFeed || "";
  } else {
    tab = tabSearchParam || "";
    headers = setCookieState(url.hostname, {
      lastSelectedHomeFeed: tab,
    });
  }

  const items = getTimeline(
    ctx,
    tab === "following" ? "following" : "timeline",
  );

  if (tab === "following") {
    if (!req.headers.get("hx-request")) {
      ctx.state.meta = [{ title: "Following — Grain" }, ...getPageMeta("")];
      return ctx.render(
        <Timeline
          isLoggedIn={!!ctx.currentUser}
          selectedTab={tab}
          items={items}
        />,
        headers,
      );
    }
    return ctx.html(
      <Timeline
        isLoggedIn={!!ctx.currentUser}
        selectedTab={tab}
        items={items}
      />,
      headers,
    );
  }

  ctx.state.meta = [{ title: "Timeline — Grain" }, ...getPageMeta("")];

  return ctx.render(
    <Timeline isLoggedIn={!!ctx.currentUser} selectedTab={tab} items={items} />,
    headers,
  );
};

type GrainStorageState = {
  lastSelectedHomeFeed?: string;
};

const defaultGrainStorageState: GrainStorageState = {
  lastSelectedHomeFeed: undefined,
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
  headers: Headers,
): GrainStorageState {
  const cookies = getCookies(headers);
  if (!cookies.grain_storage) {
    return defaultGrainStorageState;
  }
  const grainStorage = atob(cookies.grain_storage);
  if (grainStorage) {
    try {
      return JSON.parse(grainStorage);
    } catch {
      return defaultGrainStorageState;
    }
  }
  return defaultGrainStorageState;
}

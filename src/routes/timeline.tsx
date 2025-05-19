import { BffContext, RouteHandler } from "@bigmoves/bff";
import { Timeline } from "../components/Timline.tsx";
import { getPageMeta } from "../meta.ts";
import type { State } from "../state.ts";
import { getTimeline } from "../timeline.ts";

export const handler: RouteHandler = (
  _req,
  _params,
  ctx: BffContext<State>,
) => {
  const items = getTimeline(ctx);
  ctx.state.meta = [{ title: "Timeline — Grain" }, ...getPageMeta("")];
  return ctx.render(<Timeline items={items} />);
};

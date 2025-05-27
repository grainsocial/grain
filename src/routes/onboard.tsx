import { BffContext, RouteHandler } from "@bigmoves/bff";
import type { State } from "../state.ts";

export const handler: RouteHandler = (
  _req,
  _params,
  ctx: BffContext<State>,
) => {
  ctx.requireAuth();
  ctx.state.scripts = ["photo_manip.js", "profile_dialog.js"];
  return ctx.render(
    <div
      hx-get="/dialogs/profile"
      hx-trigger="load"
      hx-target="body"
      hx-swap="afterbegin"
    />,
  );
};

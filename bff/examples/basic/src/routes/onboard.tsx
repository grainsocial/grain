import { BffContext, RouteHandler } from "@bigmoves/bff";

export const handler: RouteHandler = (
  _req,
  _params,
  ctx: BffContext,
) => {
  return ctx.render(
    <div
      hx-get="/dialogs/profile"
      hx-trigger="load"
      hx-target="body"
      hx-swap="afterbegin"
    >
    </div>,
  );
};

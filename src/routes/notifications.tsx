import { BffContext, RouteHandler } from "@bigmoves/bff";
import { NotificationsPage } from "../components/NotificationsPage.tsx";
import type { State } from "../state.ts";

export const handler: RouteHandler = (
  _req,
  _params,
  ctx: BffContext<State>,
) => {
  ctx.requireAuth();
  ctx.state.meta = [
    { title: "Notifications — Grain" },
  ];
  return ctx.render(
    <NotificationsPage notifications={ctx.state.notifications ?? []} />,
  );
};

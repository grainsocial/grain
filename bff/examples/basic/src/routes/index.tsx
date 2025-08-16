import { BffContext, RouteHandler } from "@bigmoves/bff";
import { State } from "../app.tsx";
import { HomePage } from "../components/HomePage.tsx";

export const handler: RouteHandler = (
  _req,
  _params,
  ctx: BffContext<State>,
) => {
  return ctx.render(
    <HomePage
      isLoggedIn={!!ctx.currentUser}
      profile={ctx.state.profile}
    />,
  );
};

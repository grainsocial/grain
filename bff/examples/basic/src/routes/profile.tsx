import { BffContext, RouteHandler } from "@bigmoves/bff";
import { ProfilePage } from "../components/ProfilePage.tsx";
import { getActorProfile } from "../utils.ts";

export const handler: RouteHandler = (
  _req,
  params,
  ctx: BffContext,
) => {
  const profile = getActorProfile(
    params.handle,
    ctx,
  );

  if (!profile) return ctx.next();

  return ctx.render(
    <ProfilePage
      isLoggedIn={!!ctx.currentUser}
      profile={profile}
    />,
  );
};

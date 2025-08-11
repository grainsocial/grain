import { BffContext, RouteHandler } from "@bigmoves/bff";
import { AvatarDialog } from "../components/AvatarDialog.tsx";
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

  return ctx.html(
    <AvatarDialog
      profile={profile}
    />,
  );
};

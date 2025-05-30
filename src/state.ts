import { ProfileView } from "$lexicon/types/social/grain/actor/defs.ts";
import { NotificationView } from "$lexicon/types/social/grain/notification/defs.ts";
import { Un$Typed } from "$lexicon/util.ts";
import { BffMiddleware } from "@bigmoves/bff";
import { MetaDescriptor } from "@bigmoves/bff/components";
import { getActorProfile } from "./lib/actor.ts";
import { getNotifications } from "./lib/notifications.ts";

export type State = {
  profile?: ProfileView;
  scripts?: string[];
  meta?: MetaDescriptor[];
  notifications?: Un$Typed<NotificationView>[];
  staticFilesHash?: Map<string, string>;
};

export const appStateMiddleware: BffMiddleware = (req, ctx) => {
  if (ctx.currentUser) {
    const url = new URL(req.url);
    // ignore routes prefixed with actions and dialogs (no need to resolve profile)
    if (
      url.pathname.includes("actions") ||
      (url.pathname.includes("dialogs") &&
        !url.pathname.includes("/dialogs/profile"))
    ) {
      return ctx.next();
    }
    const profile = getActorProfile(ctx.currentUser.did, ctx);
    if (profile) {
      ctx.state.profile = profile;
    }
    const notifications = getNotifications(ctx.currentUser, ctx);
    ctx.state.notifications = notifications;
    return ctx.next();
  }
  return ctx.next();
};

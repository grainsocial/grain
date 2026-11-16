import type { AtIdentifierString } from "@atproto/lex";
import { whoami } from "$lib/auth";
import { query } from "$lib/xrpc";
import type * as getPreferences from "$lib/lexicons/social/grain/actor/getPreferences.ts";
import type * as getProfile from "$lib/lexicons/social/grain/actor/getProfile.ts";
import type { LayoutServerLoad } from "./$types";

export const load: LayoutServerLoad = async ({ fetch }) => {
  const session = await whoami(fetch).catch(() => null);
  const viewer = session?.account ?? null;

  return {
    viewer,
    profile: viewer
      ? query<typeof getProfile.main>(
          "social.grain.actor.getProfile",
          { actor: viewer.did as AtIdentifierString },
          fetch,
        ).catch(() => null)
      : null,
    preferences: viewer
      ? query<typeof getPreferences.main>("social.grain.actor.getPreferences", {}, fetch)
          .then((r) => r.preferences)
          .catch(() => null)
      : null,
  };
};

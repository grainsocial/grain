import { ProfileView } from "$lexicon/types/social/grain/actor/defs.ts";
import { profileLink } from "../utils.ts";
import { ActorAvatar } from "./ActorAvatar.tsx";

export function FollowsList(
  { profiles }: Readonly<{ profiles: ProfileView[] }>,
) {
  return (
    <ul class="space-y-4 relative divide-zinc-200 dark:divide-zinc-800 divide-y">
      {profiles.length === 0
        ? (
          <li>
            Not following anyone yet.
          </li>
        )
        : (
          profiles.map((profile) => (
            <li key={profile.did} class="pb-4">
              <a
                href={profileLink(profile.handle)}
                class="flex items-center"
              >
                <div class="flex flex-col space-y-2">
                  <div class="flex items-center">
                    <ActorAvatar profile={profile} size={32} class="mr-2" />
                    <div class="flex flex-col">
                      <p>{profile.displayName}</p>
                      <p class="text-zinc-600 dark:text-zinc-500">
                        @{profile.handle || profile.displayName}
                      </p>
                    </div>
                  </div>
                  <p>{profile.description}</p>
                </div>
              </a>
            </li>
          ))
        )}
    </ul>
  );
}

import { ProfileView } from "$lexicon/types/dev/fly/bffbasic/defs.ts";
import { Button } from "@bigmoves/bff/components";

type Props = Readonly<{
  isLoggedIn: boolean;
  profile: ProfileView;
}>;

export function ProfilePage(
  { isLoggedIn, profile }: Props,
) {
  return (
    <div>
      <div class="flex flex-col sm:flex-row justify-between items-start p-4">
        <div class="flex flex-col">
          <button
            type="button"
            class="flex flex-row items-center gap-2 cursor-pointer border rounded-full w-fit"
            hx-get={`/dialogs/avatar/${profile.handle}`}
            hx-trigger="click"
            hx-target="body"
            hx-swap="afterbegin"
          >
            <img
              src={profile.avatar}
              alt={profile.handle}
              class="rounded-full object-cover size-16"
            />
          </button>
          <p class="text-2xl font-bold">
            {profile.displayName}
          </p>
          <p class="text-gray-600">@{profile.handle}</p>
          <p class="my-2">{profile.description}</p>
        </div>
        {isLoggedIn
          ? (
            <div class="w-full sm:w-fit flex flex-col sm:flex-row gap-2 pt-2 sm:pt-0">
              <Button
                variant="primary"
                type="button"
                hx-get="/dialogs/profile"
                hx-trigger="click"
                hx-target="body"
                hx-swap="afterbegin"
                class="btn btn-primary w-full sm:w-fit"
              >
                Edit profile
              </Button>
            </div>
          )
          : null}
      </div>
      <div className="p-4 my-4">
        <h2 className="text-xl font-semibold mb-4">Recent Activity</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((item) => (
            <div
              key={item}
              className="border border-gray-200 rounded-lg p-4"
            >
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-4"></div>
              <div className="h-2 bg-gray-200 rounded w-full mb-2"></div>
              <div className="h-2 bg-gray-200 rounded w-5/6 mb-2"></div>
              <div className="h-2 bg-gray-200 rounded w-3/4"></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

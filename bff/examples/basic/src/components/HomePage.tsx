import { ProfileView } from "$lexicon/types/dev/fly/bffbasic/defs.ts";

type Props = Readonly<{ isLoggedIn: boolean; profile?: ProfileView }>;

export function HomePage(
  { isLoggedIn, profile }: Props,
) {
  return (
    <div class="w-full h-full flex flex-col items-center justify-center">
      <form id="signup" hx-post="/signup" hx-swap="none" />
      <h1 class="text-2xl font-bold">Welcome to the Basic BFF Example</h1>
      <p class="text-gray-600">
        You can{" "}
        <button
          form="signup"
          type="submit"
          class="text-sky-600 hover:underline cursor-pointer"
        >
          create an account
        </button>
        {", "}
        <a href="/login" class="text-sky-600 hover:underline">
          sign in
        </a>
        {", and "}
        {isLoggedIn
          ? (
            <a
              href={`/profile/${profile?.handle}`}
              class="text-sky-600 hover:underline"
            >
              edit your profile
            </a>
          )
          : (
            <a
              href="/login"
              class="text-sky-600 hover:underline"
            >
              edit your profile
            </a>
          )}.
      </p>
    </div>
  );
}

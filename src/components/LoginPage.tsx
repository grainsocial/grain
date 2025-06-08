import { Login } from "@bigmoves/bff/components";
import { profileLink } from "../utils.ts";

export function LoginPage({ error }: Readonly<{ error?: string }>) {
  return (
    <div
      id="login"
      class="flex justify-center items-center w-full h-[calc(100vh-56px)] relative"
      style="background-image: url('https://cdn.bsky.app/img/feed_fullsize/plain/did:plc:bcgltzqazw5tb6k2g3ttenbj/bafkreiewhwu3ro5dv7omedphb62db4koa7qtvyzfhiiypg3ru4tvuxkrjy@jpeg'); background-size: cover; background-position: center;"
    >
      <Login
        hx-target="#login"
        error={error}
        errorClass="text-white"
        inputPlaceholder="Enter your handle or pds host"
        submitText="Login"
        infoText="e.g., user.bsky.social, user.grain.social, example.com, https://pds.example.com"
        infoClass="text-white text-sm! bg-zinc-950/70 p-4 font-mono"
      />
      <div class="absolute bottom-2 left-2 right-2 flex flex-col sm:flex-row justify-between items-start sm:items-end text-white text-sm gap-1 sm:gap-0">
        <div class="flex flex-col sm:flex-row">
          <span>
            © 2025 Grain Social. All rights reserved.
          </span>
          <span class="flex flex-row items-center flex-wrap">
            <a
              href="/support/terms"
              class="underline hover:no-underline ml-0 sm:ml-2 mt-1 sm:mt-0"
            >
              Terms
            </a>
            <span class="mx-1">|</span>
            <a
              href="/support/privacy"
              class="underline hover:no-underline ml-0 sm:ml-1 mt-1 sm:mt-0"
            >
              Privacy
            </a>
            <span class="mx-1">|</span>
            <a
              href="/support/copyright"
              class="underline hover:no-underline ml-0 sm:ml-1 mt-1 sm:mt-0"
            >
              Copyright
            </a>
          </span>
        </div>
        <div>
          Photo by{" "}
          <a
            href={profileLink("chadtmiller.com")}
            class="underline hover:no-underline"
          >
            @chadtmiller.com
          </a>
        </div>
      </div>
    </div>
  );
}

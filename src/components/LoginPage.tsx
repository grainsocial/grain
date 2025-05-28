import { Login } from "@bigmoves/bff/components";
import { profileLink } from "../utils.ts";

export function LoginPage({ error }: Readonly<{ error?: string }>) {
  return (
    <div
      id="login"
      class="flex justify-center items-center w-full h-[calc(100vh-56px)] relative"
      style="background-image: url('https://cdn.bsky.app/img/feed_fullsize/plain/did:plc:bcgltzqazw5tb6k2g3ttenbj/bafkreiewhwu3ro5dv7omedphb62db4koa7qtvyzfhiiypg3ru4tvuxkrjy@jpeg'); background-size: cover; background-position: center;"
    >
      <Login hx-target="#login" error={error} errorClass="text-white" />
      <div class="absolute bottom-2 right-2 text-white text-sm">
        Photo by{" "}
        <a
          href={profileLink("chadtmiller.com")}
          class="hover:underline font-semibold"
        >
          @chadtmiller.com
        </a>
      </div>
    </div>
  );
}

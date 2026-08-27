import { sveltekit } from "@sveltejs/kit/vite";
import { hatk } from "@hatk/hatk/vite-plugin";
import { defineConfig } from "vite-plus";

// Point the browser's XRPC calls at a remote appview instead of the local one,
// for looking at UI changes against real data:
//
//   GRAIN_API_PROXY=https://grain.social npm run dev
//
// This has to be a middleware ahead of hatk() in the plugin list, not Vite's
// `server.proxy`: hatk registers its own /xrpc handler and answers first, so
// the built-in proxy never sees the request.
//
// Read-only. You are anonymous against the remote, so only queries (GET) are
// forwarded — procedures fall through to the local appview, since they need a
// session that only exists here. SSR data is local too: SvelteKit resolves
// same-origin server-side fetches in-process, so they never reach this. First
// paint is local, client-side navigation is live.
const apiProxy = process.env.GRAIN_API_PROXY;

function remoteXrpc(target: string) {
  return {
    name: "grain-remote-xrpc",
    configureServer(server: any) {
      server.middlewares.use("/xrpc", async (req: any, res: any, next: any) => {
        if (req.method !== "GET") return next();
        try {
          const upstream = await fetch(`${target}/xrpc${req.url}`, {
            headers: { accept: "application/json" },
          });
          res.statusCode = upstream.status;
          res.setHeader("content-type", upstream.headers.get("content-type") ?? "application/json");
          res.end(Buffer.from(await upstream.arrayBuffer()));
        } catch {
          next();
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [...(apiProxy ? [remoteXrpc(apiProxy)] : []), hatk(), sveltekit()],
  test: {
    include: ["test/**/*.test.ts"],
    exclude: ["test/browser/**"],
  },
  lint: {
    ignorePatterns: ["hatk.generated.ts", "hatk.generated.client.ts"],
  },
  fmt: {
    ignorePatterns: ["hatk.generated.ts", "hatk.generated.client.ts"],
  },
});

import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vite-plus";

// The browser's calls of grain-serve (`/xrpc`, `/oauth`, `/og`, and its DID
// document at `/.well-known/did.json`) go on to it, at GRAIN_SERVE_URL. In
// production the browser asks grain-serve for everything, and grain-serve
// hands this app what it does not answer itself (its --web). To look at the
// web against real data:
//
//   GRAIN_SERVE_URL=https://grain.social npm run dev
//
// which reads as anyone there: logging in and writing take a grain-serve
// whose --public-url is this dev server's.
const grainServe = process.env.GRAIN_SERVE_URL ?? "http://127.0.0.1:2600";
const proxy = Object.fromEntries(
  ["/xrpc", "/oauth", "/og", "/.well-known/did.json"].map((path) => [
    path,
    { target: grainServe, changeOrigin: grainServe.startsWith("https:") },
  ]),
);

export default defineConfig({
  plugins: [sveltekit()],
  server: { port: Number(process.env.PORT ?? 3000), proxy },
  preview: { proxy },
  lint: {
    ignorePatterns: [
      "hatk.generated.ts",
      "hatk.generated.client.ts",
      "web/src/lib/lexicons/**",
      ".lexicons/**",
    ],
  },
  fmt: {
    ignorePatterns: [
      "hatk.generated.ts",
      "hatk.generated.client.ts",
      "web/src/lib/lexicons/**",
      ".lexicons/**",
    ],
  },
});

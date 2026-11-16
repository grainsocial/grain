// The unit tests' config, apart from the web's vite.config.ts: server/'s
// tests import its generated module by the alias its framework's Vite plugin
// gives, which goes, with server/, at cutover. The web's tests, in test/web,
// import web/src/lib by `$lib`, as SvelteKit's plugin has it.
import { sveltekit } from "@sveltejs/kit/vite";
import { hatk } from "@hatk/hatk/vite-plugin";
import { defineConfig } from "vite-plus";

export default defineConfig({
  plugins: [hatk(), sveltekit()],
  test: {
    include: ["test/**/*.test.ts"],
    exclude: ["test/browser/**"],
  },
});

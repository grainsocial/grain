import * as esbuild from "esbuild";

import { denoPlugins } from "@luca/esbuild-deno-loader";

console.log("Bundling js...");

await esbuild.build({
  plugins: [...denoPlugins()],
  entryPoints: ["./src/static/mod.ts"],
  outfile: "./static/app.esm.js",
  bundle: true,
  format: "esm",
  sourcemap: Deno.env.get("DEV") === "true" ? "linked" : false,
  minify: Deno.env.get("DEV") !== "true",
});

const command = new Deno.Command("du", {
  args: ["-h", "./static/app.esm.js"],
  stdout: "piped",
  stderr: "piped",
});
const { code, stdout, stderr } = await command.output();
if (code === 0) {
  console.log(new TextDecoder().decode(stdout));
} else {
  console.error(new TextDecoder().decode(stderr));
}

esbuild.stop();

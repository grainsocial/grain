import * as esbuild from "esbuild";

import { denoPlugins } from "@luca/esbuild-deno-loader";
import { join } from "@std/path";

export async function bundleJs(entryPoint: string, outDir?: string) {
  console.log("Bundling js...");

  await esbuild.build({
    plugins: [...denoPlugins()],
    treeShaking: true,
    entryPoints: [entryPoint],
    outfile: join(outDir ?? "static", "app.esm.js"),
    bundle: true,
    format: "esm",
    sourcemap: Deno.env.get("DEV") === "true" ? "linked" : false,
    minify: Deno.env.get("DEV") !== "true",
  });

  const command = new Deno.Command("du", {
    args: ["-h", join(outDir ?? "static", "app.esm.js")],
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
}

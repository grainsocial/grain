#!/usr/bin/env -S deno run --unstable-sloppy-imports --allow-read --allow-write
import { walk } from "@std/fs";

if (import.meta.main) {
  const args = Deno.args;
  if (args.length !== 1) {
    console.error(
      "Usage: deno run --unstable-sloppy-imports --allow-read --allow-write unslopify.ts <path>",
    );
    Deno.exit(1);
  }
  for await (const dirEntry of walk(args[0], { exts: ["ts"] })) {
    await processFile(dirEntry.path);
  }
}

async function processFile(file: string): Promise<string> {
  try {
    const text = await Deno.readTextFile(file);

    // Handle imports across multiple lines
    const importRegex = /(import|export)[\s\S]*?from\s+['"]([^'"]+)['"]/g;

    const modifiedText = text.replace(
      importRegex,
      (match, _statement, module) => {
        // Only process relative imports that don't already have .ts
        if (module.startsWith(".") && !module.endsWith(".ts")) {
          // Replace the module path, ensuring we remove any .js extension
          const newModule = `${module.replace(/\.js$/, "")}.ts`;
          return match.replace(module, newModule);
        }
        return match;
      },
    );

    await Deno.writeTextFile(file, modifiedText);
    return modifiedText;
  } catch (err) {
    throw err;
  }
}

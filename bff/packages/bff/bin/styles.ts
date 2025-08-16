import { join } from "@std/path/join";

if (import.meta.main) {
  const decoder = new TextDecoder("utf-8");
  const css = Deno.readFileSync(join(Deno.cwd(), "styles/output.css"));
  const outputCss = decoder.decode(css);

  await Deno.writeTextFile(
    join(Deno.cwd(), "./styles.ts"),
    `export const CSS = ${JSON.stringify(outputCss)};`,
  );
  console.log("CSS written to styles.ts");
}

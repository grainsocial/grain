import { join } from "@std/path/join";
import type { BffConfig } from "../types.d.ts";

export async function generateFingerprints(
  cfg: BffConfig,
): Promise<Map<string, string>> {
  const staticFilesHash = new Map<string, string>();

  const buildDirPath = join(Deno.cwd(), cfg.buildDir);
  try {
    await Deno.stat(buildDirPath);
  } catch (_err) {
    await Deno.mkdir(buildDirPath, { recursive: true });
  }

  for (const entry of Deno.readDirSync(join(Deno.cwd(), cfg.buildDir))) {
    if (
      entry.isFile &&
      (entry.name.endsWith(".js") || entry.name.endsWith(".css"))
    ) {
      const fileContent = await Deno.readFile(
        join(Deno.cwd(), cfg.buildDir, entry.name),
      );
      const hashBuffer = await crypto.subtle.digest("SHA-256", fileContent);
      const hash = Array.from(new Uint8Array(hashBuffer))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      staticFilesHash.set(entry.name, hash);
    }
  }

  return staticFilesHash;
}
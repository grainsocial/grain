import { join } from "@std/path/join";
import type { BffConfig } from "../types.d.ts";

export async function getInstanceInfo(
  cfg: BffConfig,
): Promise<{
  primaryInstance: string;
  currentInstance: string;
  currentIsPrimary: boolean;
}> {
  const currentInstance = Deno.hostname();
  let primaryInstance;

  try {
    primaryInstance = await Deno.readTextFile(
      join(cfg.litefsDir, ".primary"),
    );
    primaryInstance = primaryInstance.trim();
  } catch {
    primaryInstance = currentInstance;
  }

  return {
    primaryInstance,
    currentInstance,
    currentIsPrimary: currentInstance === primaryInstance,
  };
}
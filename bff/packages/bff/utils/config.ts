import { Lexicons } from "@atproto/lexicon";
import type { BffConfig, BffOptions } from "../types.d.ts";
import { Root } from "./response.tsx";

export function configureBff(cfg: BffOptions): BffConfig {
  return {
    ...cfg,
    rootDir: Deno.env.get("BFF_ROOT_DIR") ?? Deno.cwd(),
    publicUrl: Deno.env.get("BFF_PUBLIC_URL") ?? "",
    port: Number(Deno.env.get("BFF_PORT")) || 8080,
    litefsDir: Deno.env.get("BFF_LITEFS_DIR") ?? "/litefs",
    databaseUrl: cfg.databaseUrl ?? Deno.env.get("BFF_DATABASE_URL") ??
      ":memory:",
    cookieSecret: Deno.env.get("BFF_COOKIE_SECRET") ??
      "000000000000000000000000000000000",
    privateKey1: Deno.env.get("BFF_PRIVATE_KEY_1"),
    privateKey2: Deno.env.get("BFF_PRIVATE_KEY_2"),
    privateKey3: Deno.env.get("BFF_PRIVATE_KEY_3"),
    plcDirectoryUrl: Deno.env.get("BFF_PLC_DIRECTORY_URL") ??
      "https://plc.directory",
    jetstreamUrl: cfg.jetstreamUrl ?? Deno.env.get("BFF_JETSTREAM_URL"),
    lexicons: cfg.lexicons ?? new Lexicons(),
    oauthScope: cfg.oauthScope ?? "atproto transition:generic",
    middlewares: cfg.middlewares ?? [],
    rootElement: cfg.rootElement ?? Root,
    buildDir: cfg.buildDir ?? "build",

    // OAuth configuration
    aipClientId: Deno.env.get("BFF_AIP_CLIENT_ID") ?? "",
    aipClientSecret: Deno.env.get("BFF_AIP_CLIENT_SECRET") ?? "",
  };
}

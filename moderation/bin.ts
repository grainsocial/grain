import { stringifyLex } from "npm:@atproto/lexicon";
import type { LabelRow } from "./main.ts";
import {
  createConfig,
  createDb,
  createLabel,
  createModService,
  ModService,
} from "./main.ts";

async function handleCreate(
  args: string[],
  cfg: Awaited<ReturnType<typeof createConfig>>,
  modService: ModService,
) {
  const [src, uri, val, negArg] = args;
  if (!src || !uri || !val) {
    console.error("Usage: deno run -A bin.ts create <src> <uri> <val> [neg]");
    Deno.exit(1);
  }
  const neg = negArg === "true" || negArg === "1";
  const doCreateLabel = createLabel(cfg, modService);
  await doCreateLabel({
    src,
    uri,
    val,
    neg,
    cts: new Date().toISOString(),
  });
  console.log(
    `Label created for src: ${src}, uri: ${uri}, val: ${val}, neg: ${neg}`,
  );
}

function parseQueryArgs(args: string[]) {
  let src = "";
  let val = "";
  let limit = 50;
  let cursor = 0;
  const patterns: string[] = [];
  let i = 0;
  while (i < args.length) {
    if (args[i] === "--src" && args[i + 1]) {
      src = args[i + 1];
      i += 2;
      continue;
    }
    if (args[i] === "--val" && args[i + 1]) {
      val = args[i + 1];
      i += 2;
      continue;
    }
    if (args[i] === "--limit" && args[i + 1]) {
      limit = parseInt(args[i + 1], 10);
      i += 2;
      continue;
    }
    if (args[i] === "--cursor" && args[i + 1]) {
      cursor = parseInt(args[i + 1], 10);
      i += 2;
      continue;
    }
    i++;
  }
  return { src, val, limit, cursor, patterns };
}

function handleQuery(args: string[], modService: ModService) {
  // Usage: deno run -A bin.ts query [--src <src>] [--val <val>] [--limit <n>] [--cursor <id>]
  const { src, val, limit, cursor, patterns } = parseQueryArgs(args);
  const sources = src ? [src] : [];
  // If val is set, filter in JS after query
  const { rows } = modService.getLabels({ patterns, sources, limit, cursor });
  const filtered = val ? rows.filter((r: LabelRow) => r.val === val) : rows;
  for (const row of filtered) {
    console.log(stringifyLex(row));
  }
}

async function main() {
  const [cmd, ...args] = Deno.args;
  if (!cmd || ["create", "query"].indexOf(cmd) === -1) {
    console.error("Usage: deno run -A bin.ts <create|query> [...args]");
    Deno.exit(1);
  }
  const cfg = await createConfig();
  const db = createDb(cfg);
  const modService = createModService(db);

  if (cmd === "create") {
    await handleCreate(args, cfg, modService);
  } else if (cmd === "query") {
    handleQuery(args, modService);
  }
}

if (import.meta.main) {
  main();
}

import { backfillCollections, bff } from "@bigmoves/bff";
import { parseArgs } from "@std/cli/parse-args";
import { join, resolve } from "@std/path";
import { bundleJs } from "./build.ts";

const DEV = Deno.env.get("DEV") === "true" || false;
const CLI_PATH = DEV
  ? "../bff/packages/bff-cli/mod.ts"
  : "jsr:@bigmoves/bff-cli";

const LEXICON_DIR = "lexicons";
const CODEGEN_DIR = "__generated__";

const MAIN_NAME = "main.tsx";
const MAIN_CONTENTS = `
import { bff, route, JETSTREAM } from "@bigmoves/bff";
import { Root } from "./app.tsx";

bff({
  appName: "AT Protocol App",
  jetstreamUrl: JETSTREAM.WEST_1,
  rootElement: Root,
  middlewares: [
    route("/", (_req, _params, ctx) => {
      return ctx.render(<div>Hello, atmosphere!</div>);
    }),
  ],
});

`;

const APP_NAME = "app.tsx";
const APP_CONTENTS = `
import { RootProps } from "@bigmoves/bff";

export type State = {
 /** State passed down through middleware **/
};

export function Root(props: RootProps<State>) {
  return (
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <script
          type="module"
          key="app.esm.js"
          src={\`/build/app.esm.js?\${props.ctx.fileFingerprints.get("app.esm.js")}\`}
        />
        <link
          rel="stylesheet"
          href={\`/build/styles.css?\${props.ctx.fileFingerprints.get(
            "styles.css"
          )}\`}
        />
      </head>
      <body>{props.children}</body>
    </html>
  );
}`;

const STATIC_MOD_NAME = "mod.ts";
const STATIC_MOD_CONTENTS = `
import htmx from "htmx.org";
import _hyperscript from "hyperscript.org";

_hyperscript.browserInit();

type BFFGlobal = typeof globalThis & {
  htmx: typeof htmx;
  _hyperscript: typeof _hyperscript;
  BFF: {
    /** Add your BFF global properties here **/
    [key: string]: unknown;
  };
};

const g = globalThis as BFFGlobal;
g.htmx = g.htmx ?? htmx;
g._hyperscript = g._hyperscript ?? _hyperscript;
g.BFF = g.BFF ?? {};
`;

const DENO_JSON_NAME = "deno.json";
const DENO_JSON_CONTENTS = `{
  "imports": {
    "$lexicon/": "./__generated__/",
    "@bigmoves/bff": "jsr:@bigmoves/bff",
    "@tailwindcss/cli": "npm:@tailwindcss/cli@^4.0.12",
    "htmx.org": "npm:htmx.org@^1.9.12",
    "hyperscript.org": "npm:hyperscript.org@^0.9.14",
    "preact": "npm:preact@^10.26.5",
    "tailwindcss": "npm:tailwindcss@^4.0.12",
    "typed-htmx": "npm:typed-htmx@^0.3.1"
  },${DEV ? `"patch": ["../bff/packages/bff"],` : ""}
  "tasks": {
    "start": "deno run -A ./src/main.tsx",
    "dev": "deno run \\"dev:*\\"",
    "build": "deno task build:static && deno task build:tailwind",
    "build:static": "deno run -A ../../packages/bff-cli/mod.ts build src/static/mod.ts",
    "build:tailwind": "deno run -A --node-modules-dir npm:@tailwindcss/cli -i ./input.css -o ./build/styles.css --minify",
    "dev:build": "DEV=true deno -A --watch=src/static/ ${CLI_PATH} build src/static/mod.ts",
    "dev:server": "deno run -A --watch ./src/main.tsx",
    "dev:tailwind": "deno run -A --node-modules-dir npm:@tailwindcss/cli -i ./input.css -o ./build/styles.css --watch",
    "codegen": "deno run -A ${CLI_PATH} lexgen"
  },
  "compilerOptions": {
    "jsx": "precompile",
    "jsxImportSource": "preact"
  },
  "nodeModulesDir": "auto"
}
`;

const GLOBALS_NAME = "globals.d.ts";
const GLOBALS_CONTENTS = `import "typed-htmx";

declare module "preact" {
  namespace JSX {
    interface HTMLAttributes extends HtmxAttributes {}
  }
}
`;

const GITIGNORE_NAME = ".gitignore";
const GITIGNORE_CONTENTS = `node_modules
*.db*
.DS_Store
.env
*.log
`;

const INPUT_CSS_NAME = "input.css";
const INPUT_CSS_CONTENTS = `@import "tailwindcss";`;

if (import.meta.main) {
  const flags = parseArgs(Deno.args, {
    boolean: ["help"],
    string: [
      "db",
      "collections",
      "repos",
      "external-collections",
      "collection-key-map",
      "unstable-lexicons",
      "lexicon-dir",
    ],
    alias: { h: "help" },
    "--": true,
  });

  if (flags.help) {
    printHelp();
  }

  const command = Deno.args[0];
  if (command == null) {
    printHelp();
  }

  switch (command) {
    case "init":
      if (!Deno.args[1] || Deno.args[1].startsWith("-")) {
        console.error("Please provide a directory to initialize.");
        Deno.exit(0);
      }
      await init(Deno.args[1]);
      if (flags["unstable-lexicons"]) {
        await addLexicons(flags["unstable-lexicons"], Deno.args[1]);
        await codegen(
          join(Deno.args[1], LEXICON_DIR),
          join(Deno.args[1], CODEGEN_DIR),
        );
      }
      break;
    case "lexgen": {
      const lexiconDir = flags["lexicon-dir"] || LEXICON_DIR;
      await codegen(lexiconDir);
      break;
    }
    case "generate-jwks": {
      const privateKeys: Record<string, string> = {
        BFF_PRIVATE_KEY_1: await generateECKey("key-1"),
        BFF_PRIVATE_KEY_2: await generateECKey("key-2"),
        BFF_PRIVATE_KEY_3: await generateECKey("key-3"),
      };
      const envContent = Object.entries(privateKeys)
        .map(([key, value]) => `${key}='${value}'`)
        .join("\n");
      await Deno.writeTextFile(".env", envContent, { append: true });
      console.log("Private keys generated and saved to .env file");
      break;
    }
    case "sync": {
      const collectionKeyMap = flags["collection-key-map"]
        ? JSON.parse(flags["collection-key-map"])
        : undefined;
      bff({
        appName: "CLI Sync",
        databaseUrl: flags.db,
        collectionKeyMap,
        onListen: async ({ indexService, cfg }) => {
          await backfillCollections(
            indexService,
            cfg,
          )({
            repos: flags.repos ? flags.repos.split(",") : [],
            collections: flags.collections ? flags.collections.split(",") : [],
            externalCollections: flags["external-collections"]
              ? flags["external-collections"].split(",")
              : [],
          });
          Deno.exit(0);
        },
      });
      break;
    }
    case "build": {
      if (!Deno.args[1] || Deno.args[1].startsWith("-")) {
        console.error("Please provide an entry point to your static js/ts.");
        Deno.exit(0);
      }
      const entryPoint = Deno.args[1];
      if (!DEV) {
        await cleanDir("build");
      }
      await bundleJs(entryPoint, "build");
      break;
    }
    default:
      console.log('Please use "init" command to initialize a bff project.');
      printHelp();
      break;
  }
} else {
  throw new Error("This module is meant to be executed as a CLI.");
}

async function init(directory: string) {
  directory = resolve(directory);

  console.log(`Initializing bff in ${directory}...`);
  try {
    const dir = [...Deno.readDirSync(directory)];
    if (dir.length > 0) {
      const confirmed = confirm(
        "You are trying to initialize a bff in an non-empty directory, do you want to continue?",
      );
      if (!confirmed) {
        throw new Error("Directory is not empty, aborting.");
      }
    }
  } catch (err) {
    if (!(err instanceof Deno.errors.NotFound)) {
      throw err;
    }
  }

  await Deno.mkdir(join(directory, "static"), { recursive: true });
  await Deno.mkdir(join(directory, "src"), { recursive: true });
  await Deno.writeTextFile(join(directory, "src", MAIN_NAME), MAIN_CONTENTS);
  await Deno.writeTextFile(join(directory, "src", APP_NAME), APP_CONTENTS);
  await Deno.mkdir(join(directory, "src", "static"), { recursive: true });
  await Deno.writeTextFile(
    join(directory, "src", "static", STATIC_MOD_NAME),
    STATIC_MOD_CONTENTS,
  );
  await Deno.writeTextFile(join(directory, GLOBALS_NAME), GLOBALS_CONTENTS);
  await Deno.writeTextFile(join(directory, GITIGNORE_NAME), GITIGNORE_CONTENTS);
  await Deno.writeTextFile(join(directory, INPUT_CSS_NAME), INPUT_CSS_CONTENTS);
  await Deno.writeTextFile(join(directory, DENO_JSON_NAME), DENO_JSON_CONTENTS);

  Deno.chdir(directory);
  await new Deno.Command("git", { args: ["init"] }).output();

  console.log(
    `BFF initialized, cd into ${directory} and run \`deno task dev\` to get started.`,
  );
}

async function codegen(
  lexiconDir: string | undefined = LEXICON_DIR,
  codegenDir: string | undefined = CODEGEN_DIR,
) {
  const filesAndDirs = await getJsonFilesAndDirs(lexiconDir);
  const { stdout, stderr } = await new Deno.Command(Deno.execPath(), {
    args: [
      "run",
      "-A",
      "npm:@atproto/lex-cli",
      "gen-server",
      "--yes",
      codegenDir,
      ...filesAndDirs,
    ],
  }).output();
  logCommandOutput(stdout, stderr);
  const result = await new Deno.Command(Deno.execPath(), {
    args: [
      "run",
      "-A",
      "--unstable-sloppy-imports",
      "jsr:@bigmoves/bff-cli/unslopify.ts",
      codegenDir,
    ],
  }).output();
  logCommandOutput(result.stdout, result.stderr);
  const result2 = await new Deno.Command(Deno.execPath(), {
    args: [
      "run",
      "-A",
      "jsr:@bigmoves/bff-cli/replace_imports.ts",
      codegenDir,
    ],
  }).output();
  logCommandOutput(result2.stdout, result2.stderr);
}

async function addLexicons(lexicons: string, rootDir?: string) {
  const { stdout, stderr } = await new Deno.Command(Deno.execPath(), {
    args: [
      "run",
      "-A",
      "jsr:@lpm/cli",
      "add",
      lexicons,
    ],
    cwd: join(Deno.cwd(), rootDir ?? ""),
  }).output();
  logCommandOutput(stdout, stderr);
}

function printHelp(): void {
  console.log(`Usage: bff [OPTIONS...]`);
  console.log("\nArguments:");
  console.log("  init <directory>          Initialize a new bff project");
  console.log(
    "  build <entry-point>       Bundle static JavaScript/TypeScript",
  );
  console.log("  lexgen                    Generate types from lexicons");
  console.log(
    "  generate-jwks             Generate private keys and save to .env file",
  );
  console.log("  sync                      Sync collections to the database");
  console.log("\nOptional flags:");
  console.log("  -h, --help                Display help");
  console.log("  --lexicon-dir <dir>       Specify lexicon directory (default: lexicons)");
  Deno.exit(0);
}

function logCommandOutput(
  stdout: Uint8Array<ArrayBuffer>,
  stderr: Uint8Array<ArrayBuffer>,
) {
  const error = new TextDecoder().decode(stderr);
  if (error) {
    console.error("Error:", error);
  }
  const output = new TextDecoder().decode(stdout);
  console.log("Output:", output);
}

async function getJsonFilesAndDirs(dirPath: string): Promise<string[]> {
  const result: string[] = [];

  if (dirPath !== ".") {
    result.push(dirPath);
  }

  for await (const entry of Deno.readDir(dirPath)) {
    const entryPath = `${dirPath}/${entry.name}`;

    if (entry.isDirectory) {
      const subEntries = await getJsonFilesAndDirs(entryPath);
      result.push(...subEntries);
    } else if (entry.isFile && entry.name.endsWith(".json")) {
      result.push(entryPath);
    }
  }

  return result;
}

async function generateECKey(kid: string): Promise<string> {
  const keyPair = await crypto.subtle.generateKey(
    {
      name: "ECDSA",
      namedCurve: "P-256",
    },
    true,
    ["sign", "verify"],
  );

  const publicJwk = await crypto.subtle.exportKey("jwk", keyPair.publicKey);
  const privateJwk = await crypto.subtle.exportKey("jwk", keyPair.privateKey);

  const jwk = {
    kty: "EC",
    crv: "P-256",
    use: "sig",
    kid,
    x: publicJwk.x,
    y: publicJwk.y,
    d: privateJwk.d,
  };

  return JSON.stringify(jwk);
}

async function cleanDir(dir: string) {
  try {
    await Deno.remove(dir, { recursive: true });
  } catch (err) {
    if (!(err instanceof Deno.errors.NotFound)) {
      throw err;
    }
  }
}

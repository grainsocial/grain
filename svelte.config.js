import adapter from "@sveltejs/adapter-node";

export default {
  compilerOptions: {
    experimental: {
      async: true,
    },
  },
  kit: {
    adapter: adapter(),
    files: {
      src: "web/src",
      assets: "web/static",
    },
    alias: {
      "$hatk/client": "./hatk.generated.client.ts",
      $hatk: "./hatk.generated.ts",
    },
    experimental: {
      remoteFunctions: true,
    },
  },
};

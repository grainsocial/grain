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
    experimental: {
      remoteFunctions: true,
    },
  },
};

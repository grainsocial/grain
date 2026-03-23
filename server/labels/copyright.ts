import { defineLabel } from "$hatk";

export default defineLabel({
  definition: {
    identifier: "copyright",
    severity: "alert",
    blurs: "content",
    defaultSetting: "hide",
    locales: [
      {
        lang: "en",
        name: "Copyright Violation",
        description: "Content that infringes on copyright or intellectual property.",
      },
    ],
  },
});

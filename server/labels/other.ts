import { defineLabel } from "$hatk";

export default defineLabel({
  definition: {
    identifier: "other",
    severity: "none",
    blurs: "none",
    defaultSetting: "ignore",
    locales: [
      {
        lang: "en",
        name: "Other",
        description: "Content that does not fit other report categories.",
      },
    ],
  },
});

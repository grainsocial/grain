import { defineLabel } from "$hatk";

export default defineLabel({
  definition: {
    identifier: "harassment",
    severity: "alert",
    blurs: "none",
    defaultSetting: "warn",
    locales: [
      {
        lang: "en",
        name: "Harassment",
        description: "Targeted harassment, bullying, or hate speech.",
      },
    ],
  },
});

import { defineLabel } from "$hatk";

export default defineLabel({
  definition: {
    identifier: "misleading",
    severity: "inform",
    blurs: "none",
    defaultSetting: "warn",
    locales: [
      {
        lang: "en",
        name: "Misleading",
        description: "Impersonation, misinformation, or deceptive content.",
      },
    ],
  },
});

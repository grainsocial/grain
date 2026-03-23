import { defineLabel } from "$hatk";

export default defineLabel({
  definition: {
    identifier: "sexual",
    severity: "inform",
    blurs: "media",
    defaultSetting: "warn",
    locales: [
      { lang: "en", name: "Sexual Content", description: "Unwanted or mislabeled sexual content." },
    ],
  },
});

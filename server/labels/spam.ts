import { defineLabel } from "$hatk";

export default defineLabel({
  definition: {
    identifier: "spam",
    severity: "inform",
    blurs: "content",
    defaultSetting: "hide",
    locales: [
      { lang: "en", name: "Spam", description: "Unwanted or repetitive promotional content." },
    ],
  },
});

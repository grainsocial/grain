import { defineLabel } from "$hatk";

export default defineLabel({
  definition: {
    identifier: "gore",
    severity: "alert",
    blurs: "media",
    defaultSetting: "hide",
    locales: [{ lang: "en", name: "Gore", description: "Graphic or violent imagery." }],
  },
});

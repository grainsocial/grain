import { defineLabel } from "$hatk";

export default defineLabel({
  definition: {
    identifier: "nudity",
    severity: "inform",
    blurs: "media",
    defaultSetting: "warn",
    locales: [{ lang: "en", name: "Nudity", description: "Content containing nudity." }],
  },
});

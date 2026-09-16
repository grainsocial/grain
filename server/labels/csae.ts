import { defineLabel } from "$hatk";

/**
 * Child sexual abuse and exploitation.
 *
 * Required by Google Play's Child Safety Standards policy, which is scoped to
 * apps that declare themselves Social — see `/support/child-safety` for the
 * published standards this category enforces.
 *
 * The file is named for the identifier rather than the display name on
 * purpose. hatk loads `server/labels/` in filename order and the report sheet
 * pre-selects whatever comes back first, so a `child-safety.ts` would sort
 * ahead of `copyright.ts` and make this the default reason on a report anyone
 * submits without changing the selection. The highest-priority queue we have
 * is the one that can least afford that noise.
 */
export default defineLabel({
  definition: {
    identifier: "csae",
    severity: "alert",
    blurs: "content",
    defaultSetting: "hide",
    locales: [
      {
        lang: "en",
        name: "Child Safety",
        description:
          "Sexual content involving a minor, or the exploitation, grooming or endangerment of a child.",
      },
    ],
  },
});

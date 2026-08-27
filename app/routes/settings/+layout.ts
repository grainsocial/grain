import type { LayoutLoad } from "./$types";

// Settings shows its own sub-nav, so the main nav collapses to the icon rail:
// one labelled nav column on screen at a time.
export const load: LayoutLoad = async () => ({ rail: true, wide: true });

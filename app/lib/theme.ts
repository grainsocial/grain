import { writable, get } from "svelte/store";
import { browser } from "$app/environment";
import { callXrpc } from "$hatk/client";

export type ThemePreference = "system" | "light" | "dark";
type ResolvedTheme = "light" | "dark";

// Also read by the inline script in app.html, which applies the theme before
// first paint. Keep the two in sync.
const STORAGE_KEY = "grain:theme";

const THEME_COLOR: Record<ResolvedTheme, string> = {
  dark: "#080b12",
  light: "#ffffff",
};

/** What the user picked — "system" follows the OS. */
export const themePreference = writable<ThemePreference>(readStored());

function isThemePreference(value: unknown): value is ThemePreference {
  return value === "system" || value === "light" || value === "dark";
}

function systemTheme(): ResolvedTheme {
  if (!browser) return "dark";
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

/**
 * Everything theme-dependent keys off `data-theme` on <html>, in CSS — that way
 * server-rendered markup is already correct and nothing has to swap on hydration.
 */
function apply(preference: ThemePreference): void {
  if (!browser) return;
  const resolved = preference === "system" ? systemTheme() : preference;
  document.documentElement.dataset.theme = resolved;
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", THEME_COLOR[resolved]);
}

function readStored(): ThemePreference {
  if (!browser) return "system";
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (isThemePreference(stored)) return stored;
  } catch {}
  return "system";
}

function store(preference: ThemePreference): void {
  if (!browser) return;
  try {
    localStorage.setItem(STORAGE_KEY, preference);
  } catch {}
}

/**
 * Sync the store with what the inline app.html script already applied, and keep
 * following the OS while the preference is "system". Call once from the root layout.
 */
export function initTheme(): () => void {
  if (!browser) return () => {};
  const preference = readStored();
  themePreference.set(preference);
  apply(preference);

  const media = window.matchMedia("(prefers-color-scheme: light)");
  const onChange = () => {
    if (get(themePreference) === "system") apply("system");
  };
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

/** User picked a theme: apply it, remember it locally, and sync it to the account. */
export async function setTheme(preference: ThemePreference): Promise<void> {
  if (get(themePreference) === preference) return;
  themePreference.set(preference);
  store(preference);
  apply(preference);
  try {
    await callXrpc("dev.hatk.putPreference", { key: "theme", value: preference });
  } catch {
    // Logged-out or offline — localStorage still holds the choice.
  }
}

/** Apply a theme that came from the account's saved preferences (no write-back). */
export function applyStoredTheme(value: unknown): void {
  if (!isThemePreference(value) || !browser) return;
  if (get(themePreference) === value) return;
  themePreference.set(value);
  store(value);
  apply(value);
}

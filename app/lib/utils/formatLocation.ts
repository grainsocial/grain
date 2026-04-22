// Re-export of the server-owned formatter so client-side callers (UI, cross-post
// builder) import it via `$lib` without reaching into `server/`. The function
// itself is pure and lives in `server/helpers/formatLocation.ts`.
export { formatStoredLocation } from "../../../server/helpers/formatLocation.ts";

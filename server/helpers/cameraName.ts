// Shared with the client so a camera reads the same on a card, on /explore and
// on /cameras. The implementation lives with the app because both sides need
// it; this re-export keeps the server's existing import paths working.
export { cleanCameraName } from "../../app/lib/utils/cameraName.ts";

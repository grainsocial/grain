import htmx from "htmx.org";
import _hyperscript from "hyperscript.org";
import { ProfileDialog } from "./profile_dialog.ts";

_hyperscript.browserInit();

type BFFGlobal = typeof globalThis & {
  htmx: typeof htmx;
  _hyperscript: typeof _hyperscript;
  BFF: {
    profileDialog?: ProfileDialog;
  };
};

const g = globalThis as BFFGlobal;
g.htmx = g.htmx ?? htmx;
g._hyperscript = g._hyperscript ?? _hyperscript;
g.BFF = g.BFF ?? {};
g.BFF.profileDialog = new ProfileDialog();

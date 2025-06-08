import htmx from "htmx.org";
import _hyperscript from "hyperscript.org";
import Sortable from "sortablejs";
import { GalleryLayout } from "./gallery_layout.ts";
import { PhotoDialog } from "./photo_dialog.ts";
import * as PhotoManip from "./photo_manip.ts";
import { ProfileDialog } from "./profile_dialog.ts";
import { UploadPage } from "./upload_page.ts";

const galleryLayout = new GalleryLayout({ layoutMode: "justified" });
galleryLayout.init();

htmx.onLoad(function (element) {
  PhotoDialog.maybeInitForElement(element);

  if (element.id === "gallery-sort-dialog") {
    const sortables = element.querySelectorAll(".sortable");
    for (const sortable of Array.from(sortables)) {
      new Sortable(sortable, {
        animation: 150,
      });
    }
  }
});

_hyperscript.browserInit();

type GrainGlobal = typeof globalThis & {
  htmx: typeof htmx;
  _hyperscript: typeof _hyperscript;
  Grain: {
    uploadPage?: UploadPage;
    profileDialog?: ProfileDialog;
    galleryLayout?: GalleryLayout;
    photoManip?: typeof PhotoManip;
  };
};

const g = globalThis as GrainGlobal;
g.htmx = g.htmx ?? htmx;
g._hyperscript = g._hyperscript ?? _hyperscript;
g.Grain = g.Grain ?? {};
g.Grain.uploadPage = new UploadPage();
g.Grain.profileDialog = new ProfileDialog();
g.Grain.galleryLayout = galleryLayout;
g.Grain.photoManip = PhotoManip;

import htmx from "htmx.org";
import _hyperscript from "hyperscript.org";
import Sortable from "sortablejs";
import { GalleryLayout } from "./gallery_layout.ts";
import { GalleryPhotosDialog } from "./gallery_photos_dialog.ts";
import { PhotoDialog } from "./photo_dialog.ts";
import { ProfileDialog } from "./profile_dialog.ts";
import { UploadPage } from "./upload_page.ts";

const galleryLayout = new GalleryLayout({
  layoutMode: "justified",
  spacing: 4,
});
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
    galleryPhotosDialog?: GalleryPhotosDialog;
  };
};

const g = globalThis as GrainGlobal;
g.htmx = g.htmx ?? htmx;
g._hyperscript = g._hyperscript ?? _hyperscript;
g.Grain = g.Grain ?? {};
g.Grain.uploadPage = new UploadPage();
g.Grain.profileDialog = new ProfileDialog();
g.Grain.galleryPhotosDialog = new GalleryPhotosDialog();
g.Grain.galleryLayout = galleryLayout;

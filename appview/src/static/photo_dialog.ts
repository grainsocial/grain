/**
 * PhotoDialog class to handle touch events for swiping left or right
 * on a photo dialog element.
 *
 * Example usage (see src/static/mod.ts):
 *
 *   htmx.onLoad(function (element) {
 *     PhotoDialog.maybeInitForElement(element);
 *     // ...
 *   });
 *
 * This will automatically initialize swipe event listeners and observation
 * when an element with id "photo-dialog" is loaded into the DOM.
 *
 * Example for htmx+JSX:
 *
 *   <div
 *     hx-get={photoDialogLink(gallery, nextImage)}
 *     hx-trigger="keyup[key=='ArrowRight'] from:body, swipeleft from:body"
 *     hx-target="#photo-dialog"
 *     hx-swap="innerHTML"
 *   />
 *
 * This pattern allows htmx to swap the photo dialog content and trigger swipe events
 * that are handled by PhotoDialog.
 */
export class PhotoDialog {
  private startX = 0;
  private readonly threshold = 50;
  private observer: MutationObserver;
  private static initialized = false;
  public static id = "photo-dialog";

  constructor() {
    this.observer = new MutationObserver(this.handleMutation.bind(this));
  }

  public connect(): void {
    this.onTouchStart = this.onTouchStart.bind(this);
    this.onTouchEnd = this.onTouchEnd.bind(this);
    console.log("PhotoDialog: Connected touch event handlers.");
  }

  public static maybeInitForElement(element: Element): void {
    if (element.id !== PhotoDialog.id) return;
    if (PhotoDialog.initialized) return;
    const dialog = new PhotoDialog();
    dialog.connect();
    if (document && document.body) {
      document.body.addEventListener("touchstart", dialog.onTouchStart);
      document.body.addEventListener("touchend", dialog.onTouchEnd);
      dialog.observe();
      PhotoDialog.initialized = true;
    } else {
      console.warn(
        "document.body not available for PhotoDialog event listeners",
      );
    }
  }

  public onTouchStart(e: TouchEvent): void {
    this.startX = e.touches[0].clientX;
  }

  public onTouchEnd(e: TouchEvent): void {
    const endX = e.changedTouches[0].clientX;
    const diffX = endX - this.startX;
    if (Math.abs(diffX) > this.threshold) {
      const direction = diffX > 0 ? "swiperight" : "swipeleft";
      (e.target as HTMLElement).dispatchEvent(
        new CustomEvent(direction, { bubbles: true }),
      );
    }
  }

  public observe(): void {
    this.observer.observe(document.body, { childList: true, subtree: true });
  }

  public disconnect(): void {
    this.observer.disconnect();
    document.body.removeEventListener("touchstart", this.onTouchStart);
    document.body.removeEventListener("touchend", this.onTouchEnd);
    PhotoDialog.initialized = false;
  }

  private handleMutation(): void {
    const modal = document.getElementById(PhotoDialog.id);
    if (!modal) {
      console.log("PhotoDialog not found, removing event listeners");
      this.disconnect();
    }
  }
}

let startX = 0;
const threshold = 50;
const onTouchStart = (e) => {
  startX = e.touches[0].clientX;
};
const onTouchEnd = (e) => {
  const endX = e.changedTouches[0].clientX;
  const diffX = endX - startX;

  if (Math.abs(diffX) > threshold) {
    const direction = diffX > 0 ? "swiperight" : "swipeleft";
    e.target.dispatchEvent(new CustomEvent(direction, { bubbles: true }));
  }
};
const observer = new MutationObserver(() => {
  const modal = document.getElementById("image-dialog");
  if (!modal) {
    console.log("Image Dialog not found, removing event listeners");
    document.body.removeEventListener("touchstart", onTouchStart);
    document.body.removeEventListener("touchend", onTouchEnd);
    observer.disconnect();
  }
});
htmx.onLoad((evt) => {
  if (evt.id === "image-dialog") {
    document.body.addEventListener("touchstart", onTouchStart);
    document.body.addEventListener("touchend", onTouchEnd);
  }
  const parent = document.body;
  observer.observe(parent, { childList: true, subtree: true });
});

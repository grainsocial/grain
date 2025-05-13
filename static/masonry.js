// deno-lint-ignore-file

let masonryObserverInitialized = false;

function computeMasonry() {
  const container = document.getElementById("masonry-container");
  if (!container) return;

  const spacing = 8;
  const containerWidth = container.offsetWidth;

  if (containerWidth === 0) {
    requestAnimationFrame(computeMasonry);
    return;
  }

  const columns = containerWidth < 640 ? 1 : 3;

  const columnWidth = (containerWidth + spacing) / columns - spacing;
  const columnHeights = new Array(columns).fill(0);
  const tiles = container.querySelectorAll(".masonry-tile");

  tiles.forEach((tile) => {
    const imgW = parseFloat(tile.dataset.width);
    const imgH = parseFloat(tile.dataset.height);
    if (!imgW || !imgH) return;

    const aspectRatio = imgH / imgW;
    const renderedHeight = aspectRatio * columnWidth;

    let shortestIndex = 0;
    for (let i = 1; i < columns; i++) {
      if (columnHeights[i] < columnHeights[shortestIndex]) {
        shortestIndex = i;
      }
    }

    const left = (columnWidth + spacing) * shortestIndex;
    const top = columnHeights[shortestIndex];

    Object.assign(tile.style, {
      position: "absolute",
      width: `${columnWidth}px`,
      height: `${renderedHeight}px`,
      left: `${left}px`,
      top: `${top}px`,
    });

    columnHeights[shortestIndex] = top + renderedHeight + spacing;
  });

  container.style.height = `${Math.max(...columnHeights)}px`;
}

function observeMasonry() {
  if (masonryObserverInitialized) return;
  masonryObserverInitialized = true;

  const container = document.getElementById("masonry-container");
  if (!container) return;

  // Observe parent resize
  if (typeof ResizeObserver !== "undefined") {
    const resizeObserver = new ResizeObserver(() => computeMasonry());
    if (container.parentElement) {
      resizeObserver.observe(container.parentElement);
    }
  }

  // Observe inner content changes (tiles being added/removed)
  const mutationObserver = new MutationObserver(() => {
    computeMasonry();
  });

  mutationObserver.observe(container, {
    childList: true,
    subtree: true,
  });
}

document.addEventListener("DOMContentLoaded", () => {
  computeMasonry();
  observeMasonry();
});

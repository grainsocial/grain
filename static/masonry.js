// deno-lint-ignore-file

let masonryObserverInitialized = false;
let layoutMode = "justified";

function computeLayout() {
  if (layoutMode === "masonry") {
    computeMasonry();
  } else {
    computeJustified();
  }
}

function toggleLayout(layout = "justified") {
  layoutMode = layout;
  computeLayout();
}

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

function computeJustified() {
  const container = document.getElementById("masonry-container");
  if (!container) return;

  const spacing = 8;
  const containerWidth = container.offsetWidth;

  if (containerWidth === 0) {
    requestAnimationFrame(computeJustified);
    return;
  }

  const tiles = Array.from(container.querySelectorAll(".masonry-tile"));
  let currentRow = [];
  let rowAspectRatioSum = 0;
  let yOffset = 0;

  // Clear all styles before layout
  tiles.forEach((tile) => {
    Object.assign(tile.style, {
      position: "absolute",
      left: "0px",
      top: "0px",
      width: "auto",
      height: "auto",
    });
  });

  for (let i = 0; i < tiles.length; i++) {
    const tile = tiles[i];
    const imgW = parseFloat(tile.dataset.width);
    const imgH = parseFloat(tile.dataset.height);
    if (!imgW || !imgH) continue;

    const aspectRatio = imgW / imgH;
    currentRow.push({ tile, aspectRatio, imgW, imgH });
    rowAspectRatioSum += aspectRatio;

    // Estimate if row is "full" enough
    const estimatedRowHeight =
      (containerWidth - (currentRow.length - 1) * spacing) / rowAspectRatioSum;

    // If height is reasonable or we're at the end, render the row
    if (estimatedRowHeight < 300 || i === tiles.length - 1) {
      let xOffset = 0;

      for (const item of currentRow) {
        const width = estimatedRowHeight * item.aspectRatio;
        Object.assign(item.tile.style, {
          position: "absolute",
          top: `${yOffset}px`,
          left: `${xOffset}px`,
          width: `${width}px`,
          height: `${estimatedRowHeight}px`,
        });
        xOffset += width + spacing;
      }

      yOffset += estimatedRowHeight + spacing;
      currentRow = [];
      rowAspectRatioSum = 0;
    }
  }

  container.style.position = "relative";
  container.style.height = `${yOffset}px`;
}

function observeMasonry() {
  if (masonryObserverInitialized) return;
  masonryObserverInitialized = true;

  const container = document.getElementById("masonry-container");
  if (!container) return;

  // Observe parent resize
  if (typeof ResizeObserver !== "undefined") {
    const resizeObserver = new ResizeObserver(() => computeLayout());
    if (container.parentElement) {
      resizeObserver.observe(container.parentElement);
    }
  }

  // Observe inner content changes (tiles being added/removed)
  const mutationObserver = new MutationObserver(() => {
    computeLayout();
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

window.Grain = window.Grain || {};
window.Grain.toggleLayout = toggleLayout;
window.Grain.computeLayout = computeLayout;

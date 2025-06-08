type LayoutMode = "justified" | "masonry";

type GalleryItem = HTMLElement & {
  dataset: {
    width: string;
    height: string;
    [key: string]: string;
  };
};

interface GalleryLayoutOptions {
  containerSelector?: string;
  layoutMode?: LayoutMode;
  spacing?: number;
  masonryBreakpoint?: number;
}

/**
 * GalleryLayout class for flexible photo gallery layouts (masonry/justified).
 *
 * Example usage with the GalleryLayout compositional component:
 *
 * // In your JSX component:
 * <GalleryLayout
 *   layoutButtons={
 *     <>
 *       <GalleryLayout.ModeButton mode="justified" />
 *       <GalleryLayout.ModeButton mode="masonry" />
 *     </>
 *   }
 * >
 *   <GalleryLayout.Container>
 *     {photos.map(photo => (
 *       <GalleryLayout.Item key={photo.cid} photo={photo} gallery={gallery} />
 *     ))}
 *   </GalleryLayout.Container>
 * </GalleryLayout>
 *
 * // In your static JS/TS:
 * import { GalleryLayout } from "../static/gallery_layout.ts";
 * const galleryLayout = new GalleryLayout({
 *   containerSelector: "#gallery-container",
 *   layoutMode: "justified",
 *   spacing: 8,
 *   masonryBreakpoint: 640,
 * });
 * galleryLayout.init();
 */
export class GalleryLayout {
  private observerInitialized = false;
  private layoutMode: LayoutMode;
  private containerSelector: string;
  private spacing: number;
  private masonryBreakpoint: number;

  constructor(options: GalleryLayoutOptions = {}) {
    this.layoutMode = options.layoutMode ?? "justified";
    this.containerSelector = options.containerSelector ?? "#gallery-container";
    this.spacing = options.spacing ?? 8;
    this.masonryBreakpoint = options.masonryBreakpoint ?? 640;
  }

  public setLayoutMode(mode: LayoutMode) {
    this.layoutMode = mode;
    this.computeLayout();
  }

  public computeLayout(): void {
    if (this.layoutMode === "masonry") {
      this.computeMasonry();
    } else {
      this.computeJustified();
    }
  }

  public computeMasonry(): void {
    const container = document.querySelector<HTMLElement>(
      this.containerSelector,
    );
    if (!container) return;

    const spacing = this.spacing;
    const containerWidth = container.offsetWidth;

    if (containerWidth === 0) {
      requestAnimationFrame(() => this.computeMasonry());
      return;
    }

    const columns = containerWidth < this.masonryBreakpoint ? 1 : 3;
    const columnWidth = (containerWidth + spacing) / columns - spacing;
    const columnHeights: number[] = new Array(columns).fill(0);
    const tiles = container.querySelectorAll<HTMLElement>(".gallery-item");

    tiles.forEach((tile) => {
      const imgW = parseFloat((tile as GalleryItem).dataset.width);
      const imgH = parseFloat((tile as GalleryItem).dataset.height);
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

  public computeJustified(): void {
    const container = document.querySelector<HTMLElement>(
      this.containerSelector,
    );
    if (!container) return;

    const spacing = this.spacing;
    const containerWidth = container.offsetWidth;

    if (containerWidth === 0) {
      requestAnimationFrame(() => this.computeJustified());
      return;
    }

    const tiles = Array.from(
      container.querySelectorAll<HTMLElement>(".gallery-item"),
    );
    let currentRow: Array<
      { tile: HTMLElement; aspectRatio: number; imgW: number; imgH: number }
    > = [];
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
      const imgW = parseFloat((tile as GalleryItem).dataset.width);
      const imgH = parseFloat((tile as GalleryItem).dataset.height);
      if (!imgW || !imgH) continue;

      const aspectRatio = imgW / imgH;
      currentRow.push({ tile, aspectRatio, imgW, imgH });
      rowAspectRatioSum += aspectRatio;

      // Estimate if row is "full" enough
      const estimatedRowHeight =
        (containerWidth - (currentRow.length - 1) * spacing) /
        rowAspectRatioSum;

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

  public observe(): void {
    if (this.observerInitialized) return;
    this.observerInitialized = true;

    const container = document.querySelector<HTMLElement>(
      this.containerSelector,
    );
    if (!container) return;

    // Observe parent resize
    if (typeof ResizeObserver !== "undefined") {
      const resizeObserver = new ResizeObserver(() => this.computeLayout());
      if (container.parentElement) {
        resizeObserver.observe(container.parentElement);
      }
    }

    // Observe inner content changes (tiles being added/removed)
    const mutationObserver = new MutationObserver(() => {
      this.computeLayout();
    });

    mutationObserver.observe(container, {
      childList: true,
      subtree: true,
    });
  }

  public init(options: GalleryLayoutOptions = {}): void {
    document.addEventListener("DOMContentLoaded", () => {
      const container = document.querySelector(
        options.containerSelector ?? "#gallery-container",
      );
      if (container) {
        this.computeLayout();
        this.observe();
      }
    });
  }
}

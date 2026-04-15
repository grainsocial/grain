// ─── Collage Layout (ported from grain-next og-server/lib/collage.js) ────────

function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  return Math.abs(hash);
}

function createSeededRandom(seed: number): () => number {
  let currentSeed = seed;
  return () => {
    currentSeed = (currentSeed * 9301 + 49297) % 233280;
    return currentSeed / 233280;
  };
}

export interface ImageItem {
  url: string;
  aspectRatio: number;
}

export interface Placement {
  item: ImageItem;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function calculateCollageLayout(
  imageData: ImageItem[],
  containerWidth: number,
  containerHeight: number,
  gap = 12,
): Placement[] {
  const seedString = imageData
    .map((item) => `${item.url}_${item.aspectRatio.toFixed(3)}`)
    .join("|");
  const seed = hashCode(seedString);
  const random = createSeededRandom(seed);

  const placements: Placement[] = [];
  const occupiedSpace: Rect[] = [];

  const sortedImages = [...imageData].sort((a, b) => {
    const aScore = a.aspectRatio + (random() - 0.5) * 0.1;
    const bScore = b.aspectRatio + (random() - 0.5) * 0.1;
    return bScore - aScore;
  });

  const containerArea = containerWidth * containerHeight;
  const numImages = sortedImages.length;
  const targetCoverage = 0.75 + random() * 0.1;
  const targetTotalArea = containerArea * targetCoverage;
  const averageImageArea = targetTotalArea / numImages;

  const sizeCategories = [
    { min: 1.2, max: 1.8 },
    { min: 0.8, max: 1.2 },
    { min: 0.5, max: 0.8 },
  ];

  for (const item of sortedImages) {
    const categoryIndex = Math.floor(random() * sizeCategories.length);
    const category = sizeCategories[categoryIndex];
    const sizeMultiplier = category.min + random() * (category.max - category.min);

    const targetArea = averageImageArea * sizeMultiplier;
    const targetHeight = Math.sqrt(targetArea / item.aspectRatio);
    const targetWidth = targetHeight * item.aspectRatio;

    const minSize = Math.min(containerWidth, containerHeight) * 0.12;
    const maxSize = Math.min(containerWidth, containerHeight) * 0.75;

    let finalWidth = Math.max(minSize, Math.min(maxSize, targetWidth));
    let finalHeight = finalWidth / item.aspectRatio;

    if (finalHeight > maxSize) {
      finalHeight = maxSize;
      finalWidth = finalHeight * item.aspectRatio;
    }

    finalWidth = Math.min(finalWidth, containerWidth - gap);
    finalHeight = Math.min(finalHeight, containerHeight - gap);

    let placed = false;
    let attempts = 0;
    const maxAttempts = 200;

    while (!placed && attempts < maxAttempts) {
      let x: number, y: number;

      if (attempts < 50) {
        x = random() * (containerWidth - finalWidth - gap);
        y = random() * (containerHeight - finalHeight - gap);
      } else {
        const gridSize = Math.min(containerWidth, containerHeight) / 8;
        const gridX = Math.floor(
          random() * Math.ceil((containerWidth - finalWidth - gap) / gridSize),
        );
        const gridY = Math.floor(
          random() * Math.ceil((containerHeight - finalHeight - gap) / gridSize),
        );
        x = Math.min(gridX * gridSize, containerWidth - finalWidth - gap);
        y = Math.min(gridY * gridSize, containerHeight - finalHeight - gap);
      }

      const reservedRect: Rect = {
        x,
        y,
        width: finalWidth + gap,
        height: finalHeight + gap,
      };

      const overlaps = occupiedSpace.some((rect) => {
        return !(
          reservedRect.x >= rect.x + rect.width ||
          reservedRect.x + reservedRect.width <= rect.x ||
          reservedRect.y >= rect.y + rect.height ||
          reservedRect.y + reservedRect.height <= rect.y
        );
      });

      if (!overlaps) {
        placements.push({
          item,
          x: Math.round(x),
          y: Math.round(y),
          width: Math.round(finalWidth),
          height: Math.round(finalHeight),
        });
        occupiedSpace.push({
          x: Math.round(x),
          y: Math.round(y),
          width: Math.round(finalWidth) + gap,
          height: Math.round(finalHeight) + gap,
        });
        placed = true;
      }

      attempts++;
    }

    // Fallback: try smaller sizes
    if (!placed) {
      for (let sizeReduction = 0; sizeReduction <= 0.5; sizeReduction += 0.1) {
        if (placed) break;
        const reducedWidth = finalWidth * (1 - sizeReduction);
        const reducedHeight = finalHeight * (1 - sizeReduction);
        const minAcceptable = Math.min(containerWidth, containerHeight) * 0.08;
        if (reducedWidth < minAcceptable || reducedHeight < minAcceptable) continue;

        const gridSize = Math.max(10, Math.min(reducedWidth, reducedHeight) / 4);
        for (let gx = 0; gx <= containerWidth - reducedWidth - gap && !placed; gx += gridSize) {
          for (let gy = 0; gy <= containerHeight - reducedHeight - gap && !placed; gy += gridSize) {
            const testRect: Rect = {
              x: gx,
              y: gy,
              width: reducedWidth + gap,
              height: reducedHeight + gap,
            };
            const hasOverlap = occupiedSpace.some((rect) => {
              return !(
                testRect.x >= rect.x + rect.width ||
                testRect.x + testRect.width <= rect.x ||
                testRect.y >= rect.y + rect.height ||
                testRect.y + testRect.height <= rect.y
              );
            });
            if (!hasOverlap) {
              placements.push({
                item,
                x: Math.round(gx),
                y: Math.round(gy),
                width: Math.round(reducedWidth),
                height: Math.round(reducedHeight),
              });
              occupiedSpace.push({
                x: Math.round(gx),
                y: Math.round(gy),
                width: Math.round(reducedWidth) + gap,
                height: Math.round(reducedHeight) + gap,
              });
              placed = true;
            }
          }
        }
      }
    }
  }

  return placements;
}

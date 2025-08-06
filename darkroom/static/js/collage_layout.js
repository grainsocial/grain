async function fetchGalleryData(galleryUri) {
  try {
    const galleryUrl = `/api/gallery?uri=${encodeURIComponent(galleryUri)}`;
    console.log(`Fetching gallery data from: ${galleryUrl}`);

    const response = await fetch(galleryUrl);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.error("Failed to fetch gallery data:", error);
    throw error;
  }
}

async function waitForImagesLoaded(images) {
  console.log(`Waiting for ${images.length} images to load...`);

  const imagePromises = images.map((img) => {
    return new Promise((resolve) => {
      if (img.complete) {
        resolve();
      } else {
        img.addEventListener("load", resolve);
        img.addEventListener("error", () => {
          console.warn(`Image failed to load: ${img.src}`);
          resolve();
        });

        setTimeout(() => {
          console.warn(`Image load timeout: ${img.src}`);
          resolve();
        }, 10000);
      }
    });
  });

  await Promise.all(imagePromises);
  console.log("All images loaded");
}

function signalScreenshotReady() {
  console.log("Signaling screenshot ready");
  document.body.dataset.screenshotReady = "true";

  const event = new CustomEvent("screenshotReady", {
    detail: { timestamp: Date.now() },
  });
  document.dispatchEvent(event);
}

// Simple hash function for consistent randomization based on image data
function hashCode(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

// Seeded random number generator for consistent layouts
function createSeededRandom(seed) {
  let currentSeed = seed;
  return function () {
    currentSeed = (currentSeed * 9301 + 49297) % 233280;
    return currentSeed / 233280;
  };
}

function calculateCollageLayout(
  imageData,
  containerWidth,
  containerHeight,
  gap,
) {
  // Create a deterministic seed based on image URIs and dimensions
  const seedString = imageData.map((item) =>
    `${item.img.src}_${item.aspectRatio.toFixed(3)}`
  ).join("|");
  const seed = hashCode(seedString);
  const random = createSeededRandom(seed);

  console.log(`Creating collage layout with seed: ${seed}`);

  const placements = [];
  const occupiedSpace = [];

  // Sort images by a deterministic order (largest to smallest area preference)
  const sortedImages = [...imageData].sort((a, b) => {
    // Create a consistent sort order with some randomness
    const aScore = a.aspectRatio + (random() - 0.5) * 0.1;
    const bScore = b.aspectRatio + (random() - 0.5) * 0.1;
    return bScore - aScore;
  });

  // Calculate total area and target coverage based on number of images
  const containerArea = containerWidth * containerHeight;
  const numImages = sortedImages.length;
  
  // Aim for 75-85% coverage of the container area
  const targetCoverage = 0.75 + (random() * 0.1);
  const targetTotalArea = containerArea * targetCoverage;
  const averageImageArea = targetTotalArea / numImages;

  // Define size categories with better distribution
  const sizeCategories = [
    { min: 1.2, max: 1.8, weight: 0.25 }, // Large
    { min: 0.8, max: 1.2, weight: 0.5 },  // Medium
    { min: 0.5, max: 0.8, weight: 0.25 }  // Small
  ];

  for (let i = 0; i < sortedImages.length; i++) {
    const item = sortedImages[i];
    
    // Debug specific image
    const isTargetImage = item.img.src.includes('bafkreial5qj6dxkgimwzuako3lgia7epzje25lwfnirpctbbmorrx33zhq');
    if (isTargetImage) {
      console.log(`🎯 Target image found at index ${i}, aspect ratio: ${item.aspectRatio.toFixed(3)}`);
    }

    // Assign size category deterministically but with variation
    const categoryIndex = Math.floor(random() * sizeCategories.length);
    const category = sizeCategories[categoryIndex];
    const sizeMultiplier = category.min +
      (random() * (category.max - category.min));

    // Calculate target size based on average area and aspect ratio
    const targetArea = averageImageArea * sizeMultiplier;
    const targetHeight = Math.sqrt(targetArea / item.aspectRatio);
    const targetWidth = targetHeight * item.aspectRatio;

    // Set more generous minimum and maximum sizes
    const minSize = Math.min(containerWidth, containerHeight) * 0.12;
    const maxSize = Math.min(containerWidth, containerHeight) * 0.75;

    let finalWidth = Math.max(minSize, Math.min(maxSize, targetWidth));
    let finalHeight = finalWidth / item.aspectRatio;

    if (finalHeight > maxSize) {
      finalHeight = maxSize;
      finalWidth = finalHeight * item.aspectRatio;
    }

    // Ensure we don't exceed container bounds
    finalWidth = Math.min(finalWidth, containerWidth - gap);
    finalHeight = Math.min(finalHeight, containerHeight - gap);

    // Find position for this image with better space utilization
    let placed = false;
    let attempts = 0;
    const maxAttempts = 200;

    while (!placed && attempts < maxAttempts) {
      let x, y;
      
      if (attempts < 50) {
        // First 50 attempts: try random positions
        x = random() * (containerWidth - finalWidth - gap);
        y = random() * (containerHeight - finalHeight - gap);
      } else {
        // After 50 attempts: try grid-based positions for better coverage
        const gridSize = Math.min(containerWidth, containerHeight) / 8;
        const gridX = Math.floor(random() * Math.ceil((containerWidth - finalWidth - gap) / gridSize));
        const gridY = Math.floor(random() * Math.ceil((containerHeight - finalHeight - gap) / gridSize));
        x = Math.min(gridX * gridSize, containerWidth - finalWidth - gap);
        y = Math.min(gridY * gridSize, containerHeight - finalHeight - gap);
      }

      // Check if this position overlaps with existing images
      // The reserved space (with gap)
      const reservedRect = {
        x: x,
        y: y,
        width: finalWidth + gap,
        height: finalHeight + gap,
      };

      const overlaps = occupiedSpace.some((rect, rectIndex) => {
        // Check if image areas would overlap (including gap buffer)
        const noOverlap = (
          reservedRect.x >= rect.x + rect.width ||
          reservedRect.x + reservedRect.width <= rect.x ||
          reservedRect.y >= rect.y + rect.height ||
          reservedRect.y + reservedRect.height <= rect.y
        );
        return !noOverlap;
      });

      if (!overlaps) {
        // Round to integer pixels to avoid sub-pixel rendering issues
        const roundedX = Math.round(x);
        const roundedY = Math.round(y);
        const roundedWidth = Math.round(finalWidth);
        const roundedHeight = Math.round(finalHeight);
        
        placements.push({
          item: item,
          x: roundedX,
          y: roundedY,
          width: roundedWidth,
          height: roundedHeight,
        });

        occupiedSpace.push({
          x: roundedX,
          y: roundedY,
          width: roundedWidth + gap,
          height: roundedHeight + gap,
        });
        if (isTargetImage) {
          console.log(`🎯 Target image ${i} PLACED at (${roundedX}, ${roundedY}) size ${roundedWidth}x${roundedHeight} after ${attempts} attempts`);
        } else {
          console.log(`Placed image ${i} at (${roundedX}, ${roundedY}) size ${roundedWidth}x${roundedHeight} after ${attempts} attempts`);
        }
        
        // Immediate verification after placement
        const imageRect = { x: roundedX, y: roundedY, width: roundedWidth, height: roundedHeight };
        for (let k = 0; k < placements.length - 1; k++) {
          const otherImage = placements[k];
          const noOverlap = (
            imageRect.x >= otherImage.x + otherImage.width ||
            imageRect.x + imageRect.width <= otherImage.x ||
            imageRect.y >= otherImage.y + otherImage.height ||
            imageRect.y + imageRect.height <= otherImage.y
          );
          if (!noOverlap) {
            console.error(`ERROR: Just placed image ${i} overlaps with existing image ${k}!`);
          }
        }
        placed = true;
      }

      attempts++;
    }

    // If we couldn't place the image normally, try to find a non-overlapping space
    if (!placed) {
      let bestPosition = null;
      let foundNonOverlapping = false;

      // Try progressively smaller sizes until we find a non-overlapping placement
      for (let sizeReduction = 0; sizeReduction <= 0.5 && !foundNonOverlapping; sizeReduction += 0.1) {
        const reducedWidth = finalWidth * (1 - sizeReduction);
        const reducedHeight = finalHeight * (1 - sizeReduction);
        
        // Skip if image would be too small
        const minAcceptableSize = Math.min(containerWidth, containerHeight) * 0.08;
        if (reducedWidth < minAcceptableSize || reducedHeight < minAcceptableSize) {
          continue;
        }

        // Grid search for non-overlapping position  
        const gridSize = Math.max(10, Math.min(reducedWidth, reducedHeight) / 4);
        for (let gx = 0; gx <= containerWidth - reducedWidth - gap && !foundNonOverlapping; gx += gridSize) {
          for (let gy = 0; gy <= containerHeight - reducedHeight - gap && !foundNonOverlapping; gy += gridSize) {
            const testReservedRect = {
              x: gx,
              y: gy,
              width: reducedWidth + gap,
              height: reducedHeight + gap,
            };

            // Check for any overlap using same logic as main placement
            const hasOverlap = occupiedSpace.some((rect) => {
              const noOverlap = (
                testReservedRect.x >= rect.x + rect.width ||
                testReservedRect.x + testReservedRect.width <= rect.x ||
                testReservedRect.y >= rect.y + rect.height ||
                testReservedRect.y + testReservedRect.height <= rect.y
              );
              return !noOverlap;
            });

            if (!hasOverlap) {
              bestPosition = { 
                x: gx, 
                y: gy, 
                width: reducedWidth, 
                height: reducedHeight 
              };
              foundNonOverlapping = true;
            }
          }
        }
      }

      if (bestPosition) {
        // Round to integer pixels for fallback placement too
        const roundedX = Math.round(bestPosition.x);
        const roundedY = Math.round(bestPosition.y);
        const roundedWidth = Math.round(bestPosition.width);
        const roundedHeight = Math.round(bestPosition.height);
        
        placements.push({
          item: item,
          x: roundedX,
          y: roundedY,
          width: roundedWidth,
          height: roundedHeight,
        });

        occupiedSpace.push({
          x: roundedX,
          y: roundedY,
          width: roundedWidth + gap,
          height: roundedHeight + gap,
        });
        if (isTargetImage) {
          console.log(`🎯 Target image ${i} FALLBACK PLACED at (${roundedX}, ${roundedY}) size ${roundedWidth}x${roundedHeight}`);
        } else {
          console.log(`Fallback placed image ${i} at (${roundedX}, ${roundedY}) size ${roundedWidth}x${roundedHeight}`);
        }
        
        // Verify no overlaps after placement
        const finalRect = {
          x: roundedX,
          y: roundedY,
          width: roundedWidth + gap,
          height: roundedHeight + gap,
        };
        const actualOverlaps = occupiedSpace.slice(0, -1).some((rect, rectIndex) => {
          const noOverlap = (
            finalRect.x >= rect.x + rect.width ||
            finalRect.x + finalRect.width <= rect.x ||
            finalRect.y >= rect.y + rect.height ||
            finalRect.y + finalRect.height <= rect.y
          );
          if (!noOverlap) {
            console.error(`ERROR: Fallback image ${i} at (${finalRect.x},${finalRect.y},${finalRect.width}x${finalRect.height}) overlaps with existing rect ${rectIndex} at (${rect.x},${rect.y},${rect.width}x${rect.height})`);
          }
          return !noOverlap;
        });
        if (actualOverlaps) {
          console.error(`ERROR: Fallback placement failed - image ${i} still overlaps!`);
        }
      } else {
        if (isTargetImage) {
          console.error(`🎯 TARGET IMAGE ${i} COULD NOT BE PLACED - SKIPPED!`);
        } else {
          console.warn(`Could not place image ${i} without overlap - skipping`);
        }
      }
    }
  }

  // Calculate actual coverage and verify no overlaps
  const totalPlacedArea = placements.reduce((sum, p) => sum + (p.width * p.height), 0);
  const actualCoverage = totalPlacedArea / containerArea;
  console.log(`Space utilization: ${(actualCoverage * 100).toFixed(1)}% (${placements.length}/${numImages} images placed)`);

  // Final overlap verification with detailed analysis
  let foundOverlaps = false;
  for (let i = 0; i < placements.length; i++) {
    for (let j = i + 1; j < placements.length; j++) {
      const a = placements[i];
      const b = placements[j];
      
      // Check if the actual image areas overlap (not the reserved areas)
      const noOverlap = (
        a.x >= b.x + b.width ||
        a.x + a.width <= b.x ||
        a.y >= b.y + b.height ||
        a.y + a.height <= b.y
      );
      
      if (!noOverlap) {
        console.error(`FINAL OVERLAP DETECTED: Image ${i} at (${a.x.toFixed(1)},${a.y.toFixed(1)},${a.width.toFixed(1)}x${a.height.toFixed(1)}) overlaps with Image ${j} at (${b.x.toFixed(1)},${b.y.toFixed(1)},${b.width.toFixed(1)}x${b.height.toFixed(1)})`);
        console.error(`  Image ${i} occupies: (${a.x},${a.y}) to (${a.x + a.width},${a.y + a.height})`);
        console.error(`  Image ${j} occupies: (${b.x},${b.y}) to (${b.x + b.width},${b.y + b.height})`);
        foundOverlaps = true;
      }
      
      // Check for very close proximity (might cause visual issues)
      const horizontalGap = Math.min(
        Math.abs(a.x + a.width - b.x),
        Math.abs(b.x + b.width - a.x)
      );
      const verticalGap = Math.min(
        Math.abs(a.y + a.height - b.y),
        Math.abs(b.y + b.height - a.y)
      );
      
      if ((horizontalGap < gap || verticalGap < gap) && !noOverlap) {
        console.warn(`Images ${i} and ${j} are very close: h_gap=${horizontalGap}, v_gap=${verticalGap}, expected_gap=${gap}`);
      }
    }
  }
  if (!foundOverlaps) {
    console.log("✓ Final verification: No mathematical overlaps detected");
  }

  return placements;
}

function applyCollageLayout(placements, container) {
  console.log(`Applying collage layout with ${placements.length} placements`);

  // First, hide all images that weren't placed
  const allImages = Array.from(container.querySelectorAll("img"));
  const placedImages = new Set(placements.map(p => p.item.img));
  
  allImages.forEach(img => {
    if (!placedImages.has(img)) {
      console.warn(`Hiding unplaced image: ${img.src.substring(img.src.lastIndexOf('/') + 1, img.src.lastIndexOf('/') + 20)}...`);
      img.style.display = 'none';
    }
  });

  placements.forEach((placement, index) => {
    Object.assign(placement.item.img.style, {
      position: "absolute",
      top: `${placement.y}px`,
      left: `${placement.x}px`,
      width: `${placement.width}px`,
      height: `${placement.height}px`,
      display: 'block',
    });

    console.log(
      `Image ${index}: placed at (${placement.x.toFixed(1)}, ${
        placement.y.toFixed(1)
      }) with size ${placement.width.toFixed(1)}x${
        placement.height.toFixed(1)
      }`,
    );
  });
}

async function computeCollage() {
  const container = document.querySelector(".collage-grid");
  if (!container) return;

  const gap = 12;
  const containerWidth = container.offsetWidth;
  const containerHeight = container.offsetHeight;

  console.log(`Container dimensions: ${containerWidth}x${containerHeight}`);

  if (containerWidth === 0 || containerHeight === 0) {
    requestAnimationFrame(computeCollage);
    return;
  }

  const galleryUri = container.dataset.galleryUri;
  if (galleryUri) {
    try {
      const galleryData = await fetchGalleryData(galleryUri);
      console.log(`Fetched ${galleryData.items.length} items from gallery`);

      container.innerHTML = "";
      const imageData = galleryData.items.map((item, _index) => {
        const img = document.createElement("img");
        img.src = item.thumb;
        img.alt = "Gallery image";
        img.dataset.width = item.aspectRatio?.width || item.width || 800;
        img.dataset.height = item.aspectRatio?.height || item.height || 600;
        container.appendChild(img);

        const width = parseFloat(img.dataset.width);
        const height = parseFloat(img.dataset.height);
        return {
          img,
          aspectRatio: width / height,
        };
      });

      console.log(`Processing ${imageData.length} images for collage`);

      const placements = calculateCollageLayout(
        imageData,
        containerWidth,
        containerHeight,
        gap,
      );
      applyCollageLayout(placements, container);

      await waitForImagesLoaded(imageData.map((item) => item.img));
      signalScreenshotReady();
    } catch (error) {
      console.error("Failed to load gallery:", error);
      container.innerHTML =
        '<div style="color: red; padding: 20px;">Failed to load gallery data</div>';
    }
  } else {
    const images = Array.from(container.querySelectorAll("img"));
    if (images.length === 0) return;

    const imageData = images.map((img) => {
      const width = parseFloat(img.dataset.width) || img.naturalWidth || 800;
      const height = parseFloat(img.dataset.height) || img.naturalHeight || 600;
      return { img, aspectRatio: width / height };
    });

    console.log(`Processing ${imageData.length} images for collage`);

    const placements = calculateCollageLayout(
      imageData,
      containerWidth,
      containerHeight,
      gap,
    );
    applyCollageLayout(placements, container);

    await waitForImagesLoaded(images);
    signalScreenshotReady();
  }
}

document.addEventListener("DOMContentLoaded", function () {
  const images = document.querySelectorAll(".collage-grid img");
  let loadedCount = 0;

  function checkAllLoaded() {
    loadedCount++;
    if (loadedCount === images.length) {
      computeCollage();
    }
  }

  if (images.length === 0) {
    computeCollage();
  } else {
    images.forEach((img) => {
      if (img.complete) {
        checkAllLoaded();
      } else {
        img.addEventListener("load", checkAllLoaded);
        img.addEventListener("error", checkAllLoaded);
      }
    });
  }
});

globalThis.addEventListener("resize", computeCollage);

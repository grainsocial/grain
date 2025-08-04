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
    console.error('Failed to fetch gallery data:', error);
    throw error;
  }
}

async function waitForImagesLoaded(images) {
  console.log(`Waiting for ${images.length} images to load...`);
  
  const imagePromises = images.map(img => {
    return new Promise((resolve) => {
      if (img.complete) {
        resolve();
      } else {
        img.addEventListener('load', resolve);
        img.addEventListener('error', () => {
          console.warn(`Image failed to load: ${img.src}`);
          resolve(); // Still resolve to continue with layout
        });
        
        // Timeout after 10 seconds
        setTimeout(() => {
          console.warn(`Image load timeout: ${img.src}`);
          resolve();
        }, 10000);
      }
    });
  });
  
  await Promise.all(imagePromises);
  console.log('All images loaded');
}

function signalScreenshotReady() {
  console.log('Signaling screenshot ready');
  document.body.dataset.screenshotReady = 'true';
  
  // Also dispatch a custom event for more flexibility
  const event = new CustomEvent('screenshotReady', {
    detail: { timestamp: Date.now() }
  });
  document.dispatchEvent(event);
}

async function computeJustified() {
  const container = document.querySelector(".adaptive-grid");
  if (!container) return;

  const spacing = 6;
  const containerWidth = container.offsetWidth;
  const containerHeight = container.offsetHeight;

  // Debug: Log container dimensions
  console.log(`Container dimensions: ${containerWidth}x${containerHeight}`);

  if (containerWidth === 0 || containerHeight === 0) {
    requestAnimationFrame(computeJustified);
    return;
  }

  // Check if we should fetch data client-side
  const galleryUri = container.dataset.galleryUri;
  if (galleryUri) {
    try {
      const galleryData = await fetchGalleryData(galleryUri);
      console.log(`Fetched ${galleryData.items.length} items from gallery`);
      
      // Create image elements and data from fetched gallery
      container.innerHTML = ''; // Clear existing content
      const imageData = galleryData.items.map((item, _index) => {
        const img = document.createElement('img');
        img.src = item.thumb;
        img.alt = 'Gallery image';
        img.dataset.width = item.aspectRatio?.width || item.width || 800;
        img.dataset.height = item.aspectRatio?.height || item.height || 600;
        container.appendChild(img);
        
        const width = parseFloat(img.dataset.width);
        const height = parseFloat(img.dataset.height);
        return { 
          img, 
          aspectRatio: width / height 
        };
      });
      
      console.log(`Processing ${imageData.length} images`);

      // Calculate optimal layout that fills space while maintaining aspect ratios
      const layout = calculateOptimalLayout(imageData, containerWidth, containerHeight, spacing);
      console.log(`Selected layout with ${layout.rows.length} rows, efficiency: ${layout.efficiency}, space utilization: ${(layout.spaceUtilization * 100).toFixed(1)}%`);
      
      applyLayout(layout, container);
      
      // Wait for all images to load before signaling ready
      await waitForImagesLoaded(imageData.map(item => item.img));
      signalScreenshotReady();
      
    } catch (error) {
      console.error('Failed to load gallery:', error);
      container.innerHTML = '<div style="color: red; padding: 20px;">Failed to load gallery data</div>';
    }
  } else {
    // Fallback to existing approach with pre-rendered images
    const images = Array.from(container.querySelectorAll("img"));
    if (images.length === 0) return;

    // Get image aspect ratios
    const imageData = images.map(img => {
      const width = parseFloat(img.dataset.width) || img.naturalWidth || 800;
      const height = parseFloat(img.dataset.height) || img.naturalHeight || 600;
      return { img, aspectRatio: width / height };
    });

    console.log(`Processing ${imageData.length} images`);

    // Calculate optimal layout that fills space while maintaining aspect ratios
    const layout = calculateOptimalLayout(imageData, containerWidth, containerHeight, spacing);
    console.log(`Selected layout with ${layout.rows.length} rows, efficiency: ${layout.efficiency}, space utilization: ${(layout.spaceUtilization * 100).toFixed(1)}%`);
    
    applyLayout(layout, container);
    
    // For pre-rendered images, wait for them to load then signal ready
    await waitForImagesLoaded(images);
    signalScreenshotReady();
  }
}

function calculateOptimalLayout(imageData, containerWidth, containerHeight, spacing) {
  // Try different approaches and pick the best one
  const approaches = [];
  
  // Try 1 to N rows (or reasonable limit for performance)
  const maxRows = Math.min(imageData.length, Math.ceil(Math.sqrt(imageData.length)) + 3);
  for (let numRows = 1; numRows <= maxRows; numRows++) {
    const layout = tryRowLayout(imageData, numRows, containerWidth, containerHeight, spacing);
    if (layout) {
      // Calculate actual space utilization (width * height used)
      // For layouts that need scaling, calculate the actual space they'll use after scaling
      const actualMaxWidth = layout.maxWidth * layout.efficiency;
      const actualHeight = layout.totalHeight * layout.efficiency;
      layout.spaceUtilization = (actualMaxWidth / containerWidth) * (actualHeight / containerHeight);
      
      console.log(`  ${numRows} rows: efficiency=${layout.efficiency.toFixed(3)}, max_width=${layout.maxWidth.toFixed(0)}, actual_width=${actualMaxWidth.toFixed(0)}, space=${(layout.spaceUtilization * 100).toFixed(1)}%`);
      approaches.push(layout);
    }
  }
  
  // Return the layout with the best space utilization
  return approaches.reduce((best, current) => {
    // Simply pick the layout with the highest space utilization
    return current.spaceUtilization > best.spaceUtilization ? current : best;
  });
}

function tryRowLayout(imageData, numRows, containerWidth, containerHeight, spacing) {
  // Distribute images across rows maintaining original order
  const rows = Array.from({ length: numRows }, () => []);
  
  // Distribute images in original order with balanced aspect ratios
  const totalAspectRatio = imageData.reduce((sum, item) => sum + item.aspectRatio, 0);
  const targetAspectRatioPerRow = totalAspectRatio / numRows;
  
  let currentIndex = 0;
  let currentRowIndex = 0;
  
  while (currentIndex < imageData.length && currentRowIndex < numRows) {
    let currentRowAspectRatio = 0;
    
    // Add items to current row until we reach target aspect ratio or run out of items
    while (currentIndex < imageData.length && currentRowIndex < numRows) {
      const nextItem = imageData[currentIndex];
      const wouldBeAspectRatio = currentRowAspectRatio + nextItem.aspectRatio;
      
      // If this is the last row, add all remaining items
      if (currentRowIndex === numRows - 1) {
        rows[currentRowIndex].push(nextItem);
        currentRowAspectRatio = wouldBeAspectRatio;
        currentIndex++;
      }
      // If adding this item would exceed target by more than not adding it, move to next row
      else if (rows[currentRowIndex].length > 0 && 
               Math.abs(wouldBeAspectRatio - targetAspectRatioPerRow) > 
               Math.abs(currentRowAspectRatio - targetAspectRatioPerRow)) {
        break;
      }
      // Add the item to current row
      else {
        rows[currentRowIndex].push(nextItem);
        currentRowAspectRatio = wouldBeAspectRatio;
        currentIndex++;
      }
    }
    
    currentRowIndex++;
  }
  
  // Filter out empty rows
  const nonEmptyRows = rows.filter(row => row.length > 0);
  
  // Calculate average height per row to fit container height
  const totalSpacingHeight = (nonEmptyRows.length - 1) * spacing;
  const availableHeightForRows = containerHeight - totalSpacingHeight;
  const averageRowHeight = availableHeightForRows / nonEmptyRows.length;
  
  // For each row, use the average height and calculate resulting width
  const rowData = nonEmptyRows.map(row => {
    const totalAspectRatio = row.reduce((sum, item) => sum + item.aspectRatio, 0);
    const resultingWidth = (averageRowHeight * totalAspectRatio) + (row.length - 1) * spacing;
    return {
      items: row,
      height: averageRowHeight,
      resultingWidth,
      totalAspectRatio
    };
  });
  
  // Check if any row exceeds container width
  const maxWidth = Math.max(...rowData.map(row => row.resultingWidth));
  const efficiency = Math.min(1, containerWidth / maxWidth);
  
  return {
    rows: rowData.map(row => ({
      items: row.items,
      height: row.height,
      totalAspectRatio: row.totalAspectRatio
    })),
    efficiency,
    totalHeight: containerHeight,
    maxWidth
  };
}

function applyLayout(layout, container) {
  const spacing = 6;
  const containerHeight = container.offsetHeight;
  
  // Scale down if any row exceeds container width
  const scale = layout.efficiency;
  
  let yOffset = 0;

  layout.rows.forEach((row, rowIndex) => {
    let xOffset = 0;
    let rowWidth = 0;
    
    const finalRowHeight = row.height * scale;
    
    row.items.forEach(item => {
      const width = finalRowHeight * item.aspectRatio;
      
      Object.assign(item.img.style, {
        position: "absolute",
        top: `${yOffset}px`,
        left: `${xOffset}px`,
        width: `${width}px`,
        height: `${finalRowHeight}px`,
      });
      
      xOffset += width + spacing;
      rowWidth += width;
    });
    
    rowWidth += (row.items.length - 1) * spacing;
    console.log(`Row ${rowIndex}: height=${finalRowHeight.toFixed(2)}, width=${rowWidth.toFixed(2)}, max_width=${layout.maxWidth?.toFixed(2)}, efficiency=${layout.efficiency.toFixed(3)}`);
    
    yOffset += finalRowHeight + spacing;
  });

  console.log(`Total layout height: ${yOffset - spacing}, container height: ${containerHeight}`);
  container.style.position = "relative";
  container.style.height = `${yOffset - spacing}px`;
}

// Run layout when page loads and images are loaded
document.addEventListener("DOMContentLoaded", function () {
  // Wait for images to load to get natural dimensions
  const images = document.querySelectorAll(".adaptive-grid img");
  let loadedCount = 0;

  function checkAllLoaded() {
    loadedCount++;
    if (loadedCount === images.length) {
      computeJustified();
    }
  }

  if (images.length === 0) {
    computeJustified();
  } else {
    images.forEach((img) => {
      if (img.complete) {
        checkAllLoaded();
      } else {
        img.addEventListener("load", checkAllLoaded);
        img.addEventListener("error", checkAllLoaded); // Still layout even if image fails
      }
    });
  }
});

// Re-run layout on window resize
globalThis.addEventListener("resize", computeJustified);

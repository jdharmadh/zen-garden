// Enhanced Zen Garden with three natural tools
// Config
const CELL_COLS = 64;   // grid width in "pixels"
const CELL_ROWS = 40;   // grid height in "pixels"
const STORAGE_KEY = "zenGarden_v2";

// Tool types
const TOOLS = {
  WAND: 'wand',
  SMOOTHER: 'smoother', 
  RAKE: 'rake',
  PLANT: 'plant',
  ROCK: 'rock'
};

// DOM
const canvas = document.getElementById("garden");
const ctx = canvas.getContext("2d", { willReadFrequently: false });
const btnClear = document.getElementById("clear");
const btnRandom = document.getElementById("randomize");
const shareResult = document.getElementById("shareResult");

// New toolbar elements
const shareToolbarBtn = document.getElementById("shareToolbar");
const shareResultToolbar = document.getElementById("shareResultToolbar");
const createOwnBtn = document.getElementById("createOwn");
const editModeActions = document.getElementById("editModeActions");
const readOnlyActions = document.getElementById("readOnlyActions");

// Tool buttons
const wandBtn = document.getElementById("wandTool");
const smootherBtn = document.getElementById("smootherTool");
const rakeBtn = document.getElementById("rakeTool");
const plantBtn = document.getElementById("plantTool");
const rockBtn = document.getElementById("rockTool");

// Responsive elements
const responsiveMessage = document.getElementById("responsiveMessage");
const mainContent = document.getElementById("mainContent");

// Responsive check function
function checkResponsive() {
  const minWidth = 1024;
  const minHeight = 690;
  const currentWidth = window.innerWidth;
  const currentHeight = window.innerHeight;
  
  // Update the message content with current screen size
  const messageContent = document.querySelector('.message-content');
  if (messageContent) {
    const isWidthTooSmall = currentWidth < minWidth;
    const isHeightTooSmall = currentHeight < minHeight;
    
    messageContent.innerHTML = `
      <h2>Please Use Fullscreen</h2>
      <p>This zen garden experience requires a minimum screen size of 1024×690 pixels.</p>
      <p><strong>Your current screen size:</strong> ${currentWidth}×${currentHeight} pixels</p>
      <p>Please expand your browser window or use a larger device.</p>
    `;
  }
  
  if (currentWidth < minWidth || currentHeight < minHeight) {
    responsiveMessage.style.display = 'flex';
    mainContent.style.display = 'none';
  } else {
    responsiveMessage.style.display = 'none';
    mainContent.style.display = 'flex';
  }
}

// State: each cell can have type and intensity/color variation
// cell format: { type: 0=sand, 1=mark, 2=smoothed, 3=raked_light, 4=raked_dark, variation: 0-1 }
let grid = createEmptyGrid();
let drawing = false;
let currentTool = TOOLS.WAND;
let cellW = 10, cellH = 10;
let isReadOnly = false;
let mousePos = { x: 0, y: 0 };
let rakePhase = 0; // for alternating rake pattern

// Unified object system for plants and rocks
let objects = []; // Array of object items: { id, x, y, type, imageIndex, width, height, image }
let plantImages = []; // Pre-loaded plant images
let rockImages = []; // Pre-loaded rock images
let draggedObject = null; // Currently dragged object
let dragOffset = { x: 0, y: 0 }; // Offset from object center when dragging
const PLANT_SIZE = 60; // Default plant size (scaled from 480px originals)
const ROCK_SIZE = 64; // Rock size (already 72x72 pixels)

// Object types
const OBJECT_TYPES = {
  PLANT: 'plant',
  ROCK: 'rock'
};

// Natural color variations - create randomness only once when cell is created
function getRandomVariation() {
    return (0.98 + Math.random() * 0.04); // 0.98 to 1.02 variation (reduced for subtler differences)
}

function createEmptyGrid() {
  return Array.from({length: CELL_ROWS}, () => 
    Array.from({length: CELL_COLS}, () => ({ 
      type: 0, 
      variation: getRandomVariation() 
    }))
  );
}

// Copy link to clipboard function
function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(() => {
    // Show temporary feedback
    const copyBtn = document.getElementById('copyLinkBtn');
    if (copyBtn) {
      const originalText = copyBtn.textContent;
      copyBtn.textContent = 'Copied!';
      copyBtn.disabled = true;
    }
  }).catch(err => {
    console.error('Failed to copy link:', err);
    // Fallback for older browsers
    const textArea = document.createElement('textarea');
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.select();
    try {
      document.execCommand('copy');
      const copyBtn = document.getElementById('copyLinkBtn');
      if (copyBtn) {
        const originalText = copyBtn.textContent;
        copyBtn.textContent = 'Copied!';
        copyBtn.disabled = true;
      }
    } catch (fallbackErr) {
      console.error('Fallback copy failed:', fallbackErr);
    }
    document.body.removeChild(textArea);
  });
}

// Natural color generators - using fixed variation, no random sampling on each call
function getSandColor(variation = 1) {
  const base = { r: 243, g: 230, b: 203 }; // #f3e6cb
  const v = variation; // use the stored variation directly
  return `rgb(${Math.floor(base.r * v)}, ${Math.floor(base.g * v)}, ${Math.floor(base.b * v)})`;
}

function getMarkColor(variation = 1) {
  const base = { r: 169, g: 143, b: 123 }; // #a98f7b
  const v = variation;
  return `rgb(${Math.floor(base.r * v)}, ${Math.floor(base.g * v)}, ${Math.floor(base.b * v)})`;
}

function getSmoothedColor(variation = 1) {
  const base = { r: 238, g: 223, b: 179 }; // lighter sand
  const v = variation;
  return `rgb(${Math.floor(base.r * v)}, ${Math.floor(base.g * v)}, ${Math.floor(base.b * v)})`;
}

function getRakedLightColor(variation = 1) {
  const base = { r: 248, g: 238, b: 215 }; // very light
  const v = variation;
  return `rgb(${Math.floor(base.r * v)}, ${Math.floor(base.g * v)}, ${Math.floor(base.b * v)})`;
}

function getRakedDarkColor(variation = 1) {
  const base = { r: 180, g: 160, b: 130 }; // darker than mark
  const v = variation;
  return `rgb(${Math.floor(base.r * v)}, ${Math.floor(base.g * v)}, ${Math.floor(base.b * v)})`;
}

// Object management functions
function loadPlantImages() {
  return Promise.all(
    Array.from({length: 10}, (_, i) => {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = `../images/plants/plant${i + 1}.png`;
      });
    })
  );
}

function loadRockImages() {
  return Promise.all(
    Array.from({length: 6}, (_, i) => {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = `../images/rocks/rock${i + 1}.png`;
      });
    })
  );
}

function createObject(x, y, type, imageIndex) {
  const isPlant = type === OBJECT_TYPES.PLANT;
  const images = isPlant ? plantImages : rockImages;
  const size = isPlant ? PLANT_SIZE : ROCK_SIZE;
  
  return {
    id: Date.now() + Math.random(), // unique ID
    x: x,
    y: y,
    type: type,
    imageIndex: imageIndex,
    width: size,
    height: size,
    image: images[imageIndex]
  };
}

function findRandomEmptySpace(objectType) {
  const maxAttempts = 100;
  const size = objectType === OBJECT_TYPES.PLANT ? PLANT_SIZE : ROCK_SIZE;
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const x = Math.random() * (canvas.width - size);
    const y = Math.random() * (canvas.height - size);
    
    if (isSpaceFree(x, y, size, size)) {
      return { x, y };
    }
  }
  return null; // No free space found
}

function isSpaceFree(x, y, width, height, excludeObjectId = null) {
  // Check collision with other objects (both plants and rocks)
  for (const obj of objects) {
    if (excludeObjectId && obj.id === excludeObjectId) continue;
    
    if (x < obj.x + obj.width &&
        x + width > obj.x &&
        y < obj.y + obj.height &&
        y + height > obj.y) {
      return false; // Collision detected
    }
  }
  return true;
}

function getObjectAt(x, y) {
  // Check objects in reverse order (top-most first)
  for (let i = objects.length - 1; i >= 0; i--) {
    const obj = objects[i];
    if (x >= obj.x && x <= obj.x + obj.width &&
        y >= obj.y && y <= obj.y + obj.height) {
      return obj;
    }
  }
  return null;
}

function placeObject(x, y, objectType) {
  const size = objectType === OBJECT_TYPES.PLANT ? PLANT_SIZE : ROCK_SIZE;
  const images = objectType === OBJECT_TYPES.PLANT ? plantImages : rockImages;
  
  // Check if the specified location is free
  if (!isSpaceFree(x - size / 2, y - size / 2, size, size)) {
    const objectName = objectType === OBJECT_TYPES.PLANT ? "plant" : "rock";
    shareResult.textContent = `Cannot place ${objectName} here!`;
    setTimeout(() => shareResult.textContent = "", 3000);
    return false;
  }
  
  // Constrain to canvas bounds
  const constrainedX = Math.max(0, Math.min(canvas.width - size, x - size / 2));
  const constrainedY = Math.max(0, Math.min(canvas.height - size, y - size / 2));
  
  const randomImageIndex = Math.floor(Math.random() * images.length);
  const newObject = createObject(constrainedX, constrainedY, objectType, randomImageIndex);
  objects.push(newObject);
  return true;
}

function addRandomObjects() {
  // Clear existing objects first
  objects = [];
  
  // Add 3-5 random plants if plant images are loaded
  if (plantImages.length > 0) {
    const numPlants = 3 + Math.floor(Math.random() * 3); // 3-5 plants
    addRandomObjectsOfType(OBJECT_TYPES.PLANT, numPlants);
  }
  
  // Add 2-4 random rocks if rock images are loaded
  if (rockImages.length > 0) {
    const numRocks = 2 + Math.floor(Math.random() * 3); // 2-4 rocks
    addRandomObjectsOfType(OBJECT_TYPES.ROCK, numRocks);
  }
}

function addRandomObjectsOfType(objectType, count) {
  const images = objectType === OBJECT_TYPES.PLANT ? plantImages : rockImages;
  let objectsAdded = 0;
  let attempts = 0;
  const maxAttempts = 50; // Prevent infinite loop
  
  while (objectsAdded < count && attempts < maxAttempts) {
    const space = findRandomEmptySpace(objectType);
    if (space) {
      const randomImageIndex = Math.floor(Math.random() * images.length);
      const newObject = createObject(space.x, space.y, objectType, randomImageIndex);
      objects.push(newObject);
      objectsAdded++;
    }
    attempts++;
  }
}

// Tool selection
function selectTool(tool) {
  currentTool = tool;
  document.querySelectorAll('.tool-btn').forEach(btn => btn.classList.remove('active'));
  
  // Update tool instructions
  const toolInstructions = document.getElementById('toolInstructions');
  
  switch(tool) {
    case TOOLS.WAND:
      wandBtn.classList.add('active');
      canvas.style.cursor = 'crosshair';
      toolInstructions.textContent = 'Drag to create flowing marks in the sand.';
      break;
    case TOOLS.SMOOTHER:
      smootherBtn.classList.add('active');
      canvas.style.cursor = 'grab';
      toolInstructions.textContent = 'Drag to smooth and blend the sand.';
      break;
    case TOOLS.RAKE:
      rakeBtn.classList.add('active');
      canvas.style.cursor = 'grab';
      toolInstructions.textContent = 'Drag to create light and dark rake patterns.';
      break;
    case TOOLS.PLANT:
      plantBtn.classList.add('active');
      canvas.style.cursor = 'pointer';
      toolInstructions.textContent = 'Click to place plants. Drag to move, shift-click to delete.';
      break;
    case TOOLS.ROCK:
      rockBtn.classList.add('active');
      canvas.style.cursor = 'pointer';
      toolInstructions.textContent = 'Click to place rocks. Drag to move, shift-click to delete.';
      break;
  }
}

// Tool event listeners
wandBtn.addEventListener('click', () => selectTool(TOOLS.WAND));
smootherBtn.addEventListener('click', () => selectTool(TOOLS.SMOOTHER));
rakeBtn.addEventListener('click', () => selectTool(TOOLS.RAKE));
plantBtn.addEventListener('click', () => selectTool(TOOLS.PLANT));
rockBtn.addEventListener('click', () => selectTool(TOOLS.ROCK));

function resizeCanvasToDisplaySize() {
  const rect = canvas.getBoundingClientRect();
  
  // Calculate optimal cell size while maintaining aspect ratio
  const availableWidth = rect.width;
  const availableHeight = rect.height;
  
  // Calculate cell size based on available space
  const cellWFromWidth = Math.floor(availableWidth / CELL_COLS);
  const cellHFromHeight = Math.floor(availableHeight / CELL_ROWS);
  
  // Use the smaller to maintain aspect ratio
  const optimalCellSize = Math.min(cellWFromWidth, cellHFromHeight);
  cellW = Math.max(4, optimalCellSize);
  cellH = Math.max(4, optimalCellSize);
  
  // Set canvas internal size
  canvas.width = CELL_COLS * cellW;
  canvas.height = CELL_ROWS * cellH;
  
  render();
}

window.addEventListener("resize", () => {
  checkResponsive();
  resizeCanvasToDisplaySize();
});

// Enhanced rendering with natural variations
function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  for (let r = 0; r < CELL_ROWS; r++) {
    for (let c = 0; c < CELL_COLS; c++) {
      const x = c * cellW;
      const y = r * cellH;
      const cell = grid[r][c];
      
      let fillColor;
      switch(cell.type) {
        case 0: // sand
          fillColor = getSandColor(cell.variation);
          break;
        case 1: // wand mark
          fillColor = getMarkColor(cell.variation);
          break;
        case 2: // smoothed
          fillColor = getSmoothedColor(cell.variation);
          break;
        case 3: // raked light
          fillColor = getRakedLightColor(cell.variation);
          break;
        case 4: // raked dark
          fillColor = getRakedDarkColor(cell.variation);
          break;
        default:
          fillColor = getSandColor(cell.variation);
      }
      
      ctx.fillStyle = fillColor;
      ctx.fillRect(x, y, cellW, cellH);
      
      // Add subtle texture to sand with consistent colors
      if (cell.type === 0 && (r + c) % 7 === 0) {
        ctx.fillStyle = getSandColor(cell.variation * 0.95);
        const dotSize = Math.max(1, cellW * 0.15);
        ctx.fillRect(
          x + cellW * 0.25, 
          y + cellH * 0.25, 
          dotSize, 
          dotSize
        );
      }
    }
  }
  
  // Draw objects on top of sand
  drawObjects();
  
  // Draw tool cursor overlay
  drawToolCursor();
}

// Draw all objects (plants and rocks)
function drawObjects() {
  for (const obj of objects) {
    if (obj.image && obj.image.complete) {
      ctx.drawImage(
        obj.image,
        obj.x,
        obj.y,
        obj.width,
        obj.height
      );
    }
  }
}

// Draw tool-specific cursor overlay
function drawToolCursor() {
  if (isReadOnly || draggedObject) return; // Don't show cursor when dragging or in read-only
  
  const cell = pointerToCell(mousePos.x, mousePos.y);
  if (!cell) return;
  
  const x = cell.c * cellW;
  const y = cell.r * cellH;
  
  ctx.strokeStyle = 'rgba(255, 0, 0, 0.4)';
  ctx.lineWidth = 1;
  
  switch(currentTool) {
    case TOOLS.WAND:
      // Small square outline
      ctx.strokeRect(x + 1, y + 1, cellW - 2, cellH - 2);
      break;
    case TOOLS.SMOOTHER:
      // Long thin rectangle
      const smootherW = cellW * 3;
      const smootherH = cellH * 0.5;
      ctx.strokeRect(
        x - cellW, 
        y + cellH * 0.25, 
        smootherW, 
        smootherH
      );
      break;
    case TOOLS.RAKE:
      // Rake pattern preview
      const rakeW = cellW * 4;
      const rakeH = cellH * 0.3;
    //   ctx.strokeRect(x - cellW, y + cellH * 0.35, rakeW, rakeH);
      // Show rake teeth
      for (let i = 0; i < 4; i++) {
        ctx.strokeRect(
          x - cellW + i * cellW, 
          y + cellH * 0.1, 
          cellW * 0.8, 
          cellH * 0.8
        );
      }
      break;
    case TOOLS.PLANT:
    case TOOLS.ROCK:
      // Object placement preview - show a rectangle where object would be placed
      const rect = canvas.getBoundingClientRect();
      const canvasX = (mousePos.x - rect.left) * (canvas.width / rect.width);
      const canvasY = (mousePos.y - rect.top) * (canvas.height / rect.height);
      
      const size = currentTool === TOOLS.PLANT ? PLANT_SIZE : ROCK_SIZE;
      const objectType = currentTool === TOOLS.PLANT ? OBJECT_TYPES.PLANT : OBJECT_TYPES.ROCK;
      const placementX = canvasX - size / 2;
      const placementY = canvasY - size / 2;
      
      // Check if hovering over a draggable object of the same type
      const objectAtPoint = getObjectAt(canvasX, canvasY);
      if (objectAtPoint && objectAtPoint.type === objectType) {
        // Draw cyan square around draggable object
        ctx.strokeStyle = 'rgba(0, 255, 255, 0.8)'; // cyan
        ctx.lineWidth = 3;
        ctx.strokeRect(objectAtPoint.x, objectAtPoint.y, objectAtPoint.width, objectAtPoint.height);
      } else {
        // Check if placement would conflict with existing objects
        const wouldConflict = !isSpaceFree(placementX, placementY, size, size);
        
        if (wouldConflict) {
          // Draw red X for conflict
          ctx.strokeStyle = 'rgba(255, 0, 0, 0.8)';
          ctx.lineWidth = 3;
          const centerX = canvasX;
          const centerY = canvasY;
          const crossSize = size * 0.3;
          
          // Draw X
          ctx.beginPath();
          ctx.moveTo(centerX - crossSize, centerY - crossSize);
          ctx.lineTo(centerX + crossSize, centerY + crossSize);
          ctx.moveTo(centerX + crossSize, centerY - crossSize);
          ctx.lineTo(centerX - crossSize, centerY + crossSize);
          ctx.stroke();
        } else {
          // Draw placement preview rectangle
          const color = currentTool === TOOLS.PLANT ? 'rgba(0, 255, 0, 0.6)' : 'rgba(139, 69, 19, 0.6)'; // green for plants, brown for rocks
          
          ctx.strokeStyle = color;
          ctx.lineWidth = 2;
          ctx.strokeRect(placementX, placementY, size, size);
        }
      }
      break;
  }
}

// Input -> map pointer to cell coords
function pointerToCell(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const cssX = clientX - rect.left;
  const cssY = clientY - rect.top;
  const c = Math.floor(cssX / (rect.width / CELL_COLS));
  const r = Math.floor(cssY / (rect.height / CELL_ROWS));
  if (r < 0 || r >= CELL_ROWS || c < 0 || c >= CELL_COLS) return null;
  return {r, c};
}

// Tool-specific painting functions
function applyWandTool(r, c) {
  if (r < 0 || r >= CELL_ROWS || c < 0 || c >= CELL_COLS) return;
  
  const cell = grid[r][c];
  if (cell.type === 0 || cell.type === 2 || cell.type === 3 || cell.type === 4) {
    // Drawing on any type of sand (untouched, smoothed, or raked) - create mark
    cell.type = 1;
    cell.variation = getRandomVariation();
  } else if (cell.type === 1) {
    // Drawing over existing mark - change color/intensity
    cell.variation = getRandomVariation() * 0.7; // darker variation
  }
}

function applySmootherTool(r, c) {
  // Smoother affects a wider area and leaves imperfect results
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -2; dc <= 2; dc++) {
      const nr = r + dr;
      const nc = c + dc;
      if (nr < 0 || nr >= CELL_ROWS || nc < 0 || nc >= CELL_COLS) continue;
      
      // Probability decreases with distance from center
      const distance = Math.abs(dr) + Math.abs(dc) * 0.5;
      const probability = Math.max(0, 1 - distance * 0.3);
      
      if (Math.random() < probability) {
        const cell = grid[nr][nc];
        if (cell.type !== 0) {
          // Convert to smoothed sand with some randomness
          if (Math.random() < 0.8) {
            cell.type = 2; // smoothed
            cell.variation = getRandomVariation();
          } else {
            // Sometimes leave tiny imperfections
            cell.type = 0;
            cell.variation = getRandomVariation();
          }
        } else {
          // If it's already sand (type 0), resample it to create some smoothed areas
          if (Math.random() < 0.6) {
            cell.type = 2; // convert to smoothed
            cell.variation = getRandomVariation();
          } else {
            // Just resample the variation for subtle change
            cell.variation = getRandomVariation();
          }
        }
      }
    }
  }
}

function applyRakeTool(r, c) {
  // Rake creates alternating pattern in a line
  for (let dc = -2; dc <= 2; dc++) {
    const nc = c + dc;
    if (nc < 0 || nc >= CELL_COLS) continue;
    
    const cell = grid[r][nc];
    // Alternate between light and dark based on position and phase
    const isLight = (nc + rakePhase) % 2 === 0;
    cell.type = isLight ? 3 : 4; // raked light or dark
    // Apply more noticeable variation to dark blocks - use broader range like 0.6 to 1.0
    cell.variation = isLight ? getRandomVariation() : (0.6 + Math.random() * 0.4);
  }
  rakePhase++; // Change phase for natural variation
}

// Mouse tracking for cursor overlay
let lastCursorCell = null;

canvas.addEventListener('mousemove', (ev) => {
  mousePos.x = ev.clientX;
  mousePos.y = ev.clientY;
  
  if (!drawing && !isReadOnly) {
    const cell = pointerToCell(ev.clientX, ev.clientY);
    // Only redraw if cursor moved to a different cell
    if (!lastCursorCell || !cell || 
        lastCursorCell.r !== cell.r || lastCursorCell.c !== cell.c) {
      lastCursorCell = cell;
      render(); // Redraw to update cursor
    }
  }
});

canvas.addEventListener('mouseleave', () => {
  lastCursorCell = null;
  if (!drawing) {
    render(); // Clear cursor when mouse leaves
  }
});

// Enhanced mouse/touch events with tool-specific behavior
canvas.addEventListener("pointerdown", (ev) => {
  if (isReadOnly) return;
  ev.preventDefault();
  
  const rect = canvas.getBoundingClientRect();
  const canvasX = (ev.clientX - rect.left) * (canvas.width / rect.width);
  const canvasY = (ev.clientY - rect.top) * (canvas.height / rect.height);
  
  if (currentTool === TOOLS.PLANT || currentTool === TOOLS.ROCK) {
    const objectType = currentTool === TOOLS.PLANT ? OBJECT_TYPES.PLANT : OBJECT_TYPES.ROCK;
    
    // Check if shift key is pressed for deletion
    if (ev.shiftKey) {
      const objectAtPoint = getObjectAt(canvasX, canvasY);
      if (objectAtPoint && objectAtPoint.type === objectType) {
        // Delete the object (only if it matches the current tool type)
        const index = objects.indexOf(objectAtPoint);
        if (index > -1) {
          objects.splice(index, 1);
          render();
          autoSaveLocal();
          const objectName = objectType === OBJECT_TYPES.PLANT ? "Plant" : "Rock";
          shareResult.textContent = `${objectName} removed.`;
          setTimeout(() => shareResult.textContent = "", 2000);
        }
      }
      return;
    }
    
    // Check if clicking on an existing object of the same type to start dragging
    const objectAtPoint = getObjectAt(canvasX, canvasY);
    if (objectAtPoint && objectAtPoint.type === objectType) {
      draggedObject = objectAtPoint;
      dragOffset.x = canvasX - objectAtPoint.x;
      dragOffset.y = canvasY - objectAtPoint.y;
      canvas.style.cursor = 'grabbing';
      return;
    }
    
    // Place a new object
    if (placeObject(canvasX, canvasY, objectType)) {
      render();
      autoSaveLocal();
      const objectName = objectType === OBJECT_TYPES.PLANT ? "Plant" : "Rock";
      shareResult.textContent = `${objectName} placed!`;
      setTimeout(() => shareResult.textContent = "", 2000);
    }
    return;
  }
  
  // Handle sand tools
  drawing = true;
  const cell = pointerToCell(ev.clientX, ev.clientY);
  if (!cell) return;
  
  // Apply current tool
  switch(currentTool) {
    case TOOLS.WAND:
      applyWandTool(cell.r, cell.c);
      break;
    case TOOLS.SMOOTHER:
      applySmootherTool(cell.r, cell.c);
      break;
    case TOOLS.RAKE:
      applyRakeTool(cell.r, cell.c);
      break;
  }
  
  render();
});

canvas.addEventListener("pointermove", (ev) => {
  mousePos.x = ev.clientX;
  mousePos.y = ev.clientY;
  
  const rect = canvas.getBoundingClientRect();
  const canvasX = (ev.clientX - rect.left) * (canvas.width / rect.width);
  const canvasY = (ev.clientY - rect.top) * (canvas.height / rect.height);
  
  // Handle object dragging
  if (draggedObject && !isReadOnly) {
    const newX = canvasX - dragOffset.x;
    const newY = canvasY - dragOffset.y;
    
    // Constrain to canvas bounds
    const constrainedX = Math.max(0, Math.min(canvas.width - draggedObject.width, newX));
    const constrainedY = Math.max(0, Math.min(canvas.height - draggedObject.height, newY));
    
    // Check for collisions with other objects
    if (isSpaceFree(constrainedX, constrainedY, draggedObject.width, draggedObject.height, draggedObject.id)) {
      draggedObject.x = constrainedX;
      draggedObject.y = constrainedY;
      render();
    }
    return;
  }
  
  if (!drawing || isReadOnly) {
    return; // Don't update cursor during drawing
  }
  
  const cell = pointerToCell(ev.clientX, ev.clientY);
  if (!cell) return;
  
  // Apply current sand tool
  switch(currentTool) {
    case TOOLS.WAND:
      applyWandTool(cell.r, cell.c);
      break;
    case TOOLS.SMOOTHER:
      applySmootherTool(cell.r, cell.c);
      break;
    case TOOLS.RAKE:
      applyRakeTool(cell.r, cell.c);
      break;
  }
  
  render();
});

window.addEventListener("pointerup", () => {
  if (draggedObject && !isReadOnly) {
    draggedObject = null;
    canvas.style.cursor = (currentTool === TOOLS.PLANT || currentTool === TOOLS.ROCK) ? 'pointer' : 'default';
    autoSaveLocal();
  } else if (drawing && !isReadOnly) {
    drawing = false;
    autoSaveLocal();
  } else {
    drawing = false;
  }
});

// Prevent context menu
canvas.addEventListener("contextmenu", (e) => e.preventDefault());

// Enhanced button functionality
btnClear.addEventListener("click", () => {
  if (isReadOnly) {
    shareResult.textContent = "Cannot clear in read-only mode.";
    return;
  }
  if (!confirm("Clear the garden?")) return;
  grid = createEmptyGrid();
  objects = []; // Clear all objects (plants and rocks)
  render();
  saveToLocal();
  shareResult.textContent = "Cleared.";
});

btnRandom.addEventListener("click", () => {
  if (isReadOnly) {
    shareResult.textContent = "Cannot randomize in read-only mode.";
    return;
  }
  randomizeGrid();
  addRandomObjects(); // Add random objects (plants and rocks) after creating random grid
  render();
  saveToLocal();
  shareResult.textContent = "Random garden generated.";
});

// New toolbar share button event listener
shareToolbarBtn.addEventListener("click", async () => {
  if (isReadOnly) {
    shareResultToolbar.textContent = "Cannot share in read-only mode.";
    return;
  }
  shareResultToolbar.textContent = "Sharing…";
  try {
    // Convert grid to simplified format (only cell types)
    const simplifiedGrid = grid.map(row => 
      row.map(cell => cell.type)
    );
    
    // Convert objects to simplified format
    const simplifiedObjects = objects.map(obj => ({
      x: obj.x,
      y: obj.y,
      type: obj.type,
      imageIndex: obj.imageIndex,
      width: obj.width,
      height: obj.height
    }));
    
    const res = await fetch("/api/garden", {
      method: "POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify({ 
        grid: simplifiedGrid,
        objects: simplifiedObjects, // Now includes both plants and rocks
        version: 5, // Increment version for rock support
        cols: CELL_COLS,
        rows: CELL_ROWS
      })
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const j = await res.json();
    const link = j.link ? j.link : (j.id ? `/garden/${j.id}` : null);
    if (link) {
      const full = window.location.origin + link;
      shareResultToolbar.innerHTML = `Saved! <button id="copyLinkBtn" style="width: 100px;" onclick="copyToClipboard('${full}')">Copy Link</button>`;
    } else {
      shareResultToolbar.textContent = "Saved but no link returned.";
    }
  } catch (err) {
    console.error(err);
    shareResultToolbar.textContent = "Share failed (is the backend running?).";
  }
});

// Create own garden button event listener
createOwnBtn.addEventListener("click", () => {
  window.location.href = "/";
});

// Enhanced localStorage with new format
function saveToLocal() {
  const payload = { 
    grid: grid, 
    objects: objects.map(obj => ({ // Save objects without image objects
      id: obj.id,
      x: obj.x,
      y: obj.y,
      type: obj.type,
      imageIndex: obj.imageIndex,
      width: obj.width,
      height: obj.height
    })),
    cols: CELL_COLS, 
    rows: CELL_ROWS, 
    version: 4, // Increment version for rock support
    ts: Date.now() 
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

function autoSaveLocal() {
  saveToLocal();
}

function loadFromLocal() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    // Try loading old format
    const oldRaw = localStorage.getItem("zenGarden_v1");
    if (oldRaw) {
      return loadOldFormat(oldRaw);
    }
    return false;
  }
  try {
    const data = JSON.parse(raw);
    if (data && data.grid) {
      grid = data.grid;
      
      // Load objects if available (version 4+ has unified objects)
      if (data.objects && (plantImages.length > 0 || rockImages.length > 0)) {
        objects = data.objects.map(obj => {
          const images = obj.type === OBJECT_TYPES.PLANT ? plantImages : rockImages;
          return {
            ...obj,
            image: images[obj.imageIndex]
          };
        });
      } else if (data.plants && plantImages.length > 0) {
        // Handle legacy plant-only format (version 3)
        objects = data.plants.map(p => ({
          ...p,
          type: OBJECT_TYPES.PLANT,
          image: plantImages[p.imageIndex]
        }));
      } else {
        objects = [];
      }
      
      return true;
    }
  } catch(e){}
  return false;
}

function loadOldFormat(raw) {
  try {
    const data = JSON.parse(raw);
    if (data && data.grid && data.grid.length === CELL_ROWS) {
      // Convert old format (numbers) to new format (objects)
      grid = data.grid.map(row => 
        row.map(cell => ({
          type: cell, // 0 or 1 from old format
          variation: getRandomVariation()
        }))
      );
      // Save in new format
      saveToLocal();
      return true;
    }
  } catch(e){}
  return false;
}

// Enhanced random generator with new cell format
function randomizeGrid(density = 0.08) {
  for (let r = 0; r < CELL_ROWS; r++) {
    for (let c = 0; c < CELL_COLS; c++) {
      const rand = Math.random();
      if (rand < density) {
        grid[r][c] = {
          type: Math.random() < 0.7 ? 1 : (Math.random() < 0.5 ? 3 : 4), // mostly marks, some raked
          variation: getRandomVariation()
        };
      } else if (rand < density * 1.5) {
        grid[r][c] = {
          type: 2, // some smoothed areas
          variation: getRandomVariation()
        };
      } else {
        grid[r][c] = {
          type: 0, // sand
          variation: getRandomVariation()
        };
      }
    }
  }
}

// Enhanced URL loading with new format support
async function tryLoadFromUrl() {
  const path = window.location.pathname;
  const match = path.match(/^\/garden\/([A-Za-z0-9-_]+)$/);
  if (!match) return false;
  const id = match[1];
  
  isReadOnly = true;
  
  try {
    const res = await fetch(`/api/garden/${id}`);
    if (!res.ok) {
      console.warn("garden not found:", res.status);
      return false;
    }
    const data = await res.json();
    if (data && data.grid) {
      // Handle different format versions
      if (data.version === 5) {
        // New format with unified objects (plants and rocks)
        grid = data.grid.map(row => 
          row.map(cellType => ({
            type: cellType,
            variation: getRandomVariation()
          }))
        );
        
        // Load objects if available and images are loaded
        if (data.objects && (plantImages.length > 0 || rockImages.length > 0)) {
          objects = data.objects.map(obj => {
            const images = obj.type === OBJECT_TYPES.PLANT ? plantImages : rockImages;
            return {
              ...obj,
              id: Date.now() + Math.random(), // Generate new ID
              image: images[obj.imageIndex]
            };
          });
        } else {
          objects = [];
        }
      } else if (data.version === 4) {
        // Previous format with plants only
        grid = data.grid.map(row => 
          row.map(cellType => ({
            type: cellType,
            variation: getRandomVariation()
          }))
        );
        
        // Load plants if available and images are loaded
        if (data.plants && plantImages.length > 0) {
          objects = data.plants.map(p => ({
            ...p,
            id: Date.now() + Math.random(), // Generate new ID
            type: OBJECT_TYPES.PLANT,
            image: plantImages[p.imageIndex]
          }));
        } else {
          objects = [];
        }
      } else if (data.version === 3) {
        // Previous simplified format - grid is 2D array of cell types only
        grid = data.grid.map(row => 
          row.map(cellType => ({
            type: cellType,
            variation: getRandomVariation()
          }))
        );
        objects = []; // No objects in older versions
      } else if (data.version === 2) {
        // Previous format with full cell objects
        grid = data.grid;
        objects = [];
      } else {
        // Convert legacy format (v1 and older)
        grid = data.grid.map(row => 
          row.map(cell => ({
            type: typeof cell === 'number' ? cell : (cell.type || 0),
            variation: getRandomVariation()
          }))
        );
        objects = [];
      }
      render();
      shareResult.textContent = `Viewing shared garden ${id} (read-only)`;
      updateUIForReadOnly();
      return true;
    }
  } catch (e) {
    console.error(e);
  }
  return false;
}

// Update UI for read-only mode
// Update UI for read-only mode
function updateUIForReadOnly() {
  // Disable buttons in read-only mode
  btnClear.disabled = true;
  btnRandom.disabled = true;
  
  // Update button text to indicate read-only state
  btnClear.textContent = "Clear (disabled)";
  btnRandom.textContent = "Random (disabled)";
  
  // Disable tool buttons
  document.querySelectorAll('.tool-btn').forEach(btn => {
    btn.disabled = true;
    btn.style.opacity = '0.5';
  });
  
  // Show read-only actions, hide edit mode actions
  editModeActions.style.display = 'none';
  readOnlyActions.style.display = 'block';
  
  // Update canvas cursor to indicate non-interactive state
  canvas.style.cursor = "not-allowed";
}

// Enhanced boot sequence
(async function boot(){
  // Check responsive requirements first
  checkResponsive();
  
  // Initialize tool selection
  selectTool(TOOLS.WAND);
  
  // Size canvas to container
  resizeCanvasToDisplaySize();

  // Load plant and rock images first
  try {
    plantImages = await loadPlantImages();
    console.log(`Loaded ${plantImages.length} plant images`);
  } catch (error) {
    console.error("Failed to load plant images:", error);
    plantImages = [];
  }
  
  try {
    rockImages = await loadRockImages();
    console.log(`Loaded ${rockImages.length} rock images`);
  } catch (error) {
    console.error("Failed to load rock images:", error);
    rockImages = [];
  }

  // First try loading from URL
  const loadedFromUrl = await tryLoadFromUrl();
  if (!loadedFromUrl) {
    // Load from local storage or create random starter
    if (!loadFromLocal()) {
      randomizeGrid(0.03);
    }
    render();
  }

  // Auto-save on unload (only if not read-only)
  window.addEventListener("beforeunload", () => {
    if (!isReadOnly) {
      saveToLocal();
    }
  });
})();

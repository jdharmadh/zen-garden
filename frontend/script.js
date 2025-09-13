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
  PLANT: 'plant'
};

// DOM
const canvas = document.getElementById("garden");
const ctx = canvas.getContext("2d", { willReadFrequently: false });
const btnClear = document.getElementById("clear");
const btnRandom = document.getElementById("randomize");
const btnShare = document.getElementById("share");
const shareResult = document.getElementById("shareResult");

// Tool buttons
const wandBtn = document.getElementById("wandTool");
const smootherBtn = document.getElementById("smootherTool");
const rakeBtn = document.getElementById("rakeTool");
const plantBtn = document.getElementById("plantTool");

// State: each cell can have type and intensity/color variation
// cell format: { type: 0=sand, 1=mark, 2=smoothed, 3=raked_light, 4=raked_dark, variation: 0-1 }
let grid = createEmptyGrid();
let drawing = false;
let currentTool = TOOLS.WAND;
let cellW = 10, cellH = 10;
let isReadOnly = false;
let mousePos = { x: 0, y: 0 };
let rakePhase = 0; // for alternating rake pattern

// Plant system
let plants = []; // Array of plant objects: { id, x, y, imageIndex, width, height, image }
let plantImages = []; // Pre-loaded plant images
let draggedPlant = null; // Currently dragged plant
let dragOffset = { x: 0, y: 0 }; // Offset from plant center when dragging
const PLANT_SIZE = 80; // Default plant size (scaled from 480px originals)

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

// Plant management functions
function loadPlantImages() {
  return Promise.all(
    Array.from({length: 10}, (_, i) => {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = `/images/plants/plant${i + 1}.png`;
      });
    })
  );
}

function createPlant(x, y, imageIndex) {
  return {
    id: Date.now() + Math.random(), // unique ID
    x: x,
    y: y,
    imageIndex: imageIndex,
    width: PLANT_SIZE,
    height: PLANT_SIZE,
    image: plantImages[imageIndex]
  };
}

function findRandomEmptySpace() {
  const maxAttempts = 100;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const x = Math.random() * (canvas.width - PLANT_SIZE);
    const y = Math.random() * (canvas.height - PLANT_SIZE);
    
    if (isSpaceFree(x, y, PLANT_SIZE, PLANT_SIZE)) {
      return { x, y };
    }
  }
  return null; // No free space found
}

function isSpaceFree(x, y, width, height, excludePlantId = null) {
  // Check collision with other plants
  for (const plant of plants) {
    if (excludePlantId && plant.id === excludePlantId) continue;
    
    if (x < plant.x + plant.width &&
        x + width > plant.x &&
        y < plant.y + plant.height &&
        y + height > plant.y) {
      return false; // Collision detected
    }
  }
  return true;
}

function getPlantAt(x, y) {
  // Check plants in reverse order (top-most first)
  for (let i = plants.length - 1; i >= 0; i--) {
    const plant = plants[i];
    if (x >= plant.x && x <= plant.x + plant.width &&
        y >= plant.y && y <= plant.y + plant.height) {
      return plant;
    }
  }
  return null;
}

function placePlant(x, y) {
  // Check if the specified location is free
  if (!isSpaceFree(x - PLANT_SIZE / 2, y - PLANT_SIZE / 2, PLANT_SIZE, PLANT_SIZE)) {
    shareResult.textContent = "Cannot place plant here - location conflicts with existing plant!";
    setTimeout(() => shareResult.textContent = "", 3000);
    return false;
  }
  
  // Constrain to canvas bounds
  const constrainedX = Math.max(0, Math.min(canvas.width - PLANT_SIZE, x - PLANT_SIZE / 2));
  const constrainedY = Math.max(0, Math.min(canvas.height - PLANT_SIZE, y - PLANT_SIZE / 2));
  
  const randomImageIndex = Math.floor(Math.random() * plantImages.length);
  const newPlant = createPlant(constrainedX, constrainedY, randomImageIndex);
  plants.push(newPlant);
  return true;
}

function addRandomPlants() {
  // Clear existing plants first
  plants = [];
  
  // Add 3-5 random plants if plant images are loaded
  if (plantImages.length === 0) return;
  
  const numPlants = 3 + Math.floor(Math.random() * 3); // 3-5 plants
  let plantsAdded = 0;
  let attempts = 0;
  const maxAttempts = 50; // Prevent infinite loop
  
  while (plantsAdded < numPlants && attempts < maxAttempts) {
    const space = findRandomEmptySpace();
    if (space) {
      const randomImageIndex = Math.floor(Math.random() * plantImages.length);
      const newPlant = createPlant(space.x, space.y, randomImageIndex);
      plants.push(newPlant);
      plantsAdded++;
    }
    attempts++;
  }
}

// Tool selection
function selectTool(tool) {
  currentTool = tool;
  document.querySelectorAll('.tool-btn').forEach(btn => btn.classList.remove('active'));
  
  switch(tool) {
    case TOOLS.WAND:
      wandBtn.classList.add('active');
      canvas.style.cursor = 'crosshair';
      break;
    case TOOLS.SMOOTHER:
      smootherBtn.classList.add('active');
      canvas.style.cursor = 'grab';
      break;
    case TOOLS.RAKE:
      rakeBtn.classList.add('active');
      canvas.style.cursor = 'grab';
      break;
    case TOOLS.PLANT:
      plantBtn.classList.add('active');
      canvas.style.cursor = 'pointer';
      break;
  }
}

// Tool event listeners
wandBtn.addEventListener('click', () => selectTool(TOOLS.WAND));
smootherBtn.addEventListener('click', () => selectTool(TOOLS.SMOOTHER));
rakeBtn.addEventListener('click', () => selectTool(TOOLS.RAKE));
plantBtn.addEventListener('click', () => selectTool(TOOLS.PLANT));

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

window.addEventListener("resize", resizeCanvasToDisplaySize);

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
  
  // Draw plants on top of sand
  drawPlants();
  
  // Draw tool cursor overlay
  drawToolCursor();
}

// Draw all plants
function drawPlants() {
  for (const plant of plants) {
    if (plant.image && plant.image.complete) {
      ctx.drawImage(
        plant.image,
        plant.x,
        plant.y,
        plant.width,
        plant.height
      );
    }
  }
}

// Draw tool-specific cursor overlay
function drawToolCursor() {
  if (isReadOnly || draggedPlant) return; // Don't show cursor when dragging or in read-only
  
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
      // Plant placement preview - show a circle where plant would be placed
      const rect = canvas.getBoundingClientRect();
      const canvasX = (mousePos.x - rect.left) * (canvas.width / rect.width);
      const canvasY = (mousePos.y - rect.top) * (canvas.height / rect.height);
      
      // Check if hovering over an existing plant - don't show cursor if so
      const plantAtPoint = getPlantAt(canvasX, canvasY);
      if (plantAtPoint) return; // Don't show cursor when hovering over existing plant
      
      ctx.strokeStyle = 'rgba(0, 255, 0, 0.6)';
      ctx.lineWidth = 2;
      ctx.strokeRect(
        canvasX - PLANT_SIZE / 2,
        canvasY - PLANT_SIZE / 2,
        PLANT_SIZE,
        PLANT_SIZE
      );
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
    cell.variation = getRandomVariation();
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
  
  if (currentTool === TOOLS.PLANT) {
    // Check if shift key is pressed for deletion
    if (ev.shiftKey) {
      const plantAtPoint = getPlantAt(canvasX, canvasY);
      if (plantAtPoint) {
        // Delete the plant
        const index = plants.indexOf(plantAtPoint);
        if (index > -1) {
          plants.splice(index, 1);
          render();
          autoSaveLocal();
          shareResult.textContent = "Plant removed.";
          setTimeout(() => shareResult.textContent = "", 2000);
        }
      }
      return;
    }
    
    // Check if clicking on an existing plant to start dragging
    const plantAtPoint = getPlantAt(canvasX, canvasY);
    if (plantAtPoint) {
      draggedPlant = plantAtPoint;
      dragOffset.x = canvasX - plantAtPoint.x;
      dragOffset.y = canvasY - plantAtPoint.y;
      canvas.style.cursor = 'grabbing';
      return;
    }
    
    // Place a new plant
    if (placePlant(canvasX, canvasY)) {
      render();
      autoSaveLocal();
      shareResult.textContent = "Plant placed!";
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
  
  // Handle plant dragging
  if (draggedPlant && !isReadOnly) {
    const newX = canvasX - dragOffset.x;
    const newY = canvasY - dragOffset.y;
    
    // Constrain to canvas bounds
    const constrainedX = Math.max(0, Math.min(canvas.width - draggedPlant.width, newX));
    const constrainedY = Math.max(0, Math.min(canvas.height - draggedPlant.height, newY));
    
    // Check for collisions with other plants
    if (isSpaceFree(constrainedX, constrainedY, draggedPlant.width, draggedPlant.height, draggedPlant.id)) {
      draggedPlant.x = constrainedX;
      draggedPlant.y = constrainedY;
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
  if (draggedPlant && !isReadOnly) {
    draggedPlant = null;
    canvas.style.cursor = currentTool === TOOLS.PLANT ? 'pointer' : 'default';
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
  plants = []; // Clear all plants too
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
  addRandomPlants(); // Add random plants after creating random grid
  render();
  saveToLocal();
  shareResult.textContent = "Random garden generated.";
});

btnShare.addEventListener("click", async () => {
  if (isReadOnly) {
    shareResult.textContent = "Cannot share in read-only mode.";
    return;
  }
  shareResult.textContent = "Sharing…";
  try {
    // Convert grid to simplified format (only cell types)
    const simplifiedGrid = grid.map(row => 
      row.map(cell => cell.type)
    );
    
    // Convert plants to simplified format
    const simplifiedPlants = plants.map(p => ({
      x: p.x,
      y: p.y,
      imageIndex: p.imageIndex,
      width: p.width,
      height: p.height
    }));
    
    const res = await fetch("/api/garden", {
      method: "POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify({ 
        grid: simplifiedGrid,
        plants: simplifiedPlants,
        version: 4, // Increment version for plant support
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
      shareResult.innerHTML = `Shareable link: <a href="${full}" target="_blank">${full}</a>`;
    } else {
      shareResult.textContent = "Saved but no link returned.";
    }
  } catch (err) {
    console.error(err);
    shareResult.textContent = "Share failed (is the backend running?).";
  }
});

// Enhanced localStorage with new format
function saveToLocal() {
  const payload = { 
    grid: grid, 
    plants: plants.map(p => ({ // Save plants without image objects
      id: p.id,
      x: p.x,
      y: p.y,
      imageIndex: p.imageIndex,
      width: p.width,
      height: p.height
    })),
    cols: CELL_COLS, 
    rows: CELL_ROWS, 
    version: 3, // Increment version for plant support
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
      
      // Load plants if available
      if (data.plants && plantImages.length > 0) {
        plants = data.plants.map(p => ({
          ...p,
          image: plantImages[p.imageIndex]
        }));
      } else {
        plants = [];
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
      if (data.version === 4) {
        // New format with plants support
        grid = data.grid.map(row => 
          row.map(cellType => ({
            type: cellType,
            variation: getRandomVariation()
          }))
        );
        
        // Load plants if available and images are loaded
        if (data.plants && plantImages.length > 0) {
          plants = data.plants.map(p => ({
            ...p,
            id: Date.now() + Math.random(), // Generate new ID
            image: plantImages[p.imageIndex]
          }));
        } else {
          plants = [];
        }
      } else if (data.version === 3) {
        // Previous simplified format - grid is 2D array of cell types only
        grid = data.grid.map(row => 
          row.map(cellType => ({
            type: cellType,
            variation: getRandomVariation()
          }))
        );
        plants = []; // No plants in older versions
      } else if (data.version === 2) {
        // Previous format with full cell objects
        grid = data.grid;
        plants = [];
      } else {
        // Convert legacy format (v1 and older)
        grid = data.grid.map(row => 
          row.map(cell => ({
            type: typeof cell === 'number' ? cell : (cell.type || 0),
            variation: getRandomVariation()
          }))
        );
        plants = [];
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
function updateUIForReadOnly() {
  // Disable buttons in read-only mode
  btnClear.disabled = true;
  btnRandom.disabled = true;
  btnShare.disabled = true;
  
  // Update button text to indicate read-only state
  btnClear.textContent = "Clear (disabled)";
  btnRandom.textContent = "Random (disabled)";
  btnShare.textContent = "Share (disabled)";
  
  // Disable tool buttons
  document.querySelectorAll('.tool-btn').forEach(btn => {
    btn.disabled = true;
    btn.style.opacity = '0.5';
  });
  
  // Update canvas cursor to indicate non-interactive state
  canvas.style.cursor = "not-allowed";
}

// Enhanced boot sequence
(async function boot(){
  // Initialize tool selection
  selectTool(TOOLS.WAND);
  
  // Size canvas to container
  resizeCanvasToDisplaySize();

  // Load plant images first
  try {
    plantImages = await loadPlantImages();
    console.log(`Loaded ${plantImages.length} plant images`);
  } catch (error) {
    console.error("Failed to load plant images:", error);
    plantImages = [];
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

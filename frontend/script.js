// Simple pixel-zen garden: draw marks on a grid, persist to localStorage, randomize, clear, share.
// Config
const CELL_COLS = 64;   // grid width in "pixels"
const CELL_ROWS = 40;   // grid height in "pixels"
const STORAGE_KEY = "zenGarden_v1";

// DOM
const canvas = document.getElementById("garden");
const ctx = canvas.getContext("2d", { willReadFrequently: false });
const btnSaveLocal = document.getElementById("saveLocal");
const btnClear = document.getElementById("clear");
const btnRandom = document.getElementById("randomize");
const btnShare = document.getElementById("share");
const shareResult = document.getElementById("shareResult");

// State: 0 = sand (empty), 1 = mark
let grid = createEmptyGrid();
let drawing = false;
let drawValue = 1; // paint with 1 (mark)
let cellW = 10, cellH = 10;

// Init
function createEmptyGrid() {
  return Array.from({length: CELL_ROWS}, () => Array(CELL_COLS).fill(0));
}

function resizeCanvasToDisplaySize() {
  // Canvas internal pixel size = CSS size * devicePixelRatio to keep crisp pixels.
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  // We want to map grid to CSS size; compute cell size in CSS pixels then multiply with dpr.
  cellW = Math.max(4, Math.floor(rect.width / CELL_COLS));
  cellH = Math.max(4, Math.floor(rect.height / CELL_ROWS));
  const internalW = CELL_COLS * cellW * dpr;
  const internalH = CELL_ROWS * cellH * dpr;
  canvas.width = internalW;
  canvas.height = internalH;
  canvas.style.width = rect.width + "px";
  canvas.style.height = rect.height + "px";
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); // scale drawing for DPR
  render();
}

window.addEventListener("resize", () => {
  resizeCanvasToDisplaySize();
});

// Rendering
function render() {
  // Draw sand background tiles subtle
  ctx.clearRect(0,0,canvas.width,canvas.height);
  // draw per cell
  for (let r=0; r<CELL_ROWS; r++){
    for (let c=0; c<CELL_COLS; c++){
      const x = c * cellW;
      const y = r * cellH;
      if (grid[r][c] === 0) {
        // sand base
        ctx.fillStyle = "#f3e6cb";
        ctx.fillRect(x, y, cellW, cellH);
        // subtle grain dot
        if ((r + c) % 7 === 0) {
          ctx.fillStyle = "#eadfb3";
          ctx.fillRect(x + cellW*0.25, y + cellH*0.25, Math.max(1, cellW*0.15), Math.max(1, cellH*0.15));
        }
      } else {
        // mark
        ctx.fillStyle = "#6e4f38";
        ctx.fillRect(x, y, cellW, cellH);
      }
      // optional grid lines for pixel look
      ctx.strokeStyle = "rgba(0,0,0,0.03)";
      ctx.strokeRect(x+0.5, y+0.5, cellW-1, cellH-1);
    }
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

// Painting helpers
function setCell(r,c,val) {
  if (r<0||r>=CELL_ROWS||c<0||c>=CELL_COLS) return;
  grid[r][c] = val;
}

function toggleCell(r,c) {
  grid[r][c] = grid[r][c] ? 0 : 1;
}

// Mouse / touch events
canvas.addEventListener("pointerdown", (ev) => {
  ev.preventDefault();
  drawing = true;
  const cell = pointerToCell(ev.clientX, ev.clientY);
  if (!cell) return;
  // Paint: left click draws mark, right-click would erase (but we don't use right here)
  if (ev.button === 2) drawValue = 0;
  else drawValue = 1;
  setCell(cell.r, cell.c, drawValue);
  render();
});
canvas.addEventListener("pointermove", (ev) => {
  if (!drawing) return;
  const cell = pointerToCell(ev.clientX, ev.clientY);
  if (!cell) return;
  setCell(cell.r, cell.c, drawValue);
  render();
});
window.addEventListener("pointerup", () => {
  if (drawing) {
    drawing = false;
    autoSaveLocal(); // save after stroke
  }
});

// Prevent context menu on canvas (so right-click can be used later if desired)
canvas.addEventListener("contextmenu", (e) => e.preventDefault());

// Buttons
btnSaveLocal.addEventListener("click", () => {
  saveToLocal();
  shareResult.textContent = "Saved locally.";
});

btnClear.addEventListener("click", () => {
  if (!confirm("Clear the garden?")) return;
  grid = createEmptyGrid();
  render();
  saveToLocal();
  shareResult.textContent = "Cleared.";
});

btnRandom.addEventListener("click", () => {
  randomizeGrid();
  render();
  saveToLocal();
  shareResult.textContent = "Random garden generated.";
});

btnShare.addEventListener("click", async () => {
  shareResult.textContent = "Sharing…";
  try {
    const res = await fetch("/api/garden", {
      method: "POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify({ grid })
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const j = await res.json();
    // server should return {id, link}
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

// LocalStorage
function saveToLocal() {
  const payload = { grid, cols: CELL_COLS, rows: CELL_ROWS, ts: Date.now() };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}
function autoSaveLocal() {
  // simple debounce-ish: immediate in this minimal version
  saveToLocal();
}

function loadFromLocal() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return false;
  try {
    const data = JSON.parse(raw);
    if (data && data.grid && data.grid.length === CELL_ROWS) {
      grid = data.grid;
      return true;
    }
  } catch(e){}
  return false;
}

// Random generator
function randomizeGrid(density = 0.08) {
  for (let r=0;r<CELL_ROWS;r++){
    for (let c=0;c<CELL_COLS;c++){
      grid[r][c] = Math.random() < density ? 1 : 0;
    }
  }
}

// Load from backend if /garden/:id
async function tryLoadFromUrl() {
  const path = window.location.pathname;
  const match = path.match(/^\/garden\/([A-Za-z0-9-_]+)$/);
  if (!match) return false;
  const id = match[1];
  try {
    const res = await fetch(`/api/garden/${id}`);
    if (!res.ok) {
      console.warn("garden not found:", res.status);
      return false;
    }
    const data = await res.json();
    if (data && data.grid) {
      grid = data.grid;
      render();
      saveToLocal(); // also cache locally
      shareResult.textContent = `Loaded garden ${id}`;
      return true;
    }
  } catch (e) {
    console.error(e);
  }
  return false;
}

// Boot
(async function boot(){
  // size canvas to container
  resizeCanvasToDisplaySize();

  // first try loading from URL
  const loadedFromUrl = await tryLoadFromUrl();
  if (!loadedFromUrl) {
    // else load from local storage if exists, otherwise random starter
    if (!loadFromLocal()) {
      randomizeGrid(0.03);
    }
    render();
  }

  // autosave on unload
  window.addEventListener("beforeunload", saveToLocal);
})();

const express = require("express");
const path = require("path");
const app = express();
const cors = require("cors");
const PORT = process.env.PORT || 3089;

app.use(express.json());
app.use(cors());

// in-memory "DB" for gardens
const gardens = {};

// serve frontend
// Serve static files first
app.use(express.static(path.join(__dirname, "../frontend")));

// Serve images from the images directory
app.use('/images', express.static(path.join(__dirname, "../images")));

// API routes should come before catch-all routes
// save a garden
app.post("/api/garden", (req, res) => {
  const id = Date.now().toString();
  gardens[id] = req.body;
  res.json({ id, link: `/garden/${id}` });
});

// load a garden
app.get("/api/garden/:id", (req, res) => {
  const garden = gardens[req.params.id];
  if (!garden) return res.status(404).json({ error: "Not found" });
  res.json(garden);
});

// Serve frontend for /garden/:id deep links (after API routes)
app.get('/garden/:id', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

app.listen(PORT, () =>
  console.log(`Zen garden running on http://localhost:${PORT}`)
);

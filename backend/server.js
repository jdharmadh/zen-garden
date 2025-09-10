const express = require("express");
const path = require("path");
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// serve frontend
app.use(express.static(path.join(__dirname, "../frontend")));

// in-memory "DB" for gardens
const gardens = {};

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

app.listen(PORT, () =>
  console.log(`Zen garden running on http://localhost:${PORT}`)
);

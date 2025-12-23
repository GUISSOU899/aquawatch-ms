const express = require("express");
const { Client } = require("pg");
const cors = require("cors");
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// PostgreSQL config (from environment or sensible defaults)
const pgClient = new Client({
  host: process.env.DB_HOST || "timescaledb",
  user: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD || "postgres",
  database: process.env.DB_NAME || "aquawatch",
  port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 5432
});

pgClient.connect()
  .then(() => console.log("Connected to PostgreSQL"))
  .catch(err => console.error("PostgreSQL error:", err));

// GET latest readings
app.get("/api/readings", async (req, res) => {
  try {
    const result = await pgClient.query(`
      SELECT sensor_id, timestamp, ph, turbidity, temperature, latitude, longitude
      FROM readings
      ORDER BY timestamp DESC
      LIMIT 100
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Start server
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`API server running on port ${PORT}`);
});

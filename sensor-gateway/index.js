const mqtt = require("mqtt");
const { Client } = require("pg");

// Try to use PostgreSQL (TimescaleDB). If unavailable, fallback to ingestion SQLite helper.
let pgClient = new Client({
  host: "timescaledb",
  user: "postgres",
  password: "postgres",
  database: "aqua",
  port: 5432
});

let usePg = true;
let sqliteHelper = null;

// MQTT broker
const mqttClient = mqtt.connect("mqtt://mosquitto:1883");

// Connect to PostgreSQL
pgClient.connect()
  .then(() => console.log("Connected to PostgreSQL"))
  .catch(async (err) => {
    console.error("PostgreSQL error:", err.message || err);
    usePg = false;
    // Try to fallback to ingestion SQLite helper if available
    try {
      sqliteHelper = require('../ingestion/db');
      if (sqliteHelper && sqliteHelper.initDatabase) {
        await sqliteHelper.initDatabase();
      }
      console.log('Using SQLite fallback from ingestion');
    } catch (e) {
      console.error('Failed to load ingestion SQLite helper:', e.message || e);
    }
  });

// Connect to MQTT
mqttClient.on("connect", () => {
  console.log("Connected to MQTT");
  mqttClient.subscribe("sensors/#");
});

// On receiving MQTT message
mqttClient.on("message", async (topic, msg) => {
  try {
    const data = JSON.parse(msg.toString());

    if (usePg) {
      const query = `
        INSERT INTO sensor_readings (sensor_id, timestamp, latitude, longitude, ph, turbidity, temperature, raw_payload)
        VALUES ($1, NOW(), $2, $3, $4, $5, $6, $7)
      `;

      const values = [
        data.sensor_id || "unknown",
        data.latitude || null,
        data.longitude || null,
        data.ph || null,
        data.turbidity || null,
        data.temperature || null,
        data
      ];

      await pgClient.query(query, values);
      console.log("Inserted into PostgreSQL ✔", data.sensor_id);
    } else if (sqliteHelper && sqliteHelper.insertMeasurement) {
      try {
        sqliteHelper.insertMeasurement({
          sensor_id: data.sensor_id || 'unknown',
          timestamp: data.timestamp || new Date().toISOString(),
          latitude: data.latitude || 0,
          longitude: data.longitude || 0,
          ph: data.ph || null,
          turbidity: data.turbidity || null,
          temperature: data.temperature || null,
          conductivity: data.conductivity || null
        });
        console.log("Inserted into SQLite fallback ✔", data.sensor_id);
      } catch (e) {
        console.error('SQLite insert error:', e.message || e);
      }
    } else {
      console.warn('No DB available to persist message');
    }

  } catch (err) {
    console.error("Error processing message:", err);
  }
});

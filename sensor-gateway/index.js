const mqtt = require("mqtt");
const { Client } = require("pg");

// PostgreSQL config
const pgClient = new Client({
  host: "timescaledb",
  user: "postgres",
  password: "postgres",
  database: "aqua",
  port: 5432
});

// MQTT broker
const mqttClient = mqtt.connect("mqtt://mosquitto:1883");

// Connect to PostgreSQL
pgClient.connect()
  .then(() => console.log("Connected to PostgreSQL"))
  .catch(err => console.error("PostgreSQL error:", err));

// Connect to MQTT
mqttClient.on("connect", () => {
  console.log("Connected to MQTT");
  mqttClient.subscribe("sensors/#");
});

// On receiving MQTT message
mqttClient.on("message", async (topic, msg) => {
  try {
    const data = JSON.parse(msg.toString());

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
    console.log("Inserted into database ✔", data.sensor_id);

  } catch (err) {
    console.error("Error processing message:", err);
  }
});

const mqtt = require("mqtt");

// MQTT broker
const mqttClient = mqtt.connect("mqtt://mosquitto:1883");

// Number of sensors
const NUM_SENSORS = 10;

// Base coordinates (pick a realistic center for your map)
const baseLat = 33.97;
const baseLon = -6.85;

// Helper function to generate random float between min and max
function randomFloat(min, max) {
  return parseFloat((Math.random() * (max - min) + min).toFixed(2));
}

// Helper function to generate random integer between min and max
function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Connect to MQTT
mqttClient.on("connect", () => {
  console.log("Connected to MQTT, sending 10 test messages...");

  for (let i = 1; i <= NUM_SENSORS; i++) {
    const message = {
      sensor_id: `S${i}`,
      timestamp: new Date().toISOString(),
      ph: randomFloat(6, 8),
      turbidity: randomFloat(2, 6),
      temperature: randomFloat(18, 22),
      latitude: parseFloat((baseLat + randomFloat(-0.02, 0.02)).toFixed(5)),
      longitude: parseFloat((baseLon + randomFloat(-0.02, 0.02)).toFixed(5))
    };

    mqttClient.publish("sensors/test", JSON.stringify(message));
    console.log("Message published ✔", message.sensor_id);
  }

  // Optional: keep sending updates every few seconds
  setInterval(() => {
    for (let i = 1; i <= NUM_SENSORS; i++) {
      const message = {
        sensor_id: `S${i}`,
        timestamp: new Date().toISOString(),
        ph: randomFloat(6, 8),
        turbidity: randomFloat(2, 6),
        temperature: randomFloat(18, 22),
        latitude: parseFloat((baseLat + randomFloat(-0.02, 0.02)).toFixed(5)),
        longitude: parseFloat((baseLon + randomFloat(-0.02, 0.02)).toFixed(5))
      };

      mqttClient.publish("sensors/test", JSON.stringify(message));
    }
  }, 5000); // every 5 seconds
});

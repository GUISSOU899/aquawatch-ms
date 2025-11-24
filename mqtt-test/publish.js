const mqtt = require("mqtt");

const client = mqtt.connect("mqtt://mosquitto:1883");

client.on("connect", () => {
  console.log("Connected to MQTT, sending test message...");

  const message = {
    sensor_id: "S1",
    ph: 7.8,
    turbidity: 3.2,
    temperature: 18.6,
    lat: 33.97,
    lon: -6.85
  };

  client.publish("sensors/test", JSON.stringify(message), {}, (err) => {
    if (err) console.error("Publish error:", err);
    else console.log("Message published ✔");
    client.end();
  });
});

const aedes = require('aedes')();
const net = require('net');
const { initDatabase, insertMeasurement } = require('./db');

const MQTT_PORT = process.env.MQTT_PORT || 1883;

// Initialiser la base de données au démarrage
initDatabase().then(() => {
  console.log('✅ Base de données prête');
}).catch(err => {
  console.error('❌ Erreur initialisation DB:', err);
});

// Gérer les connexions MQTT
aedes.on('client', (client) => {
  console.log(`📡 Client MQTT connecté: ${client.id}`);
});

aedes.on('clientDisconnect', (client) => {
  console.log(`📡 Client MQTT déconnecté: ${client.id}`);
});

// Gérer les messages MQTT publiés
aedes.on('publish', async (packet, client) => {
  if (packet.topic.startsWith('sensors/')) {
    try {
      const payload = JSON.parse(packet.payload.toString());
      
      // Valider les données
      if (
        payload.sensor_id &&
        payload.latitude !== undefined &&
        payload.longitude !== undefined &&
        payload.ph !== undefined &&
        payload.turbidity !== undefined &&
        payload.temperature !== undefined &&
        payload.conductivity !== undefined
      ) {
        // Insérer dans TimescaleDB
        await insertMeasurement({
          sensor_id: payload.sensor_id,
          timestamp: payload.timestamp || new Date().toISOString(),
          latitude: payload.latitude,
          longitude: payload.longitude,
          ph: payload.ph,
          turbidity: payload.turbidity,
          temperature: payload.temperature,
          conductivity: payload.conductivity,
        });

        console.log(`✅ Mesure reçue et stockée: Capteur ${payload.sensor_id} - pH: ${payload.ph}, Temp: ${payload.temperature}°C`);
      } else {
        console.warn('⚠️  Données invalides reçues:', payload);
      }
    } catch (error) {
      console.error('❌ Erreur lors du traitement du message MQTT:', error.message);
    }
  }
});

// Créer le serveur MQTT
const server = net.createServer(aedes.handle);

server.listen(MQTT_PORT, () => {
  console.log(`🚀 Serveur MQTT démarré sur le port ${MQTT_PORT}`);
  console.log(`📡 En attente de messages sur les topics: sensors/sensor-1, sensors/sensor-2, sensors/sensor-3`);
});

server.on('error', (error) => {
  console.error('❌ Erreur du serveur MQTT:', error.message);
  process.exit(1);
});

// Gestion propre de l'arrêt
process.on('SIGINT', () => {
  console.log('\n🛑 Arrêt du serveur MQTT...');
  server.close(() => {
    process.exit(0);
  });
});


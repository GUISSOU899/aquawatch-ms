const mqtt = require('mqtt');
require('dotenv').config();

const MQTT_HOST = process.env.MQTT_HOST || 'localhost';
const MQTT_PORT = process.env.MQTT_PORT || 1883;
const MQTT_URL = `mqtt://${MQTT_HOST}:${MQTT_PORT}`;

// Configuration des 3 capteurs avec leurs coordonnées GPS
const SENSORS = [
  {
    id: 'sensor-1',
    name: 'Capteur Rivière Nord',
    latitude: 48.8566,  // Paris
    longitude: 2.3522,
  },
  {
    id: 'sensor-2',
    name: 'Capteur Rivière Sud',
    latitude: 45.7640,  // Lyon
    longitude: 4.8357,
  },
  {
    id: 'sensor-3',
    name: 'Capteur Rivière Est',
    latitude: 43.2965,  // Marseille
    longitude: 5.3698,
  },
];

// Valeurs de base réalistes pour chaque capteur
const BASE_VALUES = {
  'sensor-1': {
    ph: 7.2,
    turbidity: 2.5,
    temperature: 15.0,
    conductivity: 800,
  },
  'sensor-2': {
    ph: 7.0,
    turbidity: 3.0,
    temperature: 18.0,
    conductivity: 1200,
  },
  'sensor-3': {
    ph: 7.5,
    turbidity: 1.8,
    temperature: 20.0,
    conductivity: 1500,
  },
};

// Fonction pour générer une valeur aléatoire autour d'une valeur de base
function randomValue(base, variation, min = null, max = null) {
  const value = base + (Math.random() * 2 - 1) * variation;
  
  if (min !== null && value < min) return min;
  if (max !== null && value > max) return max;
  
  return parseFloat(value.toFixed(2));
}

// Fonction pour générer occasionnellement des valeurs anormales (pour tester les alertes)
function generateMeasurement(sensor) {
  const base = BASE_VALUES[sensor.id];
  const timestamp = new Date().toISOString();
  
  // 5% de chance de générer une valeur anormale pour tester les alertes
  const isAnomaly = Math.random() < 0.05;
  
  let ph, turbidity, temperature, conductivity;
  
  if (isAnomaly) {
    // Générer des valeurs anormales pour tester les alertes
    const anomalyType = Math.floor(Math.random() * 4);
    
    switch (anomalyType) {
      case 0: // pH anormal
        ph = Math.random() < 0.5 ? randomValue(4.0, 0.5, 0, 5) : randomValue(9.5, 0.5, 9, 14);
        turbidity = randomValue(base.turbidity, 0.5, 0, 10);
        temperature = randomValue(base.temperature, 2, 0, 30);
        conductivity = randomValue(base.conductivity, 200, 0, 3000);
        break;
      case 1: // Turbidité élevée
        ph = randomValue(base.ph, 0.3, 6.5, 8.5);
        turbidity = randomValue(12.0, 3.0, 5, 20);
        temperature = randomValue(base.temperature, 2, 0, 30);
        conductivity = randomValue(base.conductivity, 200, 0, 3000);
        break;
      case 2: // Température anormale
        ph = randomValue(base.ph, 0.3, 6.5, 8.5);
        turbidity = randomValue(base.turbidity, 0.5, 0, 10);
        temperature = Math.random() < 0.5 ? randomValue(-2.0, 2.0, -5, 5) : randomValue(35.0, 5.0, 30, 40);
        conductivity = randomValue(base.conductivity, 200, 0, 3000);
        break;
      case 3: // Conductivité élevée
        ph = randomValue(base.ph, 0.3, 6.5, 8.5);
        turbidity = randomValue(base.turbidity, 0.5, 0, 10);
        temperature = randomValue(base.temperature, 2, 0, 30);
        conductivity = randomValue(4000.0, 1000, 2500, 6000);
        break;
    }
  } else {
    // Valeurs normales avec variation réaliste
    ph = randomValue(base.ph, 0.3, 6.5, 8.5);
    turbidity = randomValue(base.turbidity, 0.5, 0, 5);
    temperature = randomValue(base.temperature, 2, 5, 25);
    conductivity = randomValue(base.conductivity, 200, 0, 2500);
  }
  
  return {
    sensor_id: sensor.id,
    timestamp: timestamp,
    latitude: sensor.latitude,
    longitude: sensor.longitude,
    ph: ph,
    turbidity: turbidity,
    temperature: temperature,
    conductivity: conductivity,
  };
}

// Fonction principale
async function main() {
  console.log('🚀 Démarrage du simulateur de capteurs IoT...');
  console.log(`📡 Connexion au broker MQTT: ${MQTT_URL}`);
  
  // Connexion au broker MQTT
  const client = mqtt.connect(MQTT_URL, {
    clientId: 'aquawatch-simulator',
    reconnectPeriod: 1000,
  });
  
  client.on('connect', () => {
    console.log('✅ Connecté au broker MQTT');
    console.log(`📊 Simulation de ${SENSORS.length} capteur(s):`);
    SENSORS.forEach(sensor => {
      console.log(`   - ${sensor.name} (${sensor.id}) à [${sensor.latitude}, ${sensor.longitude}]`);
    });
    console.log(`⏰ Envoi de données toutes les 5 secondes...\n`);
  });
  
  client.on('error', (error) => {
    console.error('❌ Erreur de connexion MQTT:', error.message);
    console.error('💡 Assurez-vous que le serveur MQTT (microservice ingestion) est démarré');
    process.exit(1);
  });
  
  client.on('offline', () => {
    console.log('⚠️  Déconnecté du broker MQTT, tentative de reconnexion...');
  });
  
  // Envoyer des données toutes les 5 secondes pour chaque capteur
  const INTERVAL = 5000; // 5 secondes
  
  setInterval(() => {
    if (client.connected) {
      SENSORS.forEach(sensor => {
        const measurement = generateMeasurement(sensor);
        const topic = `sensors/${sensor.id}`;
        const payload = JSON.stringify(measurement);
        
        client.publish(topic, payload, (error) => {
          if (error) {
            console.error(`❌ Erreur lors de l'envoi pour ${sensor.id}:`, error.message);
          } else {
            console.log(`📤 ${sensor.name}: pH=${measurement.ph.toFixed(2)}, Temp=${measurement.temperature.toFixed(2)}°C, Turb=${measurement.turbidity.toFixed(2)}NTU, Cond=${measurement.conductivity.toFixed(2)}µS/cm`);
          }
        });
      });
    }
  }, INTERVAL);
  
  // Envoyer immédiatement une première série de mesures
  if (client.connected) {
    SENSORS.forEach(sensor => {
      const measurement = generateMeasurement(sensor);
      const topic = `sensors/${sensor.id}`;
      const payload = JSON.stringify(measurement);
      
      client.publish(topic, payload);
    });
  }
  
  // Gestion propre de l'arrêt
  process.on('SIGINT', () => {
    console.log('\n🛑 Arrêt du simulateur...');
    client.end();
    process.exit(0);
  });
}

// Démarrer le simulateur
main().catch((error) => {
  console.error('❌ Erreur fatale:', error);
  process.exit(1);
});


const { initDatabase, getRecentMeasurements, insertAlert, checkRecentAlert } = require('./db');
const { sendAlertEmail } = require('./email');

// Seuils OMS (Organisation Mondiale de la Santé) pour la qualité de l'eau
const THRESHOLDS = {
  ph: {
    min: 6.5,
    max: 8.5,
    unit: 'pH',
  },
  turbidity: {
    max: 5.0, // NTU (Nephelometric Turbidity Units)
    unit: 'NTU',
  },
  temperature: {
    min: 0,
    max: 30, // °C - température acceptable pour l'eau potable
    unit: '°C',
  },
  conductivity: {
    max: 2500, // µS/cm (microsiemens par centimètre)
    unit: 'µS/cm',
  },
};

// Vérifier les seuils pour une mesure
async function checkThresholds(measurement) {
  const alerts = [];

  // Vérifier le pH
  if (measurement.ph < THRESHOLDS.ph.min || measurement.ph > THRESHOLDS.ph.max) {
    const threshold = measurement.ph < THRESHOLDS.ph.min ? THRESHOLDS.ph.min : THRESHOLDS.ph.max;
    const severity = measurement.ph < 5 || measurement.ph > 9 ? 'CRITIQUE' : 'WARNING';
    
    const alreadyAlerted = await checkRecentAlert(measurement.sensor_id, 'ph');
    if (!alreadyAlerted) {
      alerts.push({
        sensor_id: measurement.sensor_id,
        timestamp: measurement.timestamp,
        parameter: 'ph',
        value: measurement.ph,
        threshold: threshold,
        severity: severity,
        message: `pH hors norme: ${measurement.ph.toFixed(2)} ${THRESHOLDS.ph.unit} (seuil: ${THRESHOLDS.ph.min}-${THRESHOLDS.ph.max} ${THRESHOLDS.ph.unit})`,
      });
    }
  }

  // Vérifier la turbidité
  if (measurement.turbidity > THRESHOLDS.turbidity.max) {
    const severity = measurement.turbidity > 10 ? 'CRITIQUE' : 'WARNING';
    
    const alreadyAlerted = await checkRecentAlert(measurement.sensor_id, 'turbidity');
    if (!alreadyAlerted) {
      alerts.push({
        sensor_id: measurement.sensor_id,
        timestamp: measurement.timestamp,
        parameter: 'turbidity',
        value: measurement.turbidity,
        threshold: THRESHOLDS.turbidity.max,
        severity: severity,
        message: `Turbidité élevée: ${measurement.turbidity.toFixed(2)} ${THRESHOLDS.turbidity.unit} (seuil max: ${THRESHOLDS.turbidity.max} ${THRESHOLDS.turbidity.unit})`,
      });
    }
  }

  // Vérifier la température
  if (measurement.temperature < THRESHOLDS.temperature.min || measurement.temperature > THRESHOLDS.temperature.max) {
    const threshold = measurement.temperature < THRESHOLDS.temperature.min 
      ? THRESHOLDS.temperature.min 
      : THRESHOLDS.temperature.max;
    const severity = measurement.temperature < -5 || measurement.temperature > 35 ? 'CRITIQUE' : 'WARNING';
    
    const alreadyAlerted = await checkRecentAlert(measurement.sensor_id, 'temperature');
    if (!alreadyAlerted) {
      alerts.push({
        sensor_id: measurement.sensor_id,
        timestamp: measurement.timestamp,
        parameter: 'temperature',
        value: measurement.temperature,
        threshold: threshold,
        severity: severity,
        message: `Température hors norme: ${measurement.temperature.toFixed(2)} ${THRESHOLDS.temperature.unit} (seuil: ${THRESHOLDS.temperature.min}-${THRESHOLDS.temperature.max} ${THRESHOLDS.temperature.unit})`,
      });
    }
  }

  // Vérifier la conductivité
  if (measurement.conductivity > THRESHOLDS.conductivity.max) {
    const severity = measurement.conductivity > 5000 ? 'CRITIQUE' : 'WARNING';
    
    const alreadyAlerted = await checkRecentAlert(measurement.sensor_id, 'conductivity');
    if (!alreadyAlerted) {
      alerts.push({
        sensor_id: measurement.sensor_id,
        timestamp: measurement.timestamp,
        parameter: 'conductivity',
        value: measurement.conductivity,
        threshold: THRESHOLDS.conductivity.max,
        severity: severity,
        message: `Conductivité élevée: ${measurement.conductivity.toFixed(2)} ${THRESHOLDS.conductivity.unit} (seuil max: ${THRESHOLDS.conductivity.max} ${THRESHOLDS.conductivity.unit})`,
      });
    }
  }

  return alerts;
}

// Traiter les alertes
async function processAlerts() {
  try {
    const measurements = await getRecentMeasurements();
    
    if (measurements.length === 0) {
      console.log('⏳ Aucune mesure récente à vérifier');
      return;
    }

    console.log(`🔍 Vérification de ${measurements.length} mesure(s) récente(s)...`);

    let totalAlerts = 0;
    for (const measurement of measurements) {
      const alerts = await checkThresholds(measurement);

      for (const alert of alerts) {
        // Enregistrer l'alerte dans la base de données
        await insertAlert(alert);
        totalAlerts++;

        // Simuler l'envoi d'email/SMS
        console.log('\n🚨 ===== ALERTE DÉTECTÉE =====');
        console.log(`📧 EMAIL envoyé à: admin@aquawatch.local`);
        console.log(`📱 SMS envoyé à: +33 6 12 34 56 78`);
        console.log(`📍 Capteur: ${alert.sensor_id}`);
        console.log(`⚠️  Paramètre: ${alert.parameter.toUpperCase()}`);
        console.log(`📊 Valeur: ${alert.value} (Seuil: ${alert.threshold})`);
        console.log(`🔴 Sévérité: ${alert.severity}`);
        console.log(`💬 Message: ${alert.message}`);
        console.log(`🕐 Timestamp: ${new Date(alert.timestamp).toLocaleString()}`);
        console.log('================================\n');
        // Send email asynchronously (fire-and-forget but log errors)
        try {
          // schedule non-blocking send
          setImmediate(() => {
            sendAlertEmail(alert.sensor_id, alert.parameter, alert.value, alert.threshold)
              .catch(err => console.error('❌ Email send error:', err && err.message ? err.message : err));
          });
        } catch (e) {
          console.error('❌ Failed to schedule email send:', e && e.message ? e.message : e);
        }
      }
    }

    if (totalAlerts === 0) {
      console.log('✅ Toutes les mesures sont dans les normes');
    }
  } catch (error) {
    console.error('❌ Erreur lors du traitement des alertes:', error.message);
  }
}

// Fonction principale
async function main() {
  console.log('🚀 Démarrage du microservice Alertes...');
  
  // Initialiser la base de données
  await initDatabase();

  // Vérifier les alertes toutes les minutes
  const CHECK_INTERVAL = 60000; // 1 minute en millisecondes

  console.log(`⏰ Vérification des alertes toutes les ${CHECK_INTERVAL / 1000} secondes...`);
  
  // Exécuter immédiatement une première vérification
  await processAlerts();

  // Puis exécuter périodiquement
  setInterval(processAlerts, CHECK_INTERVAL);
}

// Gestion des erreurs non capturées
process.on('unhandledRejection', (error) => {
  console.error('❌ Erreur non gérée:', error);
});

// Démarrer le service
main().catch((error) => {
  console.error('❌ Erreur fatale:', error);
  process.exit(1);
});


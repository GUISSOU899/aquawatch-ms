const express = require('express');
const cors = require('cors');
const path = require('path');
const { getLatestMeasurements, getAlerts } = require('./db');

const app = express();
const PORT = process.env.API_PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Endpoint pour récupérer les dernières mesures par capteur
app.get('/latest-measurements', async (req, res) => {
  try {
    const measurements = await getLatestMeasurements();
    
    res.json({
      success: true,
      count: measurements.length,
      data: measurements,
    });
  } catch (error) {
    console.error('❌ Erreur lors de la récupération des mesures:', error.message);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération des mesures',
      message: error.message,
    });
  }
});

// Endpoint pour récupérer l'historique des alertes
app.get('/alerts', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const sensorId = req.query.sensor_id || null;
    
    const alerts = await getAlerts(limit, sensorId);
    
    res.json({
      success: true,
      count: alerts.length,
      data: alerts,
    });
  } catch (error) {
    console.error('❌ Erreur lors de la récupération des alertes:', error.message);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération des alertes',
      message: error.message,
    });
  }
});

// Endpoint de santé
app.get('/health', (req, res) => {
  res.json({
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString(),
  });
});

// Gestion des erreurs 404
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint non trouvé',
    availableEndpoints: [
      'GET /health',
      'GET /latest-measurements',
      'GET /alerts?limit=100&sensor_id=sensor-1',
    ],
  });
});

// Démarrer le serveur
app.listen(PORT, () => {
  console.log(`🚀 API REST démarrée sur le port ${PORT}`);
  console.log(`📡 Endpoints disponibles:`);
  console.log(`   - GET http://localhost:${PORT}/health`);
  console.log(`   - GET http://localhost:${PORT}/latest-measurements`);
  console.log(`   - GET http://localhost:${PORT}/alerts`);
  console.log(`   - 🌐 Dashboard: http://localhost:${PORT}/`);
});

// Gestion propre de l'arrêt
process.on('SIGINT', () => {
  console.log('\n🛑 Arrêt de l\'API REST...');
  process.exit(0);
});


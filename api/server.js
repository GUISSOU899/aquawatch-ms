const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { getLatestMeasurements, getAlerts } = require('./db');
const { router: authRouter, verifyJWT } = require('./auth');
const { computeWQI } = require('../lib/wqi');

const app = express();
const PORT = process.env.API_PORT || 3000;
const JWT_SECRET = process.env.API_JWT_SECRET || 'change_this_secret';
const USERS_FILE = path.join(__dirname, '..', 'auth', 'users.json');

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/auth', authRouter);

// Convenience top-level login route (also available at /auth/login)
app.post('/login', (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) return res.status(400).json({ success: false, error: 'username and password required' });
    if (!fs.existsSync(USERS_FILE)) return res.status(500).json({ success: false, error: 'users file not found' });
    const users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8')) || [];
    const user = users.find(u => u.username === username && u.password === password);
    if (!user) return res.status(401).json({ success: false, error: 'Invalid credentials' });
    const token = require('jsonwebtoken').sign({ username: user.username }, JWT_SECRET, { expiresIn: '8h' });
    return res.json({ success: true, token });
  } catch (err) {
    console.error('❌ /login error', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

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

// Endpoint: statistiques historiques produites par data-mining
app.get('/stats', verifyJWT, async (req, res) => {
  try {
    const statsPath = path.join(__dirname, '..', 'data', 'mining_outputs', 'stats.json');
    if (!fs.existsSync(statsPath)) {
      return res.status(404).json({ success: false, error: 'stats not found', message: 'Run data-mining first' });
    }
    const content = fs.readFileSync(statsPath, 'utf8');
    const data = JSON.parse(content);
    res.json({ success: true, count: data.length, data });
  } catch (error) {
    console.error('❌ Erreur /stats:', error.message);
    res.status(500).json({ success: false, error: 'Erreur lors de la lecture des statistiques', message: error.message });
  }
});

// WQI latest: compute WQI from latest measurements (public)
app.get('/wqi/latest', async (req, res) => {
  try {
    const measurements = await getLatestMeasurements();
    const result = measurements.map(m => {
      const info = computeWQI({
        ph: m.ph,
        turbidity: m.turbidity,
        temperature: m.temperature,
        conductivity: m.conductivity
      });
      return Object.assign({ sensor_id: m.sensor_id, timestamp: m.timestamp, latitude: m.latitude, longitude: m.longitude }, info);
    });
    res.json({ success: true, count: result.length, data: result });
  } catch (error) {
    console.error('❌ Erreur /wqi/latest:', error.message);
    res.status(500).json({ success: false, error: 'Erreur lors du calcul du WQI', message: error.message });
  }
});

// WQI forecast: compute WQI series from ML predictions (public)
app.get('/wqi/forecast', async (req, res) => {
  try {
    const sensorId = req.query.sensor_id || null;
    const jsonPath = path.join(__dirname, '..', 'data', 'ml_outputs', 'predictions.json');
    let rows = [];
    if (fs.existsSync(jsonPath)) {
      rows = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    } else {
      const predPath = path.join(__dirname, '..', 'data', 'ml_outputs', 'predictions.csv');
      if (!fs.existsSync(predPath)) {
        return res.status(404).json({ success: false, error: 'predictions not found', message: 'Run ml/train.py or ml/predict.py first' });
      }
      const csv = fs.readFileSync(predPath, 'utf8').trim();
      const lines = csv.split(/\r?\n/).filter(Boolean);
      const keys = lines[0].split(',');
      rows = lines.slice(1).map(l => {
        const parts = l.split(',');
        const obj = {};
        keys.forEach((k,i)=> obj[k]=parts[i]);
        return obj;
      });
    }

    // Build grouped forecast entries per sensor+timestamp
    const grouped = {};
    for (const r of rows) {
      const sid = r.sensor_id;
      if (sensorId && sid !== sensorId) continue;
      const ts = r.timestamp;
      const key = `${sid}||${ts}`;
      if (!grouped[key]) grouped[key] = { sensor_id: sid, timestamp: ts };
      const param = (r.parameter || r.parameter).toString();
      const pred = Number(r.prediction);
      if (param === 'pH' || param.toLowerCase() === 'ph') grouped[key].ph = pred;
      else if (param.toLowerCase() === 'turbidity') grouped[key].turbidity = pred;
      else if (param.toLowerCase() === 'temperature') grouped[key].temperature = pred;
      else if (param.toLowerCase() === 'conductivity') grouped[key].conductivity = pred;
    }

    const entries = Object.values(grouped).map(g => {
      const info = computeWQI({ ph: g.ph, turbidity: g.turbidity, temperature: g.temperature, conductivity: g.conductivity });
      return Object.assign({ sensor_id: g.sensor_id, timestamp: g.timestamp }, info);
    });

    // sort by timestamp
    entries.sort((a,b) => (''+a.timestamp).localeCompare(''+b.timestamp));
    res.json({ success: true, count: entries.length, data: entries });
  } catch (error) {
    console.error('❌ Erreur /wqi/forecast:', error.message);
    res.status(500).json({ success: false, error: 'Erreur lors du calcul du WQI forecast', message: error.message });
  }
});

// Endpoint: predictions produites par ML (predictions.csv)
app.get('/predictions', verifyJWT, async (req, res) => {
  try {
    const jsonPath = path.join(__dirname, '..', 'data', 'ml_outputs', 'predictions.json');
    if (fs.existsSync(jsonPath)) {
      const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
      return res.json({ success: true, count: data.length, data });
    }

    const predPath = path.join(__dirname, '..', 'data', 'ml_outputs', 'predictions.csv');
    if (!fs.existsSync(predPath)) {
      return res.status(404).json({ success: false, error: 'predictions not found', message: 'Run ml/train.py or ml/predict.py first' });
    }
    const csv = fs.readFileSync(predPath, 'utf8');
    // fallback simple CSV -> JSON parsing
    const lines = csv.split(/\r?\n/).filter(Boolean);
    const keys = lines[0].split(',');
    const rows = lines.slice(1).map(l => {
      const parts = l.split(',');
      const obj = {};
      keys.forEach((k,i)=> obj[k]=parts[i]);
      return obj;
    });
    res.json({ success: true, count: rows.length, data: rows });
  } catch (error) {
    console.error('❌ Erreur /predictions:', error.message);
    res.status(500).json({ success: false, error: 'Erreur lors de la lecture des predictions', message: error.message });
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


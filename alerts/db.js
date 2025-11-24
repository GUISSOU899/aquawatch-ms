const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

let SQL = null;

// Charger la base de données (recharger à chaque fois pour avoir les données à jour)
async function loadDb() {
  if (!SQL) {
    SQL = await initSqlJs();
  }
  const dbPath = path.join(__dirname, '..', 'data', 'aquawatch.db');
  if (!fs.existsSync(dbPath)) {
    return new SQL.Database();
  }
  // Recharger la base de données à chaque fois pour avoir les données à jour
  const buffer = fs.readFileSync(dbPath);
  return new SQL.Database(buffer);
}

// Initialisation de la table des alertes
async function initDatabase() {
  try {
    const db = await loadDb();
    
    db.run(`
      CREATE TABLE IF NOT EXISTS alerts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sensor_id TEXT NOT NULL,
        timestamp TEXT NOT NULL DEFAULT (datetime('now')),
        parameter TEXT NOT NULL,
        value REAL NOT NULL,
        threshold REAL NOT NULL,
        severity TEXT NOT NULL,
        message TEXT NOT NULL
      );
    `);

    db.run(`
      CREATE INDEX IF NOT EXISTS idx_alerts_sensor_timestamp 
      ON alerts (sensor_id, timestamp DESC);
    `);

    // Sauvegarder
    const dbPath = path.join(__dirname, '..', 'data', 'aquawatch.db');
    const dbData = db.export();
    const buffer = Buffer.from(dbData);
    fs.writeFileSync(dbPath, buffer);

    console.log('✅ Table des alertes initialisée avec succès');
  } catch (error) {
    console.error('❌ Erreur lors de l\'initialisation de la table des alertes:', error.message);
  }
}

// Récupérer les dernières mesures (dernières 2 minutes)
async function getRecentMeasurements() {
  const dbPath = path.join(__dirname, '..', 'data', 'aquawatch.db');
  if (!fs.existsSync(dbPath)) {
    return [];
  }
  
  const buffer = fs.readFileSync(dbPath);
  const db = new SQL.Database(buffer);
  
  const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
  
  const stmt = db.prepare(`
    SELECT 
      sensor_id,
      timestamp,
      latitude,
      longitude,
      ph,
      turbidity,
      temperature,
      conductivity
    FROM measurements
    WHERE timestamp > ?
    ORDER BY sensor_id, timestamp DESC
  `);

  try {
    stmt.bind([twoMinutesAgo]);
    const results = [];
    while (stmt.step()) {
      const row = stmt.getAsObject();
      results.push({
        sensor_id: row.sensor_id,
        timestamp: row.timestamp,
        latitude: row.latitude,
        longitude: row.longitude,
        ph: row.ph,
        turbidity: row.turbidity,
        temperature: row.temperature,
        conductivity: row.conductivity
      });
    }
    stmt.free();
    db.close();
    
    // Obtenir la dernière mesure par capteur
    const latestBySensor = {};
    for (const row of results) {
      if (!latestBySensor[row.sensor_id]) {
        latestBySensor[row.sensor_id] = row;
      }
    }
    
    return Object.values(latestBySensor);
  } catch (error) {
    db.close();
    console.error('❌ Erreur lors de la récupération des mesures:', error.message);
    throw error;
  }
}

// Insérer une alerte
async function insertAlert(alert) {
  // Charger la base existante
  const dbPath = path.join(__dirname, '..', 'data', 'aquawatch.db');
  if (!fs.existsSync(dbPath)) {
    throw new Error('Base de données non trouvée');
  }
  
  const buffer = fs.readFileSync(dbPath);
  const db = new SQL.Database(buffer);
  
  const stmt = db.prepare(`
    INSERT INTO alerts (sensor_id, timestamp, parameter, value, threshold, severity, message)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  try {
    stmt.run([
      alert.sensor_id,
      alert.timestamp || new Date().toISOString(),
      alert.parameter,
      alert.value,
      alert.threshold,
      alert.severity,
      alert.message
    ]);
    stmt.free();

    // Sauvegarder
    const dbData = db.export();
    const saveBuffer = Buffer.from(dbData);
    fs.writeFileSync(dbPath, saveBuffer);

    const result = db.exec("SELECT last_insert_rowid()");
    const id = result[0].values[0][0];
    db.close();
    
    return { id };
  } catch (error) {
    db.close();
    console.error('❌ Erreur lors de l\'insertion de l\'alerte:', error.message);
    throw error;
  }
}

// Vérifier si une alerte similaire existe déjà récemment
async function checkRecentAlert(sensorId, parameter, minutes = 5) {
  const dbPath = path.join(__dirname, '..', 'data', 'aquawatch.db');
  if (!fs.existsSync(dbPath)) {
    return false;
  }
  
  const buffer = fs.readFileSync(dbPath);
  const db = new SQL.Database(buffer);
  
  const minutesAgo = new Date(Date.now() - minutes * 60 * 1000).toISOString();
  
  const stmt = db.prepare(`
    SELECT id FROM alerts
    WHERE sensor_id = ? AND parameter = ? AND timestamp > ?
    LIMIT 1
  `);

  try {
    stmt.bind([sensorId, parameter, minutesAgo]);
    const exists = stmt.step();
    stmt.free();
    db.close();
    return exists;
  } catch (error) {
    db.close();
    console.error('❌ Erreur lors de la vérification des alertes récentes:', error.message);
    return false;
  }
}

module.exports = {
  loadDb,
  initDatabase,
  getRecentMeasurements,
  insertAlert,
  checkRecentAlert,
};

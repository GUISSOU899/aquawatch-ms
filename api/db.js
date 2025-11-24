const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

let SQL = null;

// Récupérer les dernières mesures par capteur
async function getLatestMeasurements() {
  const dbPath = path.join(__dirname, '..', 'data', 'aquawatch.db');
  if (!fs.existsSync(dbPath)) {
    return [];
  }

  if (!SQL) {
    SQL = await initSqlJs();
  }
  
  const buffer = fs.readFileSync(dbPath);
  const db = new SQL.Database(buffer);

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
    ORDER BY sensor_id, timestamp DESC
  `);

  try {
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
    // Si la table n'existe pas encore, retourner un tableau vide
    if (error.message.includes('no such table')) {
      return [];
    }
    console.error('❌ Erreur lors de la récupération des dernières mesures:', error.message);
    throw error;
  }
}

// Récupérer l'historique des alertes
async function getAlerts(limit = 100, sensorId = null) {
  const dbPath = path.join(__dirname, '..', 'data', 'aquawatch.db');
  if (!fs.existsSync(dbPath)) {
    return [];
  }

  if (!SQL) {
    SQL = await initSqlJs();
  }
  
  const buffer = fs.readFileSync(dbPath);
  const db = new SQL.Database(buffer);

  let query = `
    SELECT 
      id,
      sensor_id,
      timestamp,
      parameter,
      value,
      threshold,
      severity,
      message
    FROM alerts
  `;
  
  const params = [];
  
  if (sensorId) {
    query += ` WHERE sensor_id = ?`;
    params.push(sensorId);
  }
  
  query += ` ORDER BY timestamp DESC LIMIT ?`;
  params.push(limit);

  try {
    const stmt = db.prepare(query);
    stmt.bind(params);

    const results = [];
    while (stmt.step()) {
      const row = stmt.getAsObject();
      results.push({
        id: row.id,
        sensor_id: row.sensor_id,
        timestamp: row.timestamp,
        parameter: row.parameter,
        value: row.value,
        threshold: row.threshold,
        severity: row.severity,
        message: row.message
      });
    }
    stmt.free();
    db.close();
    return results;
  } catch (error) {
    db.close();
    // Si la table n'existe pas encore, retourner un tableau vide
    if (error.message.includes('no such table')) {
      return [];
    }
    console.error('❌ Erreur lors de la récupération des alertes:', error.message);
    throw error;
  }
}

module.exports = {
  getLatestMeasurements,
  getAlerts,
};

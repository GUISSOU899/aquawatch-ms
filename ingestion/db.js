const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

let db = null;
let SQL = null;

// Initialiser la base de données
async function initDatabase() {
  try {
    SQL = await initSqlJs();
    const dbPath = path.join(__dirname, '..', 'data', 'aquawatch.db');
    const dbDir = path.dirname(dbPath);
    
    // Créer le dossier data s'il n'existe pas
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
    
    // Charger la base de données existante ou en créer une nouvelle
    if (fs.existsSync(dbPath)) {
      const buffer = fs.readFileSync(dbPath);
      db = new SQL.Database(buffer);
    } else {
      db = new SQL.Database();
    }

    // Créer la table des mesures si elle n'existe pas
    db.run(`
      CREATE TABLE IF NOT EXISTS measurements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sensor_id TEXT NOT NULL,
        timestamp TEXT NOT NULL DEFAULT (datetime('now')),
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        ph REAL NOT NULL,
        turbidity REAL NOT NULL,
        temperature REAL NOT NULL,
        conductivity REAL NOT NULL
      );
    `);

    // Créer un index
    db.run(`
      CREATE INDEX IF NOT EXISTS idx_measurements_sensor_timestamp 
      ON measurements (sensor_id, timestamp DESC);
    `);

    // Sauvegarder la base de données
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbPath, buffer);

    console.log('✅ Base de données SQLite initialisée avec succès');
  } catch (error) {
    console.error('❌ Erreur lors de l\'initialisation de la base de données:', error.message);
  }
}

// Obtenir l'instance de la base de données
function getDb() {
  if (!db) {
    throw new Error('Base de données non initialisée');
  }
  return db;
}

// Insérer une mesure dans la base de données
function insertMeasurement(data) {
  if (!db) {
    throw new Error('Base de données non initialisée');
  }
  
  try {
    // Recharger la base de données pour avoir la version la plus récente
    const dbPath = path.join(__dirname, '..', 'data', 'aquawatch.db');
    if (fs.existsSync(dbPath)) {
      const buffer = fs.readFileSync(dbPath);
      db.close();
      db = new SQL.Database(buffer);
    }
    
    const stmt = db.prepare(`
      INSERT INTO measurements (sensor_id, timestamp, latitude, longitude, ph, turbidity, temperature, conductivity)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const timestamp = data.timestamp || new Date().toISOString();
    stmt.run([
      data.sensor_id,
      timestamp,
      data.latitude,
      data.longitude,
      data.ph,
      data.turbidity,
      data.temperature,
      data.conductivity
    ]);
    stmt.free();

    // Sauvegarder la base de données
    const dbData = db.export();
    const buffer = Buffer.from(dbData);
    fs.writeFileSync(dbPath, buffer);

    const result = db.exec("SELECT last_insert_rowid()");
    const id = result[0].values[0][0];
    
    return { id };
  } catch (error) {
    console.error('❌ Erreur lors de l\'insertion de la mesure:', error.message);
    throw error;
  }
}

module.exports = {
  getDb,
  initDatabase,
  insertMeasurement,
};

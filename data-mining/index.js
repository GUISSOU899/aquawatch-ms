const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
const initSqlJs = require('sql.js');

const OUT_DIR = path.join(__dirname, '..', 'data', 'mining_outputs');
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

const THRESHOLDS = {
  ph: { min: 6.5, max: 8.5 },
  turbidity: { max: 5.0 },
  temperature: { min: 0, max: 30 },
  conductivity: { max: 2500 },
};

async function queryPostgres(query, params = []) {
  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT ? parseInt(process.env.DB_PORT) : 5432,
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'aquawatch',
  });
  await client.connect();
  try {
    const res = await client.query(query, params);
    return res.rows;
  } finally {
    await client.end();
  }
}

async function readFromSqlite() {
  const SQL = await initSqlJs();
  const dbPath = path.join(__dirname, '..', 'data', 'aquawatch.db');
  if (!fs.existsSync(dbPath)) return [];
  const buffer = fs.readFileSync(dbPath);
  const db = new SQL.Database(buffer);
  const res = db.exec('SELECT sensor_id, timestamp, latitude, longitude, ph, turbidity, temperature, conductivity FROM measurements ORDER BY timestamp ASC');
  if (!res || !res[0]) return [];
  const cols = res[0].columns;
  return res[0].values.map((row) => {
    const obj = {};
    cols.forEach((c, i) => (obj[c] = row[i]));
    return obj;
  });
}

function summarizePerSensor(rows) {
  const bySensor = {};
  for (const r of rows) {
    const id = r.sensor_id;
    if (!bySensor[id]) bySensor[id] = { count: 0, ph: [], turbidity: [], temperature: [], conductivity: [] };
    bySensor[id].count++;
    bySensor[id].ph.push(Number(r.ph));
    bySensor[id].turbidity.push(Number(r.turbidity));
    bySensor[id].temperature.push(Number(r.temperature));
    bySensor[id].conductivity.push(Number(r.conductivity));
  }

  const stats = [];
  for (const [sensor_id, v] of Object.entries(bySensor)) {
    function statsFor(arr) {
      const n = arr.length;
      if (n === 0) return { mean: null, min: null, max: null, std: null };
      const mean = arr.reduce((a, b) => a + b, 0) / n;
      const min = Math.min(...arr);
      const max = Math.max(...arr);
      const std = Math.sqrt(arr.map(x => Math.pow(x - mean, 2)).reduce((a, b) => a + b, 0) / n);
      return { mean, min, max, std };
    }

    stats.push({
      sensor_id,
      count: v.count,
      ph: statsFor(v.ph),
      turbidity: statsFor(v.turbidity),
      temperature: statsFor(v.temperature),
      conductivity: statsFor(v.conductivity),
    });
  }
  return stats;
}

function detectRecurrentAnomalies(rows) {
  const bySensor = {};
  const sinceDays = 30;
  const since = new Date(Date.now() - sinceDays * 24 * 3600 * 1000);
  for (const r of rows) {
    const ts = new Date(r.timestamp);
    if (isNaN(ts)) continue;
    if (ts < since) continue;
    const id = r.sensor_id;
    if (!bySensor[id]) bySensor[id] = { ph: 0, turbidity: 0, temperature: 0, conductivity: 0, total: 0 };
    bySensor[id].total++;
    if (r.ph < THRESHOLDS.ph.min || r.ph > THRESHOLDS.ph.max) bySensor[id].ph++;
    if (Number(r.turbidity) > THRESHOLDS.turbidity.max) bySensor[id].turbidity++;
    if (r.temperature < THRESHOLDS.temperature.min || r.temperature > THRESHOLDS.temperature.max) bySensor[id].temperature++;
    if (Number(r.conductivity) > THRESHOLDS.conductivity.max) bySensor[id].conductivity++;
  }

  const anomalies = [];
  for (const [sensor_id, v] of Object.entries(bySensor)) {
    const summary = { sensor_id, total: v.total };
    for (const param of ['ph','turbidity','temperature','conductivity']) {
      const count = v[param];
      const freq = v.total > 0 ? count / v.total : 0;
      summary[param] = { count, frequency: freq }; // frequency in [0,1]
      summary[param].recurrent = freq >= 0.05; // arbitrary: recurrent if >=5% of recent readings
    }
    anomalies.push(summary);
  }
  return anomalies;
}

function groupDaily(rows) {
  // daily avg per sensor and parameter
  const daily = {};
  for (const r of rows) {
    const d = (new Date(r.timestamp)).toISOString().slice(0,10);
    const id = r.sensor_id;
    const key = `${id}|${d}`;
    if (!daily[key]) daily[key] = { sensor_id: id, date: d, ph: [], turbidity: [], temperature: [], conductivity: [] };
    daily[key].ph.push(Number(r.ph));
    daily[key].turbidity.push(Number(r.turbidity));
    daily[key].temperature.push(Number(r.temperature));
    daily[key].conductivity.push(Number(r.conductivity));
  }
  return Object.values(daily).map(d => ({
    sensor_id: d.sensor_id,
    date: d.date,
    ph: d.ph.reduce((a,b)=>a+b,0)/d.ph.length,
    turbidity: d.turbidity.reduce((a,b)=>a+b,0)/d.turbidity.length,
    temperature: d.temperature.reduce((a,b)=>a+b,0)/d.temperature.length,
    conductivity: d.conductivity.reduce((a,b)=>a+b,0)/d.conductivity.length,
  }));
}

function groupWeekly(rows) {
  // week starting Monday ISO week/year
  const weekly = {};
  for (const r of rows) {
    const d = new Date(r.timestamp);
    const year = d.getUTCFullYear();
    const week = getWeekNumber(d);
    const key = `${r.sensor_id}|${year}-${week}`;
    if (!weekly[key]) weekly[key] = { sensor_id: r.sensor_id, year, week, ph: [], turbidity: [], temperature: [], conductivity: [] };
    weekly[key].ph.push(Number(r.ph));
    weekly[key].turbidity.push(Number(r.turbidity));
    weekly[key].temperature.push(Number(r.temperature));
    weekly[key].conductivity.push(Number(r.conductivity));
  }
  return Object.values(weekly).map(d => ({
    sensor_id: d.sensor_id,
    year: d.year,
    week: d.week,
    ph: d.ph.reduce((a,b)=>a+b,0)/d.ph.length,
    turbidity: d.turbidity.reduce((a,b)=>a+b,0)/d.turbidity.length,
    temperature: d.temperature.reduce((a,b)=>a+b,0)/d.temperature.length,
    conductivity: d.conductivity.reduce((a,b)=>a+b,0)/d.conductivity.length,
  }));
}

function getWeekNumber(d) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(),0,1));
  return Math.ceil((((date - yearStart) / 86400000) + 1)/7);
}

function writeJSON(name, obj) {
  const p = path.join(OUT_DIR, name);
  fs.writeFileSync(p, JSON.stringify(obj, null, 2));
  console.log('Wrote', p);
}

function writeCSV(name, rows) {
  if (!Array.isArray(rows) || rows.length === 0) return;
  const keys = Object.keys(rows[0]);
  const csv = [keys.join(',')].concat(rows.map(r => keys.map(k => JSON.stringify(r[k] === undefined ? '' : r[k])).join(','))).join('\n');
  const p = path.join(OUT_DIR, name);
  fs.writeFileSync(p, csv);
  console.log('Wrote', p);
}

async function main() {
  console.log('🔎 Starting data-mining...');
  let rows = [];
  const usePostgres = !!process.env.DB_HOST && process.env.DB_HOST !== 'sqlite' && process.env.DB_HOST !== 'localhost-sqlite';
  if (usePostgres) {
    try {
      rows = await queryPostgres('SELECT sensor_id, timestamp, latitude, longitude, ph, turbidity, temperature, conductivity FROM measurements ORDER BY timestamp ASC');
      console.log('Connected to Postgres, rows:', rows.length);
    } catch (e) {
      console.warn('Postgres query failed, falling back to sqlite:', e.message);
      rows = await readFromSqlite();
    }
  } else {
    rows = await readFromSqlite();
    console.log('Read rows from sqlite:', rows.length);
  }

  const stats = summarizePerSensor(rows);
  const anomalies = detectRecurrentAnomalies(rows);
  const daily = groupDaily(rows);
  const weekly = groupWeekly(rows);

  writeJSON('stats.json', stats);
  writeCSV('stats.csv', stats);
  writeJSON('anomalies.json', anomalies);
  writeCSV('anomalies.csv', anomalies);
  writeJSON('daily.json', daily);
  writeCSV('daily.csv', daily);
  writeJSON('weekly.json', weekly);
  writeCSV('weekly.csv', weekly);

  // also export raw measurements to CSV for ML consumption
  writeCSV('measurements.csv', rows);

  // optional: write back to Postgres summary tables if available
  if (usePostgres) {
    try {
      const createStats = `
        CREATE TABLE IF NOT EXISTS sensor_stats (
          sensor_id TEXT,
          metric TEXT,
          mean DOUBLE PRECISION,
          min DOUBLE PRECISION,
          max DOUBLE PRECISION,
          std DOUBLE PRECISION,
          created_at TIMESTAMP DEFAULT now()
        );
      `;
      await queryPostgres(createStats);
      // insert stats
      for (const s of stats) {
        await queryPostgres('INSERT INTO sensor_stats(sensor_id, metric, mean, min, max, std) VALUES($1,$2,$3,$4,$5,$6)', [s.sensor_id, 'ph', s.ph.mean, s.ph.min, s.ph.max, s.ph.std]);
        await queryPostgres('INSERT INTO sensor_stats(sensor_id, metric, mean, min, max, std) VALUES($1,$2,$3,$4,$5,$6)', [s.sensor_id, 'turbidity', s.turbidity.mean, s.turbidity.min, s.turbidity.max, s.turbidity.std]);
      }
      console.log('Wrote summary tables to Postgres');
    } catch (e) {
      console.warn('Failed to write summaries to Postgres:', e.message);
    }
  }

  console.log('✅ Data-mining completed. Outputs in', OUT_DIR);
}

if (require.main === module) {
  main().catch(e => {
    console.error('Data-mining failed:', e.message);
    process.exit(1);
  });
}

module.exports = { main };

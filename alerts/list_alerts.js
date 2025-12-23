const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

(async ()=>{
  const SQL = await initSqlJs();
  const dbPath = path.join(__dirname, '..', 'data', 'aquawatch.db');
  if (!fs.existsSync(dbPath)) { console.log('No DB found'); process.exit(0); }
  const buffer = fs.readFileSync(dbPath);
  const db = new SQL.Database(buffer);
  try {
    const res = db.exec('SELECT id, sensor_id, timestamp, parameter, value, threshold, severity, message FROM alerts ORDER BY timestamp DESC LIMIT 50');
    if (!res || res.length === 0) { console.log('No alerts found'); process.exit(0); }
    const cols = res[0].columns;
    for (const row of res[0].values) {
      const obj = {};
      cols.forEach((c,i)=> obj[c]=row[i]);
      console.log(obj);
    }
  } catch(e){ console.error('Error reading alerts:', e.message); }
  db.close();
})();

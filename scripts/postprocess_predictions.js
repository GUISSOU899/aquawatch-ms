const fs = require('fs');
const path = require('path');
const { computeWQI } = require('../lib/wqi');

const IN = path.join(__dirname, '..', 'data', 'ml_outputs', 'predictions.csv');
const OUT = path.join(__dirname, '..', 'data', 'ml_outputs', 'predictions.json');

const WHO = {
  turbidity: { max: 5.0 }
};

if (!fs.existsSync(IN)) {
  console.error('predictions.csv not found, run ml/train.py or ml/predict.py first');
  process.exit(1);
}

const csv = fs.readFileSync(IN, 'utf8').trim();
const lines = csv.split(/\r?\n/).filter(Boolean);
const keys = lines[0].split(',');
const rows = lines.slice(1).map(l => {
  const parts = l.split(',');
  const obj = {};
  keys.forEach((k,i) => obj[k]=parts[i]);
  return obj;
});

// Postprocess: clip predictions to a reasonable numeric range and add risk flag
const processed = rows.map(r => {
  const p = Number(r.prediction);
  // clip NaN
  let pred = Number.isFinite(p) ? p : 0;
  // clamp to [0, 10000]
  if (pred < 0) pred = 0;
  if (pred > 10000) pred = 10000;
  const risk = {};
  if (r.parameter === 'turbidity') {
    risk.parameter = 'turbidity';
    risk.exceeds_who = pred > WHO.turbidity.max;
    risk.who_threshold = WHO.turbidity.max;
  }

  // compute WQI combining available fields (ph, turbidity, temperature, conductivity)
  // Note: predictions.csv may only contain a single parameter per row; we compute WQI
  // using the available predicted value for that parameter and leaving others null.
  const wqi = computeWQI({
    ph: r.parameter === 'pH' ? pred : (r.ph !== undefined ? Number(r.ph) : null),
    turbidity: r.parameter === 'turbidity' ? pred : (r.turbidity !== undefined ? Number(r.turbidity) : null),
    temperature: r.temperature !== undefined ? Number(r.temperature) : null,
    conductivity: r.conductivity !== undefined ? Number(r.conductivity) : null
  });

  return {
    sensor_id: r.sensor_id,
    timestamp: r.timestamp,
    parameter: r.parameter,
    prediction: pred,
    risk,
    wqi
  };
});

fs.writeFileSync(OUT, JSON.stringify(processed, null, 2));
console.log('Wrote', OUT, 'rows:', processed.length);

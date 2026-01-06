const fs = require('fs');
const path = require('path');
const { computeWQI } = require('../lib/wqi');

// Prefer latest predictions from `ai/predictions.csv` (produced by the model).
// Fall back to data/ml_outputs/predictions.csv for backwards compatibility.
const AI_IN = path.join(__dirname, '..', 'ai', 'predictions.csv');
const LEGACY_IN = path.join(__dirname, '..', 'data', 'ml_outputs', 'predictions.csv');
const IN = fs.existsSync(AI_IN) ? AI_IN : LEGACY_IN;

// If a legacy predictions CSV exists but we're using ai/predictions.csv, archive the old file
try {
  if (fs.existsSync(LEGACY_IN) && IN !== LEGACY_IN) {
    const bak = LEGACY_IN + '.bak.' + Date.now();
    fs.renameSync(LEGACY_IN, bak);
    console.log('Archived legacy predictions file to', bak);
  }
} catch (e) {
  console.warn('Could not archive legacy predictions file:', e.message);
}
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

// Postprocess: validate and clamp predictions per-parameter and add risk flag
const CLAMPS = {
  ph: { min: 0, max: 14 },
  turbidity: { min: 0, max: 1000 },
  temperature: { min: -50, max: 60 },
  conductivity: { min: 0, max: 10000 },
  wqi: { min: 0, max: 100 }
};

function clampParam(param, value) {
  const p = (param || '').toString().toLowerCase();
  const c = CLAMPS[p];
  if (!Number.isFinite(value)) return null;
  if (!c) return value; // no clamp defined
  if (value < c.min) return c.min;
  if (value > c.max) return c.max;
  return value;
}

const processed = rows.map(r => {
  const raw = Number(r.prediction);
  const param = (r.parameter || '').toString().toLowerCase();
  let pred = Number.isFinite(raw) ? raw : null;
  pred = pred === null ? null : clampParam(param, pred);

  const risk = {};
  if (param === 'turbidity') {
    risk.parameter = 'turbidity';
    risk.exceeds_who = pred !== null && pred > WHO.turbidity.max;
    risk.who_threshold = WHO.turbidity.max;
  }

  // compute WQI combining available fields (ph, turbidity, temperature, conductivity)
  const wqi = computeWQI({
    ph: param === 'ph' ? pred : (r.ph !== undefined ? clampParam('ph', Number(r.ph)) : null),
    turbidity: param === 'turbidity' ? pred : (r.turbidity !== undefined ? clampParam('turbidity', Number(r.turbidity)) : null),
    temperature: r.temperature !== undefined ? clampParam('temperature', Number(r.temperature)) : null,
    conductivity: r.conductivity !== undefined ? clampParam('conductivity', Number(r.conductivity)) : null
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

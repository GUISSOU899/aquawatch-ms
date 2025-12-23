/*
  Water Quality Index (WQI) helper

  This module provides simple, explainable formulas to compute a WQI
  from sensor parameters: pH, turbidity (NTU), temperature (°C), conductivity (µS/cm).

  Normalization approach (sub-index 0-100 for each parameter):
  - pH: ideal = 7.0. Subindex = max(0, 100*(1 - |pH-7|/7)). This linearly penalizes distance
    from neutral pH; 0 maps to 0 and 14 maps to 0, 7 -> 100.
  - Turbidity: lower is better. Use max physical cap turbMax (default 1000 NTU).
    Subindex = max(0, 100*(1 - turbidity / turbMax)).
  - Temperature: ideal ~20°C for freshwater ecology. Subindex = max(0, 100*(1 - |T-20|/25)).
    This gives 100 at 20°C and declines linearly; extremes beyond ±25°C map to 0.
  - Conductivity: lower generally better for drinking water. Use cap condMax (default 5000 µS/cm).
    Subindex = max(0, 100*(1 - conductivity / condMax)).

  WQI: weighted average of sub-indices. We use explainable weights summing to 1:
    w_pH = 0.25, w_turb = 0.35, w_temp = 0.2, w_cond = 0.2

  Classification:
    90-100 Excellent
    70-89  Good
    50-69  Moderate
    <50    Poor

  The formulas are simple linear scalings chosen for explainability and defensibility.
*/

function clamp(v, a, b) {
  if (isNaN(v) || v === null || v === undefined) return null;
  return Math.max(a, Math.min(b, v));
}

function subindexPH(pH) {
  if (pH === null || pH === undefined || isNaN(pH)) return null;
  const d = Math.abs(pH - 7.0);
  const val = Math.max(0, 100 * (1 - d / 7.0));
  return +val.toFixed(2);
}

function subindexTurbidity(turb, turbMax = 1000) {
  if (turb === null || turb === undefined || isNaN(turb)) return null;
  const v = Math.max(0, 100 * (1 - turb / turbMax));
  return +v.toFixed(2);
}

function subindexTemperature(temp) {
  if (temp === null || temp === undefined || isNaN(temp)) return null;
  const d = Math.abs(temp - 20.0);
  const val = Math.max(0, 100 * (1 - d / 25.0));
  return +val.toFixed(2);
}

function subindexConductivity(cond, condMax = 5000) {
  if (cond === null || cond === undefined || isNaN(cond)) return null;
  const v = Math.max(0, 100 * (1 - cond / condMax));
  return +v.toFixed(2);
}

function computeWQI(measurement, options = {}) {
  // measurement: { ph, turbidity, temperature, conductivity }
  const weights = options.weights || { ph: 0.25, turbidity: 0.35, temperature: 0.2, conductivity: 0.2 };
  const turbMax = (options.turbMax !== undefined) ? options.turbMax : 1000;
  const condMax = (options.condMax !== undefined) ? options.condMax : 5000;

  const ph = measurement.ph !== undefined ? Number(measurement.ph) : null;
  const turb = measurement.turbidity !== undefined ? Number(measurement.turbidity) : null;
  const temp = measurement.temperature !== undefined ? Number(measurement.temperature) : null;
  const cond = measurement.conductivity !== undefined ? Number(measurement.conductivity) : null;

  const s_ph = subindexPH(ph);
  const s_turb = subindexTurbidity(turb, turbMax);
  const s_temp = subindexTemperature(temp);
  const s_cond = subindexConductivity(cond, condMax);

  // Weighted mean, ignoring null subindices and renormalizing weights.
  const subs = { ph: s_ph, turbidity: s_turb, temperature: s_temp, conductivity: s_cond };
  let totalWeight = 0;
  let accum = 0;
  for (const k of Object.keys(weights)) {
    const sub = subs[k];
    if (sub === null) continue;
    const w = weights[k];
    totalWeight += w;
    accum += sub * w;
  }
  const wqi = (totalWeight > 0) ? +(accum / totalWeight).toFixed(2) : null;

  let classLabel = null;
  if (wqi !== null) {
    if (wqi >= 90) classLabel = 'Excellent';
    else if (wqi >= 70) classLabel = 'Good';
    else if (wqi >= 50) classLabel = 'Moderate';
    else classLabel = 'Poor';
  }

  return {
    wqi,
    class: classLabel,
    subindices: subs,
    weights
  };
}

module.exports = {
  computeWQI,
  subindexPH,
  subindexTurbidity,
  subindexTemperature,
  subindexConductivity
};

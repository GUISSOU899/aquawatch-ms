# Analytics and ML modules

This document describes the Data Mining and Machine Learning modules added to the project.

Overview
- `data-mining/` (Node.js): reads historical `measurements` from TimescaleDB (if available) or local SQLite fallback (`data/aquawatch.db`). Produces:
  - `data/mining_outputs/stats.json` and `stats.csv` (per-sensor mean/min/max/std)
  - `data/mining_outputs/daily.csv`, `weekly.csv` (aggregations)
  - `data/mining_outputs/anomalies.json` (recurrent violation summary)
  - `data/mining_outputs/measurements.csv` (export for ML)

- `ml/` (Python): simple baseline ML pipeline.
  - `ml/train.py`: trains a per-sensor LinearRegression on hourly resampled turbidity and saves models in `ml/models/` and outputs `data/ml_outputs/predictions.csv`.
  - `ml/predict.py`: loads models and writes predictions (useful for scheduled runs).

API integration
- `api` exposes two new endpoints:
  - `GET /stats` — returns JSON from `data/mining_outputs/stats.json`.
  - `GET /predictions` — returns JSON parsed from `data/ml_outputs/predictions.csv`.

Running locally (no Docker)
1. Ensure services are running: ingestion, api, alerts. SQLite fallback works without external DB.
2. Run data-mining to export historical CSVs:
   - `node data-mining/index.js`
3. Install Python deps (in a virtualenv) and run training:
   - `python -m venv .venv` (optional)
   - `pip install -r ml/requirements.txt`
   - `python ml/train.py`
4. Check API endpoints:
   - `curl http://localhost:3000/stats`
   - `curl http://localhost:3000/predictions`

Notes for reproducibility
- If you have TimescaleDB/Postgres available, set `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` in environment before running `data-mining` to use the primary time-series store.
- ML scripts prioritize CSV exported by `data-mining` and will exit if the CSV is missing.

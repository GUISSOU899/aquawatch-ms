"""
Load saved models and produce predictions (useful for scheduled prediction runs).
Outputs predictions to data/ml_outputs/predictions.csv
"""
import os
import pandas as pd
import joblib

ROOT = os.path.dirname(os.path.dirname(__file__))
DATA_DIR = os.path.join(ROOT, 'data', 'mining_outputs')
ML_OUT = os.path.join(ROOT, 'data', 'ml_outputs')
MODELS_DIR = os.path.join(ROOT, 'ml', 'models')
os.makedirs(ML_OUT, exist_ok=True)

def load_models():
    models = {}
    if not os.path.exists(MODELS_DIR):
        return models
    for fn in os.listdir(MODELS_DIR):
        if fn.endswith('.joblib'):
            sensor = fn.split('_')[0]
            models[sensor] = joblib.load(os.path.join(MODELS_DIR, fn))
    return models

def load_series():
    csv = os.path.join(DATA_DIR, 'measurements.csv')
    if not os.path.exists(csv):
        raise SystemExit('Missing measurements.csv - run data-mining first')
    df = pd.read_csv(csv, parse_dates=['timestamp']).set_index('timestamp')
    return df

def main():
    models = load_models()
    df = load_series()
    results = []
    for sensor_id, model in models.items():
        try:
            s = df[df['sensor_id'] == sensor_id]['turbidity'].astype(float).resample('H').mean().ffill()
            if len(s) < 24:
                continue
            last = s.values[-24:]
            preds = []
            import numpy as np
            for _ in range(24):
                p = model.predict(last.reshape(1,-1))[0]
                preds.append(p)
                last = np.roll(last, -1)
                last[-1] = p
            ts_index = pd.date_range(start=s.index[-1] + pd.Timedelta(hours=1), periods=24, freq='H')
            for t,p in zip(ts_index, preds):
                results.append({'sensor_id': sensor_id, 'timestamp': t.isoformat(), 'parameter': 'turbidity', 'prediction': float(p)})
        except Exception as e:
            print('Prediction failed for', sensor_id, e)

    out_csv = os.path.join(ML_OUT, 'predictions.csv')
    if results:
        pd.DataFrame(results).to_csv(out_csv, index=False)
        print('Saved predictions to', out_csv)
    else:
        print('No predictions generated')

if __name__ == '__main__':
    main()

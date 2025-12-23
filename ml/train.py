"""
Train simple per-sensor LinearRegression models on historical turbidity.
Outputs models to ml/models/ and predictions to data/ml_outputs/predictions.csv
"""
import os
import pandas as pd
import numpy as np
from sklearn.linear_model import LinearRegression
import joblib

ROOT = os.path.dirname(os.path.dirname(__file__))
DATA_DIR = os.path.join(ROOT, 'data', 'mining_outputs')
ML_OUT = os.path.join(ROOT, 'data', 'ml_outputs')
MODELS_DIR = os.path.join(ROOT, 'ml', 'models')
os.makedirs(ML_OUT, exist_ok=True)
os.makedirs(MODELS_DIR, exist_ok=True)

TARGET = 'turbidity'
PRED_HORIZON = 24  # hours

def load_measurements():
    csv = os.path.join(DATA_DIR, 'measurements.csv')
    if not os.path.exists(csv):
        raise SystemExit('Missing measurements.csv - run data-mining first')
    df = pd.read_csv(csv, parse_dates=['timestamp'])
    df = df.set_index('timestamp')
    return df

def train_for_sensor(df_sensor):
    # resample hourly mean
    s = df_sensor[TARGET].astype(float).resample('H').mean().ffill()
    # create lag features
    lags = 24
    X = []
    y = []
    for i in range(lags, len(s)):
        X.append(s.values[i-lags:i])
        y.append(s.values[i])
    if len(X) < 5:
        return None, None
    X = np.array(X)
    y = np.array(y)
    model = LinearRegression()
    model.fit(X, y)
    return model, s

def forecast(model, series):
    # iterative forecast
    last_window = series.values[-24:]
    preds = []
    for _ in range(PRED_HORIZON):
        x = last_window.reshape(1, -1)
        p = model.predict(x)[0]
        preds.append(p)
        last_window = np.roll(last_window, -1)
        last_window[-1] = p
    return preds

def main():
    df = load_measurements()
    results = []
    for sensor_id, g in df.groupby('sensor_id'):
        try:
            model, series = train_for_sensor(g)
            if model is None:
                print('Not enough data for', sensor_id)
                continue
            preds = forecast(model, series)
            # save model
            model_path = os.path.join(MODELS_DIR, f'{sensor_id}_turbidity.joblib')
            joblib.dump(model, model_path)
            ts_index = pd.date_range(start=series.index[-1] + pd.Timedelta(hours=1), periods=len(preds), freq='H')
            for t, p in zip(ts_index, preds):
                results.append({'sensor_id': sensor_id, 'timestamp': t.isoformat(), 'parameter': TARGET, 'prediction': float(p)})
            print('Trained and forecasted for', sensor_id)
        except Exception as e:
            print('Failed for', sensor_id, e)

    out_csv = os.path.join(ML_OUT, 'predictions.csv')
    if results:
        pd.DataFrame(results).to_csv(out_csv, index=False)
        print('Saved predictions to', out_csv)
    else:
        print('No predictions generated')

if __name__ == '__main__':
    main()

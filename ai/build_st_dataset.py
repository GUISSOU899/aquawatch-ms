# ai/build_st_dataset.py
import pandas as pd
import numpy as np

WINDOW = 24
HORIZON = 24

FEATURES = ["ph", "turbidity", "temperature", "conductivity"]

# Load CSV
df = pd.read_csv("data/mining_outputs/measurements.csv", parse_dates=["timestamp"])
df = df.sort_values(["timestamp"])

sensors = df["sensor_id"].unique()

# Simple WQI formula (same logic as your backend)
def compute_wqi(row):
    score = 100
    if row["ph"] < 6.5 or row["ph"] > 8.5:
        score -= 30
    if row["turbidity"] > 5:
        score -= 30
    if row["temperature"] > 30:
        score -= 10
    if row["conductivity"] > 2000:
        score -= 10
    return max(score, 0)

df["wqi"] = df.apply(compute_wqi, axis=1)

FEATURES.append("wqi")

def build():
    X, Y = [], []

    for start in range(len(df) - WINDOW - HORIZON):
        past = []
        future = []

        for sid in sensors:
            sdata = df[df.sensor_id == sid]
            chunk = sdata.iloc[start:start+WINDOW]
            fchunk = sdata.iloc[start+WINDOW:start+WINDOW+HORIZON]

            if len(chunk) != WINDOW or len(fchunk) != HORIZON:
                break

            past.append(chunk[FEATURES].values)
            future.append(fchunk[FEATURES].values)

        if len(past) == len(sensors):
            X.append(past)
            Y.append(future)

    X = np.array(X)
    Y = np.array(Y)

    # Save for train/predict
    np.save("ai/st_dataset.npy", X)  # <- Changed to st_dataset.npy
    np.save("ai/Y.npy", Y)

    print("Saved:", X.shape, Y.shape)

if __name__ == "__main__":
    build()

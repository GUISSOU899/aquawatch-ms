# ai/predict.py
import torch
import numpy as np
import pandas as pd

# Relative import (works when running as a module)
from .train import ConvLSTMBlock as ConvLSTM
 

# Paths
DATA_PATH = "ai/st_dataset.npy"       # input dataset
MODEL_PATH = "ai/convlstm_model.pth"  # trained model
OUTPUT_CSV = "ai/predictions.csv"     # output predictions

# Load dataset
data = np.load(DATA_PATH)  # shape: (samples, sensors, timesteps, features)
data_tensor = torch.tensor(data, dtype=torch.float32)

# Initialize model (match hyperparameters from training)
input_size = data.shape[-1]
hidden_size = 64    # must match your train.py
num_layers = 1
output_size = data.shape[-1]

model = ConvLSTM(input_channels=input_size, hidden_channels=hidden_size)

model.load_state_dict(torch.load(MODEL_PATH))
model.eval()

# Make predictions
predictions = model(data_tensor).detach().numpy()

# Flatten to CSV-friendly format
samples, sensors, horizon, features = predictions.shape
feature_names = ["ph", "turbidity", "temperature", "conductivity", "wqi"]

rows = []
for s in range(sensors):
    for t in range(horizon):
        for f_idx, f_name in enumerate(feature_names):
            rows.append({
                "sensor_id": f"sensor-{s+1}",
                "timestamp": pd.Timestamp.now() + pd.Timedelta(hours=t),
                "parameter": f_name,
                "prediction": predictions[0, s, t, f_idx]
            })

df = pd.DataFrame(rows)
df.to_csv(OUTPUT_CSV, index=False)
print(f"Predictions saved to {OUTPUT_CSV}")

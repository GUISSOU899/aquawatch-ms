import numpy as np
import torch
import torch.nn as nn
from torch.utils.data import DataLoader, TensorDataset
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
import math

X = np.load("ai/X.npy")
Y = np.load("ai/Y.npy")

X = torch.tensor(X).float()
Y = torch.tensor(Y).float()

dataset = TensorDataset(X, Y)
loader = DataLoader(dataset, batch_size=64)

class ConvLSTMBlock(nn.Module):
    def __init__(self, input_channels, hidden_channels=64, kernel_size=3):
        super().__init__()
        # use the same attribute names as in training: conv_lstm and conv_out
        self.conv_lstm = nn.LSTM(input_channels, hidden_channels, batch_first=True)
        self.conv_out = nn.Linear(hidden_channels, input_channels)

    def forward(self, x):
        # x: [batch, sensors, timesteps, features]
        b, s, t, f = x.shape
        x = x.view(b * s, t, f)
        out, _ = self.conv_lstm(x)
        out = self.conv_out(out)
        return out.view(b, s, t, f)

model = ConvLSTMBlock(X.shape[-1])
model.load_state_dict(torch.load("ai/convlstm_model.pth"))
model.eval()

all_preds = []
all_true = []

with torch.no_grad():
    for xb, yb in loader:
        pred = model(xb)
        all_preds.append(pred.numpy().reshape(-1))
        all_true.append(yb.numpy().reshape(-1))

preds = np.concatenate(all_preds)
true = np.concatenate(all_true)

mae = mean_absolute_error(true, preds)
rmse = math.sqrt(mean_squared_error(true, preds))
r2 = r2_score(true, preds)

print("\nMODEL PERFORMANCE:")
print("MAE :", round(mae, 3))
print("RMSE:", round(rmse, 3))
print("R2  :", round(r2, 3))

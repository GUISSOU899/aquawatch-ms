import numpy as np
import torch
import torch.nn as nn
from torch.utils.data import DataLoader, TensorDataset
import matplotlib.pyplot as plt

X = np.load("ai/X.npy")
Y = np.load("ai/Y.npy")

X = torch.tensor(X).float()
Y = torch.tensor(Y).float()

dataset = TensorDataset(X, Y)
loader = DataLoader(dataset, batch_size=32, shuffle=True)

class ConvLSTMBlock(nn.Module):
    def __init__(self, input_features, hidden_features=64):
        super().__init__()
        self.lstm = nn.LSTM(input_features, hidden_features, batch_first=True)
        self.fc = nn.Linear(hidden_features, input_features)

    def forward(self, x):
        b, s, t, f = x.shape
        x = x.view(b*s, t, f)
        out,_ = self.lstm(x)
        out = self.fc(out)
        return out.view(b, s, t, f)

model = ConvLSTMBlock(X.shape[-1])
optimizer = torch.optim.Adam(model.parameters(), lr=0.001)
loss_fn = nn.MSELoss()

losses = []

for epoch in range(20):
    total = 0
    for xb, yb in loader:
        optimizer.zero_grad()
        pred = model(xb)
        loss = loss_fn(pred, yb)
        loss.backward()
        optimizer.step()
        total += loss.item()
    avg = total / len(loader)
    losses.append(avg)
    print(f"Epoch {epoch+1} Loss {avg:.2f}")

plt.plot(losses)
plt.title("Model Training Loss")
plt.xlabel("Epoch")
plt.ylabel("MSE Loss")
plt.grid()
plt.savefig("ai/training_curve.png")
plt.show()

import numpy as np
import torch
import torch.nn as nn
from torch.utils.data import DataLoader, TensorDataset

# -----------------------
# Load dataset
# -----------------------
X = np.load("ai/X.npy")  # shape: (samples, sensors, timesteps, features)
Y = np.load("ai/Y.npy")  # same shape

# Convert to PyTorch tensors
X_tensor = torch.from_numpy(X).float()
Y_tensor = torch.from_numpy(Y).float()

dataset = TensorDataset(X_tensor, Y_tensor)
dataloader = DataLoader(dataset, batch_size=32, shuffle=True)

# -----------------------
# Define ConvLSTM model
# -----------------------
class ConvLSTMBlock(nn.Module):
    def __init__(self, input_channels, hidden_channels, kernel_size=3):
        super().__init__()
        self.conv_lstm = nn.LSTM(input_channels, hidden_channels, batch_first=True)
        self.conv_out = nn.Linear(hidden_channels, input_channels)
        
    def forward(self, x):
        # x: [batch, sensors, timesteps, features]
        batch, sensors, timesteps, features = x.size()
        x = x.view(batch * sensors, timesteps, features)
        out, _ = self.conv_lstm(x)
        out = self.conv_out(out)
        out = out.view(batch, sensors, timesteps, features)
        return out

# Hyperparameters
input_features = X.shape[-1]
hidden_features = 64
epochs = 20
lr = 0.001

model = ConvLSTMBlock(input_features, hidden_features)
optimizer = torch.optim.Adam(model.parameters(), lr=lr)
criterion = nn.MSELoss()

# -----------------------
# Training loop
# -----------------------
for epoch in range(epochs):
    total_loss = 0
    for batch_x, batch_y in dataloader:
        optimizer.zero_grad()
        output = model(batch_x)
        loss = criterion(output, batch_y)
        loss.backward()
        optimizer.step()
        total_loss += loss.item()
    print(f"Epoch {epoch+1}/{epochs}, Loss: {total_loss/len(dataloader):.4f}")

# Save model
torch.save(model.state_dict(), "ai/convlstm_model.pth")
print("Model trained and saved!")

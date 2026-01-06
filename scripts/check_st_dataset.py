import numpy as np
arr = np.load('ai/st_dataset.npy')
print('shape', arr.shape)
if arr.size == 0:
    print('empty')
else:
    samples, sensors, timesteps, features = arr.shape
    for f in range(features):
        vals = arr[:,:,:,f].ravel()
        print(f'feature#{f} count={vals.size} min={np.nanmin(vals)} max={np.nanmax(vals)} mean={np.nanmean(vals)}')

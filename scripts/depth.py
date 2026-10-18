"""Depth maps for the painted plates, computed locally with MiDaS v2.1 small (ONNX).

    python3 -I scripts/depth.py <model.onnx> <in.webp> <out.png> [tiles]

MiDaS returns relative inverse depth (near = bright). It is run at 256 px over the
whole frame and, with tiles, on overlapping 384 px tiles at higher resolution so
edges stay crisp; the tile results are fitted to the global map (scale + offset
per tile) and blended. The result is edge-aware smoothed against the painting so
depth boundaries follow the painted silhouettes, then stored as 8-bit grey.
"""
import sys
import numpy as np, cv2, onnxruntime as ort

model, src, dst = sys.argv[1:4]
tiles = int(sys.argv[4]) if len(sys.argv) > 4 else 3
sess = ort.InferenceSession(model, providers=['CPUExecutionProvider'])
inp = sess.get_inputs()[0]
S = inp.shape[2] if isinstance(inp.shape[2], int) else 256
mean, std = np.array([0.485, 0.456, 0.406]), np.array([0.229, 0.224, 0.225])

def run(rgb):
    x = cv2.resize(rgb, (S, S), interpolation=cv2.INTER_AREA).astype(np.float32) / 255.0
    x = ((x - mean) / std).transpose(2, 0, 1)[None].astype(np.float32)
    y = sess.run(None, {inp.name: x})[0].reshape(S, S)
    return cv2.resize(y, (rgb.shape[1], rgb.shape[0]), interpolation=cv2.INTER_CUBIC)

img = cv2.cvtColor(cv2.imread(src, cv2.IMREAD_COLOR), cv2.COLOR_BGR2RGB)
H, W = img.shape[:2]
g = run(img)
if tiles > 1:
    acc = np.zeros((H, W), np.float64); wsum = np.zeros((H, W), np.float64)
    th, tw = int(H / tiles * 1.5), int(W / tiles * 1.5)
    for ty in np.linspace(0, H - th, tiles).astype(int):
        for tx in np.linspace(0, W - tw, tiles).astype(int):
            t = run(img[ty:ty + th, tx:tx + tw])
            gt = g[ty:ty + th, tx:tx + tw]
            a, b = np.polyfit(t.ravel(), gt.ravel(), 1)       # fit tile to the global scale
            t = a * t + b
            wy = np.hanning(th + 2)[1:-1][:, None]; wx = np.hanning(tw + 2)[1:-1][None, :]
            w = wy * wx
            acc[ty:ty + th, tx:tx + tw] += t * w; wsum[ty:ty + th, tx:tx + tw] += w
    d = 0.5 * g + 0.5 * np.where(wsum > 1e-6, acc / np.maximum(wsum, 1e-6), g)
else:
    d = g
lo, hi = np.percentile(d, 1), np.percentile(d, 99.5)
d = np.clip((d - lo) / (hi - lo), 0, 1).astype(np.float32)
# edge-aware smoothing guided by the painting (joint bilateral via guided filter if present)
try:
    d = cv2.ximgproc.guidedFilter(img, d, 8, 1e-3)
except Exception:
    d = cv2.bilateralFilter(d, 9, 0.1, 6)
cv2.imwrite(dst, np.clip(d * 255, 0, 255).astype(np.uint8))
print(dst, W, H, 'mean', round(float(d.mean()), 3))

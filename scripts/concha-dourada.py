"""Concha Pérolas em dourado com transparência, a partir da arte oficial (logo horizontal do kit).

Saída: PNG com degradê dourado (como a referência da marca), pérola inclusa. Usada no ingresso em PDF
(selo, marca d'água e assinatura). Uso: python -I scripts/concha-dourada.py <logo-horizontal.jpg> <saida.png> [largura]
"""
import sys

import numpy as np
from PIL import Image
from scipy.ndimage import gaussian_filter, label

im = np.asarray(Image.open(sys.argv[1]).convert("RGB")).astype(float)
h, w = im.shape[:2]
g = gaussian_filter(im[..., 1], 1.2)
a = np.clip((g - 95) / 35, 0, 1)  # ciano claro → opaco, azul do fundo → transparente
Y, X = np.mgrid[:h, :w]
a *= (Y < h * 0.66) & (Y > h * 0.12) & (X > w * 0.25) & (X < w * 0.75)  # só a concha (sem letreiro nem textura do fundo)
lb, n = label(a > 0.3)
sz = np.bincount(lb.ravel()); sz[0] = 0
cx, cy = w * 0.5, h * 0.38
keep = [i for i in range(1, n + 1) if sz[i] > 300 and abs(X[lb == i].mean() - cx) < w * 0.17 and abs(Y[lb == i].mean() - cy) < h * 0.22]
a *= np.isin(lb, keep)  # só as peças da concha (tira manchas da textura do fundo)
ys, xs = np.where(a > 0.4)
y0, y1, x0, x1 = max(ys.min() - 4, 0), ys.max() + 4, max(xs.min() - 4, 0), xs.max() + 4
a = a[y0:y1, x0:x1]
hh, ww = a.shape
# degradê dourado vertical (claro em cima → âmbar → claro embaixo), como a referência
t = np.linspace(0, 1, hh)[:, None]
stops = np.array([[255, 228, 170], [214, 160, 82], [246, 206, 130], [176, 120, 52], [236, 194, 120]], float)
pos = np.linspace(0, 1, len(stops))
col = np.stack([np.interp(t[:, 0], pos, stops[:, c]) for c in range(3)], 1)[:, None, :].repeat(ww, 1)
out = np.dstack([col, a * 255]).astype(np.uint8)
img = Image.fromarray(out, "RGBA")
target = int(sys.argv[3]) if len(sys.argv) > 3 else 900
img = img.resize((target, round(target * hh / ww)), Image.LANCZOS)
img.save(sys.argv[2], optimize=True)
print(img.size)

import sys, numpy as np
from PIL import Image
im = np.asarray(Image.open(sys.argv[1]).convert('RGB')).astype(float)
from scipy.ndimage import gaussian_filter
g = gaussian_filter(im[..., 1], 1.6)  # tira o granulado da arte
a = np.clip((g - 100) / 30, 0, 1)  # ciano claro → opaco, azul do fundo → transparente
Y, X = np.mgrid[:a.shape[0], :a.shape[1]]; m = (((X - 543) / 250) ** 2 + ((Y - 285) / 215) ** 2 < 1) & (Y < 485); a = a * m  # só a concha (sem letreiro e fundo)
from scipy.ndimage import label
lb, n = label(a > 0.3)
sz = np.bincount(lb.ravel()); sz[0] = 0
a = a * np.isin(lb, np.where(sz > 400)[0])  # tira manchas soltas do fundo
from scipy.ndimage import grey_erosion
a = grey_erosion(a, size=(int(sys.argv[3]), int(sys.argv[3])))  # abre os vãos entre as linhas (lê pequeno)
ys, xs = np.where(a > 0.5)
y0, y1, x0, x1 = ys.min(), ys.max(), xs.min(), xs.max()
print(x0, x1, y0, y1)
a = a[y0:y1 + 1, x0:x1 + 1]
h, w = a.shape; s = max(h, w); pad = np.zeros((s, s)); pad[(s - h) // 2:(s - h) // 2 + h, (s - w) // 2:(s - w) // 2 + w] = a
out = np.zeros((s, s, 4), np.uint8); out[..., :3] = 255; out[..., 3] = (pad * 255).astype(np.uint8)
Image.fromarray(out).resize((192, 192), Image.LANCZOS).save(sys.argv[2], optimize=True)

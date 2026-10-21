import numpy as np, os, sys
from PIL import Image, ImageFilter
out = sys.argv[1]
rng = np.random.default_rng(1231)

def periodic(N, mask_fn):
    fx = np.fft.fftfreq(N)[None, :] * N; fy = np.fft.fftfreq(N)[:, None] * N
    k = np.hypot(fx, fy) + 1e-9
    w = np.fft.fft2(rng.standard_normal((N, N)))
    o = np.real(np.fft.ifft2(w * mask_fn(k)))
    return (o - o.mean()) / (o.std() + 1e-9)

# ── 1. cáusticas (ladrilho 512, sem emenda): rede de Worley F2−F1 com as coordenadas deformadas ──
N = 512; M = 9; C = N / M
yy, xx = np.mgrid[0:N, 0:N].astype(np.float32)
wx = periodic(N, lambda k: np.exp(-((k - 3) / 2) ** 2)) * 18
wy = periodic(N, lambda k: np.exp(-((k - 3) / 2) ** 2)) * 18
cx = (xx + wx) / C; cy = (yy + wy) / C
jit = rng.random((M, M, 2))
ix = np.floor(cx).astype(int); iy = np.floor(cy).astype(int)
f1 = np.full((N, N), 1e9); f2 = np.full((N, N), 1e9)
for dy in (-1, 0, 1):
    for dx in (-1, 0, 1):
        jx = (ix + dx) % M; jy = (iy + dy) % M
        d = np.hypot(cx - (ix + dx + jit[jy, jx, 0]), cy - (iy + dy + jit[jy, jx, 1]))
        f2 = np.where(d < f1, f1, np.minimum(f2, d)); f1 = np.minimum(f1, d)
edge = f2 - f1
caus = np.exp(-edge * 9.0) ** 1.4
caus = caus / caus.max()
caus = np.clip(caus * 1.25 - 0.08, 0, 1)
a = (caus * 255).astype(np.uint8)
im = Image.merge("RGBA", [Image.new("L", (N, N), 255), Image.new("L", (N, N), 252), Image.new("L", (N, N), 236), Image.fromarray(a)])
im = im.filter(ImageFilter.GaussianBlur(0.8))
im.save(f"{out}/mar-causticas.webp", "WEBP", quality=82, method=6)

# ── 2. raios de luz entrando pela superfície (1600×700, transparente) ──
W, H = 1600, 700
yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
rays = np.zeros((H, W), np.float32)
for _ in range(14):
    x0 = rng.uniform(-200, W + 200); slope = rng.uniform(0.32, 0.42)  # inclinados (luz de lado)
    width = rng.uniform(18, 70); inten = rng.uniform(0.25, 0.9)
    xc = x0 + slope * yy
    prof = np.exp(-((xx - xc) / width) ** 2)
    fade = np.clip(1 - yy / (H * rng.uniform(0.75, 1.05)), 0, 1) ** 1.3
    rays += prof * fade * inten
rays = np.clip(rays / rays.max(), 0, 1) ** 1.1
ra = (rays * 170).astype(np.uint8)
im = Image.merge("RGBA", [Image.new("L", (W, H), 225), Image.new("L", (W, H), 238), Image.new("L", (W, H), 255), Image.fromarray(ra)]).filter(ImageFilter.GaussianBlur(6))
im.save(f"{out}/mar-raios.webp", "WEBP", quality=80, method=6)

# ── 3. neve marinha: partículas finas em suspensão (ladrilho 512) ──
N = 512
al = np.zeros((N, N), np.float32)
pts = rng.random((420, 2)) * N
sz = rng.choice([0.6, 0.9, 1.3, 1.9], size=420, p=[0.5, 0.3, 0.15, 0.05])
op = rng.uniform(0.25, 0.85, size=420)
yy, xx = np.mgrid[0:N, 0:N].astype(np.float32)
for (px, py), s, o in zip(pts, sz, op):
    for ox in (-N, 0, N):
        for oy in (-N, 0, N):
            x0, y0 = px + ox, py + oy
            if -6 < x0 < N + 6 and -6 < y0 < N + 6:
                r0, r1 = int(max(0, y0 - 5)), int(min(N, y0 + 6)); c0, c1 = int(max(0, x0 - 5)), int(min(N, x0 + 6))
                d2 = (xx[r0:r1, c0:c1] - x0) ** 2 + (yy[r0:r1, c0:c1] - y0) ** 2
                al[r0:r1, c0:c1] = np.maximum(al[r0:r1, c0:c1], o * np.exp(-d2 / (2 * s * s)))
im = Image.merge("RGBA", [Image.new("L", (N, N), 230), Image.new("L", (N, N), 242), Image.new("L", (N, N), 255), Image.fromarray((al * 255).astype(np.uint8))])
im.save(f"{out}/mar-particulas.webp", "WEBP", quality=82, method=6)
for f in ("mar-causticas", "mar-raios", "mar-particulas"):
    print(f, os.path.getsize(f"{out}/{f}.webp") // 1024, "KB")

"""Concha grande do rodapé (vieira aberta), no mesmo estilo realista do fundo do mar: nácar rosado por dentro,
costelas, borda ondulada, luar vindo do alto-esquerda, sombra na areia e uma pérola na dobradiça.
O botão "Siga @perolaseventos" fica dentro da metade de baixo (centro dela = 50% x, ALVO_Y da altura).
Uso: python scripts/fundo-mar/concha.py public/2027  ->  concha-rodape.webp (1200x800, transparente)
"""
import os
import sys

import numpy as np
from PIL import Image
from scipy.ndimage import gaussian_filter, shift

OUT = sys.argv[1]
W, H = 1200, 800
HX, HY = 600.0, 430.0  # dobradiça
N = 17  # costelas
SQ = 0.36  # achatamento da metade de baixo (ela está deitada na areia)
RU, RL = 400.0, 520.0
LUZ = np.array([-0.35, -0.75, 0.56]); LUZ /= np.linalg.norm(LUZ)
MOON = np.array([0.9, 0.84, 0.98])
yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)


def lit(n, alb, amb=0.3, spec=0.35, shin=30):
    nx, ny, nz = n
    ndl = np.clip(nx * LUZ[0] + ny * LUZ[1] + nz * LUZ[2], 0, 1)
    hv = LUZ + np.array([0, 0, 1.0]); hv /= np.linalg.norm(hv)
    sp = np.clip(nx * hv[0] + ny * hv[1] + nz * hv[2], 0, 1) ** shin
    return alb * MOON * (amb + 0.85 * ndl)[..., None] + (sp * spec)[..., None]


def norm3(nx, ny, nz):
    L = np.sqrt(nx * nx + ny * ny + nz * nz) + 1e-9
    return nx / L, ny / L, nz / L


def nacre(th, rr):
    """nácar: branco-rosado com reflexos que mudam de cor"""
    base = np.array([0.98, 0.88, 0.9])
    ir = np.stack([0.05 * np.sin(rr * 9 + th * 3), 0.05 * np.sin(rr * 7 - th * 4 + 1), 0.07 * np.sin(rr * 11 + 2)], -1)
    return np.clip(base + ir, 0, 1)


TMAX = 1.12


def edge_r(th, R):
    # borda ondulada (uma onda por costela) e ombros arredondados que descem até a dobradiça
    sh = np.sqrt(np.clip(1 - (np.abs(th) / TMAX) ** 5, 0, 1))
    return R * sh * (1 + 0.025 * np.abs(np.cos(N * th / 2)))


def relevo(th, r, R):
    """costelas arredondadas + estrias finas + linhas de crescimento (anéis), como numa vieira de verdade"""
    rib_s = -np.sin(N * th) * 0.32 - np.sin(N * 3 * th) * 0.05
    ring_s = np.sin(r * 0.22) * 0.02 + np.sin(r * 0.071) * 0.015
    return rib_s * np.clip(r / R * 2.2, 0, 1), ring_s


rgb = np.zeros((H, W, 3), np.float32)
alpha = np.zeros((H, W), np.float32)


def paint(mask, col):
    global rgb, alpha
    a = gaussian_filter(mask.astype(np.float32), 0.7)
    rgb = rgb * (1 - a[..., None]) + col * a[..., None]
    alpha = np.maximum(alpha, a)


# sombra de contato na areia, debaixo da metade de baixo
sh = np.exp(-(((xx - HX - 30) / 560) ** 2 + ((yy - HY - 0.62 * RL * SQ) / 95) ** 2) * 2.2) * 0.6
alpha = sh.copy()

# ── metade de cima: leque em pé, vemos o lado de dentro ──
vx = xx - HX; vy = HY - yy
r = np.hypot(vx, vy); th = np.arctan2(vx, vy)
up = (np.abs(th) < TMAX) & (r < edge_r(th, RU)) & (vy > -10)
t = r / RU
rib = np.cos(N * th)
radial = np.stack([vx / (r + 1e-6), -vy / (r + 1e-6)])
tang = np.stack([vy / (r + 1e-6), vx / (r + 1e-6)])
dr, ring = relevo(th, r, RU)
conc = -0.4 * t + ring  # côncava (a borda olha pra dentro) + anéis de crescimento
nx = tang[0] * dr + radial[0] * conc; ny = tang[1] * dr + radial[1] * conc - 0.3  # inclinada pra trás: pega luar
n = norm3(nx, ny, np.ones_like(nx))
alb = nacre(th, t) * (0.72 + 0.28 * np.clip(t * 1.6, 0, 1))[..., None] * (1 - 0.12 * (rib < -0.6))[..., None]
cu = lit(n, alb)
# borda: espessura da casca, mais clara e lilás por fora
rim = up & (r > edge_r(th, RU) - 9)
cu = np.where(rim[..., None], lit(n, np.array([0.86, 0.72, 0.84])) * 1.05, cu)
paint(up, cu)

# ── pérola na dobradiça (aparece acima do botão) ──
px, py, pr = HX, HY + 14, 64
d = np.hypot(xx - px, yy - py) / pr
pm = d < 1
pnz = np.sqrt(np.clip(1 - d * d, 0, 1))
pn = ((xx - px) / pr, (yy - py) / pr, pnz)
pc = lit(pn, np.array([0.98, 0.95, 0.96]), amb=0.35, spec=0.9, shin=70) + ((1 - pnz) ** 2.5)[..., None] * np.array([0.25, 0.2, 0.35])
paint(pm, pc)

# ── metade de baixo: deitada, aberta pra cima; primeiro a espessura da borda da frente (lado de fora) ──
ly = (yy - HY) / SQ
rl = np.hypot(vx, ly); thl = np.arctan2(vx, ly)
low = (np.abs(thl) < TMAX) & (rl < edge_r(thl, RL)) & (ly > -20)
band = shift(low.astype(np.float32), (22, 0), order=0) > 0.5
outside = band & ~low
ribo = np.cos(N * thl)
on = norm3(np.sin(N * thl) * 0.5 * (vx / (rl + 1e-6)), np.full_like(vx, 0.25), np.ones_like(vx))
co = lit(on, np.array([0.8, 0.66, 0.74]) * (0.85 + 0.15 * ribo)[..., None], amb=0.22, spec=0.1)
paint(outside, co)
tl = rl / RL
dr, ringl = relevo(thl, rl, RL)
radl = np.stack([vx / (rl + 1e-6), ly / (rl + 1e-6) * SQ]); tanl = np.stack([-ly / (rl + 1e-6) * SQ, vx / (rl + 1e-6)])
nx = tanl[0] * dr + radl[0] * (-0.4 * tl + ringl); ny = tanl[1] * dr + radl[1] * (-0.4 * tl + ringl) - 0.55  # vira pra cima
n = norm3(nx, ny, np.ones_like(nx) * 0.85)
alb = nacre(thl, tl) * (0.7 + 0.3 * np.clip(tl * 1.5, 0, 1))[..., None] * (1 - 0.1 * (np.cos(N * thl) < -0.6))[..., None]
cl = lit(n, alb)
riml = low & (rl > edge_r(thl, RL) - 10)
cl = np.where(riml[..., None], lit(n, np.array([0.9, 0.76, 0.86])) * 1.08, cl)
paint(low, cl)

# orelhinhas da dobradiça: duas cunhas curtas e arredondadas dos lados (o "V" de vieira)
ear = (r < 120 - 40 * np.clip((np.abs(th) - 1.15) / 0.4, 0, 1)) & (np.abs(th) > 1.0) & (np.abs(th) < 1.62) & (vy > -26)
ear_c = lit(norm3(np.sign(vx) * -0.2, np.full_like(xx, -0.35), np.ones_like(xx)), np.array([0.86, 0.74, 0.84]) * (0.9 + 0.1 * np.sin(r * 0.3))[..., None], amb=0.25)
paint(ear & ~low & ~pm, ear_c)

rgb *= 0.86  # mesma exposição da areia do rodapé
rgb *= (1 + 0.03 * gaussian_filter(np.random.default_rng(3).standard_normal((H, W)), 0.8) * 3)[..., None]
img = np.dstack([np.clip(rgb, 0, 1), np.clip(alpha, 0, 1)])
Image.fromarray((img * 255 + 0.5).astype(np.uint8), "RGBA").save(f"{OUT}/concha-rodape.webp", "WEBP", quality=86, method=6)
print("concha-rodape", os.path.getsize(f"{OUT}/concha-rodape.webp") // 1024, "KB", "· centro da metade de baixo em y =", round((HY + 0.5 * RL * SQ) / H * 100, 1), "%")

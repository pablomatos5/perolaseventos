"""Céu e mar realistas do fundo do site (tudo com transparência, para ir por cima do degradê da página):
  ceu-estrelas.webp   ladrilho sem emenda: estrelas com brilho em lei de potência (muitas fracas, poucas fortes),
                      cor pela temperatura (azuladas, brancas, amareladas) e halo nas mais fortes
  ceu-cintila.webp    ladrilho com poucas estrelas fortes, que piscam (animação de opacidade no CSS)
  fios-luz.webp       o redemoinho de luz do flyer: feixes de dezenas de fios finíssimos com faíscas e brilho difuso
  brilho.webp         brilho de 4 pontas (estrela da marca) como reflexo de lente: raios finos e núcleo suave
  bolha.webp          bolha de ar na água: transparente, borda fina clara, reflexo da luz em cima
Uso: python scripts/fundo-mar/ceu.py public/2027
"""
import os
import sys

import numpy as np
from PIL import Image
from scipy.ndimage import gaussian_filter

OUT = sys.argv[1]
rng = np.random.default_rng(2027)


def save_rgba(rgb, name, q=82):
    """rgb = luz somada (pode passar de 1). Vira cor + alfa: em fundo escuro reproduz a soma de luz."""
    a = np.clip(rgb.max(-1), 0, 1)
    c = np.where(a[..., None] > 1e-4, np.clip(rgb, 0, None) / np.maximum(a[..., None], 1e-4), 0)
    img = np.dstack([np.clip(c, 0, 1), a])
    Image.fromarray((img * 255 + 0.5).astype(np.uint8), "RGBA").save(f"{OUT}/{name}.webp", "WEBP", quality=q, method=6)
    print(name, os.path.getsize(f"{OUT}/{name}.webp") // 1024, "KB")


def splat(acc, xs, ys, vals, wrap=False):
    """soma pontos com posição sub-pixel (bilinear) num buffer HxWx3"""
    H, W = acc.shape[:2]
    x0 = np.floor(xs).astype(int); y0 = np.floor(ys).astype(int)
    fx = xs - x0; fy = ys - y0
    for dx, dy, w in ((0, 0, (1 - fx) * (1 - fy)), (1, 0, fx * (1 - fy)), (0, 1, (1 - fx) * fy), (1, 1, fx * fy)):
        xi = x0 + dx; yi = y0 + dy
        if wrap:
            xi %= W; yi %= H; ok = np.ones_like(xi, bool)
        else:
            ok = (xi >= 0) & (xi < W) & (yi >= 0) & (yi < H)
        for c in range(3):
            np.add.at(acc[..., c], (yi[ok], xi[ok]), (vals[:, c] * w)[ok])


def blur(a, s, wrap=False):
    return gaussian_filter(a, (s, s, 0), mode="wrap" if wrap else "constant")


def star_color(n):
    # temperatura de cor das estrelas vistas a olho nu: a maioria branca, algumas azuladas, outras amareladas
    t = rng.choice(4, n, p=[0.2, 0.5, 0.2, 0.1])
    pal = np.array([[0.78, 0.86, 1.0], [1.0, 0.98, 0.96], [1.0, 0.92, 0.8], [1.0, 0.82, 0.68]])
    return pal[t]


# ── estrelas (ladrilho 1024, sem emenda) ──
def stars(N, count, bright_frac, name, halo=True):
    acc = np.zeros((N, N, 3), np.float32)
    xs = rng.random(count) * N; ys = rng.random(count) * N
    mag = rng.pareto(1.6, count) + 1  # lei de potência
    lum = np.clip(mag / np.percentile(mag, 100 * (1 - bright_frac)), 0, 6) * 0.35
    col = star_color(count) * lum[:, None]
    splat(acc, xs, ys, col, wrap=True)
    img = blur(acc, 0.55, True) * 6.0  # disco de cada estrela (PSF)
    if halo:
        img += blur(acc, 2.2, True) * 3.0 + blur(acc, 7, True) * 2.5  # halo das fortes (o fraco some sozinho)
    save_rgba(img, name)


stars(1024, 1400, 0.03, "ceu-estrelas")
stars(1024, 26, 0.5, "ceu-cintila")


# ── fios de luz (o redemoinho do flyer) ──
def bezier_path(d):
    """M x y C ... S ... (o mesmo traçado das curvas que já estavam no site)"""
    tok = d.replace("M", " M ").replace("C", " C ").replace("S", " S ").replace(",", " ").split()
    pts = []; cur = None; last_c2 = None; i = 0; cmd = None
    while i < len(tok):
        if tok[i] in "MCS":
            cmd = tok[i]; i += 1; continue
        if cmd == "M":
            cur = np.array([float(tok[i]), float(tok[i + 1])]); i += 2; continue
        if cmd == "C":
            c1, c2, e = (np.array([float(tok[i + k]), float(tok[i + k + 1])]) for k in (0, 2, 4)); i += 6
        else:
            c1 = 2 * cur - last_c2
            c2, e = (np.array([float(tok[i + k]), float(tok[i + k + 1])]) for k in (0, 2)); i += 4
        t = np.linspace(0, 1, 900)[:, None]
        pts.append((1 - t) ** 3 * cur + 3 * (1 - t) ** 2 * t * c1 + 3 * (1 - t) * t * t * c2 + t ** 3 * e)
        cur = e; last_c2 = c2
    p = np.concatenate(pts)
    seg = np.r_[0, np.cumsum(np.hypot(*np.diff(p, axis=0).T))]
    # reamostra por comprimento (pontos igualmente espaçados)
    L = seg[-1]; s = np.linspace(0, L, int(L * 3))
    return np.stack([np.interp(s, seg, p[:, 0]), np.interp(s, seg, p[:, 1])], -1)


CURVES = [
    ("M470 70C250 120 70 300 70 520S260 900 620 960", 16, 1.0),
    ("M430 90C230 150 95 320 105 520S300 870 680 930", 12, 0.8),
    ("M520 60C300 110 120 280 110 470S240 820 560 990", 10, 0.65),
    ("M380 120C200 190 40 360 55 560S260 920 520 1000", 14, 0.9),
]
S = 1.6  # 1000 do viewBox -> 1600 px
WF = HF = 1600
core = np.zeros((HF, WF, 3), np.float32)
spark = np.zeros((HF, WF, 3), np.float32)
for d, n, power in CURVES:
    p = bezier_path(d) * S
    tg = np.gradient(p, axis=0); tg /= np.linalg.norm(tg, axis=1, keepdims=True) + 1e-9
    nm = np.stack([-tg[:, 1], tg[:, 0]], -1)
    m = len(p); t = np.linspace(0, 1, m)
    for k in range(n):
        # cada fio: deslocamento lateral próprio que respira ao longo do arco (abre e fecha o feixe)
        off = rng.normal(0, 7) + rng.uniform(4, 14) * np.sin(t * rng.uniform(4, 11) + rng.uniform(0, 6))
        a0, a1 = sorted(rng.uniform(0, 1, 2)); a0 *= 0.35; a1 = 0.65 + a1 * 0.35  # nem todo fio vai de ponta a ponta
        env = np.clip((t - a0) / 0.12, 0, 1) * np.clip((a1 - t) / 0.12, 0, 1)
        env *= 0.55 + 0.45 * np.sin(t * rng.uniform(8, 20) + rng.uniform(0, 6)) ** 2  # brilho que varia ao longo
        env *= np.sin(np.pi * t) ** 0.6  # pontas do arco somem
        q = p + nm * off[:, None]
        w = power * rng.uniform(0.25, 0.7) * env
        col = np.array([1.0, 0.84, 0.58]) * w[:, None] * 0.55  # dourado (fraco, sobre o azul, não pode virar prata)
        splat(core, q[:, 0], q[:, 1], col)
    # faíscas: pontinhos espalhados em volta do feixe, alguns grandes
    ns = int(140 * power)
    idx = rng.integers(0, m, ns)
    jitter = rng.normal(0, 14, ns) + rng.normal(0, 40, ns) * (rng.random(ns) < 0.25)
    q = p[idx] + nm[idx] * jitter[:, None]
    lum = (rng.pareto(2.0, ns) + 0.3) * np.sin(np.pi * t[idx]) ** 0.5 * power
    splat(spark, q[:, 0], q[:, 1], np.array([1.0, 0.9, 0.72]) * lum[:, None] * 1.4)

# discreto e elegante: fios finos bem marcados, halo curto e fraco (o forte atrapalhava a leitura)
fios = blur(core, 0.6) * 3.2 + blur(core, 3) * 0.7 + blur(core, 12) * 1.1 + blur(core, 34) * 0.6
fios += blur(spark, 0.7) * 6 + blur(spark, 3.5) * 2.5 + blur(spark, 12) * 0.8
# tom: núcleo quase branco, brilho em volta dourado-pêssego (como no flyer)
warm = np.array([1.0, 0.78, 0.55])
glow_part = blur(core, 12) * 1.1 + blur(core, 34) * 0.6
fios = fios - glow_part + glow_part * warm
save_rgba(fios, "fios-luz", q=80)


# ── brilho de 4 pontas (reflexo de lente) 160 px ──
N = 160
yy, xx = (np.mgrid[0:N, 0:N] - (N - 1) / 2).astype(np.float32) / (N / 2)
r = np.hypot(xx, yy)
spikes = np.exp(-np.abs(yy) * 60) * np.exp(-np.abs(xx) * 2.6) + np.exp(-np.abs(xx) * 60) * np.exp(-np.abs(yy) * 2.6)
diag = (np.exp(-np.abs(xx - yy) * 70) + np.exp(-np.abs(xx + yy) * 70)) * np.exp(-r * 6) * 0.35
corev = np.exp(-(r / 0.06) ** 2) * 1.4 + np.exp(-(r / 0.22) ** 2) * 0.35
lum = (spikes * 0.9 + diag + corev) * np.clip(1 - r, 0, 1) ** 0.5
save_rgba(lum[..., None] * np.array([1.0, 0.98, 0.95]), "brilho")
save_rgba(lum[..., None] * np.array([1.0, 0.84, 0.58]), "brilho-ouro")


# ── bolha de ar na água 128 px ──
N = 128
yy, xx = (np.mgrid[0:N, 0:N] - (N - 1) / 2).astype(np.float32) / (N / 2 - 2)
r = np.hypot(xx, yy)
inside = r < 1
nz = np.sqrt(np.clip(1 - r * r, 0, 1))
rim = np.exp(-((1 - r) / 0.045) ** 2) * 0.9 + np.exp(-((1 - r) / 0.16) ** 2) * 0.22  # reflexão total na borda
hl = np.exp(-(((xx + 0.38) ** 2 + (yy + 0.42) ** 2) / 0.018)) * 1.1  # reflexo da luz de cima
hl2 = np.exp(-(((xx - 0.42) ** 2 + (yy - 0.5) ** 2) / 0.03)) * 0.25  # luz que atravessa e sai embaixo
body = (1 - nz) * 0.06  # quase invisível no meio
lum = np.where(r < 1.03, rim + hl + hl2 + body, 0) * np.clip((1.03 - r) * 40, 0, 1)
save_rgba(lum[..., None] * np.array([0.92, 0.96, 1.0]), "bolha")

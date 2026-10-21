"""Elementos do fundo do mar (usados por realista.py): rochas, corais galhados, leques-do-mar, algas,
capim marinho e corais-cérebro. Tudo desenhado em numpy como volumes iluminados pelo luar (vem do alto,
um pouco da esquerda), com sombra de contato na areia e a mesma névoa de profundidade da areia.
Cada elemento vira um "sprite" RGBA e é colado do mais longe para o mais perto.
"""
import numpy as np
from scipy.ndimage import gaussian_filter

LUZ = np.array([-0.35, -0.75, 0.56])
LUZ /= np.linalg.norm(LUZ)
MOON = np.array([0.86, 0.80, 0.96])


def _noise(rng, h, w, sigma):
    n = gaussian_filter(rng.standard_normal((h, w)).astype(np.float32), sigma, mode="wrap")
    return n / (n.std() + 1e-6)


def tubes(segs, w, h):
    """segs: lista de (x0, y0, x1, y1, r0, r1, cor rgb). Desenha cilindros arredondados (cápsulas) com volume.
    Devolve cor (h,w,3) e alfa (h,w). O mais "alto" (mais perto de quem olha) vence em cada pixel."""
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    zbest = np.full((h, w), -1.0, np.float32)
    nx = np.zeros((h, w), np.float32); ny = np.zeros((h, w), np.float32); nz = np.zeros((h, w), np.float32)
    alb = np.zeros((h, w, 3), np.float32)
    tip = np.zeros((h, w), np.float32)
    for x0, y0, x1, y1, r0, r1, c in segs:
        pad = max(r0, r1) + 2
        X0, X1 = int(max(0, min(x0, x1) - pad)), int(min(w, max(x0, x1) + pad + 1))
        Y0, Y1 = int(max(0, min(y0, y1) - pad)), int(min(h, max(y0, y1) + pad + 1))
        if X0 >= X1 or Y0 >= Y1:
            continue
        sx = xx[Y0:Y1, X0:X1]; sy = yy[Y0:Y1, X0:X1]
        dx, dy = x1 - x0, y1 - y0
        L2 = dx * dx + dy * dy + 1e-9
        t = np.clip(((sx - x0) * dx + (sy - y0) * dy) / L2, 0, 1)
        px = x0 + t * dx; py = y0 + t * dy
        ox = sx - px; oy = sy - py
        d = np.sqrt(ox * ox + oy * oy)
        r = r0 + (r1 - r0) * t
        inside = d < r
        z = np.where(inside, np.sqrt(np.clip(r * r - d * d, 0, None)), -1)
        zabs = z + (1 - t) * 0.01  # empate: o pedaço de cima por cima
        win = inside & (zabs > zbest[Y0:Y1, X0:X1])
        if not win.any():
            continue
        rr = np.maximum(r, 1e-3)
        zbest[Y0:Y1, X0:X1] = np.where(win, zabs, zbest[Y0:Y1, X0:X1])
        nx[Y0:Y1, X0:X1] = np.where(win, ox / rr, nx[Y0:Y1, X0:X1])
        ny[Y0:Y1, X0:X1] = np.where(win, oy / rr, ny[Y0:Y1, X0:X1])
        nz[Y0:Y1, X0:X1] = np.where(win, z / rr, nz[Y0:Y1, X0:X1])
        tip[Y0:Y1, X0:X1] = np.where(win, t, tip[Y0:Y1, X0:X1])
        for k in range(3):
            alb[Y0:Y1, X0:X1, k] = np.where(win, c[k], alb[Y0:Y1, X0:X1, k])
    a = (zbest >= 0).astype(np.float32)
    a = gaussian_filter(a, 0.5)  # borda sem serrilhado
    return alb, (nx, ny, nz), a


def shade(alb, n, amb=0.22, spec=0.18, sss=0.12, shin=24):
    nx, ny, nz = n
    ndl = np.clip(nx * LUZ[0] + ny * LUZ[1] + nz * LUZ[2], 0, 1)
    hv = LUZ + np.array([0, 0, 1.0]); hv /= np.linalg.norm(hv)
    sp = np.clip(nx * hv[0] + ny * hv[1] + nz * hv[2], 0, 1) ** shin
    rim = (1 - np.clip(nz, 0, 1)) ** 3  # luz que atravessa a borda (tecido vivo, translúcido)
    return alb * MOON * (amb + 0.9 * ndl)[..., None] + (sp * spec)[..., None] + alb * (rim * sss)[..., None]


# ── geradores ──
def branch(rng, x, y, ang, length, rad, depth, segs, col, spread, shrink, taper, wiggle, kids):
    """galho que se divide (coral galhado / leque). ang em radianos, 0 = pra cima"""
    n = max(2, int(length / max(rad * 1.2, 2)))
    for _ in range(n):
        ang += rng.normal(0, wiggle)
        step = length / n
        x1 = x + np.sin(ang) * step; y1 = y - np.cos(ang) * step
        r1 = rad * taper ** (1 / n)
        c = np.clip(col * (1 + rng.normal(0, 0.04)), 0, 1)
        segs.append((x, y, x1, y1, rad, r1, c))
        x, y, rad = x1, y1, r1
    if depth > 0:
        for k in range(kids):
            off = (k - (kids - 1) / 2) * spread + rng.normal(0, spread * 0.25)
            branch(rng, x, y, ang + off, length * shrink * rng.uniform(0.8, 1.1), rad * 0.86, depth - 1, segs, col, spread, shrink, taper, wiggle, kids)
    else:
        segs.append((x, y, x, y, rad * 1.15, rad * 1.15, np.clip(col * 1.12, 0, 1)))  # pontinha arredondada (pólipos)


def coral_galhado(rng, size, col):
    w = h = int(size * 2.2)
    segs = []
    for k in range(rng.integers(5, 9)):
        a0 = rng.normal(0, 0.55)
        branch(rng, w / 2 + rng.normal(0, size * 0.16), h - 2, a0, size * rng.uniform(0.28, 0.4), size * 0.085,
               3, segs, col, 0.6, 0.7, 0.72, 0.07, 2)
    alb, n, a = tubes(segs, w, h)
    # textura de pólipos: pontinhos claros e escuros sobre a superfície
    pol = _noise(rng, h, w, 0.8)
    alb = alb * (1 + 0.12 * pol)[..., None]
    return shade(alb, n, sss=0.18), a


def leque(rng, size, col):
    """leque-do-mar (gorgônia): rede fina num plano de frente, translúcida"""
    w = int(size * 2.4); h = int(size * 2.0)
    segs = []
    for k in range(3):
        branch(rng, w / 2, h - 2, (k - 1) * 0.5, size * 0.32, size * 0.03, 5, segs, col, 0.42, 0.78, 0.75, 0.05, 2)
    alb, n, a = tubes(segs, w, h)
    # malha entre os galhos: véu finíssimo (a gorgônia é uma rede)
    veil = gaussian_filter(a, size * 0.025) > 0.12
    av = np.maximum(a, veil * 0.1)
    c = shade(alb, n, amb=0.3, sss=0.25)
    c = np.where(a[..., None] > 0.05, c, col * MOON * 0.35)
    return c, av


def alga(rng, size, col):
    """alga comprida (fita), balançando parada no meio do movimento; bordas translúcidas"""
    w = int(size * 2.0); h = int(size * 2.5)
    segs = []
    for k in range(rng.integers(5, 9)):
        x = w / 2 + rng.normal(0, size * 0.1); y = h - 2
        L = size * rng.uniform(1.5, 2.3); n = 60
        ph = rng.uniform(0, 6); amp = rng.uniform(0.35, 0.7); bend = rng.normal(0, 0.3)
        for i in range(n):
            t = i / n
            ang = bend * t + amp * np.sin(t * 8 + ph) * (0.3 + t)
            x1 = x + np.sin(ang) * L / n; y1 = y - np.cos(ang) * L / n
            r = size * 0.075 * (0.45 + 1.2 * np.sin(np.pi * min(t * 1.15, 1)) ** 0.7) * (1 - t) ** 0.35
            segs.append((x, y, x1, y1, r, r, np.clip(col * (0.85 + 0.3 * t), 0, 1)))
            x, y = x1, y1
    alb, nn, a = tubes(segs, w, h)
    # fita é achatada: normal quase de frente, nervura central mais escura
    nx, ny, nz = nn
    flat = (nx * 0.35, ny * 0.35, np.sqrt(np.clip(1 - (nx * 0.35) ** 2 - (ny * 0.35) ** 2, 0, 1)))
    c = shade(alb, flat, amb=0.25, spec=0.08, sss=0.3)
    return c, a * 0.95


def capim(rng, size, col):
    """tufo de capim marinho: muitas folhinhas finas"""
    w = int(size * 1.6); h = int(size * 1.3)
    segs = []
    for k in range(rng.integers(14, 26)):
        x = w / 2 + rng.normal(0, size * 0.12); y = h - 2
        L = size * rng.uniform(0.5, 1.1); ang = rng.normal(0, 0.35); n = 14; cur = rng.normal(0, 0.06)
        for i in range(n):
            t = i / n
            ang += cur
            x1 = x + np.sin(ang) * L / n; y1 = y - np.cos(ang) * L / n
            r = size * 0.014 * (1 - t * 0.8)
            segs.append((x, y, x1, y1, r, r, np.clip(col * (0.8 + 0.4 * t), 0, 1)))
            x, y = x1, y1
    alb, n, a = tubes(segs, w, h)
    return shade(alb, n, amb=0.3, sss=0.25), a


def rocha(rng, size, col):
    """rocha meio enterrada: forma irregular, superfície áspera, manchas de alga incrustada"""
    w = int(size * 2.9); h = int(size * 1.4)
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    cx, cy = w / 2, h * 0.98
    th = np.arctan2(yy - cy, xx - cx)
    rr = np.hypot((xx - cx) / (size * 1.0), (yy - cy) / (size * rng.uniform(0.6, 0.9)))
    bump = 1 + 0.18 * np.sin(th * 3 + rng.uniform(0, 6)) + 0.1 * np.sin(th * 7 + rng.uniform(0, 6))
    hgt = np.clip(1 - (rr / bump) ** 2, 0, None) ** 0.6
    hgt += _noise(rng, h, w, size * 0.03) * 0.04 * (hgt > 0) + _noise(rng, h, w, size * 0.008) * 0.015 * (hgt > 0)
    gy, gx = np.gradient(hgt * size * 0.9)
    nrm = np.stack([-gx, -gy, np.ones_like(gx)], -1)
    nrm /= np.linalg.norm(nrm, axis=-1, keepdims=True)
    tex = _noise(rng, h, w, size * 0.05)
    alb = col * (0.85 + 0.15 * tex)[..., None]
    alga_m = np.clip(_noise(rng, h, w, size * 0.07) - 0.6, 0, 1)[..., None] * (nrm[..., 1:2] < -0.2)
    alb = alb * (1 - alga_m * 0.8) + np.array([0.42, 0.45, 0.33]) * alga_m * 0.8
    a = np.clip(hgt * 25, 0, 1)
    c = shade(alb, (nrm[..., 0], nrm[..., 1], nrm[..., 2]), amb=0.18, spec=0.06, sss=0.0, shin=10)
    return c, a


def cerebro(rng, size, col):
    """coral-cérebro: cúpula com sulcos em labirinto"""
    w = int(size * 2.1); h = int(size * 1.2)
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    cx, cy = w / 2, h * 0.98
    rr = np.hypot((xx - cx) / size, (yy - cy) / (size * 0.95))
    dome = np.clip(1 - rr ** 2, 0, None) ** 0.5
    lab = np.sin(_noise(rng, h, w, size * 0.035) * 5 + _noise(rng, h, w, size * 0.12) * 2)
    groove = np.exp(-(lab / 0.3) ** 2)
    hgt = dome * size * 0.8 - groove * size * 0.018 * (dome > 0)
    gy, gx = np.gradient(hgt)
    nrm = np.stack([-gx, -gy, np.ones_like(gx)], -1)
    nrm /= np.linalg.norm(nrm, axis=-1, keepdims=True)
    alb = col * (1 - 0.18 * groove)[..., None] * (1 + 0.06 * _noise(rng, h, w, 0.8))[..., None]
    a = np.clip(dome * 25, 0, 1)
    c = shade(alb, (nrm[..., 0], nrm[..., 1], nrm[..., 2]), amb=0.2, spec=0.12, sss=0.08)
    return c, a


def tubo(rng, size, col):
    """esponjas-tubo: cilindros grossos em pé, boca escura em cima"""
    w = int(size * 1.8); h = int(size * 1.6)
    segs = []; mouths = []
    for k in range(rng.integers(3, 7)):
        x = w / 2 + rng.normal(0, size * 0.18); L = size * rng.uniform(0.6, 1.35); r = size * rng.uniform(0.09, 0.15)
        ang = rng.normal(0, 0.15); n = 10; y = h - 2
        for i in range(n):
            x1 = x + np.sin(ang) * L / n; y1 = y - np.cos(ang) * L / n
            segs.append((x, y, x1, y1, r * (0.9 + 0.1 * i / n), r * (0.9 + 0.1 * (i + 1) / n), np.clip(col * (0.85 + 0.25 * i / n), 0, 1)))
            x, y = x1, y1
        mouths.append((x, y, r))
    alb, n, a = tubes(segs, w, h)
    c = shade(alb * (1 + 0.1 * _noise(rng, h, w, 1.0))[..., None], n, sss=0.15)
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    for x, y, r in mouths:  # boca: elipse escura com borda clara
        e = ((xx - x) / (r * 0.85)) ** 2 + ((y - yy) / (r * 0.35)) ** 2
        c = np.where((e < 1)[..., None], c * 0.18, c)
        ring = np.exp(-((np.sqrt(e) - 1.05) / 0.12) ** 2)
        c = c + (ring * 0.25)[..., None] * col * MOON
    return c, a


KINDS = {"tubo": tubo, "coral": coral_galhado, "leque": leque, "alga": alga, "capim": capim, "rocha": rocha, "cerebro": cerebro}
# cores de dia, puxadas para os tons do site (rosa, lilás, coral, ameixa); o luar e a névoa esfriam depois
CORES = {
    "coral": [np.array(c) for c in ([1.0, 0.58, 0.66], [0.9, 0.64, 0.95], [1.0, 0.7, 0.5], [0.98, 0.84, 0.9])],
    "leque": [np.array(c) for c in ([0.72, 0.36, 0.78], [0.86, 0.38, 0.52], [0.95, 0.66, 0.4])],
    "alga": [np.array(c) for c in ([0.42, 0.5, 0.3], [0.55, 0.45, 0.28], [0.5, 0.36, 0.55])],
    "capim": [np.array(c) for c in ([0.45, 0.56, 0.34], [0.52, 0.5, 0.32])],
    "rocha": [np.array(c) for c in ([0.62, 0.58, 0.6], [0.66, 0.6, 0.56], [0.55, 0.54, 0.6])],
    "tubo": [np.array(c) for c in ([0.95, 0.6, 0.35], [0.75, 0.5, 0.85], [0.9, 0.78, 0.5])],
    "cerebro": [np.array(c) for c in ([0.85, 0.7, 0.55], [0.8, 0.62, 0.75])],
}


def place(col, W, H, yh, texel, rng, items, fog_at, light_at):
    """items: (tipo, x relativo, linha 0..1 do horizonte à base, tamanho no primeiro plano em px).
    Cola do mais longe pro mais perto, com sombra de contato, luz lateral e névoa da distância."""
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    for kind, px, pd, size in sorted(items, key=lambda t: t[2]):
        by = yh + pd * (H - yh)
        scl = (by - yh) / (H - yh)
        sz = max(6, size * scl)
        cor = CORES[kind][rng.integers(len(CORES[kind]))]
        c, a = KINDS[kind](rng, sz, cor)
        h, w = a.shape
        sink = max(2, int(sz * 0.06))
        edge = np.clip((h - 1 - np.arange(h)[:, None] - sink * 0.3 * (1 + _noise(rng, 1, w, 3)[0])[None, :]) / sink, 0, 1)
        a = a * edge
        x0 = int(px * W - w / 2); y0 = int(by - h + sink * 0.6)
        # sombra de contato elíptica na areia (luz do alto-esquerda: sombra pra direita/frente)
        d2 = ((xx - px * W - sz * 0.25) / (w * 0.42)) ** 2 + ((yy - by - sz * 0.05) / (sz * 0.18 + 2)) ** 2
        col *= (1 - 0.5 * np.exp(-d2 * 2.5))[..., None]
        f, fc = fog_at(by)
        c = c * light_at(px * W) * (1 - f) + fc * f
        X0, Y0 = max(0, x0), max(0, y0)
        X1, Y1 = min(W, x0 + w), min(H, y0 + h)
        if X0 >= X1 or Y0 >= Y1:
            continue
        cs = c[Y0 - y0:Y1 - y0, X0 - x0:X1 - x0]; as_ = a[Y0 - y0:Y1 - y0, X0 - x0:X1 - x0, None]
        col[Y0:Y1, X0:X1] = col[Y0:Y1, X0:X1] * (1 - as_) + cs * as_
    return col

"""Fundo do mar realista do rodapé: a mesma areia grão a grão do site (public/2027/areia-real.webp),
vista em perspectiva no fundo da água à noite. Ondulações de fundo, cáusticas da lua na areia,
névoa de profundidade (some na cor da página) e pérolas meio enterradas.
Uso: python scripts/fundo-mar/realista.py public/2027  ->  fundo-mar-real-pc.webp / fundo-mar-real-cel.webp
(precisa de mar-causticas.webp, gerada antes, na mesma pasta)
"""
import os
import sys

import numpy as np
from PIL import Image
from scipy.ndimage import gaussian_filter, map_coordinates

from elementos import place

OUT = sys.argv[1]
SAND = np.asarray(Image.open(f"{OUT}/areia-real.webp").convert("RGB"), np.float32) / 255
CAUS = np.asarray(Image.open(f"{OUT}/mar-causticas.webp").convert("RGBA"), np.float32)[..., 3] / 255

# níveis cada vez mais borrados (mesmo tamanho): ao longe amostra o borrado, sem serrilhar
SIG = [0, 0.8, 1.6, 3.2, 6.4, 12.8, 25.6]


def blur_levels(img):
    return [img if s == 0 else gaussian_filter(img, (s, s, 0) if img.ndim == 3 else s, mode="wrap") for s in SIG]


SAND_L = blur_levels(SAND)
CAUS_L = blur_levels(CAUS)


def sample(levels, u, v, lod):
    """amostra com repetição (sem emenda) misturando os níveis conforme a distância"""
    T = levels[0].shape[0]
    lod = np.clip(lod, 0, len(levels) - 1.001)
    i0 = np.floor(lod).astype(int)
    t = lod - i0
    coords = [np.mod(v, T), np.mod(u, T)]
    out = 0
    for k, L in enumerate(levels):
        w = np.where(i0 == k, 1 - t, 0) + np.where(i0 + 1 == k, t, 0)
        if not w.any():
            continue
        if L.ndim == 3:
            s = np.stack([map_coordinates(L[..., c], coords, order=1, mode="grid-wrap") for c in range(3)], -1) * w[..., None]
        else:
            s = map_coordinates(L, coords, order=1, mode="grid-wrap") * w
        out = out + s
    return out


def render(W, H, horizon, texel, seed, pearls, items, name):
    rng = np.random.default_rng(seed)
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    yh = horizon * H
    dy = np.maximum(yy - yh, 0.6)
    s = (H - yh) / dy * texel  # texels por pixel: 1 no primeiro plano, cresce até o horizonte
    TILT = 2.6  # encurtamento da profundidade (câmera baixa, olhando de lado)
    u = (xx - W / 2) * s + 9000
    v = (H - yh) * TILT * texel * (H - yh) / dy
    lod = np.log2(np.maximum(s * TILT * 0.75, 1))

    alb = sample(SAND_L, u, v, lod)
    # areia do fundo é mais uniforme que a da praia: puxa um pouco para o tom médio
    alb = alb * 0.82 + alb.mean((0, 1)) * 0.18

    # ── ondulações de fundo feitas pela correnteza: cristas quase paralelas, levemente tortas ──
    def warp_noise(scale, amp):
        n = gaussian_filter(rng.standard_normal((64, 64)).astype(np.float32), 3, mode="wrap")
        n /= n.std() + 1e-6
        return sample([n], u / scale, v / scale, np.zeros_like(u)) * amp

    warp = warp_noise(70, 0.38) + warp_noise(22, 0.07)  # só curvas largas: cristas longas e contínuas
    lam = 250.0
    ph = 2 * np.pi * (v / lam + u / (lam * 11) + warp)
    hgt = np.sin(ph) + 0.28 * np.sin(2 * ph + 0.9)  # perfil assimétrico
    dh = np.cos(ph) + 0.56 * np.cos(2 * ph + 0.9)
    near = np.clip(1 - lod / 6.5, 0, 1)  # ao longe a ondulação vira tom liso
    slope = dh * (2 * np.pi / lam) * 26 * near
    shade = np.clip(1 - 0.5 * slope, 0.4, 1.6)  # luar por trás: face voltada à câmera mais escura
    trough = np.clip(-hgt, 0, None) * near  # sedimento fino nos vales: um tiquinho mais escuro e frio
    alb = alb * (1 - 0.07 * trough[..., None]) + np.array([-0.01, 0, 0.015]) * trough[..., None]

    # ── luar atravessando a água ──
    moon = np.array([0.86, 0.80, 0.96])  # luar lilás: a areia mantém a cor
    light = 0.5 + 0.5 * np.exp(-(((xx - W * 0.5) / (W * 0.55)) ** 2))
    caus = sample(CAUS_L, u * 0.32, v * 0.32, lod + 0.3) ** 2.2 * np.clip(1 - lod / 7, 0, 1) * (0.55 + 0.45 * shade)
    col = alb * moon * (shade * light)[..., None] * 0.8
    col += (caus * 0.22)[..., None] * np.array([0.9, 0.9, 1.0]) * light[..., None]

    # ── pérolas meio enterradas: sombra de contato, nácar, brilho e borda de areia ──
    Ld = np.array([-0.45, -0.6, 0.66])
    Ld /= np.linalg.norm(Ld)
    Hh = Ld + np.array([0, 0, 1.0])
    Hh /= np.linalg.norm(Hh)
    for px, pd, pr in pearls:
        cy = yh + pd * (H - yh)
        r = pr * (cy - yh) / (H - yh)
        cx = px * W
        d2 = ((xx - cx - r * 0.35) / (r * 1.6)) ** 2 + ((yy - cy - r * 0.55) / (r * 0.55)) ** 2
        col *= (1 - 0.55 * np.exp(-d2 * 2.2))[..., None]
        dx = (xx - cx) / r
        dyp = (yy - cy) / r
        rr = dx * dx + dyp * dyp
        bury = 0.18 + 0.07 * np.sin(dx * 5 + px * 20)
        nz = np.sqrt(np.clip(1 - rr, 0, 1))
        ndl = np.clip(dx * Ld[0] + dyp * Ld[1] + nz * Ld[2], 0, 1)
        spec = np.clip(dx * Hh[0] + dyp * Hh[1] + nz * Hh[2], 0, 1) ** 60
        fres = (1 - nz) ** 2.2
        irid = np.stack([0.06 * np.sin(dx * 3 + 1), 0.04 * np.sin(dyp * 3 + 2), 0.08 * np.cos(dx * 2 - dyp)], -1)
        pc = (np.array([0.97, 0.93, 0.92]) + irid) * (0.28 + 0.8 * ndl)[..., None] * moon * 1.05
        pc += spec[..., None] * 0.9 + fres[..., None] * np.array([0.3, 0.22, 0.38])
        a = np.clip((1 - rr) * 30, 0, 1) * np.clip((bury - dyp) * r * 0.6, 0, 1)
        a = np.where(rr < 1, a, 0)
        col = col * (1 - a[..., None]) + pc * a[..., None]

    # ── névoa de profundidade: a areia some na água, que encontra a cor da página (#0a0a28) ──
    far = np.array([10, 10, 40]) / 255
    glow = np.array([30, 30, 78]) / 255
    fog = np.clip(1 - np.exp(-(((s / texel) * 0.085) ** 1.15)), 0, 1)
    halo = (0.6 + 0.4 * light)[..., None]
    fogc = far + (glow - far) * np.exp(-(((yy - yh) / (H * 0.08)) ** 2))[..., None] * halo
    col = col * (1 - fog[..., None]) + fogc * fog[..., None]
    sky = far + (glow - far) * np.exp(-np.clip(yh - yy, 0, None) / (H * 0.12))[..., None] * halo
    col = np.where((yy < yh)[..., None], sky, col)

    # ── corais, algas, rochas…: mesma luz e mesma névoa da areia ──
    def fog_at(by):
        sr = (H - yh) / max(by - yh, 0.6)
        f = float(np.clip(1 - np.exp(-((sr * 0.085) ** 1.15)), 0, 1))
        return f, far + (glow - far) * np.exp(-(((by - yh) / (H * 0.08)) ** 2)) * 0.8

    def light_at(x):
        return 0.85 * (0.5 + 0.5 * np.exp(-(((x - W * 0.5) / (W * 0.55)) ** 2)))

    col = place(col, W, H, yh, texel, rng, items, fog_at, light_at)

    col *= (1 - 0.28 * ((xx - W / 2) / (W / 2)) ** 2)[..., None]  # vinheta lateral
    col += rng.normal(0, 0.006, col.shape)  # granulação fina: tira o "liso de computador"
    img = Image.fromarray((np.clip(col, 0, 1) * 255).astype(np.uint8))
    img.save(f"{OUT}/{name}.webp", "WEBP", quality=80, method=6)
    print(name, img.size, os.path.getsize(f"{OUT}/{name}.webp") // 1024, "KB")


# pérolas e elementos longe do centro (onde ficam o botão e o texto); tamanho = no primeiro plano (encolhe ao longe)
# (tipo, x, linha 0 = horizonte .. 1 = base, tamanho px). Gerado com semente fixa: sai sempre igual.
def jardim(seed, lados, fundo):
    r = np.random.default_rng(seed)
    kinds = ["coral", "coral", "alga", "alga", "leque", "tubo", "rocha", "capim", "capim", "cerebro"]
    items = []
    for (xa, xb), n, (sa, sb), (pa, pb) in lados:  # moitas cheias nas laterais
        for _ in range(n):
            pd = r.uniform(pa, pb) ** 0.6
            items.append((kinds[r.integers(len(kinds))], r.uniform(xa, xb), pd, r.uniform(sa, sb)))
    for _ in range(fundo):  # silhuetas ao fundo, sumindo na névoa
        items.append((kinds[r.integers(len(kinds))], r.uniform(0.02, 0.98), r.uniform(0.04, 0.3), r.uniform(200, 380)))
    return items


PC = jardim(11, [((0.0, 0.27), 26, (80, 190), (0.45, 1.0)), ((0.73, 1.0), 26, (80, 190), (0.45, 1.0))], 22)
# celular: o botão fixo de compra cobre a base, então as moitas ficam no meio da areia, dos lados do botão do Instagram
CEL = jardim(12, [((0.05, 0.3), 16, (110, 230), (0.25, 0.7)), ((0.7, 0.95), 16, (110, 230), (0.25, 0.7)), ((0.0, 1.0), 8, (150, 260), (0.75, 1.0))], 14)
render(2880, 1000, 0.34, 1.0, 7, [(0.13, 0.78, 34), (0.17, 0.86, 22), (0.84, 0.70, 28), (0.905, 0.9, 40), (0.33, 0.42, 30), (0.70, 0.36, 26)], PC, "fundo-mar-real-pc")
render(1170, 1300, 0.30, 1.2, 9, [(0.1, 0.9, 34), (0.9, 0.82, 30), (0.22, 0.38, 26), (0.8, 0.33, 22)], CEL, "fundo-mar-real-cel")

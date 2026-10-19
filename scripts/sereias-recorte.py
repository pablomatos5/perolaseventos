"""Recorte das sereias do topo (public/2027/sereia-s{e,d}-inteira.webp) a partir dos PNGs do kit.

A silhueta (sereia + pedra + concha + corais) vem de uma máscara do rembg (modelo isnet-general-use,
rodado à parte: `rembg i -m isnet-general-use -om rgb.png mask-<se|sd>.png`). O céu roxo da arte original sai
inteiro: elas ficam direto sobre o céu e o mar do site, sem o "painel" retangular. Base com esfumado curto.
Uso: python -I scripts/sereias-recorte.py <pasta-dos-png-e-mascaras> <pasta-de-saida>
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image

src, out = Path(sys.argv[1]), Path(sys.argv[2])

for n in ("se", "sd"):
    rgb = np.asarray(Image.open(src / f"sereia-{n}-inteira.png").convert("RGB"))
    m = np.asarray(Image.open(src / f"mask-{n}.png").convert("L")).astype(float) / 255
    h = m.shape[0]
    m = np.clip((m - 0.08) / 0.92, 0, 1)  # tira a névoa fraca em volta (halo do fundo antigo)
    y = np.linspace(0, 1, h)[:, None]
    base = np.clip((1 - y) / 0.025, 0, 1)  # só um fio na base, onde a pedra encontra a água
    a = m * base
    Image.fromarray(np.dstack([rgb, (a * 255).astype(np.uint8)])).save(out / f"sereia-{n}-inteira.webp", quality=86, method=6)
    print(n, rgb.shape)

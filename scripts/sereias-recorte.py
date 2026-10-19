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
from scipy.ndimage import binary_fill_holes, binary_opening, gaussian_filter, label

src, out = Path(sys.argv[1]), Path(sys.argv[2])

for n in ("se",):
    rgb = np.asarray(Image.open(src / f"sereia-{n}-inteira.png").convert("RGB"))
    m = np.asarray(Image.open(src / f"mask-{n}.png").convert("L")).astype(float) / 255
    h = m.shape[0]
    # máscara sólida: tudo que é sereia/pedra/concha fica opaco (o rembg deixava partes translúcidas em lugares
    # diferentes em cada sereia); os buracos internos são preenchidos e só a borda ganha um esfumado curto
    solid = binary_fill_holes(binary_opening(m > 0.3, iterations=2))
    lb, n = label(solid)
    if n > 1:
        sz = np.bincount(lb.ravel()); sz[0] = 0
        solid = lb == sz.argmax()
    m = np.clip(gaussian_filter(solid.astype(float), 1.6) * 1.15, 0, 1)
    y = np.linspace(0, 1, h)[:, None]
    base = np.clip((1 - y) / 0.025, 0, 1)  # só um fio na base, onde a pedra encontra a água
    a = m * base
    Image.fromarray(np.dstack([rgb, (a * 255).astype(np.uint8)])).save(out / f"sereia-{n}-inteira.webp", quality=86, method=6)
    print(n, rgb.shape)

# a da direita é a da esquerda espelhada: as duas ficam idênticas (mesmo recorte, opacidade e base na água;
# a arte original da direita trazia uma névoa clara na base que a outra não tinha)
Image.open(out / "sereia-se-inteira.webp").transpose(Image.FLIP_LEFT_RIGHT).save(out / "sereia-sd-inteira.webp", quality=86, method=6)
print("sd = se espelhada")

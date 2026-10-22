"""Texturas do ingresso em PDF no visual atual do site (mesmas artes da página):
- pe-dia.png:   areia realista da seção de ingressos (public/2027/areia-real.webp) no pé do ingresso claro (feminino)
- pe-noite.png: fundo do mar do rodapé (public/2027/fundo-mar-real-cel.webp) no pé do ingresso escuro (masculino)
- fios-luz.png: os fios de luz dourados do céu do site (public/2027/fios-luz.webp), por cima do topo
- fundo-noite-roxo.png / topo-noite-roxo.jpg: o tema escuro puxado para o roxo-noite da capa do site
  (gerados a partir de fundo-noite.png e topo-noite.jpg, que ficam como estavam)

Os pés sobem esfumados (alfa em degradê) para entrar no fundo do ingresso sem linha reta.
Uso: python scripts/fundo-mar/ingresso.py  ->  assets/pdf/pe-dia.png, pe-noite.png, fios-luz.png
"""
import numpy as np
from PIL import Image, ImageEnhance, ImageFilter

PUB = "public/2027"
OUT = "assets/pdf"
W, H = 630, 330  # 1,5x de 420 × 220 pt: nítido no celular e na impressão, sem pesar o anexo do e-mail


def fade(im: Image.Image, solid_from: float) -> Image.Image:
    """alfa 0 no alto → 1 a partir de `solid_from` (fração da altura), curva suave"""
    a = np.clip(np.linspace(0, 1, im.height) / solid_from, 0, 1)
    a = (a * a * (3 - 2 * a))[:, None] * np.ones((1, im.width))
    rgba = np.dstack([np.asarray(im.convert("RGB"), np.float32), a * 255])
    return Image.fromarray(rgba.astype(np.uint8), "RGBA")


def cover(im: Image.Image, w: int, h: int, x: float = 0.5, y: float = 0.5) -> Image.Image:
    """corta para w×h preenchendo tudo (como object-fit: cover), ancorado em (x, y)"""
    s = max(w / im.width, h / im.height)
    im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
    left = round((im.width - w) * x)
    top = round((im.height - h) * y)
    return im.crop((left, top, left + w, top + h))


# areia: tom de pêssego claro do fim do degradê do ingresso, clara o bastante para o texto escuro por cima
areia = cover(Image.open(f"{PUB}/areia-real.webp"), W, H, 0.5, 0.5)
areia = ImageEnhance.Brightness(areia).enhance(1.18)
areia = ImageEnhance.Contrast(areia).enhance(0.85).filter(ImageFilter.GaussianBlur(0.6))  # grão suave: comprime bem
tint = Image.new("RGB", (W, H), (255, 226, 196))
areia = Image.blend(areia, tint, 0.25)
fade(areia, 0.55).save(f"{OUT}/pe-dia.png", optimize=True)

# fundo do mar: a parte de baixo da cena do celular (areia com corais), escurecida para o texto creme
mar = cover(Image.open(f"{PUB}/fundo-mar-real-cel.webp"), W, H, 0.5, 1.0)
mar = ImageEnhance.Brightness(mar).enhance(0.62).filter(ImageFilter.GaussianBlur(0.5))
# véu escuro embaixo: as regras e a assinatura (texto creme) ficam legíveis por cima dos corais
veu = np.linspace(0, 0.55, H)[:, None, None]
mar = Image.fromarray((np.asarray(mar, np.float32) * (1 - veu) + np.array([22, 12, 48]) * veu).astype(np.uint8))
fade(mar, 0.6).save(f"{OUT}/pe-noite.png", optimize=True)

# fios de luz: o canto com o redemoinho (o site mostra com object-position 18%), 840 px
fios = Image.open(f"{PUB}/fios-luz.webp").convert("RGBA")
fios = cover(fios, 630, 630, 0.18, 0.5)
fios.save(f"{OUT}/fios-luz.png", optimize=True)

# ── tema escuro em roxo-noite ──
# fundo: violeta profundo no alto → ameixa escuro embaixo (mesma faixa de tons da capa do site à noite)
stops = [(0.0, (46, 26, 98)), (0.35, (34, 19, 78)), (0.7, (24, 13, 56)), (1.0, (16, 9, 40))]
ys = np.linspace(0, 1, 980)
cols = np.stack([np.interp(ys, [p for p, _ in stops], [c[k] for _, c in stops]) for k in range(3)], -1)
Image.fromarray(np.repeat(cols[:, None, :], 4, 1).astype(np.uint8), "RGB").save(f"{OUT}/fundo-noite-roxo.png", optimize=True)

# topo: o azul-marinho do céu e do mar vira violeta (soma um pouco do azul no vermelho); o dourado quase não muda
topo = np.asarray(Image.open(f"{OUT}/topo-noite.jpg").convert("RGB"), np.float32)
rr, gg, bb = topo[..., 0], topo[..., 1], topo[..., 2]
frio = np.clip((bb - rr) / 60, 0, 1)  # só onde o azul domina (céu e mar), não nas sereias douradas
topo = np.stack([rr + bb * 0.32 * frio, gg * (1 - 0.06 * frio), bb * (1 + 0.04 * frio)], -1)
Image.fromarray(np.clip(topo, 0, 255).astype(np.uint8)).save(f"{OUT}/topo-noite-roxo.jpg", quality=86, optimize=True)

for f in ("pe-dia.png", "pe-noite.png", "fios-luz.png", "fundo-noite-roxo.png", "topo-noite-roxo.jpg"):
    import os
    print(f, os.path.getsize(f"{OUT}/{f}") // 1024, "KB")

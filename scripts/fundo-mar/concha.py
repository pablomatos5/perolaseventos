"""Concha grande do rodapé: vieira aberta, sentada na areia do fundo do mar, renderizada em 3D de verdade
(geometria + luz), com a mesma luz, a mesma areia e a mesma névoa da cena (realista.py).

- duas valvas com ~16 costelas, leque arredondado, orelhinhas na dobradiça, espessura da casca e linhas de crescimento
- dentro: nácar (o reflexo muda de cor com o ângulo); fora: bege-rosado com faixas e poeira de areia
- metade de baixo afundada na areia, com um montinho de areia (areia-real.webp) encostado e sumindo na cena
- sombra projetada do luar e sombra de contato; ligamento escuro na dobradiça

Uso: python scripts/fundo-mar/concha.py public/2027  ->  concha-rodape.webp (transparente)
Imprime onde fica o botão do Instagram (no lugar da pérola, perto da dobradiça), em % da imagem.
"""
import os
import sys

import numpy as np
from PIL import Image
from scipy.ndimage import binary_erosion, gaussian_filter, map_coordinates

OUT = sys.argv[1]
SS = 2  # renderiza no dobro e reduz (bordas suaves)
LARG = 1000  # largura final da imagem (px), antes do recorte
rng = np.random.default_rng(11)
f32 = np.float32


def nrm(v):
    return v / (np.linalg.norm(v, axis=-1, keepdims=True) + 1e-9)


# ── luz da cena (realista.py): luar lilás do alto-esquerda, água azulada em volta, areia quente embaixo ──
L = nrm(np.array([-0.4, 0.68, 0.62], f32))
MOON = np.array([0.86, 0.80, 0.96], f32)
AMB_CEU = np.array([0.30, 0.30, 0.46], f32)
AMB_CHAO = np.array([0.30, 0.25, 0.25], f32)
NEVOA = np.array([0.11, 0.11, 0.28], f32)

# ── câmera: um pouco de cima, como a areia do rodapé ──
EYE = np.array([0.0, 1.95, 3.5], f32)
ALVO = np.array([0.0, 0.25, 0.35], f32)
FWD = nrm(ALVO - EYE)
RIGHT = nrm(np.cross(FWD, np.array([0, 1, 0], f32)))
UP = np.cross(RIGHT, FWD)


def cam(P):
    d = P - EYE
    zc = d @ FWD
    return (d @ RIGHT) / zc, -(d @ UP) / zc, zc


# ── valva (coordenadas locais, raio ~1): x lado, y da dobradiça pra borda, z pra fora (lado convexo) ──
A = np.radians(66)
C, RC = 0.5, 0.56
N = 44  # cos(N·φ) no leque de ±66° → ~16 costelas
ESP = 0.02  # espessura da casca
NOISE = gaussian_filter(rng.standard_normal((256, 256)).astype(f32), 6)
NOISE /= NOISE.std()
GRAO = rng.standard_normal((1024, 1024)).astype(f32)


def amostra(tex, x, y, escala):
    s = tex.shape[0]
    return map_coordinates(tex, [np.mod(y * escala, s), np.mod(x * escala, s)], order=1, mode="wrap")


def valva(passo):
    xs = np.arange(-0.76, 0.76, passo, dtype=f32)
    ys = np.arange(-0.01, 1.14, passo, dtype=f32)
    x, y = np.meshgrid(xs, ys)
    phi = np.arctan2(x, np.maximum(y, 1e-4))
    rho = np.hypot(x, y)
    borda = C * np.cos(phi) + np.sqrt(np.clip(RC**2 - (C * np.sin(phi)) ** 2, 0, None))
    borda = borda * (1 + 0.018 * np.cos(N * phi))  # a borda ondula com as costelas
    leque = (np.abs(phi) < A) & (rho < borda)
    orelha = (y >= -0.004) & (y < 0.11) & (np.abs(x) < 0.15 * np.sqrt(np.clip(1 - y / 0.11, 0, 1)) + 0.01)
    mask = leque | orelha
    cup = np.clip(1 - (x**2 + (y - C) ** 2) / RC**2, 0, 1)
    rampa = np.clip(rho / 0.3, 0, 1) * leque
    nz = amostra(NOISE, x, y, 60)
    costela = np.cos(N * phi)
    h = 0.17 * cup**0.8
    g0y, g0x = np.gradient(h, passo)  # forma lisa (o lado de dentro tem as costelas bem mais suaves)
    h = h + 0.013 * rampa * (0.45 + 0.55 * np.clip(rho, 0, 1)) * costela  # costelas
    h = h + 0.0018 * rampa * np.cos(3 * N * phi + 0.5)  # estrias finas
    h = h + 0.0009 * np.sin(rho * 115 + 1.6 * nz) * rampa  # linhas de crescimento (anéis a partir da dobradiça)
    so_orelha = orelha & ~leque
    h = h + so_orelha * (0.0025 * np.cos(x * 70) + 0.0012 * np.sin(rho * 115))  # orelhas: estrias e anéis como o resto
    g_y, g_x = np.gradient(h, passo)
    return dict(x=x, y=y, h=h, gx=g_x, gy=g_y, g0x=g0x, g0y=g0y, mask=mask, phi=phi, rho=rho, borda=borda, costela=costela, rampa=rampa, nz=nz)


def base(teta):
    """eixos da valva no mundo; teta = abertura (0 = metade de baixo deitada, lado de fora pra baixo)"""
    ex = np.array([1, 0, 0], f32)
    if teta is None:  # metade de baixo
        return ex, np.array([0, 0, 1], f32), np.array([0, -1, 0], f32)
    t = np.radians(teta)
    return ex, np.array([0, np.sin(t), np.cos(t)], f32), np.array([0, np.cos(t), -np.sin(t)], f32)


DOBRA = np.array([0, 0.165, 0], f32)  # dobradiça (só a base da metade de baixo afunda na areia)
ABRE = 70.0
INCL = np.radians(6)  # metade de baixo levemente inclinada pra frente (assentada na areia)


def para_mundo(eixos, x, y, z):
    ex, ey, ez = eixos
    P = DOBRA + x[..., None] * ex + y[..., None] * ey + z[..., None] * ez
    return P


def inclina(P):
    """gira tudo em volta da dobradiça (eixo x): a concha assenta com a frente um tiquinho mais baixa"""
    d = P - DOBRA
    c, s = np.cos(INCL), np.sin(INCL)
    y = d[..., 1] * c - d[..., 2] * s
    z = d[..., 1] * s + d[..., 2] * c
    return np.stack([d[..., 0], y, z], -1) + DOBRA


def inclina_n(n):
    c, s = np.cos(INCL), np.sin(INCL)
    return np.stack([n[..., 0], n[..., 1] * c - n[..., 2] * s, n[..., 1] * s + n[..., 2] * c], -1)


# ── materiais ──
def nacar(V, n, g):
    ndv = np.clip(np.sum(n * V, -1), 0, 1)
    fase = 1.6 * (1 - ndv) + 0.35 * g["nz"] + 0.2 * g["rho"]
    irid = 0.5 + 0.5 * np.cos(2 * np.pi * (fase[..., None] + np.array([0, 0.33, 0.67], f32)))
    alb = np.array([0.95, 0.90, 0.87], f32) * (0.94 + 0.06 * irid)  # porcelana acetinada, só um reflexo
    perto_borda = np.clip((g["rho"] / g["borda"] - 0.86) / 0.12, 0, 1)
    alb = alb * (1 - 0.35 * perto_borda[..., None]) + np.array([0.80, 0.62, 0.68], f32) * 0.35 * perto_borda[..., None]
    return alb, 0.25, 30


def fora(V, n, g):
    faixa = np.sin(g["rho"] * 24 + 2.5 * g["nz"])
    alb = np.array([0.80, 0.68, 0.64], f32) * (1 - 0.13 * (faixa > 0.55))[..., None]
    alb = alb * (1 + 0.07 * np.clip(g["costela"], 0, 1) * g["rampa"])[..., None]
    poeira = np.clip(amostra(GRAO, g["x"], g["y"], 700), 0, None) * 0.05
    alb = alb + poeira[..., None] * np.array([0.9, 0.8, 0.7], f32)
    return alb, 0.08, 14


def sombrear(P, n, alb, spec, shin, ao):
    V = nrm(EYE - P)
    ndl = np.clip(n @ L, 0, 1)
    hemi = 0.5 + 0.5 * n[..., 1]
    amb = AMB_CEU * hemi[..., None] + AMB_CHAO * (1 - hemi)[..., None] * 0.6
    H = nrm(L + V)
    s = np.clip(np.sum(n * H, -1), 0, 1) ** shin * spec
    fres = (1 - np.clip(np.sum(n * V, -1), 0, 1)) ** 4 * 0.12
    col = alb * (MOON * (0.95 * ndl)[..., None] + amb) * ao[..., None]
    col = col + (s[..., None] * MOON) + fres[..., None] * np.array([0.55, 0.5, 0.75], f32) * ao[..., None]
    return col


# ── buffers ──
class Tela:
    def __init__(self, W, H, s, ox, oy):
        self.W, self.H, self.s, self.ox, self.oy = W, H, s, ox, oy
        self.z = np.full(W * H, np.inf, f32)
        self.col = np.zeros((W * H, 3), f32)
        self.cob = np.zeros(W * H, bool)
        self.sombra = np.zeros(W * H, f32)
        self.contato = np.zeros(W * H, f32)

    def px(self, P):
        u, v, zc = cam(P)
        return u * self.s + self.ox, v * self.s + self.oy, zc

    def pinta(self, P, col, alfa=None):
        u, v, zc = self.px(P)
        iu, iv = np.round(u).astype(np.int64), np.round(v).astype(np.int64)
        ok = (iu >= 0) & (iu < self.W) & (iv >= 0) & (iv < self.H)
        idx = (iv * self.W + iu)[ok]
        zc, col = zc[ok].astype(f32), col[ok]
        np.minimum.at(self.z, idx, zc)
        win = zc <= self.z[idx]
        self.col[idx[win]] = col[win]
        self.cob[idx[win]] = True

    def marca(self, buf, P, peso=1.0):
        u, v, _ = self.px(P)
        iu, iv = np.round(u).astype(np.int64), np.round(v).astype(np.int64)
        ok = (iu >= 0) & (iu < self.W) & (iv >= 0) & (iv < self.H)
        np.maximum.at(buf, (iv * self.W + iu)[ok], peso)


def no_chao(P, direcao):
    """projeta no chão (y = 0) seguindo a direção (luz ou vertical)"""
    t = P[..., 1] / direcao[1]
    return P - t[..., None] * direcao


VALVAS = [("baixo", None), ("cima", ABRE)]


def geometria(passo):
    """gera (P, normal, material, ao, dados) de cada superfície"""
    for nome, teta in VALVAS:
        g = valva(passo)
        m = g["mask"]
        eixos = base(teta)
        ex, ey, ez = eixos
        nl = np.stack([-g["gx"], -g["gy"], np.ones_like(g["h"])], -1)
        nl = nl / np.linalg.norm(nl, axis=-1, keepdims=True)
        nw = nl[..., 0:1] * ex + nl[..., 1:2] * ey + nl[..., 2:3] * ez
        ao_dobra = 1 - 0.5 * np.exp(-((g["rho"] / 0.2) ** 2))
        ao_sulco = 1 - 0.3 * np.clip(-g["costela"], 0, 1) * g["rampa"]
        nl0 = np.stack([-g["g0x"], -g["g0y"], np.ones_like(g["h"])], -1)
        nl0 = nl0 / np.linalg.norm(nl0, axis=-1, keepdims=True)
        nl_in = nl * 0.25 + nl0 * 0.75
        nl_in = nl_in / np.linalg.norm(nl_in, axis=-1, keepdims=True)
        nw_in = nl_in[..., 0:1] * ex + nl_in[..., 1:2] * ey + nl_in[..., 2:3] * ez
        for lado, dz, sinal in (("fora", 0.0, 1.0), ("dentro", -ESP, -1.0)):
            P = para_mundo(eixos, g["x"], g["y"], g["h"] + dz)
            n = (nw if lado == "fora" else nw_in) * sinal
            if teta is None:
                P, n = inclina(P), inclina_n(n)
            ao = ao_dobra * (ao_sulco if lado == "fora" else 1 - 0.1 * (1 - ao_sulco) / 0.3)
            if lado == "dentro":
                ao = ao * (1 - 0.25 * np.clip(1 - g["rho"] / 0.45, 0, 1))  # fundo da concha mais escuro
            yield nome, lado, P[m], n[m], ao[m], {k: v[m] for k, v in g.items() if k not in ("mask",)}
        # borda: a espessura da casca
        bd = m & ~binary_erosion(m, iterations=2)
        radial = np.stack([g["x"], g["y"] - C * 0.6, np.zeros_like(g["h"])], -1)
        radial = radial / (np.linalg.norm(radial, axis=-1, keepdims=True) + 1e-9)
        nb = radial[..., 0:1] * ex + radial[..., 1:2] * ey
        for s in np.linspace(0, 1, 7):
            P = para_mundo(eixos, g["x"], g["y"], g["h"] - ESP * s)
            n = nb
            if teta is None:
                P, n = inclina(P), inclina_n(n)
            yield nome, "borda", P[bd], n[bd], np.ones(bd.sum(), f32), {k: v[bd] for k, v in g.items() if k not in ("mask",)}


def ninho():
    """onde a pérola ficava: lado de dentro da metade de baixo, perto da dobradiça. O botão do Instagram fica ali."""
    g = valva(0.004)
    i = np.argmin(np.abs(g["x"]) + np.abs(g["y"] - 0.2))
    return inclina(para_mundo(base(None), g["x"].ravel()[i:i + 1], g["y"].ravel()[i:i + 1], g["h"].ravel()[i:i + 1] - ESP))[0]


def ligamento(passo):
    """o ligamento escuro que une as duas metades na dobradiça (some a fresta entre elas)"""
    t, p = np.meshgrid(np.arange(0, np.pi, passo, dtype=f32), np.arange(0, 2 * np.pi, passo, dtype=f32))
    n = np.stack([np.sin(t) * np.cos(p), np.cos(t), np.sin(t) * np.sin(p)], -1).reshape(-1, 3)
    raio = np.array([0.12, 0.011, 0.02], f32)  # linha fina ao longo da dobradiça
    P = DOBRA + np.array([0, 0.004, -0.008], f32) + n * raio
    return P, nrm(n / raio)


def areia_monte(passo, pegada):
    """chão em volta da metade de baixo: um montinho de areia encostado na concha que some na areia da cena"""
    xs = np.arange(-1.2, 1.2, passo, dtype=f32)
    zs = np.arange(-0.5, 1.6, passo, dtype=f32)
    x, z = np.meshgrid(xs, zs)
    d = pegada(x, z)  # distância (aprox.) até a beirada da metade de baixo
    alt = 0.03 * np.exp(-np.clip(d - 0.012, 0, None) / 0.06) + 0.006 * amostra(NOISE, x, z, 40)
    P = np.stack([x, alt, z], -1)
    gz, gx = np.gradient(alt, passo)
    n = nrm(np.stack([-gx, np.ones_like(alt), -gz], -1))
    areia = np.asarray(Image.open(f"{OUT}/areia-real.webp").convert("RGB"), f32) / 255
    alb = np.stack([amostra(areia[..., c], x, z, 900) for c in range(3)], -1)
    # mesma luz da areia da cena (realista.py: col = alb · luar · sombreado · 0,8)
    ndl = np.clip(n @ L, 0, 1)
    col = alb * MOON * (0.55 + 0.6 * ndl)[..., None] * 0.8
    fora_conc = np.clip((d - 0.012) / 0.01, 0, 1)  # dentro da metade de baixo não tem areia
    alfa = 0.9 * fora_conc * np.clip(1 - (d - 0.012) / 0.2, 0, 1) ** 2
    return P.reshape(-1, 3), col.reshape(-1, 3), alfa.reshape(-1)


def main():
    # 1) enquadramento com uma passada grossa
    us, vs = [], []
    for _, _, P, _, _, _ in geometria(0.02):
        u, v, _ = cam(P)
        us.append(u), vs.append(v)
    u, v = np.concatenate(us), np.concatenate(vs)
    W = LARG * SS
    s = W * 0.66 / (u.max() - u.min())
    ox = W / 2 - (u.max() + u.min()) / 2 * s
    H = int((v.max() - v.min()) * s + W * 0.32)
    oy = W * 0.1 - v.min() * s
    tela = Tela(W, H, s, ox, oy)
    passo = 2.5 / (s * 1.5)  # pontos mais densos que os pixels na parte mais perto da câmera (sem furos)

    # pegada da metade de baixo no chão (pra areia encostar e pra sombra de contato)
    g = valva(0.01)
    Pb = inclina(para_mundo(base(None), g["x"], g["y"], g["h"]))[g["mask"]]
    from scipy.spatial import cKDTree

    arvore = cKDTree(Pb[:, [0, 2]])

    def pegada(x, z):
        d, _ = arvore.query(np.stack([x.ravel(), z.ravel()], -1), workers=-1)
        return d.reshape(x.shape)

    seat = ninho()

    for nome, lado, P, n, ao, gg in geometria(passo):
        V = nrm(EYE - P)
        alb, spec, shin = (nacar if lado == "dentro" else fora)(V, n, gg)
        if lado == "borda":
            alb = np.array([0.88, 0.78, 0.78], f32) * np.ones_like(P)
        # sombra suave do botão aninhado na concha
        d = ((P[:, 0] - seat[0]) / 0.36) ** 2 + (np.hypot(P[:, 1] - seat[1], P[:, 2] - seat[2]) / 0.11) ** 2
        ao = ao * (1 - 0.38 * np.exp(-d * 1.4))
        tela.pinta(P, sombrear(P, n, alb, spec, shin, ao))
        if lado != "dentro":
            tela.marca(tela.sombra, no_chao(P, L))
    # ligamento da dobradiça
    Pg, Ng = ligamento(np.pi / 500)
    tela.pinta(Pg, sombrear(Pg, Ng, np.array([0.38, 0.29, 0.26], f32) * np.ones_like(Pg), 0.1, 16, np.full(len(Pg), 0.75, f32)))

    # montinho de areia: pinta por cima (z-buffer esconde a parte da concha enterrada) e guarda o alfa
    Pa, ca, aa = areia_monte(passo * 1.3, pegada)
    vis = aa > 0.01
    Pa, ca, aa = Pa[vis], ca[vis], aa[vis]
    u, vv, zc = tela.px(Pa)
    iu, iv = np.round(u).astype(np.int64), np.round(vv).astype(np.int64)
    ok = (iu >= 0) & (iu < W) & (iv >= 0) & (iv < H)
    idx, zc, ca, aa = (iv * W + iu)[ok], zc[ok].astype(f32), ca[ok], aa[ok]
    areia_a = np.zeros(W * H, f32)
    areia_c = np.zeros((W * H, 3), f32)
    zA = np.full(W * H, np.inf, f32)
    np.minimum.at(zA, idx, zc)
    win = zc <= zA[idx]
    areia_a[idx[win]] = aa[win]
    areia_c[idx[win]] = ca[win]
    frente = zA < tela.z  # areia na frente da concha (parte enterrada)

    # ── monta a imagem ──
    cob = tela.cob.reshape(H, W).astype(f32)
    col = tela.col.reshape(H, W, 3)
    # fecha furinhos entre pontos
    pesos = gaussian_filter(cob, 1.0)
    col = np.where(cob[..., None] > 0, col, gaussian_filter(col * cob[..., None], (1.0, 1.0, 0)) / np.maximum(pesos, 1e-4)[..., None])
    cob = np.clip(pesos * 2.2, 0, 1) * (pesos > 0.2)
    # névoa e exposição iguais às da areia da cena
    col = col * 0.82
    col = col * 0.9 + NEVOA * 0.1
    ruido = gaussian_filter(rng.standard_normal((H, W)).astype(f32), 0.7)
    col = col * (1 + 0.025 * ruido)[..., None]

    # areia por cima da concha onde ela está enterrada, e em volta (some na cena)
    aA = gaussian_filter(areia_a.reshape(H, W), 1.0)
    cA = gaussian_filter(areia_c.reshape(H, W, 3), (1.0, 1.0, 0)) / np.maximum(gaussian_filter((areia_a > 0).reshape(H, W).astype(f32), 1.0), 1e-4)[..., None]
    na_frente = gaussian_filter(frente.reshape(H, W).astype(f32), 1.2)
    cobre = np.where(cob > 0, na_frente * np.clip(aA * 1.4, 0, 1), aA)
    col = col * (1 - cobre[..., None]) + cA * cobre[..., None]

    # sombras na areia (fora da concha)
    somb = gaussian_filter(tela.sombra.reshape(H, W), 14 * SS / 2) * 0.5
    cont = gaussian_filter(binary_erosion(cob > 0.5, iterations=1).astype(f32), 5 * SS) * 0.0
    alfa_concha = np.maximum(cob, cobre * (cob == 0))
    alfa_somb = np.clip(somb, 0, 0.5)
    # cor final: concha/areia por cima; sombra = preto-azulado com alfa
    alfa = alfa_concha + alfa_somb * (1 - alfa_concha)
    cor = (col * alfa_concha[..., None] + np.array([0.02, 0.02, 0.06], f32) * (alfa_somb * (1 - alfa_concha))[..., None]) / np.maximum(alfa, 1e-4)[..., None]

    img = np.dstack([np.clip(cor, 0, 1), np.clip(alfa, 0, 1)])
    im = Image.fromarray((img * 255 + 0.5).astype(np.uint8), "RGBA")
    # reduz (pré-multiplicado, pra não sujar a borda)
    pm = np.asarray(im, f32) / 255
    pm[..., :3] *= pm[..., 3:4]
    pm = np.asarray(Image.fromarray((pm * 255 + 0.5).astype(np.uint8), "RGBA").resize((W // SS, H // SS), Image.LANCZOS), f32) / 255
    a = pm[..., 3:4]
    pm[..., :3] = np.where(a > 0, pm[..., :3] / np.maximum(a, 1e-4), 0)
    final = Image.fromarray((np.clip(pm, 0, 1) * 255 + 0.5).astype(np.uint8), "RGBA")
    bbox = final.getchannel("A").point(lambda q: 255 if q > 3 else 0).getbbox()
    final = final.crop(bbox)

    # onde fica o botão (no lugar da pérola)
    u, v, _ = tela.px(seat[None])
    bx = (u[0] / SS - bbox[0]) / final.width * 100
    by = (v[0] / SS - bbox[1]) / final.height * 100

    final.save(f"{OUT}/concha-rodape.webp", "WEBP", quality=88, method=6)
    print(f"concha-rodape {final.width}x{final.height} {os.path.getsize(f'{OUT}/concha-rodape.webp') // 1024} KB · botão em x={bx:.1f}% y={by:.1f}%")


if __name__ == "__main__":
    main()

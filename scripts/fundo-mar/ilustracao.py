#!/usr/bin/env python3
"""Fundo do mar do rodapé: ilustração 2D detalhada gerada como SVG e renderizada UMA vez em imagem
(webp leve, custo zero no celular).

Uso: python3 scripts/fundo-mar/ilustracao.py <pasta-de-saida>
Gera fundo-mar-pc.svg (1440×380) e fundo-mar-cel.svg (585×500); depois:
  magick -density 192 -background none fundo-mar-pc.svg -quality 82 public/2027/fundo-mar-pc.webp
"""
import math
import random
import sys
from pathlib import Path

OUT = Path(sys.argv[1] if len(sys.argv) > 1 else ".")


def f(n):
    return f"{n:.1f}"


class Scene:
    def __init__(self, w, h, seed):
        self.w, self.h = w, h
        self.r = random.Random(seed)
        self.defs = []
        self.layers = {k: [] for k in ["bg", "rays", "far", "dune", "sand", "weed", "mid", "front", "fx"]}
        self._id = 0

    def uid(self, p):
        self._id += 1
        return f"{p}{self._id}"

    def add(self, layer, s):
        self.layers[layer].append(s)

    def lin(self, stops, x1=0, y1=0, x2=0, y2=1):
        i = self.uid("g")
        st = "".join(f'<stop offset="{o}" stop-color="{c}" stop-opacity="{a}"/>' for o, c, a in stops)
        self.defs.append(f'<linearGradient id="{i}" x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}">{st}</linearGradient>')
        return f"url(#{i})"

    def rad(self, stops, cx=0.5, cy=0.5, r=0.5, fx=None, fy=None):
        i = self.uid("r")
        st = "".join(f'<stop offset="{o}" stop-color="{c}" stop-opacity="{a}"/>' for o, c, a in stops)
        fxy = f' fx="{fx}" fy="{fy}"' if fx is not None else ""
        self.defs.append(f'<radialGradient id="{i}" cx="{cx}" cy="{cy}" r="{r}"{fxy}>{st}</radialGradient>')
        return f"url(#{i})"

    def svg(self):
        body = "".join(f'<g id="L-{k}">{"".join(v)}</g>' for k, v in self.layers.items())
        filters = """
<filter id="blur2" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="2"/></filter>
<filter id="blur4" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="4"/></filter>
<filter id="blur10" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="10"/></filter>
<filter id="caustic" x="0" y="0" width="100%" height="100%">
  <feTurbulence type="fractalNoise" baseFrequency="0.018 0.055" numOctaves="2" seed="4" result="n"/>
  <feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 -2.2 1.35" in="n" result="w"/>
  <feComponentTransfer in="w"><feFuncA type="table" tableValues="0 0 0.05 0.55 0"/></feComponentTransfer>
</filter>
<filter id="grain" x="0" y="0" width="100%" height="100%">
  <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="9" result="n"/>
  <feColorMatrix type="matrix" values="0 0 0 0 0.55  0 0 0 0 0.35  0 0 0 0 0.3  0 0 0 0.16 0" in="n"/>
</filter>"""
        return (
            f'<svg xmlns="http://www.w3.org/2000/svg" width="{self.w}" height="{self.h}" viewBox="0 0 {self.w} {self.h}">'
            f"<defs>{filters}{''.join(self.defs)}</defs>{body}</svg>"
        )


# ───────────────────────── elementos ─────────────────────────

def sand(sc, top):
    w, h = sc.w, sc.h
    # duna de trás (lavanda) e areia da frente (pêssego) com borda ondulada
    pts = []
    for i in range(0, w + 41, 40):
        pts.append((i, top - 22 + 9 * math.sin(i / 97) + 6 * math.sin(i / 41 + 1)))
    d = f"M0 {h} L" + " L".join(f"{f(x)} {f(y)}" for x, y in pts) + f" L{w} {h} Z"
    sc.add("dune", f'<path d="{d}" fill="{sc.lin([(0, "#e9c6e2", 1), (1, "#f0cdc8", 1)])}"/>')
    pts = []
    for i in range(0, w + 31, 30):
        pts.append((i, top + 7 * math.sin(i / 120 + 2) + 4 * math.sin(i / 37)))
    d = f"M0 {h} L" + " L".join(f"{f(x)} {f(y)}" for x, y in pts) + f" L{w} {h} Z"
    clip = sc.uid("c")
    sc.defs.append(f'<clipPath id="{clip}"><path d="{d}"/></clipPath>')
    sc.add("sand", f'<path d="{d}" fill="{sc.lin([(0, "#f6dccb", 1), (0.5, "#f0cbb6", 1), (1, "#e6b7a4", 1)])}"/>')
    sc.add("sand", f'<path d="M0 {f(pts[0][1])} L' + " L".join(f"{f(x)} {f(y)}" for x, y in pts) + '" fill="none" stroke="#fff" stroke-opacity=".7" stroke-width="2"/>')
    g = [f'<g clip-path="url(#{clip})">']
    g.append(f'<rect width="{w}" height="{h}" filter="url(#grain)"/>')
    g.append(f'<rect width="{w}" height="{h}" filter="url(#caustic)" opacity=".75"/>')
    # ondulações da areia (sombra + brilho)
    for k in range(int(w / 48)):
        x = sc.r.uniform(-40, w)
        y = sc.r.uniform(top + 18, h - 6)
        ln = sc.r.uniform(50, 150)
        bend = sc.r.uniform(4, 9)
        g.append(f'<path d="M{f(x)} {f(y)} q{f(ln/2)} {-bend} {f(ln)} 0" fill="none" stroke="#c9937f" stroke-opacity=".18" stroke-width="1.4" stroke-linecap="round"/>')
        g.append(f'<path d="M{f(x)} {f(y-2.2)} q{f(ln/2)} {-bend} {f(ln)} 0" fill="none" stroke="#fff" stroke-opacity=".4" stroke-width="1.1" stroke-linecap="round"/>')
    g.append("</g>")
    sc.add("sand", "".join(g))


def rays(sc, xs):
    for x, wd in xs:
        g = sc.lin([(0, "#fff", 0.55), (1, "#fff", 0)])
        sc.add("rays", f'<path d="M{f(x)} 0 h{f(wd)} L{f(x + wd*1.6 + 60)} {sc.h} h{f(-wd*2.6)} Z" fill="{g}" filter="url(#blur10)"/>')


def coral_branch(out, x, y, ang, ln, w, depth, base, hi, rng):
    ex = x + ln * math.cos(ang)
    ey = y - ln * math.sin(ang)
    bend = rng.uniform(-0.25, 0.25) * ln
    cx = (x + ex) / 2 + bend * math.sin(ang)
    cy = (y + ey) / 2 + bend * math.cos(ang)
    d = f"M{f(x)} {f(y)} Q{f(cx)} {f(cy)} {f(ex)} {f(ey)}"
    out.append(f'<path d="{d}" fill="none" stroke="{base}" stroke-width="{f(w)}" stroke-linecap="round"/>')
    # brilho num dos lados do galho
    ox, oy = -math.sin(ang) * w * 0.22, -math.cos(ang) * w * 0.22
    out.append(f'<path d="M{f(x+ox)} {f(y+oy)} Q{f(cx+ox)} {f(cy+oy)} {f(ex+ox)} {f(ey+oy)}" fill="none" stroke="{hi}" stroke-opacity=".75" stroke-width="{f(w*0.32)}" stroke-linecap="round"/>')
    if depth <= 0 or w < 2.2:
        out.append(f'<circle cx="{f(ex)}" cy="{f(ey)}" r="{f(w*0.62)}" fill="{hi}"/>')
        out.append(f'<circle cx="{f(ex - w*0.15)}" cy="{f(ey - w*0.15)}" r="{f(w*0.25)}" fill="#fff" fill-opacity=".8"/>')
        return
    n = rng.choice([2, 2, 3])
    for i in range(n):
        t = rng.uniform(0.55, 0.95)
        bx = (1 - t) ** 2 * x + 2 * (1 - t) * t * cx + t * t * ex
        by = (1 - t) ** 2 * y + 2 * (1 - t) * t * cy + t * t * ey
        na = ang + rng.uniform(0.3, 0.65) * (-1 if i % 2 == 0 else 1) + rng.uniform(-0.1, 0.1)
        coral_branch(out, bx, by, na, ln * rng.uniform(0.6, 0.8), w * 0.7, depth - 1, base, hi, rng)
    coral_branch(out, ex, ey, ang + rng.uniform(-0.2, 0.2), ln * 0.55, w * 0.72, depth - 1, base, hi, rng)


CORALS = {
    "rosa": ("#e98bb5", "#ffd1e4"),
    "lilas": ("#9f82e4", "#e3d6ff"),
    "pessego": ("#f2a27c", "#ffe0cc"),
    "violeta": ("#7f63d6", "#c9b8ff"),
}


def coral(sc, layer, x, y, size, kind, trunks=3):
    base, hi = CORALS[kind]
    out = []
    out.append(f'<ellipse cx="{f(x)}" cy="{f(y+2)}" rx="{f(size*0.5)}" ry="{f(size*0.07)}" fill="#a86d5c" fill-opacity=".22" filter="url(#blur4)"/>')
    for i in range(trunks):
        a = math.pi / 2 + (i - (trunks - 1) / 2) * 0.35 + sc.r.uniform(-0.12, 0.12)
        coral_branch(out, x + (i - 1) * size * 0.06, y, a, size * sc.r.uniform(0.32, 0.42), size * 0.075, 3, base, hi, sc.r)
    sc.add(layer, "".join(out))


def fan_coral(sc, layer, x, y, size, color):
    out = [f'<g opacity=".92">']
    for i in range(13):
        a = math.radians(30 + i * 9.2)
        ex, ey = x + size * math.cos(a), y - size * 0.95 * math.sin(a)
        cx, cy = x + size * 0.5 * math.cos(a) + sc.r.uniform(-6, 6), y - size * 0.6 * math.sin(a)
        out.append(f'<path d="M{f(x)} {f(y)} Q{f(cx)} {f(cy)} {f(ex)} {f(ey)}" fill="none" stroke="{color}" stroke-width="2" stroke-linecap="round"/>')
    for k in range(1, 6):
        rr = size * k / 6
        out.append(f'<path d="M{f(x - rr*0.95)} {f(y - rr*0.3)} Q{f(x)} {f(y - rr*1.25)} {f(x + rr*0.95)} {f(y - rr*0.3)}" fill="none" stroke="{color}" stroke-width="1" stroke-opacity=".7"/>')
    out.append("</g>")
    sc.add(layer, "".join(out))


def brain_coral(sc, layer, x, y, r, c1, c2):
    g = sc.rad([(0, c2, 1), (1, c1, 1)], cx=0.4, cy=0.3, r=0.75)
    out = [f'<ellipse cx="{f(x)}" cy="{f(y+3)}" rx="{f(r*1.15)}" ry="{f(r*0.22)}" fill="#a86d5c" fill-opacity=".25" filter="url(#blur4)"/>']
    out.append(f'<path d="M{f(x-r)} {f(y)} A{f(r)} {f(r*0.78)} 0 0 1 {f(x+r)} {f(y)} Z" fill="{g}"/>')
    clip = sc.uid("bc")
    sc.defs.append(f'<clipPath id="{clip}"><path d="M{f(x-r)} {f(y)} A{f(r)} {f(r*0.78)} 0 0 1 {f(x+r)} {f(y)} Z"/></clipPath>')
    out.append(f'<g clip-path="url(#{clip})" fill="none" stroke="{c1}" stroke-opacity=".75" stroke-width="1.6">')
    for k in range(9):
        yy = y - r * 0.78 + k * r * 0.1
        dd = f"M{f(x-r)} {f(yy)}"
        for s in range(14):
            dd += f" q{f(r/14)} {f((-1)**s * r*0.06)} {f(r/7)} 0"
        out.append(f'<path d="{dd}"/>')
    out.append("</g>")
    out.append(f'<path d="M{f(x-r*0.7)} {f(y-r*0.45)} A{f(r*0.8)} {f(r*0.55)} 0 0 1 {f(x+r*0.1)} {f(y-r*0.75)}" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="3" stroke-linecap="round"/>')
    sc.add(layer, "".join(out))


def anemone(sc, layer, x, y, size, c1, c2):
    out = [f'<ellipse cx="{f(x)}" cy="{f(y+2)}" rx="{f(size*0.55)}" ry="{f(size*0.1)}" fill="#a86d5c" fill-opacity=".25" filter="url(#blur4)"/>']
    out.append(f'<path d="M{f(x-size*0.3)} {f(y)} Q{f(x)} {f(y-size*0.35)} {f(x+size*0.3)} {f(y)} Z" fill="{c1}"/>')
    for i in range(16):
        a = math.radians(25 + i * 8.5)
        ln = size * sc.r.uniform(0.55, 0.8)
        sx, sy = x + size * 0.22 * math.cos(a), y - size * 0.18 * math.sin(a)
        ex, ey = sx + ln * math.cos(a) * 0.8, sy - ln * math.sin(a)
        cx, cy = sx + ln * 0.5 * math.cos(a) + sc.r.uniform(-8, 8), sy - ln * 0.55 * math.sin(a)
        out.append(f'<path d="M{f(sx)} {f(sy)} Q{f(cx)} {f(cy)} {f(ex)} {f(ey)}" fill="none" stroke="{c1}" stroke-width="{f(size*0.05)}" stroke-linecap="round"/>')
        out.append(f'<circle cx="{f(ex)}" cy="{f(ey)}" r="{f(size*0.035)}" fill="{c2}"/>')
    sc.add(layer, "".join(out))


def kelp(sc, layer, x, y, height, color, light):
    pts = []
    ph = sc.r.uniform(0, 6)
    for i in range(13):
        t = i / 12
        pts.append((x + math.sin(t * 4 + ph) * 16 * t, y - t * height, 9 * (1 - t * 0.75)))
    left = [(px - wd, py) for px, py, wd in pts]
    right = [(px + wd, py) for px, py, wd in pts][::-1]
    d = "M" + " L".join(f"{f(a)} {f(b)}" for a, b in left + right) + "Z"
    g = sc.lin([(0, color, 1), (1, light, 1)], 0, 1, 0, 0)
    mid = "M" + " L".join(f"{f(px)} {f(py)}" for px, py, _ in pts)
    sc.add(layer, f'<path d="{d}" fill="{g}" stroke="{color}" stroke-width="1" stroke-linejoin="round"/><path d="{mid}" fill="none" stroke="#fff" stroke-opacity=".45" stroke-width="1.2"/>')


def scallop_open(sc, layer, x, y, R):
    out = [f'<ellipse cx="{f(x)}" cy="{f(y+R*0.18)}" rx="{f(R*1.05)}" ry="{f(R*0.13)}" fill="#a86d5c" fill-opacity=".3" filter="url(#blur4)"/>']
    # brilho atrás
    out.append(f'<circle cx="{f(x)}" cy="{f(y-R*0.45)}" r="{f(R*1.1)}" fill="{sc.rad([(0, "#fff7ea", 0.9), (1, "#fff7ea", 0)])}"/>')
    n = 13
    a0, a1 = math.radians(196), math.radians(344)
    hx, hy = x, y - R * 0.02
    light = sc.lin([(0, "#f5d9bf", 1), (0.6, "#f6eafb", 1), (1, "#fbe3ef", 1)], 0, 1, 0, 0)
    dark = sc.lin([(0, "#e3bb9e", 1), (0.6, "#e6d6f4", 1), (1, "#f2cfe0", 1)], 0, 1, 0, 0)
    for i in range(n):
        s = a0 + (a1 - a0) * i / n
        e = a0 + (a1 - a0) * (i + 1) / n
        m = (s + e) / 2
        p = lambda a, rr: (hx + rr * math.cos(a), hy + rr * math.sin(a))
        sx, sy = p(s, R)
        ex, ey = p(e, R)
        mx, my = p(m, R * 1.1)
        out.append(f'<path d="M{f(hx)} {f(hy)} L{f(sx)} {f(sy)} Q{f(mx)} {f(my)} {f(ex)} {f(ey)} Z" fill="{light if i % 2 == 0 else dark}" stroke="#c4935a" stroke-width="1.1" stroke-linejoin="round"/>')
    for k in (0.45, 0.72):
        out.append(f'<path d="M{f(hx - R*k*0.97)} {f(hy - R*k*0.24)} A{f(R*k)} {f(R*k)} 0 0 1 {f(hx + R*k*0.97)} {f(hy - R*k*0.24)}" fill="none" stroke="#c4935a" stroke-opacity=".35" stroke-width="1"/>')
    # pérola
    pr = R * 0.33
    px, py = x, y - pr * 0.75
    out.append(f'<circle cx="{f(px)}" cy="{f(py)}" r="{f(pr*2.2)}" fill="{sc.rad([(0, "#fff3e2", 0.85), (1, "#fff3e2", 0)])}"/>')
    out.append(f'<circle cx="{f(px)}" cy="{f(py)}" r="{f(pr)}" fill="{sc.rad([(0, "#ffffff", 1), (0.5, "#f4ecff", 1), (0.85, "#d9c6f2", 1), (1, "#f2c9c0", 1)], cx=0.38, cy=0.32, r=0.75)}"/>')
    out.append(f'<ellipse cx="{f(px - pr*0.35)}" cy="{f(py - pr*0.4)}" rx="{f(pr*0.28)}" ry="{f(pr*0.18)}" fill="#fff" transform="rotate(-30 {f(px - pr*0.35)} {f(py - pr*0.4)})"/>')
    # valva de baixo (tigela) com lábio ondulado
    lip_y = y
    xs = [x - R * 0.98 + i * R * 0.245 for i in range(9)]
    d = f"M{f(xs[0])} {f(lip_y)}"
    for i in range(1, 9):
        d += f" Q{f((xs[i-1] + xs[i]) / 2)} {f(lip_y + (7 if i % 2 else -7))} {f(xs[i])} {f(lip_y)}"
    bowl = d + f" C{f(xs[-1] - R*0.1)} {f(lip_y + R*0.45)}, {f(xs[0] + R*0.1)} {f(lip_y + R*0.45)}, {f(xs[0])} {f(lip_y)} Z"
    out.append(f'<path d="{bowl}" fill="{sc.lin([(0, "#fbecd9", 1), (1, "#d7a876", 1)])}" stroke="#b9854b" stroke-width="1.4" stroke-linejoin="round"/>')
    for k in (0.55, 0.3):
        out.append(f'<path d="M{f(x - R*0.98*k*1.4)} {f(lip_y + 5)} Q{f(x)} {f(lip_y + R*0.42*k*1.6)} {f(x + R*0.98*k*1.4)} {f(lip_y + 5)}" fill="none" stroke="#b9854b" stroke-opacity=".45" stroke-width="1"/>')
    out.append(f'<path d="{d}" fill="none" stroke="#fff" stroke-opacity=".7" stroke-width="1.6"/>')
    sc.add(layer, "".join(out))


def scallop_small(sc, layer, x, y, R, rot, c1="#f3cf9c", c2="#d69b5f"):
    out = [f'<ellipse cx="{f(x)}" cy="{f(y+R*0.12)}" rx="{f(R*1)}" ry="{f(R*0.2)}" fill="#a86d5c" fill-opacity=".3" filter="url(#blur2)"/>']
    out.append(f'<g transform="rotate({rot} {f(x)} {f(y)})">')
    n = 9
    a0, a1 = math.radians(200), math.radians(340)
    g1 = sc.lin([(0, c2, 1), (1, c1, 1)], 0, 1, 0, 0)
    for i in range(n):
        s = a0 + (a1 - a0) * i / n
        e = a0 + (a1 - a0) * (i + 1) / n
        m = (s + e) / 2
        sx, sy = x + R * math.cos(s), y + R * math.sin(s)
        ex, ey = x + R * math.cos(e), y + R * math.sin(e)
        mx, my = x + R * 1.12 * math.cos(m), y + R * 1.12 * math.sin(m)
        out.append(f'<path d="M{f(x)} {f(y)} L{f(sx)} {f(sy)} Q{f(mx)} {f(my)} {f(ex)} {f(ey)} Z" fill="{g1}" stroke="#a8743d" stroke-width=".8"/>')
        out.append(f'<path d="M{f(x)} {f(y)} L{f((sx+ex)/2*0.98 + x*0.02)} {f((sy+ey)/2*0.98 + y*0.02)}" stroke="#fff" stroke-opacity=".5" stroke-width=".8"/>')
    out.append(f'<path d="M{f(x - R*0.28)} {f(y)} h{f(R*0.56)} l{f(-R*0.1)} {f(R*0.2)} h{f(-R*0.36)} Z" fill="{c2}" stroke="#a8743d" stroke-width=".8"/>')
    out.append("</g>")
    sc.add(layer, "".join(out))


def starfish(sc, layer, x, y, R, rot, c1, c2):
    pts = []
    for k in range(10):
        a = math.radians(rot - 90 + k * 36)
        rr = R if k % 2 == 0 else R * 0.42
        pts.append((x + rr * math.cos(a), y + rr * math.sin(a) * 0.62))
    d = f"M{f(pts[0][0])} {f(pts[0][1])}"
    for k in range(1, 11):
        p0 = pts[(k - 1) % 10]
        p1 = pts[k % 10]
        if k % 2 == 1:  # ponta → vale
            d += f" Q{f(p0[0] + (p1[0]-p0[0])*0.15 + (p0[0]-x)*0.12)} {f(p0[1] + (p1[1]-p0[1])*0.15 + (p0[1]-y)*0.12)} {f(p1[0])} {f(p1[1])}"
        else:
            d += f" Q{f((p0[0]+p1[0])/2)} {f((p0[1]+p1[1])/2)} {f(p1[0])} {f(p1[1])}"
    g = sc.rad([(0, c2, 1), (1, c1, 1)], cx=0.45, cy=0.4, r=0.65)
    out = [f'<ellipse cx="{f(x+3)}" cy="{f(y+R*0.22)}" rx="{f(R*0.95)}" ry="{f(R*0.22)}" fill="#a86d5c" fill-opacity=".3" filter="url(#blur2)"/>']
    out.append(f'<path d="{d}" fill="{g}" stroke="{c1}" stroke-width="1.4" stroke-linejoin="round"/>')
    for k in range(5):
        a = math.radians(rot - 90 + k * 72)
        for t in (0.25, 0.45, 0.65, 0.82):
            px, py = x + R * t * math.cos(a), y + R * t * math.sin(a) * 0.62
            out.append(f'<circle cx="{f(px)}" cy="{f(py)}" r="{f(R*0.045*(1.2-t*0.5))}" fill="#fff4e2" fill-opacity=".9"/>')
    out.append(f'<circle cx="{f(x)}" cy="{f(y)}" r="{f(R*0.08)}" fill="#fff4e2" fill-opacity=".9"/>')
    sc.add(layer, "".join(out))


def conch(sc, layer, x, y, s, rot):
    out = [f'<ellipse cx="{f(x)}" cy="{f(y+s*0.32)}" rx="{f(s*0.95)}" ry="{f(s*0.18)}" fill="#a86d5c" fill-opacity=".3" filter="url(#blur2)"/>']
    out.append(f'<g transform="rotate({rot} {f(x)} {f(y)})">')
    g = sc.lin([(0, "#fde9de", 1), (1, "#e7b39a", 1)])
    out.append(f'<path d="M{f(x-s)} {f(y+s*0.15)} C{f(x-s*0.6)} {f(y-s*0.55)}, {f(x+s*0.5)} {f(y-s*0.6)}, {f(x+s*0.95)} {f(y-s*0.05)} C{f(x+s*0.6)} {f(y+s*0.35)}, {f(x-s*0.4)} {f(y+s*0.4)}, {f(x-s)} {f(y+s*0.15)} Z" fill="{g}" stroke="#b9805f" stroke-width="1"/>')
    for k in range(4):
        xx = x - s * 0.55 + k * s * 0.38
        out.append(f'<path d="M{f(xx)} {f(y-s*0.4)} Q{f(xx+s*0.12)} {f(y)} {f(xx)} {f(y+s*0.28)}" fill="none" stroke="#b9805f" stroke-opacity=".55" stroke-width="1"/>')
    out.append(f'<path d="M{f(x+s*0.6)} {f(y-s*0.15)} q{f(s*0.25)} {f(s*0.05)} {f(s*0.32)} {f(s*0.12)}" fill="none" stroke="#fff" stroke-opacity=".7" stroke-width="1.4" stroke-linecap="round"/>')
    out.append("</g>")
    sc.add(layer, "".join(out))


def pebble(sc, layer, x, y, r, c):
    g = sc.rad([(0, "#fff", 0.9), (0.35, c, 1), (1, c, 1)], cx=0.35, cy=0.3, r=0.8)
    sc.add(layer, f'<ellipse cx="{f(x+1)}" cy="{f(y+r*0.4)}" rx="{f(r*1.05)}" ry="{f(r*0.35)}" fill="#a86d5c" fill-opacity=".28" filter="url(#blur2)"/><ellipse cx="{f(x)}" cy="{f(y)}" rx="{f(r)}" ry="{f(r*0.62)}" fill="{g}"/>')


def pearl(sc, layer, x, y, r):
    g = sc.rad([(0, "#ffffff", 1), (0.55, "#f3ebff", 1), (0.9, "#d6c3f0", 1), (1, "#f0c8bd", 1)], cx=0.36, cy=0.3, r=0.75)
    sc.add(layer, f'<ellipse cx="{f(x+1)}" cy="{f(y+r*0.85)}" rx="{f(r)}" ry="{f(r*0.3)}" fill="#a86d5c" fill-opacity=".3" filter="url(#blur2)"/><circle cx="{f(x)}" cy="{f(y)}" r="{f(r)}" fill="{g}"/><circle cx="{f(x-r*0.35)}" cy="{f(y-r*0.35)}" r="{f(r*0.22)}" fill="#fff"/>')


def bubbles(sc, n, ymax):
    for _ in range(n):
        x = sc.r.uniform(0, sc.w)
        y = sc.r.uniform(10, ymax)
        r = sc.r.uniform(1.5, 5)
        sc.add("fx", f'<circle cx="{f(x)}" cy="{f(y)}" r="{f(r)}" fill="#fff" fill-opacity=".12" stroke="#fff" stroke-opacity=".7" stroke-width=".8"/><circle cx="{f(x-r*0.35)}" cy="{f(y-r*0.35)}" r="{f(r*0.25)}" fill="#fff" fill-opacity=".9"/>')


def far_reef(sc, y, count, spread):
    for _ in range(count):
        x = sc.r.uniform(-40, sc.w + 40)
        if abs(x - sc.w / 2) < spread:
            continue
        out = []
        coral_branch(out, x, y, math.pi / 2 + sc.r.uniform(-0.2, 0.2), sc.r.uniform(40, 75), 7, 3, "#cdb6ee", "#e8dcfa", sc.r)
        sc.add("far", f'<g opacity=".55" filter="url(#blur2)">{"".join(out)}</g>')


# ───────────────────────── composições ─────────────────────────

def compose(w, h, mobile):
    sc = Scene(w, h, 11 if not mobile else 5)
    cx = w / 2
    top = h * (0.58 if not mobile else 0.6)
    rays(sc, [(cx - 380, 60), (cx - 120, 40), (cx + 90, 70), (cx + 360, 45)] if not mobile else [(cx - 150, 40), (cx + 30, 55)])
    far_reef(sc, top - 6, 26 if not mobile else 10, 150 if not mobile else 90)
    sand(sc, top)
    k = 1 if not mobile else 0.42

    def side(sx):
        bx = cx + sx * (470 if not mobile else 205)
        for i in range(4):
            kelp(sc, "weed", bx + sx * (60 + i * 26) * k + sc.r.uniform(-10, 10), top + 12, sc.r.uniform(150, 230), ["#8f74de", "#b898ec", "#dc7fab", "#a58ce9"][i], "#efe6ff")
        fan_coral(sc, "mid", bx + sx * 150 * k, top + 26, 95 if not mobile else 70, "#e893b9")
        coral(sc, "mid", bx, top + 40, 230 if not mobile else 170, "lilas" if sx < 0 else "rosa")
        coral(sc, "mid", bx + sx * 90 * k, top + 52, 170 if not mobile else 130, "pessego" if sx < 0 else "violeta")
        coral(sc, "mid", bx - sx * 95 * k, top + 48, 150 if not mobile else 110, "rosa" if sx < 0 else "lilas")
        brain_coral(sc, "front", bx - sx * 150 * k, top + 72, 46 if not mobile else 36, "#b394ea" if sx < 0 else "#ec9f84", "#efe5ff" if sx < 0 else "#ffe2d4")
        anemone(sc, "front", bx + sx * 40 * k, top + 80, 60 if not mobile else 46, "#f08fb7" if sx < 0 else "#9f82e4", "#fff0f6")

    side(-1)
    side(1)
    scallop_open(sc, "front", cx, top + 74, 128 if not mobile else 100)
    starfish(sc, "front", cx - 190 * k - (0 if not mobile else 30), top + 116, 40, 12, "#d9984c", "#f6cf8c")
    starfish(sc, "front", cx + 210 * k + (0 if not mobile else 30), top + 122, 32, -20, "#e17c6b", "#ffc2a8")
    if not mobile:
        starfish(sc, "front", cx - 560, top + 132, 30, 30, "#d9984c", "#f6cf8c")
        conch(sc, "front", cx + 560, top + 120, 26, -12)
    conch(sc, "front", cx + 128 * k + 20, top + 128, 20, 18)
    scallop_small(sc, "front", cx - 120 * k - 10, top + 132, 17, -15)
    scallop_small(sc, "front", cx + 300 * k, top + 140, 14, 20, "#f6d3e4", "#d79ab7")
    if not mobile:
        scallop_small(sc, "front", cx - 420, top + 140, 15, 10, "#e3d4fb", "#a78ad8")
    for i in range(30 if not mobile else 14):
        x = sc.r.uniform(30, w - 30)
        y = sc.r.uniform(top + 95, h - 10)
        if abs(x - cx) < 120:
            continue
        pebble(sc, "front", x, y, sc.r.uniform(3, 7), ["#d8c4ee", "#f0cfc0", "#e8b9c9", "#fbeee3"][i % 4])
    for x, y, r in [(cx + 70, top + 108, 6), (cx + 84, top + 114, 4), (cx - 64, top + 112, 5)] + ([(cx - 330, top + 130, 5), (cx + 410, top + 132, 6)] if not mobile else []):
        pearl(sc, "front", x, y, r)
    bubbles(sc, 40 if not mobile else 18, top + 40)
    return sc


OUT.mkdir(parents=True, exist_ok=True)
(OUT / "fundo-mar-pc.svg").write_text(compose(1440, 380, False).svg())
(OUT / "fundo-mar-cel.svg").write_text(compose(585, 500, True).svg())
print("ok")

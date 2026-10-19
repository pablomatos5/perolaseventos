// Concha característica do logotipo da Pérolas: valva de cima feita de linhas onduladas em leque, valva de baixo
// com nervuras e borda recortada, em dourado. Usada no carrossel da areia: chega fechada, abre pela dobradiça e a
// pérola com a foto da atração sobe ("os DJs saindo de dentro dela"). SVG + CSS: leve em qualquer aparelho.
import { useId } from "react";

const W = 400;
const H = 330;
const HX = 200; // dobradiça
const HY = 236;

const f = (n: number) => n.toFixed(1);

// linha ondulada em arco: raio r, da esquerda (200°) à direita (340°), com ondinhas
function wavyArc(r: number, waves: number, amp: number) {
  const a0 = (196 * Math.PI) / 180;
  const a1 = (344 * Math.PI) / 180;
  const n = 90;
  let d = "";
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const a = a0 + (a1 - a0) * t;
    const rr = r + amp * Math.sin(t * waves * Math.PI * 2);
    const x = HX + rr * Math.cos(a);
    const y = HY + rr * Math.sin(a) * 0.98;
    d += `${i ? "L" : "M"}${f(x)} ${f(y)}`;
  }
  return d;
}

const ARCS = [0, 1, 2, 3, 4, 5, 6, 7].map((k) => ({ d: wavyArc(46 + k * 21, 7 + k, 3.2 + k * 0.5), w: k === 7 ? 4 : 2.6 }));
// contorno de fora do leque (para o preenchimento)
const FAN = `${wavyArc(46 + 7 * 21, 14, 6.7)} L${HX} ${HY} Z`;

// valva de baixo: tigela com nervuras e borda inferior recortada
const BOWL_L = 92;
const BOWL_R = 308;
const BOWL_Y = HY + 4;
const BOWL = `M${BOWL_L} ${BOWL_Y} C${BOWL_L + 10} ${BOWL_Y + 70}, ${BOWL_R - 10} ${BOWL_Y + 70}, ${BOWL_R} ${BOWL_Y} Q${HX} ${BOWL_Y - 14} ${BOWL_L} ${BOWL_Y} Z`;
const RIBS = Array.from({ length: 11 }, (_, i) => {
  const t = (i + 1) / 12;
  const x = BOWL_L + (BOWL_R - BOWL_L) * t;
  const yb = BOWL_Y + 52 * Math.sin(Math.PI * t);
  return `M${f(HX + (x - HX) * 0.18)} ${BOWL_Y - 4}L${f(x)} ${f(yb)}`;
});

export function WavyShellPearl({ src }: { src: string }) {
  const id = useId();
  const gold = `${id}-gold`;
  const nacre = `${id}-nacre`;
  return (
    <span className="wavy-shell" style={{ aspectRatio: `${W} / ${H}` }}>
      <svg className="wavy-shell-top" viewBox={`0 0 ${W} ${H}`} aria-hidden>
        <defs>
          <linearGradient id={gold} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#fff0c8" />
            <stop offset="0.45" stopColor="#e2b45c" />
            <stop offset="0.7" stopColor="#f6d98e" />
            <stop offset="1" stopColor="#a8742a" />
          </linearGradient>
          <radialGradient id={nacre} cx="0.5" cy="0.95" r="0.9">
            <stop offset="0" stopColor="#fff8ec" stopOpacity="0.95" />
            <stop offset="0.6" stopColor="#f3e2f6" stopOpacity="0.55" />
            <stop offset="1" stopColor="#e9c9e6" stopOpacity="0.25" />
          </radialGradient>
        </defs>
        <path d={FAN} fill={`url(#${nacre})`} />
        {ARCS.map((a) => (
          <path key={a.d.slice(0, 20)} d={a.d} fill="none" stroke={`url(#${gold})`} strokeWidth={a.w} strokeLinecap="round" />
        ))}
      </svg>

      <span className="wavy-pearl">
        {/* eslint-disable-next-line @next/next/no-img-element -- foto da atração em /public */}
        <img src={src} alt="" loading="lazy" />
      </span>

      <svg className="wavy-shell-bottom" viewBox={`0 0 ${W} ${H}`} aria-hidden>
        <defs>
          <linearGradient id={`${gold}-b`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#fbe7b4" />
            <stop offset="0.55" stopColor="#d6a24a" />
            <stop offset="1" stopColor="#a8742a" />
          </linearGradient>
        </defs>
        <path d={BOWL} fill="rgb(255 244 228 / 0.92)" stroke={`url(#${gold}-b)`} strokeWidth="3.4" strokeLinejoin="round" />
        {RIBS.map((d) => (
          <path key={d} d={d} fill="none" stroke={`url(#${gold}-b)`} strokeWidth="2" strokeLinecap="round" opacity="0.85" />
        ))}
      </svg>
    </span>
  );
}

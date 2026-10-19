// Concha na areia com a foto da atração como pérola (carrossel da areia). Quando a maré recua ela está
// fechada (valva de cima deitada sobre a de baixo, lado de fora dourado), balança e abre: a pérola sobe.
// No estilo da concha oficial Pérolas (faixas onduladas em cima, leque com sulcos embaixo), como a versão 3D.
import { useId } from "react";

const W = 400;
const H = 310;
const HINGE = { x: 200, y: 232 };
const LIP_Y = 236;

const pt = (r: number, deg: number) => {
  const a = (deg * Math.PI) / 180;
  return { x: HINGE.x + r * Math.cos(a), y: HINGE.y + r * Math.sin(a) };
};
const f = (n: number) => n.toFixed(1);

// Valva de cima no estilo da concha oficial Pérolas: faixas onduladas concêntricas (como curvas de nível)
// separadas por vãos, abertas um pouco abaixo da linha da dobradiça nas pontas.
const START = 172;
const END = 368;
const R = 178;
const INNER = 56;
const BANDS = 7;
const LOBES = 5;
const wavy = (r: number, deg: number) => {
  const t = ((deg - START) / (END - START)) * 2 - 1; // -1..1 de ponta a ponta
  return r + 12 * Math.pow(r / R, 0.9) * Math.cos(LOBES * Math.PI * t);
};
const arc = (r: number, from: number, to: number) =>
  Array.from({ length: 61 }, (_, i) => {
    const deg = from + ((to - from) * i) / 60;
    const q = pt(wavy(r, deg), deg);
    return `${f(q.x)} ${f(q.y)}`;
  });
const bandStep = (R - INNER) / BANDS;
const bands = Array.from({ length: BANDS }, (_, k) => {
  const r0 = INNER + k * bandStep;
  const r1 = r0 + bandStep * 0.76; // o resto é vão
  const cut = (1 - k / (BANDS - 1)) * 6; // as de dentro terminam um pouco antes (pontas em degrau)
  const outerArc = arc(r1, START + cut, END - cut);
  const innerArc = arc(r0, END - cut, START + cut);
  return `M ${outerArc.join(" L ")} L ${innerArc.join(" L ")} Z`;
});

// Valva de baixo no estilo da logo: leque em lente (lábio arqueado) com sulcos que irradiam do fundo.
const LIP_L = 40;
const LIP_R = 360;
const APEX = { x: 200, y: LIP_Y + 54 };
const bowl = `M ${LIP_L} ${LIP_Y - 6} Q 200 ${LIP_Y + 22} ${LIP_R} ${LIP_Y - 6} C ${LIP_R - 30} ${LIP_Y + 40}, 250 ${APEX.y}, 200 ${APEX.y} C 150 ${APEX.y}, ${LIP_L + 30} ${LIP_Y + 40}, ${LIP_L} ${LIP_Y - 6} Z`;
const grooves = Array.from({ length: 13 }, (_, i) => {
  const t = (i + 1) / 14;
  const x = LIP_L + (LIP_R - LIP_L) * t;
  const y = LIP_Y - 6 + 28 * 4 * t * (1 - t) * 0.92; // segue o lábio
  const e = { x: APEX.x + (x - APEX.x) * 0.12, y: APEX.y - 6 };
  return `M ${f(x)} ${f(y + 3)} L ${f(e.x)} ${f(e.y)}`;
});

export function ShellPearl({ src }: { src: string }) {
  const id = useId();
  const ink = `${id}-ink`;
  const nacre = `${id}-nacre`;
  const outer = `${id}-outer`;
  const line = { stroke: `url(#${ink})`, fill: "none", strokeLinecap: "round", strokeLinejoin: "round" } as const;

  return (
    <span className="sand-shell" style={{ aspectRatio: `${W} / ${H}` }}>
      <svg className="sand-shell-back" viewBox={`0 0 ${W} ${H}`} aria-hidden>
        <defs>
          <linearGradient id={ink} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#a8783f" />
            <stop offset="0.5" stopColor="#e2b874" />
            <stop offset="1" stopColor="#8a5a2b" />
          </linearGradient>
          <radialGradient id={nacre} cx="0.5" cy="0.82" r="0.8">
            <stop offset="0" stopColor="#fff4e2" />
            <stop offset="0.5" stopColor="#f6d9b0" />
            <stop offset="1" stopColor="#e6b27c" />
          </radialGradient>
          <linearGradient id={outer} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#f8e1bd" />
            <stop offset="1" stopColor="#dca46e" />
          </linearGradient>
        </defs>
        {bands.map((d) => (
          <path key={d} d={d} fill={`url(#${nacre})`} stroke={`url(#${ink})`} strokeWidth={1.4} strokeLinejoin="round" />
        ))}
      </svg>

      {/* lado de fora da MESMA valva de cima: gira junto com ela e só aparece enquanto está deitada
          (concha fechada, vista de cima). Mesma geometria, virada de costas (rotateY 180°). */}
      <svg className="sand-shell-lid" viewBox={`0 0 ${W} ${H}`} aria-hidden>
        {bands.map((d) => (
          <path key={d} d={d} fill={`url(#${outer})`} stroke={`url(#${ink})`} strokeWidth={1.4} strokeLinejoin="round" />
        ))}
      </svg>

      <span className="sand-pearl">
        {/* eslint-disable-next-line @next/next/no-img-element -- foto em /public, já otimizada */}
        <img src={src} alt="" loading="lazy" />
      </span>

      <svg className="sand-shell-front" viewBox={`0 0 ${W} ${H}`} aria-hidden>
        <path d={bowl} fill={`url(#${outer})`} stroke={`url(#${ink})`} strokeWidth={3} strokeLinejoin="round" />
        {grooves.map((d) => (
          <path key={d} d={d} {...line} strokeWidth={1.6} strokeOpacity={0.55} />
        ))}
      </svg>
    </span>
  );
}

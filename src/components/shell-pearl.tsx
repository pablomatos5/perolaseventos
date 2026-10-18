// Concha na areia com a foto da atração como pérola (carrossel da areia). Quando a maré recua ela está
// fechada (valva de cima deitada sobre a de baixo, lado de fora dourado), balança e abre: a pérola sobe.
// Mesma linguagem da concha do hero (gomos + nervuras), mas preenchida para ler bem sobre a areia.
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

const LOBES = 9;
const START = 194;
const END = 346;
const step = (END - START) / LOBES;
const R = 178;

function scallop(r: number, bulge = 1.08) {
  const first = pt(r, START);
  let d = `M ${f(first.x)} ${f(first.y)}`;
  for (let i = 0; i < LOBES; i++) {
    const c = pt(r * bulge, START + (i + 0.5) * step);
    const e = pt(r, START + (i + 1) * step);
    d += ` Q ${f(c.x)} ${f(c.y)} ${f(e.x)} ${f(e.y)}`;
  }
  return d;
}

// Valva de cima (o leque atrás da pérola), fechada até a dobradiça.
const fan = (() => {
  const d = scallop(R);
  const a = pt(R, START);
  return `M ${HINGE.x} ${HINGE.y} L ${f(a.x)} ${f(a.y)} ${d.slice(d.indexOf("Q"))} Z`;
})();
const rings = [0.78, 0.58].map((k) => scallop(R * k, 1.07));
const ribs = Array.from({ length: LOBES - 1 }, (_, i) => {
  const deg = START + (i + 1) * step;
  const a = pt(30, deg);
  const c = pt(R * 0.55, deg + 2.5);
  const b = pt(R * 0.97, deg);
  return `M ${f(a.x)} ${f(a.y)} Q ${f(c.x)} ${f(c.y)} ${f(b.x)} ${f(b.y)}`;
});

// Valva de baixo (a "tigela" na frente da pérola): lábio ondulado + fundo arredondado.
const LIP_XS = Array.from({ length: 9 }, (_, i) => 46 + i * 38.5);
const lip = LIP_XS.slice(1).reduce(
  (d, x, i) => `${d} Q ${f((LIP_XS[i] + x) / 2)} ${i % 2 ? LIP_Y + 9 : LIP_Y - 9} ${f(x)} ${LIP_Y}`,
  `M ${LIP_XS[0]} ${LIP_Y}`,
);
const last = LIP_XS[LIP_XS.length - 1];
const bowl = `${lip} C ${f(last - 18)} ${LIP_Y + 78}, ${f(LIP_XS[0] + 18)} ${LIP_Y + 78}, ${LIP_XS[0]} ${LIP_Y} Z`;
const bowlLines = [0.72, 0.46].map((k) => {
  const half = 150 * k;
  const depth = 66 * k;
  return `M ${f(200 - half)} ${LIP_Y + 6} C ${f(200 - half * 0.9)} ${f(LIP_Y + 6 + depth)}, ${f(200 + half * 0.9)} ${f(LIP_Y + 6 + depth)}, ${f(200 + half)} ${LIP_Y + 6}`;
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
            <stop offset="0" stopColor="#fffaf2" />
            <stop offset="0.45" stopColor="#f6e6f3" />
            <stop offset="0.8" stopColor="#e7d3ee" />
            <stop offset="1" stopColor="#d9bfa0" />
          </radialGradient>
          <linearGradient id={outer} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#f8ead6" />
            <stop offset="1" stopColor="#d6b07a" />
          </linearGradient>
        </defs>
        <path d={fan} fill={`url(#${nacre})`} stroke={`url(#${ink})`} strokeWidth={3} strokeLinejoin="round" />
        {rings.map((d) => (
          <path key={d} d={d} {...line} strokeWidth={1.6} strokeOpacity={0.55} />
        ))}
        {ribs.map((d) => (
          <path key={d} d={d} {...line} strokeWidth={1.4} strokeOpacity={0.45} />
        ))}
        {/* lado de fora da valva: aparece com a concha fechada e some enquanto ela abre */}
        <g className="sand-shell-lid">
          <path d={fan} fill={`url(#${outer})`} stroke={`url(#${ink})`} strokeWidth={3} strokeLinejoin="round" />
          {ribs.map((d) => (
            <path key={d} d={d} {...line} strokeWidth={2.2} strokeOpacity={0.7} />
          ))}
        </g>
      </svg>

      <span className="sand-pearl">
        {/* eslint-disable-next-line @next/next/no-img-element -- foto em /public, já otimizada */}
        <img src={src} alt="" loading="lazy" />
      </span>

      <svg className="sand-shell-front" viewBox={`0 0 ${W} ${H}`} aria-hidden>
        <path d={bowl} fill={`url(#${outer})`} stroke={`url(#${ink})`} strokeWidth={3} strokeLinejoin="round" />
        {bowlLines.map((d) => (
          <path key={d} d={d} {...line} strokeWidth={1.5} strokeOpacity={0.5} />
        ))}
      </svg>
    </span>
  );
}

// Concha na areia com a foto da atração como pérola (carrossel da areia). Quando a maré recua ela está
// fechada (valva de cima deitada sobre a de baixo, lado de fora dourado), balança e abre: a pérola sobe.
// No estilo da concha oficial Pérolas (faixas onduladas em cima, leque com sulcos embaixo), como a versão 3D.
import { useId } from "react";

const W = 400;
const H = 310;
const HINGE = { x: 200, y: 232 };

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
// corpo único atrás das faixas (os vãos viram sulcos de UMA concha, não várias conchas empilhadas)
const body = (() => {
  const rOut = INNER + (BANDS - 1) * bandStep + bandStep * 0.76;
  return `M ${arc(rOut, START, END).join(" L ")} L ${arc(INNER, END, START).join(" L ")} Z`;
})();

// Valva de baixo: as mesmas faixas onduladas da de cima (as duas metades casam), vista de cima e achatada
// em perspectiva, abrindo para a frente a partir da dobradiça.
const B_START = 8;
const B_END = 172;
const SQ = 0.42; // achatamento (tigela vista de cima)
const arcB = (r: number, from: number, to: number) =>
  Array.from({ length: 61 }, (_, i) => {
    const deg = from + ((to - from) * i) / 60;
    const t = ((deg - B_START) / (B_END - B_START)) * 2 - 1;
    const rr = r + 12 * Math.pow(r / R, 0.9) * Math.cos(LOBES * Math.PI * t);
    const a = (deg * Math.PI) / 180;
    return `${f(HINGE.x + rr * Math.cos(a))} ${f(HINGE.y + rr * Math.sin(a) * SQ)}`;
  });
const bottomBody = (() => {
  const rOut = INNER + (BANDS - 1) * bandStep + bandStep * 0.76;
  return `M ${arcB(rOut, B_START, B_END).join(" L ")} L ${HINGE.x} ${HINGE.y} Z`;
})();
// só o aro ondulado (a faixa de fora): a de baixo é a base da MESMA concha, não uma segunda concha
const bottomBands = [BANDS - 1].map((k) => {
  const r0 = INNER + k * bandStep;
  const r1 = r0 + bandStep * 0.76;
  const cut = (1 - k / (BANDS - 1)) * 6;
  return `M ${arcB(r1, B_START + cut, B_END - cut).join(" L ")} L ${arcB(r0, B_END - cut, B_START + cut).join(" L ")} Z`;
});
// raios finos no fundo da tigela (os sulcos da logo), da dobradiça até o aro
const bottomRays = Array.from({ length: 13 }, (_, i) => {
  const deg = B_START + 14 + ((B_END - B_START - 28) * i) / 12;
  const a = (deg * Math.PI) / 180;
  const r1 = INNER + (BANDS - 1) * bandStep - 2;
  return `M ${f(HINGE.x + 14 * Math.cos(a))} ${f(HINGE.y + 14 * Math.sin(a) * SQ)} L ${f(HINGE.x + r1 * Math.cos(a))} ${f(HINGE.y + r1 * Math.sin(a) * SQ)}`;
});

export function ShellPearl({ src }: { src: string }) {
  const id = useId();
  const ink = `${id}-ink`;
  const nacre = `${id}-nacre`;
  const outer = `${id}-outer`;

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
        <path d={body} fill="#c98e68" stroke={`url(#${ink})`} strokeWidth={2.2} strokeLinejoin="round" />
        {bands.map((d) => (
          <path key={d} d={d} fill={`url(#${nacre})`} stroke={`url(#${ink})`} strokeWidth={1.4} strokeLinejoin="round" />
        ))}
      </svg>

      {/* lado de fora da MESMA valva de cima: gira junto com ela e só aparece enquanto está deitada
          (concha fechada, vista de cima). Mesma geometria, virada de costas (rotateY 180°). */}
      <svg className="sand-shell-lid" viewBox={`0 0 ${W} ${H}`} aria-hidden>
        <path d={body} fill="#c98e68" stroke={`url(#${ink})`} strokeWidth={2.2} strokeLinejoin="round" />
        {bands.map((d) => (
          <path key={d} d={d} fill={`url(#${outer})`} stroke={`url(#${ink})`} strokeWidth={1.4} strokeLinejoin="round" />
        ))}
      </svg>

      <span className="sand-pearl">
        {/* eslint-disable-next-line @next/next/no-img-element -- foto em /public, já otimizada */}
        <img src={src} alt="" loading="lazy" />
      </span>

      <svg className="sand-shell-front" viewBox={`0 0 ${W} ${H}`} aria-hidden>
        <path d={bottomBody} fill="#c98e68" stroke={`url(#${ink})`} strokeWidth={2.2} strokeLinejoin="round" />
        {bottomRays.map((d) => (
          <path key={d} d={d} stroke="#f3d3a6" strokeWidth={2.4} strokeLinecap="round" fill="none" />
        ))}
        {bottomBands.map((d) => (
          <path key={d} d={d} fill={`url(#${outer})`} stroke={`url(#${ink})`} strokeWidth={1.2} strokeLinejoin="round" />
        ))}
      </svg>
    </span>
  );
}

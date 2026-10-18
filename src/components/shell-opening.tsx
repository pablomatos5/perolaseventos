// Concha em linhas douradas finas (estilo do logo 2027) que se desenha ao abrir a página.
// Só SVG + CSS (stroke-dashoffset/opacity). A queda da pérola ao rolar fica em pearl-drop.tsx.

const W = 400;
const H = 320;
const HINGE = { x: 200, y: 214 };

const pt = (r: number, deg: number) => {
  const a = (deg * Math.PI) / 180;
  return { x: HINGE.x + r * Math.cos(a), y: HINGE.y + r * Math.sin(a) };
};
const f = (n: number) => n.toFixed(1);

const LOBES = 9;
const START = 196;
const END = 344;
const step = (END - START) / LOBES;

/** Borda recortada em gomos num raio R (aberta, só o contorno de cima). */
function scallop(R: number, bulge = 1.09) {
  const first = pt(R, START);
  let d = `M ${f(first.x)} ${f(first.y)}`;
  for (let i = 0; i < LOBES; i++) {
    const c = pt(R * bulge, START + (i + 0.5) * step);
    const e = pt(R, START + (i + 1) * step);
    d += ` Q ${f(c.x)} ${f(c.y)} ${f(e.x)} ${f(e.y)}`;
  }
  return d;
}

const R = 170;
// Contornos concêntricos, como as "ondas" do logo; o de fora fecha até a dobradiça.
const rings = [1, 0.8, 0.61, 0.43].map((k, i) => {
  const d = scallop(R * k, 1.09 - i * 0.01);
  if (i > 0) return d;
  const a = pt(R, START);
  return `M ${HINGE.x} ${HINGE.y} L ${f(a.x)} ${f(a.y)} ${d.slice(d.indexOf("Q"))} L ${HINGE.x} ${HINGE.y}`;
});

// Nervuras levemente curvas saindo da dobradiça até os vales entre os gomos.
const ribs = Array.from({ length: LOBES - 1 }, (_, i) => {
  const deg = START + (i + 1) * step;
  const a = pt(24, deg);
  const c = pt(R * 0.55, deg + 2.5);
  const b = pt(R * 0.97, deg);
  return `M ${f(a.x)} ${f(a.y)} Q ${f(c.x)} ${f(c.y)} ${f(b.x)} ${f(b.y)}`;
});

// Base: lábio ondulado + curvas aninhadas em forma de concha.
const lip = (() => {
  const xs = Array.from({ length: 9 }, (_, i) => 52 + i * 37);
  let d = `M ${xs[0]} 216`;
  for (let i = 0; i < xs.length - 1; i++) d += ` Q ${f((xs[i] + xs[i + 1]) / 2)} ${i % 2 ? 224 : 207} ${xs[i + 1]} 216`;
  return d;
})();
const bowl = [1, 0.74, 0.5].map((k) => {
  const half = 148 * k;
  const depth = 82 * k;
  return `M ${f(200 - half)} 216 C ${f(200 - half * 0.9)} ${f(216 + depth)}, ${f(200 + half * 0.9)} ${f(216 + depth)}, ${f(200 + half)} 216`;
});

const DrawPath = ({ d, delay, w = 1.4, o = 1 }: { d: string; delay: number; w?: number; o?: number }) => (
  <path d={d} pathLength={1} className="draw" style={{ "--d": `${delay}s` } as React.CSSProperties} stroke="url(#gold)" strokeWidth={w} strokeOpacity={o} fill="none" strokeLinecap="round" strokeLinejoin="round" />
);

export function ShellOpening({ className = "" }: { className?: string }) {
  return (
    <div className={`shell-stage ${className}`} style={{ aspectRatio: `${W} / ${H}` }} aria-hidden>
      <div className="shell-halo" />

      <svg className="shell-svg" viewBox={`0 0 ${W} ${H}`}>
        <defs>
          <linearGradient id="gold" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="var(--accent-2)" />
            <stop offset="0.5" stopColor="#fff6e6" />
            <stop offset="1" stopColor="var(--accent)" />
          </linearGradient>
          <radialGradient id="veil" cx="0.5" cy="1" r="0.9">
            <stop offset="0" stopColor="#ffffff" stopOpacity="0.16" />
            <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
          </radialGradient>
        </defs>
        <path d={rings[0]} fill="url(#veil)" className="veil" />
        {rings.map((d, i) => (
          <DrawPath key={`r${i}`} d={d} delay={0.15 + i * 0.18} w={i === 0 ? 1.8 : 1.2} o={1 - i * 0.18} />
        ))}
        {ribs.map((d, i) => (
          <DrawPath key={`b${i}`} d={d} delay={0.5 + i * 0.05} w={0.9} o={0.55} />
        ))}
      </svg>

      <div className="shell-pearl" data-pearl>
        <div className="pearl w-full" />
      </div>

      <svg className="shell-svg shell-front" viewBox={`0 0 ${W} ${H}`}>
        {bowl.map((d, i) => (
          <DrawPath key={`w${i}`} d={d} delay={0.35 + i * 0.15} w={i === 0 ? 1.8 : 1.1} o={1 - i * 0.25} />
        ))}
        <DrawPath d={lip} delay={0.3} w={1.6} />
      </svg>
    </div>
  );
}

// Brilhos fixos (posições determinísticas para não divergir entre servidor e cliente).
const SPARKS = [
  [8, 18, 0], [22, 9, 1.2], [35, 24, 2.4], [64, 12, 0.6], [78, 22, 1.8], [91, 10, 3],
  [14, 42, 2.1], [86, 40, 0.9], [5, 66, 1.5], [95, 62, 2.7], [28, 54, 3.3], [72, 50, 0.3],
] as const;

export function Sparkles() {
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden>
      {SPARKS.map(([x, y, delay]) => (
        <span key={`${x}-${y}`} className="spark" style={{ left: `${x}%`, top: `${y}%`, animationDelay: `${delay}s` }} />
      ))}
    </div>
  );
}

/** Ondas preenchidas que deslizam devagar na base do hero. */
export function OceanWaves() {
  const wave = (amp: number, y: number) => {
    let d = `M 0 ${y}`;
    for (let x = 0; x < 2880; x += 720) {
      d += ` C ${x + 180} ${y - amp}, ${x + 360} ${y + amp}, ${x + 540} ${y} S ${x + 720 - 40} ${y - amp / 2}, ${x + 720} ${y}`;
    }
    return `${d} V 200 H 0 Z`;
  };
  return (
    <div className="ocean-waves" aria-hidden>
      <svg viewBox="0 0 2880 200" preserveAspectRatio="none" className="wave-layer wave-back">
        <path d={wave(28, 70)} fill="var(--sea)" fillOpacity=".35" />
      </svg>
      <svg viewBox="0 0 2880 200" preserveAspectRatio="none" className="wave-layer wave-mid">
        <path d={wave(22, 100)} fill="var(--sea)" fillOpacity=".7" stroke="var(--accent)" strokeOpacity=".35" strokeWidth="2" />
      </svg>
      <svg viewBox="0 0 2880 200" preserveAspectRatio="none" className="wave-layer wave-front">
        <path d={wave(16, 135)} fill="var(--sea)" />
      </svg>
    </div>
  );
}

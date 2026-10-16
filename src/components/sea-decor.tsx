// Elementos do fundo do mar da identidade 2027 (conchas, estrelas-do-mar, corais, bolhas e as sereias das
// artes oficiais), desenhados em traço dourado fino para todos terem o mesmo estilo. Sem JS: só SVG e CSS
// (estilos em globals.css, seção "Fundo do mar").

/** Concha vieira: leque com nervuras saindo da base, orelhinhas embaixo. */
export function Scallop({ className = "" }: { className?: string }) {
  const ribs = [-62, -44, -26, -9, 9, 26, 44, 62];
  return (
    <svg viewBox="0 0 64 64" className={className} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M32 52C18 51 8 41 8.5 28.5 9 17 19 9 32 9s23 8 23.5 19.5C56 41 46 51 32 52Z" />
      <path d="M25 51.5l-2 5.5h18l-2-5.5" />
      {ribs.map((deg) => {
        const r = (deg * Math.PI) / 180;
        return <path key={deg} d={`M32 51L${(32 + Math.sin(r) * 23).toFixed(1)} ${(51 - Math.cos(r) * 40).toFixed(1)}`} opacity="0.75" />;
      })}
    </svg>
  );
}

// Estrela-do-mar: 5 braços arredondados (pontos calculados uma vez) e a textura de pontinhos no meio de cada braço.
const STAR = (() => {
  const pts: string[] = [];
  for (let k = 0; k < 10; k++) {
    const a = ((-90 + k * 36) * Math.PI) / 180;
    const r = k % 2 === 0 ? 27 : 11;
    pts.push(`${(32 + Math.cos(a) * r).toFixed(1)} ${(34 + Math.sin(a) * r).toFixed(1)}`);
  }
  const dots: [number, number][] = [];
  for (let k = 0; k < 5; k++) {
    const a = ((-90 + k * 72) * Math.PI) / 180;
    for (const r of [9, 15, 20]) dots.push([32 + Math.cos(a) * r, 34 + Math.sin(a) * r]);
  }
  return { d: `M${pts.join("L")}Z`, dots };
})();

export function Starfish({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" aria-hidden>
      <path d={STAR.d} strokeWidth="3.2" opacity="0.18" />
      <path d={STAR.d} />
      {STAR.dots.map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x.toFixed(1)} cy={y.toFixed(1)} r="1.1" fill="currentColor" stroke="none" />
      ))}
    </svg>
  );
}

/** Coral ramificado. */
export function Coral({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden>
      <path d="M32 62V40M32 46c-6-4-8-12-6-20M26 34c-6-2-8-8-8-14M32 40c6-4 8-12 6-20M38 30c6-2 8-8 8-14M26 26c0-4 2-8 4-10M38 20c0-4-2-7-4-9M18 20c-1-3 0-6 2-8M46 16c1-3 0-5-2-7" />
    </svg>
  );
}

/** Pérola pequena (para os grupinhos espalhados). */
function Pearlet({ className = "" }: { className?: string }) {
  return <span className={`sea-pearlet ${className}`} aria-hidden />;
}

type OrnamentKind = "scallop" | "starfish" | "coral" | "pearls";
const ORNAMENTS = { scallop: Scallop, starfish: Starfish, coral: Coral } as const;

/**
 * Enfeites soltos nas laterais de uma seção (a seção precisa de position: relative).
 * `at` posiciona com classes utilitárias (ex.: "-left-10 top-12"); no celular só os marcados `mobile` aparecem.
 */
export function SeaDecor({ items }: { items: { kind: OrnamentKind; at: string; size?: string; rotate?: number; delay?: number; mobile?: boolean }[] }) {
  return (
    <>
      {items.map((it, i) => {
        const style = { "--rot": `${it.rotate ?? 0}deg`, animationDelay: `${it.delay ?? i * -1.7}s` } as React.CSSProperties;
        const cls = `sea-ornament ${it.mobile ? "" : "max-md:hidden"} ${it.at} ${it.size ?? "size-16"}`;
        if (it.kind === "pearls") {
          return (
            <span key={i} className={cls} style={style} aria-hidden>
              <Pearlet className="left-[10%] top-[30%] size-[38%]" />
              <Pearlet className="left-[52%] top-[12%] size-[26%]" />
              <Pearlet className="left-[48%] top-[56%] size-[20%]" />
            </span>
          );
        }
        const Icon = ORNAMENTS[it.kind];
        return <Icon key={i} className={cls} />;
      })}
    </>
  );
}

// Bolhas subindo devagar (só transform/opacity animados). [x%, tamanho px, duração s, atraso s]
const BUBBLES = [
  [6, 10, 11, 0], [14, 6, 9, 3.5], [23, 14, 14, 6], [37, 7, 10, 1.6], [48, 9, 12, 8], [61, 5, 9, 4.4],
  [70, 12, 13, 2.2], [79, 7, 10, 7.1], [88, 10, 12, 0.9], [95, 6, 9, 5.3],
] as const;

export function Bubbles({ className = "" }: { className?: string }) {
  return (
    <div className={`sea-bubbles ${className}`} aria-hidden>
      {BUBBLES.map(([x, s, d, delay]) => (
        <i key={x} style={{ left: `${x}%`, "--b": `${s}px`, animationDuration: `${d}s`, animationDelay: `${-delay}s` } as React.CSSProperties} />
      ))}
    </div>
  );
}

/** Sereia das artes oficiais aparecendo pela lateral da seção (esfumado já gravado no webp). */
export function SideMermaid({ side }: { side: "left" | "right" }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- recorte da arte oficial em /public/2027
    <img src={side === "left" ? "/2027/sereia-esq.webp" : "/2027/sereia-dir.webp"} alt="" loading="lazy" className={`side-mermaid is-${side}`} />
  );
}

/**
 * Fim da página no fundo do mar: areia, algas e corais lilás, estrela-do-mar, concha aberta com a pérola
 * e a sereia da arte "Save the date" sentada na areia. O conteúdo do rodapé fica por cima.
 */
export function Seabed() {
  return (
    <div className="seabed" aria-hidden>
      <Bubbles />
      <SideMermaid side="left" />
      <svg viewBox="0 0 1440 300" preserveAspectRatio="xMidYMax slice" className="seabed-art">
        <defs>
          <linearGradient id="seabed-sand" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#f6dfd2" />
            <stop offset="1" stopColor="#eccabd" />
          </linearGradient>
          <radialGradient id="seabed-pearl" cx="0.35" cy="0.3" r="0.75">
            <stop offset="0" stopColor="#fff" />
            <stop offset="0.55" stopColor="#efe5ff" />
            <stop offset="1" stopColor="#b9a3e6" />
          </radialGradient>
          <linearGradient id="seabed-gold" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#f3d9a8" />
            <stop offset="1" stopColor="#b98444" />
          </linearGradient>
        </defs>
        {/* algas balançando (lilás e rosa) */}
        <g className="seabed-weed" fill="none" strokeLinecap="round" strokeWidth="7">
          <path d="M1060 300c-14-40 18-70 0-110s14-60 6-96" stroke="#c9b4f2" />
          <path d="M1092 300c10-36-16-62 2-98s-8-52 4-80" stroke="#f3b9d2" />
          <path d="M318 300c-12-34 16-58 0-92s10-48 2-74" stroke="#f3b9d2" />
          <path d="M1330 300c-10-30 14-52 0-84s8-44 0-66" stroke="#c9b4f2" />
        </g>
        {/* corais */}
        <g fill="none" strokeLinecap="round" strokeWidth="9" stroke="#b9a3e6" opacity="0.9">
          <path d="M1210 300v-70m0 22c-18-10-24-34-18-58m18 36c18-12 22-34 16-56m-34 22c-14-4-20-18-20-32m54 6c14-6 18-18 16-32" />
        </g>
        <g fill="none" strokeLinecap="round" strokeWidth="7" stroke="#f3b9d2" opacity="0.9">
          <path d="M420 300v-52m0 16c-14-8-18-26-14-44m14 28c14-8 18-26 12-42" />
        </g>
        {/* areia */}
        <path d="M0 230C180 200 340 246 540 226S900 196 1080 222 1320 214 1440 200V300H0Z" fill="url(#seabed-sand)" />
        <path d="M0 230C180 200 340 246 540 226S900 196 1080 222 1320 214 1440 200" fill="none" stroke="#fff" strokeOpacity="0.6" strokeWidth="2" />
        {/* concha aberta com a pérola, no centro */}
        <g transform="translate(720 236)">
          <path d="M-58 0C-60-40-30-70 0-72S60-40 58 0" fill="#fbf3ff" stroke="url(#seabed-gold)" strokeWidth="2.5" />
          {[-48, -32, -16, 0, 16, 32, 48].map((x) => (
            <path key={x} d={`M0 -2L${x} -66`} stroke="url(#seabed-gold)" strokeWidth="1.2" opacity="0.6" />
          ))}
          <path d="M-62 0C-50 22 50 22 62 0Z" fill="#f6e7d4" stroke="url(#seabed-gold)" strokeWidth="2.5" />
          <circle cx="0" cy="-6" r="17" fill="url(#seabed-pearl)" className="seabed-pearl" />
        </g>
        {/* estrelas-do-mar douradas na areia */}
        <g transform="translate(560 262) rotate(-14)">
          <path d={STAR.d} transform="translate(-32 -34) scale(1.1)" fill="url(#seabed-gold)" stroke="#a26f32" strokeWidth="1.2" strokeLinejoin="round" />
        </g>
        <g transform="translate(910 268) rotate(18) scale(0.7)">
          <path d={STAR.d} transform="translate(-32 -34)" fill="url(#seabed-gold)" stroke="#a26f32" strokeWidth="1.4" strokeLinejoin="round" />
        </g>
        {/* conchinhas e pérolas soltas */}
        <g transform="translate(1000 262) rotate(-8) scale(0.55)" fill="#fbf3ff" stroke="#b98444" strokeWidth="2.6">
          <path d="M0 20C-14 19-24 9-23.5-3.5-23-15-13-23 0-23s23 8 23.5 19.5C24 9 14 19 0 20Z" />
        </g>
        <circle cx="642" cy="276" r="6" fill="url(#seabed-pearl)" />
        <circle cx="796" cy="280" r="4.5" fill="url(#seabed-pearl)" />
        <circle cx="1140" cy="270" r="5" fill="url(#seabed-pearl)" />
      </svg>
    </div>
  );
}

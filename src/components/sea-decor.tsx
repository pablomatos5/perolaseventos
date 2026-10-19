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
    <img src={side === "left" ? "/2027/sereia-se-areia.webp" : "/2027/sereia-sd-areia.webp"} alt="" loading="lazy" className={`side-mermaid is-${side}`} />
  );
}

/**
 * Fim da página no fundo do mar: ilustração 2D detalhada (corais, algas, anêmonas, estrelas-do-mar,
 * conchas, luz na areia e a pérola na concha aberta) gerada por scripts/fundo-mar/ilustracao.py e servida
 * como imagem webp leve — custo zero no celular. Bolhas por cima dão vida. O rodapé fica por cima.
 */
export function Seabed() {
  return (
    <div className="seabed" aria-hidden>
      <Bubbles />
      <picture>
        <source media="(max-width: 767px)" srcSet="/2027/fundo-mar-cel.webp" width={1170} height={1000} />
        <img src="/2027/fundo-mar-pc.webp" alt="" width={2880} height={760} loading="lazy" decoding="async" className="seabed-scene" />
      </picture>
    </div>
  );
}

/** Assinatura do time de desenvolvimento (Koraki): marcada na areia do rodapé, discreta, no tom da areia. */
export function KorakiMark() {
  return (
    <span className="koraki-mark">
      <span>feito por</span>
      <svg viewBox="0 0 152 152" aria-hidden>
        <rect width="152" height="152" rx="18" fill="currentColor" />
        <path d="M0 76H66L152 34M66 76L152 118M66 76H152" stroke="var(--koraki-cut)" strokeWidth="13" fill="none" strokeLinejoin="round" />
      </svg>
      <b>koraki</b>
    </span>
  );
}

// conchas e pérolas espalhadas pela areia da seção de ingressos: [x%, y%, tamanho rem, giro, tipo]
const TREASURES = [
  [4, 14, 2.6, -18, "s"], [93, 9, 2.2, 22, "s"], [8, 62, 1.9, 12, "s"], [91, 55, 2.8, -10, "s"], [48, 94, 2, 28, "s"],
  [12, 30, 0.9, 0, "p"], [14, 32.5, 0.55, 0, "p"], [86, 34, 0.8, 0, "p"], [6, 84, 0.75, 0, "p"], [95, 80, 1, 0, "p"],
  [30, 97, 0.6, 0, "p"], [70, 96, 0.85, 0, "p"], [2, 45, 0.6, 0, "p"],
] as const;

/** Conchinhas douradas e pérolas na areia (seção de ingressos). Decorativas, paradas: custo zero. */
export function SandTreasures() {
  return (
    <div className="sand-treasures" aria-hidden>
      {TREASURES.map(([x, y, size, rot, kind]) =>
        kind === "s" ? (
          <span key={`${x}-${y}`} className="sand-shell-wrap" style={{ left: `${x}%`, top: `${y}%`, width: `${size}rem`, rotate: `${rot}deg` }}>
            <Scallop />
          </span>
        ) : (
          <span key={`${x}-${y}`} className="sand-pearl-deco" style={{ left: `${x}%`, top: `${y}%`, width: `${size}rem` }} />
        ),
      )}
    </div>
  );
}

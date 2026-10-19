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

/** Sereia das artes oficiais aparecendo pela lateral da seção (esfumado já gravado no webp).
 *  No celular (400 px) a da esquerda vem com o esfumado redondo gravado (sereia-se-areia-cel.webp): sem máscara no CSS. */
export function SideMermaid({ side }: { side: "left" | "right" }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- recorte da arte oficial em /public/2027
    <img src={`/2027/sereia-${side === "left" ? "se" : "sd"}-areia.webp`} srcSet={`/2027/sereia-${side === "left" ? "se-areia-cel" : "sd-areia-400"}.webp 400w, /2027/sereia-${side === "left" ? "se" : "sd"}-areia.webp 600w`} sizes="(max-width: 1023px) 8rem, 26rem" alt="" width={600} height={1254} loading="lazy" decoding="async" className={`side-mermaid is-${side}`} />
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

// enfeites na areia da seção de ingressos, nos espaços livres (fora dos cards e das sereias):
// [x%, y%, tamanho rem, giro, tipo, aparece no celular?] — s concha, p pérola, e estrela-do-mar, c caranguejo
const TREASURES = [
  [26, 58, 3.6, -16, "e", false], [42, 74, 3.8, 14, "c", false], [31, 84, 3, 12, "s", false],
  [22.5, 68, 1.1, 0, "p", false], [25, 70.5, 0.7, 0, "p", false], [47, 63, 0.8, 0, "p", false],
  [64, 9, 2.8, 24, "s", false], [76, 7, 2.5, -28, "e", false],
  [55, 88, 3.2, -8, "e", true], [86, 86, 3.4, 12, "c", true], [12, 86, 3, 30, "s", true],
  [8, 89, 1, 0, "p", true], [93, 80, 1.1, 0, "p", true], [60, 84, 0.75, 0, "p", false],
  [92, 10, 2.6, -20, "s", false], [6, 9, 2.3, 18, "e", false],
] as const;

/** Estrela-do-mar coral com pontinhos em relevo. */
export function SandStarfish() {
  let d = "";
  for (let i = 0; i < 5; i++) {
    const a = i * 72;
    const r = (x: number) => (x * Math.PI) / 180;
    const tip = [50 + 46 * Math.sin(r(a)), 52 - 46 * Math.cos(r(a))];
    const before = [50 + 15 * Math.sin(r(a - 36)), 52 - 15 * Math.cos(r(a - 36))];
    const after = [50 + 15 * Math.sin(r(a + 36)), 52 - 15 * Math.cos(r(a + 36))];
    d += `${i ? "L" : "M"}${before[0].toFixed(1)} ${before[1].toFixed(1)}Q${((before[0] + tip[0]) / 2).toFixed(1)} ${((before[1] + tip[1]) / 2).toFixed(1)} ${tip[0].toFixed(1)} ${tip[1].toFixed(1)}Q${((after[0] + tip[0]) / 2).toFixed(1)} ${((after[1] + tip[1]) / 2).toFixed(1)} ${after[0].toFixed(1)} ${after[1].toFixed(1)}`;
  }
  const dots = Array.from({ length: 5 }, (_, i) =>
    [14, 24, 34].map((k) => {
      const a = (i * 72 * Math.PI) / 180;
      // arredondado: servidor e navegador geram o mesmo número (sem erro de hidratação)
      return [Math.round((50 + k * Math.sin(a)) * 10) / 10, Math.round((52 - k * Math.cos(a)) * 10) / 10];
    }),
  ).flat();
  return (
    <svg viewBox="0 0 100 100">
      <defs>
        <radialGradient id="sf-g" cx="0.45" cy="0.4" r="0.7">
          <stop offset="0" stopColor="#f6a37a" />
          <stop offset="0.6" stopColor="#e07a4f" />
          <stop offset="1" stopColor="#b8532f" />
        </radialGradient>
      </defs>
      <path d={`${d}Z`} fill="url(#sf-g)" stroke="#a24a2a" strokeWidth="1.2" strokeLinejoin="round" />
      {dots.map(([x, y]) => (
        <circle key={`${x.toFixed(1)}-${y.toFixed(1)}`} cx={x} cy={y} r="2.1" fill="#ffd3b4" opacity="0.85" />
      ))}
      <circle cx="50" cy="52" r="3" fill="#ffd3b4" opacity="0.85" />
    </svg>
  );
}

/** Caranguejinho vermelho-coral visto de cima. */
export function Crab() {
  return (
    <svg viewBox="0 0 120 90">
      <defs>
        <radialGradient id="cb-g" cx="0.45" cy="0.35" r="0.75">
          <stop offset="0" stopColor="#f28a6a" />
          <stop offset="0.65" stopColor="#d5543a" />
          <stop offset="1" stopColor="#9e3424" />
        </radialGradient>
      </defs>
      <g fill="none" stroke="#a83a27" strokeWidth="4" strokeLinecap="round">
        {/* patinhas */}
        <path d="M38 52 26 60 18 72M40 58 30 70 26 82M80 52 92 60 100 72M78 58 88 70 92 82" />
        {/* braços até as pinças */}
        <path d="M40 40 28 30 22 20M80 40 92 30 98 20" />
      </g>
      {/* pinças */}
      <path d="M22 20c-9-2-14-10-10-16 6 4 9 2 12-2 5 4 4 13-2 18Z" fill="url(#cb-g)" stroke="#9e3424" strokeWidth="1.5" />
      <path d="M98 20c9-2 14-10 10-16-6 4-9 2-12-2-5 4-4 13 2 18Z" fill="url(#cb-g)" stroke="#9e3424" strokeWidth="1.5" />
      {/* casco */}
      <ellipse cx="60" cy="50" rx="28" ry="20" fill="url(#cb-g)" stroke="#9e3424" strokeWidth="1.5" />
      <path d="M44 46q16 -8 32 0" stroke="#ffb59a" strokeWidth="2" fill="none" opacity="0.6" />
      {/* olhinhos */}
      <path d="M52 32v-6M68 32v-6" stroke="#9e3424" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="52" cy="25" r="3.4" fill="#2a1410" />
      <circle cx="68" cy="25" r="3.4" fill="#2a1410" />
      <circle cx="53" cy="24" r="1" fill="#fff" />
      <circle cx="69" cy="24" r="1" fill="#fff" />
    </svg>
  );
}

/** Conchas, pérolas, estrelas-do-mar e caranguejinhos na areia (seção de ingressos). Parados: custo zero. */
export function SandTreasures() {
  return (
    <div className="sand-treasures" aria-hidden>
      {TREASURES.map(([x, y, size, rot, kind, mobile]) => {
        const style = { left: `${x}%`, top: `${y}%`, width: `${size}rem`, rotate: `${rot}deg` };
        const cls = mobile ? "" : " no-cel";
        if (kind === "p") return <span key={`${x}-${y}`} className={`sand-pearl-deco${cls}`} style={{ left: `${x}%`, top: `${y}%`, width: `${size}rem` }} />;
        return (
          <span key={`${x}-${y}`} className={`sand-deco sand-deco-${kind}${cls}`} style={style}>
            {kind === "s" ? <Scallop /> : kind === "e" ? <SandStarfish /> : <Crab />}
          </span>
        );
      })}
    </div>
  );
}

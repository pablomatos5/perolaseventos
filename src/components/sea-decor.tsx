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
    <img src={side === "left" ? "/2027/sereia-rodape.webp" : "/2027/sereia-lateral.webp"} alt="" loading="lazy" className={`side-mermaid is-${side}`} />
  );
}

// Concha vieira aberta (valva de cima): gomos em leque com a borda recortada. Calculada uma vez.
function scallopFan(r: number, n: number) {
  const a0 = Math.PI * 1.06;
  const a1 = Math.PI * 1.94;
  const step = (a1 - a0) / n;
  const pt = (a: number, rr: number) => `${(Math.cos(a) * rr).toFixed(1)} ${(Math.sin(a) * rr).toFixed(1)}`;
  const ribs: { d: string; light: boolean }[] = [];
  for (let i = 0; i < n; i++) {
    const s = a0 + i * step;
    const e = s + step;
    const m = (s + e) / 2;
    ribs.push({ d: `M0 0L${pt(s, r)}Q${pt(m, r * 1.12)} ${pt(e, r)}Z`, light: i % 2 === 0 });
  }
  return ribs;
}
const BIG_FAN = scallopFan(88, 13);
const SMALL_FAN = scallopFan(24, 9);

// Grãos de areia (posições fixas para servidor e navegador desenharem igual).
const GRAINS = Array.from({ length: 70 }, (_, i) => [((i * 197) % 1440) + ((i * 7) % 13), 262 + ((i * 53) % 52), 0.8 + ((i * 3) % 4) * 0.35] as const);

/**
 * Fim da página no fundo do mar: raios de luz na água, areia com ondulações, algas e corais, leque-do-mar,
 * a concha aberta com a pérola, estrelas-do-mar e conchinhas; a sereia da arte "Save the date" sentada à esquerda.
 * O conteúdo do rodapé fica por cima.
 */
export function Seabed() {
  return (
    <div className="seabed" aria-hidden>
      <div className="seabed-water" />
      <Bubbles />
      {/* eslint-disable-next-line @next/next/no-img-element -- recorte da arte oficial com esfumado em volta */}
      <img src="/2027/sereia-rodape.webp" alt="" loading="lazy" className="seabed-mermaid" />
      <svg viewBox="0 0 1440 320" preserveAspectRatio="xMidYMax slice" className="seabed-art">
        <defs>
          <linearGradient id="sb-ray" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#fff" stopOpacity="0.55" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="sb-sand" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#fbe8dc" />
            <stop offset="1" stopColor="#efcdbf" />
          </linearGradient>
          <linearGradient id="sb-dune" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#efd6ea" />
            <stop offset="1" stopColor="#f3d4cf" />
          </linearGradient>
          <radialGradient id="sb-pearl" cx="0.35" cy="0.3" r="0.8">
            <stop offset="0" stopColor="#fff" />
            <stop offset="0.5" stopColor="#f3ebff" />
            <stop offset="0.8" stopColor="#d9c6f5" />
            <stop offset="1" stopColor="#f6c9b8" />
          </radialGradient>
          <radialGradient id="sb-glow">
            <stop offset="0" stopColor="#fff6e6" stopOpacity="0.95" />
            <stop offset="1" stopColor="#fff6e6" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="sb-rib-a" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0" stopColor="#f2d7a8" />
            <stop offset="1" stopColor="#fff8f0" />
          </linearGradient>
          <linearGradient id="sb-rib-b" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0" stopColor="#e3bfa0" />
            <stop offset="1" stopColor="#f6e6f6" />
          </linearGradient>
          <linearGradient id="sb-gold" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#f6dcaa" />
            <stop offset="0.6" stopColor="#d9a35f" />
            <stop offset="1" stopColor="#b07a3c" />
          </linearGradient>
          <linearGradient id="sb-weed-a" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0" stopColor="#a58ce9" />
            <stop offset="1" stopColor="#d9cbfa" />
          </linearGradient>
          <linearGradient id="sb-weed-b" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0" stopColor="#e99bbf" />
            <stop offset="1" stopColor="#f8d3e3" />
          </linearGradient>
        </defs>

        {/* raios de luz entrando na água */}
        <g className="seabed-rays">
          <path d="M520 0h70L470 300h-90Z" fill="url(#sb-ray)" />
          <path d="M700 0h40L700 300h-60Z" fill="url(#sb-ray)" opacity="0.7" />
          <path d="M860 0h80L1000 300h-110Z" fill="url(#sb-ray)" />
          <path d="M1060 0h36L1160 300h-50Z" fill="url(#sb-ray)" opacity="0.6" />
        </g>

        {/* duna de trás */}
        <path d="M0 250C200 226 360 252 560 236S920 214 1120 236 1340 230 1440 220V320H0Z" fill="url(#sb-dune)" />

        {/* algas em folha (balançam) */}
        <g className="seabed-weed">
          <path d="M1080 262c-18-34 14-58-2-92s12-56 2-92c18 30-4 58 10 90s-6 62-10 94Z" fill="url(#sb-weed-a)" />
          <path d="M1112 262c10-30-14-56 4-88s-6-46 6-74c10 26-6 46 6 74s-10 60-16 88Z" fill="url(#sb-weed-b)" />
          <path d="M1350 260c-12-30 10-52-2-80s8-40 0-62c14 22-2 44 8 66s-4 50-6 76Z" fill="url(#sb-weed-a)" />
          <path d="M300 262c-14-30 12-54-2-84s10-46 2-70c14 24-2 48 8 72s-4 56-8 82Z" fill="url(#sb-weed-b)" />
          <path d="M268 262c8-22-8-40 2-62s-4-34 4-52c10 18-4 34 4 52s-6 40-10 62Z" fill="url(#sb-weed-a)" />
        </g>

        {/* coral ramificado (lilás) com brilho por cima */}
        <g strokeLinecap="round" fill="none">
          <path d="M1210 268v-60m0 18c-20-10-26-36-20-62m20 40c20-12 24-36 18-60m-38 26c-14-4-22-20-22-36m60 8c14-6 20-20 18-36m-58-4c-2-10 2-20 8-26m32 2c4-8 2-18-4-24" stroke="#b39be3" strokeWidth="11" />
          <path d="M1210 268v-60m0 18c-20-10-26-36-20-62m20 40c20-12 24-36 18-60" stroke="#e2d6fb" strokeWidth="3" opacity="0.8" />
        </g>
        {/* coral rosa à esquerda */}
        <g strokeLinecap="round" fill="none">
          <path d="M420 268v-46m0 14c-16-8-20-28-14-48m14 32c14-8 20-28 14-46m-28 16c-10-2-14-14-14-24m42 6c10-4 12-14 10-24" stroke="#f0a9c8" strokeWidth="9" />
          <path d="M420 268v-46m0 14c-16-8-20-28-14-48" stroke="#fde3ee" strokeWidth="2.5" opacity="0.8" />
        </g>
        {/* leque-do-mar (gorgônia) */}
        <g transform="translate(1300 262)" stroke="#e7a3c4" fill="none" strokeLinecap="round" opacity="0.85">
          {[-60, -40, -20, 0, 20, 40, 60].map((deg) => {
            const r = (deg * Math.PI) / 180;
            return <path key={deg} d={`M0 0Q${(Math.sin(r) * 30).toFixed(1)} -40 ${(Math.sin(r) * 62).toFixed(1)} ${(-Math.cos(r) * 82).toFixed(1)}`} strokeWidth="2.4" />;
          })}
          {[30, 48, 66].map((rr) => (
            <path key={rr} d={`M${-rr * 0.86} ${-rr * 0.6}Q0 ${-rr * 1.25} ${rr * 0.86} ${-rr * 0.6}`} strokeWidth="1.2" opacity="0.7" />
          ))}
        </g>

        {/* areia da frente com ondulações e grãos */}
        <path d="M0 262C180 244 340 272 540 258S900 238 1080 256 1320 250 1440 240V320H0Z" fill="url(#sb-sand)" />
        <path d="M0 262C180 244 340 272 540 258S900 238 1080 256 1320 250 1440 240" fill="none" stroke="#fff" strokeOpacity="0.75" strokeWidth="2" />
        <g fill="none" stroke="#fff" strokeOpacity="0.55" strokeWidth="1.4" strokeLinecap="round">
          <path d="M80 292c40-8 80-8 120 0M240 304c30-6 60-6 90 0M980 298c40-8 80-8 120 0M1180 306c30-6 70-6 100 0M1300 288c30-6 60-6 90 0" />
        </g>
        <g fill="#c99a86" opacity="0.45">
          {GRAINS.map(([x, y, r]) => (
            <circle key={`${x}-${y}`} cx={x} cy={y} r={r} />
          ))}
        </g>

        {/* concha vieira aberta com a pérola */}
        <g transform="translate(720 268)">
          <ellipse cx="0" cy="12" rx="104" ry="10" fill="#d9b2a6" opacity="0.45" />
          <g transform="translate(0 -8)">
            {BIG_FAN.map((rib, i) => (
              <path key={i} d={rib.d} fill={rib.light ? "url(#sb-rib-a)" : "url(#sb-rib-b)"} stroke="#c99357" strokeWidth="1" strokeLinejoin="round" />
            ))}
            <path d="M-14 0l-6 10h40l-6-10Z" fill="#e3bfa0" stroke="#c99357" strokeWidth="1" />
          </g>
          <path d="M-92 -4C-80 22 80 22 92 -4C70 4-70 4-92-4Z" fill="#f7e4d6" stroke="#c99357" strokeWidth="1.4" />
          <circle cx="0" cy="-22" r="48" fill="url(#sb-glow)" className="seabed-pearl-glow" />
          <circle cx="0" cy="-20" r="22" fill="url(#sb-pearl)" stroke="#fff" strokeOpacity="0.8" />
          <circle cx="-7" cy="-27" r="5" fill="#fff" opacity="0.9" />
        </g>

        {/* estrelas-do-mar (pontas arredondadas, pontinhos em relevo) */}
        {[
          [575, 290, -16, 1.15],
          [905, 296, 22, 0.75],
          [160, 300, 8, 0.6],
        ].map(([x, y, rot, sc]) => (
          <g key={x} transform={`translate(${x} ${y}) rotate(${rot}) scale(${sc})`}>
            <path d={STAR.d} transform="translate(-32 -34)" fill="url(#sb-gold)" stroke="url(#sb-gold)" strokeWidth="7" strokeLinejoin="round" />
            <path d={STAR.d} transform="translate(-32 -34)" fill="none" stroke="#9a6a2e" strokeWidth="1" strokeLinejoin="round" opacity="0.6" />
            {STAR.dots.map(([dx, dy]) => (
              <circle key={`${dx}-${dy}`} cx={(dx - 32).toFixed(1)} cy={(dy - 34).toFixed(1)} r="1.6" fill="#fff3dc" opacity="0.9" />
            ))}
          </g>
        ))}

        {/* conchinhas vieira soltas */}
        {[
          [1010, 300, -12],
          [356, 302, 14],
        ].map(([x, y, rot]) => (
          <g key={x} transform={`translate(${x} ${y}) rotate(${rot})`}>
            {SMALL_FAN.map((rib, i) => (
              <path key={i} d={rib.d} fill={rib.light ? "url(#sb-rib-a)" : "url(#sb-rib-b)"} stroke="#c99357" strokeWidth="0.8" />
            ))}
          </g>
        ))}
        {/* concha caracol */}
        <g transform="translate(1250 300) rotate(-20)">
          <path d="M-22 6C-22-14 2-22 16-12S22 10 6 12-10 2-4-4 8-4 6 2" fill="#fbe9e0" stroke="#c99357" strokeWidth="1.6" strokeLinecap="round" />
          <path d="M-22 6l-10 6 12 2" fill="#f3d5c6" stroke="#c99357" strokeWidth="1.4" strokeLinejoin="round" />
        </g>

        {/* pedrinhas e pérolas na areia */}
        <ellipse cx="640" cy="304" rx="9" ry="5" fill="#d6c3ec" />
        <ellipse cx="1150" cy="300" rx="12" ry="6" fill="#ecc4cf" />
        <ellipse cx="470" cy="306" rx="7" ry="4" fill="#f0d0bf" />
        <circle cx="805" cy="300" r="5.5" fill="url(#sb-pearl)" />
        <circle cx="822" cy="306" r="3.5" fill="url(#sb-pearl)" />
        <circle cx="1100" cy="296" r="4.5" fill="url(#sb-pearl)" />
        <circle cx="250" cy="304" r="4" fill="url(#sb-pearl)" />
      </svg>
    </div>
  );
}

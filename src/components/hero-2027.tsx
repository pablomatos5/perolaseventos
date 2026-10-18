// Topo do site na identidade 2027 da Pérolas (artes oficiais da campanha "Um novo ciclo"):
// céu violeta → lavanda → rosa → pêssego, redemoinhos de luz dourada, a sereia deles sobre as pedras
// (recorte da arte "31 dezembro", em /public/2027) e a pérola sobre o mar, que cai na água ao rolar
//.

/** Estrela de 4 pontas (elemento gráfico da marca). */
export function Star4({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path d="M12 0c.6 6.2 5.8 11.4 12 12-6.2.6-11.4 5.8-12 12-.6-6.2-5.8-11.4-12-12C6.2 11.4 11.4 6.2 12 0Z" fill="currentColor" />
    </svg>
  );
}

/** Estrelinha de 4 pontas fina (brilho), usada em volta do logo. */
function Sparkle({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path d="M12 0C12.5 8 16 11.5 24 12 16 12.5 12.5 16 12 24 11.5 16 8 12.5 0 12 8 11.5 11.5 8 12 0Z" fill="currentColor" />
    </svg>
  );
}

/**
 * Logo "RÉVEILLON · PÉROLAS · 2K27" como na arte oficial da campanha 2027: romanas douradas (Cinzel),
 * a pérola no lugar do O dentro de um aro dourado com brilho, arabesco com uma perolinha embaixo.
 * Tudo em vetor/CSS: nítido em qualquer tela.
 */
export function PerolasLogo({ year, className = "" }: { year: string; className?: string }) {
  return (
    <div className={`pl ${className}`}>
      <div className="pl-kicker">
        <i aria-hidden />
        <span>Réveillon</span>
        <i aria-hidden />
      </div>
      <h1 className="pl-name" aria-label={`Réveillon Pérolas ${year}`}>
        <Sparkle className="pl-spark pl-spark-l" />
        <span className="pl-gold" aria-hidden>
          PÉR
        </span>
        <span className="pl-o" aria-hidden>
          <span className="pl-pearl" />
          <Sparkle className="pl-spark pl-spark-o" />
          <Sparkle className="pl-spark pl-spark-o2" />
        </span>
        <span className="pl-gold" aria-hidden>
          LAS
        </span>
      </h1>
      <svg className="pl-flourish" viewBox="0 0 600 70" aria-hidden>
        <defs>
          <linearGradient id="pl-gold-g" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#fbe3a4" />
            <stop offset="0.45" stopColor="#e2b45c" />
            <stop offset="1" stopColor="#a8742a" />
          </linearGradient>
          <radialGradient id="pl-mini-pearl" cx="0.38" cy="0.32" r="0.75">
            <stop offset="0" stopColor="#ffffff" />
            <stop offset="0.6" stopColor="#f6e6f3" />
            <stop offset="1" stopColor="#d9b8d4" />
          </radialGradient>
        </defs>
        <g fill="none" stroke="url(#pl-gold-g)" strokeLinecap="round" strokeLinejoin="round">
          {/* traço principal: sai da perolinha, sobe suave e termina numa voluta enrolando para dentro */}
          <path d="M286 40 C250 44 190 45 140 38 C110 34 92 26 88 16 C85 7 94 2 102 5 C110 8 108 18 100 18 C95 18 93 13 96 10" strokeWidth="3.6" />
          <path d="M314 40 C350 44 410 45 460 38 C490 34 508 26 512 16 C515 7 506 2 498 5 C490 8 492 18 500 18 C505 18 507 13 504 10" strokeWidth="3.6" />
          {/* segundo traço, fino, embaixo */}
          <path d="M282 51 C250 56 205 56 170 50" strokeWidth="1.5" />
          <path d="M318 51 C350 56 395 56 430 50" strokeWidth="1.5" />
        </g>
        {/* estrelinhas ao lado das volutas */}
        <path d="M62 44C62.3 48 64 49.7 68 50 64 50.3 62.3 52 62 56 61.7 52 60 50.3 56 50 60 49.7 61.7 48 62 44Z" fill="#f2cf7a" />
        <path d="M538 44C538.3 48 540 49.7 544 50 540 50.3 538.3 52 538 56 537.7 52 536 50.3 532 50 536 49.7 537.7 48 538 44Z" fill="#f2cf7a" />
        <circle cx="300" cy="40" r="11" fill="none" stroke="url(#pl-gold-g)" strokeWidth="2.4" />
        <circle cx="300" cy="40" r="7" fill="url(#pl-mini-pearl)" />
        <circle cx="297.5" cy="37.5" r="2" fill="#fff" />
      </svg>
      <div className="pl-year">
        <i aria-hidden />
        <span className="pl-gold">{year}</span>
        <i aria-hidden />
      </div>
    </div>
  );
}

/** Redemoinhos de luz dourada que atravessam o céu (desenhados uma vez ao abrir; depois parados). */
export function LightSwirls() {
  const paths = [
    "M -40 620 C 180 520, 260 300, 520 260 S 900 300, 1000 180 S 1300 40, 1500 110",
    "M -60 700 C 220 640, 380 420, 640 400 S 1040 470, 1180 330 S 1400 160, 1520 220",
    "M 1480 760 C 1260 700, 1180 520, 980 470 S 640 520, 520 420 S 300 160, 120 120",
  ];
  return (
    <svg className="light-swirls" viewBox="0 0 1440 800" preserveAspectRatio="xMidYMid slice" aria-hidden>
      <defs>
        <linearGradient id="swirl-gold" x1="0" x2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.35" stopColor="#ffe3b2" stopOpacity="0.9" />
          <stop offset="0.7" stopColor="#fff" stopOpacity="0.8" />
          <stop offset="1" stopColor="#ffc9a3" stopOpacity="0" />
        </linearGradient>
      </defs>
      {paths.map((d, i) => (
        <path key={d} d={d} pathLength={1} className="swirl" style={{ "--d": `${0.4 + i * 0.35}s` } as React.CSSProperties} stroke="url(#swirl-gold)" strokeWidth={i === 1 ? 1.4 : 1} fill="none" />
      ))}
    </svg>
  );
}

/** Brilho do sol nascendo no horizonte, sobre o mar da arte oficial. */
export function PearlHorizon() {
  return (
    <div className="pearl-horizon" aria-hidden>
      <div className="pearl-rays" />
      {/* eslint-disable-next-line @next/next/no-img-element -- faixa de mar da arte oficial, já otimizada */}
      <img src="/2027/mar.webp" alt="" className="sea-strip" fetchPriority="high" />
    </div>
  );
}

/**
 * As duas sereias da campanha (artes oficiais "Save the date" e "31 dezembro"), uma em cada canto,
 * olhando para o centro, como no banner de divulgação da Pérolas.
 */
export function HeroMermaids() {
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element -- recorte da arte oficial em /public/2027 */}
      <img src="/2027/sereia-esq.webp" alt="" className="hero-mermaid is-left" fetchPriority="high" />
      {/* eslint-disable-next-line @next/next/no-img-element -- recorte da arte oficial em /public/2027 */}
      <img src="/2027/sereia-dir.webp" alt="Sereias da campanha Réveillon Pérolas 2027" className="hero-mermaid is-right" fetchPriority="high" />
    </>
  );
}

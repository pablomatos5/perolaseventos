// Topo do site na identidade 2027 da Pérolas (artes oficiais da campanha "Um novo ciclo"):
// céu violeta → lavanda → rosa → pêssego, redemoinhos de luz dourada, a sereia deles sobre as pedras
// (recorte da arte "31 dezembro", em /public/2027) e a pérola sobre o mar, que cai na água ao rolar
// (pearl-drop.tsx usa [data-pearl] e [data-water]).

/** Estrela de 4 pontas (elemento gráfico da marca). */
export function Star4({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path d="M12 0c.6 6.2 5.8 11.4 12 12-6.2.6-11.4 5.8-12 12-.6-6.2-5.8-11.4-12-12C6.2 11.4 11.4 6.2 12 0Z" fill="currentColor" />
    </svg>
  );
}

/** Logo "RÉVEILLON PÉROLAS 2027": serifa clássica dourada, estrela de 4 pontas dentro do O. */
export function PerolasLogo({ year, className = "" }: { year: string; className?: string }) {
  return (
    <div className={`perolas-logo ${className}`}>
      <span className="perolas-logo-kicker">Réveillon</span>
      <h1 className="perolas-logo-name" aria-label={`Réveillon Pérolas ${year}`}>
        PÉR
        <span className="perolas-logo-o">
          O
          <Star4 className="perolas-logo-star" />
        </span>
        LAS
      </h1>
      <span className="perolas-logo-year">
        <i aria-hidden />
        {year}
        <i aria-hidden />
      </span>
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

/** Pérola sobre o mar com os raios do amanhecer (a pérola é a que cai no mar ao rolar). */
export function PearlHorizon() {
  return (
    <div className="pearl-horizon" aria-hidden>
      <div className="pearl-rays" />
      <div className="pearl-2027" data-pearl>
        <div className="pearl w-full" />
      </div>
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

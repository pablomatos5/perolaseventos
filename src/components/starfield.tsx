// Fundo de céu estrelado / pérolas no mar (estilos em globals.css, .starfield).
// Posições fixas para o servidor e o navegador desenharem igual.
const PEARLS = [
  [7, 14, 5, 0], [88, 9, 4, 2.1], [23, 38, 6, 4.2], [71, 31, 4, 1.3], [93, 52, 5, 3.4],
  [4, 63, 4, 5.1], [46, 72, 5, 0.7], [79, 81, 6, 2.8], [15, 90, 4, 4.6], [58, 22, 3, 3.9],
] as const;

// Brilhos de 4 pontas: [x%, y%, tamanho px, atraso s, dourado?] — brancos no alto do céu, dourados embaixo.
const SPARKLES = [
  [12, 8, 16, 0, 0], [34, 15, 10, 1.8, 0], [63, 6, 13, 3.1, 0], [82, 19, 18, 0.9, 0], [51, 28, 9, 4.2, 0],
  [6, 33, 12, 2.4, 0], [91, 37, 11, 3.7, 0], [27, 47, 14, 1.2, 1], [72, 52, 10, 4.6, 1], [44, 61, 12, 0.4, 1],
  [9, 71, 15, 2.9, 1], [88, 68, 13, 1.6, 1], [58, 79, 10, 3.4, 1], [21, 86, 12, 0.7, 1], [77, 92, 14, 2.2, 1],
] as const;

export function Starfield() {
  return (
    <div className="starfield" aria-hidden>
      <i />
      <i />
      <i />
      {PEARLS.map(([x, y, s, d]) => (
        <b key={`${x}-${y}`} style={{ left: `${x}%`, top: `${y}%`, "--s": `${s}px`, animationDelay: `${d}s` } as React.CSSProperties} />
      ))}
      {SPARKLES.map(([x, y, s, d, gold]) => (
        <s key={`${x}-${y}`} className={gold ? "gold" : undefined} style={{ left: `${x}%`, top: `${y}%`, "--s": `${s}px`, animationDelay: `${d}s` } as React.CSSProperties} />
      ))}
      <svg viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id="sky-thread" x1="0" x2="1">
            <stop offset="0" stopColor="#fff" stopOpacity="0" />
            <stop offset="0.4" stopColor="#ffe3b2" stopOpacity="0.9" />
            <stop offset="0.75" stopColor="#fff" stopOpacity="0.7" />
            <stop offset="1" stopColor="#ffc9a3" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d="M -60 640 C 240 560, 420 380, 720 360 S 1180 420, 1500 240" stroke="url(#sky-thread)" strokeWidth="1" fill="none" />
        <path d="M 1500 760 C 1220 700, 1060 560, 820 560 S 380 600, -60 420" stroke="url(#sky-thread)" strokeWidth="0.8" fill="none" />
      </svg>
    </div>
  );
}

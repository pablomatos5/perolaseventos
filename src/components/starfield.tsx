// Fundo de céu estrelado / pérolas no mar (estilos em globals.css, .starfield).
// Posições fixas para o servidor e o navegador desenharem igual.
const PEARLS = [
  [7, 14, 5, 0], [88, 9, 4, 2.1], [23, 38, 6, 4.2], [71, 31, 4, 1.3], [93, 52, 5, 3.4],
  [4, 63, 4, 5.1], [46, 72, 5, 0.7], [79, 81, 6, 2.8], [15, 90, 4, 4.6], [58, 22, 3, 3.9],
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
    </div>
  );
}

// Logotipo oficial do Réveillon Pérolas 2K27 (letra vetorizada da arte aprovada pelo cliente: a perna do R
// forma o O, com a estrela dentro). Sempre a imagem, nunca recriado com fonte.
// Arquivos em /public/2027/logo (originais de 2400 px + cópias redimensionadas de 600 e 1200 px).
// - "reveillon": com RÉVEILLON em cima (capa do site); "wordmark": só PÉROLAS (cabeçalho/menu)
// - tom "dourado" sobre fundo escuro; "ameixa" sobre fundo claro; "creme" quando o dourado tiver pouco contraste
// Margem livre ao redor = altura do "R" (0,189 × largura da imagem): ver .brand-logo no globals.css.

const SIZE = { reveillon: { w: 2400, h: 766 }, wordmark: { w: 2400, h: 607 } } as const;

export type LogoKind = keyof typeof SIZE;
export type LogoTone = "dourado" | "ameixa" | "creme";

export function BrandLogo({
  kind,
  tone = "dourado",
  sizes,
  priority = false,
  className = "",
}: {
  kind: LogoKind;
  tone?: LogoTone;
  /** largura exibida (atributo sizes), para o navegador escolher 600, 1200 ou 2400 px */
  sizes: string;
  priority?: boolean;
  className?: string;
}) {
  const base = `/2027/logo/perolas-${kind === "reveillon" ? "logo-reveillon" : "wordmark"}-${tone}`;
  const { w, h } = SIZE[kind];
  return (
    <picture className={`brand-logo brand-logo-${kind} ${className}`}>
      <source type="image/webp" srcSet={`${base}-600.webp 600w, ${base}-1200.webp 1200w, ${base}.webp 2400w`} sizes={sizes} />
      {/* eslint-disable-next-line @next/next/no-img-element -- arte oficial com fallback PNG via <picture> */}
      <img
        src={`${base}.png`}
        width={w}
        height={h}
        alt="Réveillon Pérolas 2K27"
        decoding="async"
        loading={priority ? "eager" : "lazy"}
        fetchPriority={priority ? "high" : undefined}
      />
    </picture>
  );
}

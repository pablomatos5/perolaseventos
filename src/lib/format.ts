const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
export const formatBRL = (cents: number) => brl.format(cents / 100);

const dateFmt = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Belem",
});
export const formatDateTime = (d: Date) => dateFmt.format(d);

/** Preço do ingresso feminino do lote (vazio no banco = mesmo preço do masculino). */
export const femalePrice = (b: { priceCents: number; femalePriceCents: number | null }) => b.femalePriceCents ?? b.priceCents;

/** Taxa de serviço por ingresso vendido (fica com os desenvolvedores); cortesia não paga. */
export const SERVICE_FEE_CENTS = 250;

/**
 * Total no cartão com a taxa do cartão repassada ao comprador (bps = centésimos de %, 499 = 4,99%).
 * Calculado para o vendedor receber o valor cheio depois da taxa: total ÷ (1 − taxa), arredondado para cima.
 */
export const cardTotalCents = (cents: number, bps: number) => (bps > 0 ? Math.ceil((cents * 10_000) / (10_000 - bps)) : cents);

export const genderLabel = (g: "MASCULINO" | "FEMININO" | null) => (g === "FEMININO" ? "Feminino" : g === "MASCULINO" ? "Masculino" : "Cortesia");

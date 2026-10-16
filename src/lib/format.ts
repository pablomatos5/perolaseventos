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

export const genderLabel = (g: "MASCULINO" | "FEMININO" | null) => (g === "FEMININO" ? "Feminino" : g === "MASCULINO" ? "Masculino" : "Cortesia");

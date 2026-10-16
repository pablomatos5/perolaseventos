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

export const halfPrice = (b: { priceCents: number; halfPriceCents: number | null }) =>
  b.halfPriceCents ?? Math.round(b.priceCents / 2);

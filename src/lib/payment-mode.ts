/**
 * Qual cobrança está ativa, decidida só pelo .env:
 * - "mercadopago": PAYMENT_PROVIDER=mercadopago e MP_ACCESS_TOKEN preenchido.
 * - "mock": PAYMENT_PROVIDER=mock FORA de produção (botão "simular pagamento").
 * - "off": qualquer outra coisa. Em produção o mock nunca liga, senão daria ingresso de graça.
 */
export function paymentMode(): "mercadopago" | "mock" | "off" {
  const provider = process.env.PAYMENT_PROVIDER;
  if (provider === "mercadopago" && process.env.MP_ACCESS_TOKEN) return "mercadopago";
  if (provider === "mock" && process.env.NODE_ENV !== "production") return "mock";
  return "off";
}

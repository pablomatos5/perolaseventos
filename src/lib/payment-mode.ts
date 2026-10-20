/**
 * Qual cobrança está ativa, decidida só pelo .env:
 * - "mercadopago": PAYMENT_PROVIDER=mercadopago e (MP_ACCESS_TOKEN ou a aplicação MP_CLIENT_ID/SECRET para o "Conectar").
 * - "mock": PAYMENT_PROVIDER=mock FORA de produção (botão "simular pagamento").
 * - "demo": PAYMENT_PROVIDER=demo, também em produção, para apresentar o site ao cliente. Mostra uma
 *   faixa "Demonstração" em todas as páginas e marca d'água nos ingressos. DESLIGAR antes das vendas
 *   reais e apagar os pedidos de teste (o check:config avisa).
 * - "off": qualquer outra coisa. Em produção o mock nunca liga, senão daria ingresso de graça.
 */
export function paymentMode(): "mercadopago" | "mock" | "demo" | "off" {
  const provider = process.env.PAYMENT_PROVIDER;
  if (provider === "demo") return "demo";
  // conta do evento conectada pelo painel (MP_CLIENT_ID/SECRET) ou token fixo no .env
  if (provider === "mercadopago" && (process.env.MP_ACCESS_TOKEN || (process.env.MP_CLIENT_ID && process.env.MP_CLIENT_SECRET))) return "mercadopago";
  if (provider === "mock" && process.env.NODE_ENV !== "production") return "mock";
  return "off";
}

/** Pagamento simulado (botão "simular"): mock em dev ou modo demonstração. */
export const isSimulated = (mode = paymentMode()) => mode === "mock" || mode === "demo";
export const isDemo = () => paymentMode() === "demo";

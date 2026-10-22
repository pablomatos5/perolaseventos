import MercadoPagoConfig, { Payment, PaymentRefund } from "mercadopago";
import { db } from "@/lib/db";
import { cardTotalCents } from "@/lib/format";
import { deliverTickets, notifyFirstInstallment } from "@/lib/delivery";
import { firstInstallmentCents, markFirstInstallmentPaid, markOrderPaid, refundOrder } from "@/lib/orders";
import { sellerAccessToken, sellerPublicKey } from "@/lib/mp-account";

// Pagamento DENTRO do site (Checkout Transparente do Mercado Pago):
// - Pix: o servidor cria o pagamento e a página do pedido mostra o QR e o "copia e cola";
// - cartão: os campos do cartão são do Mercado Pago (Secure Fields, embutidos na página), o navegador gera um
//   token e o servidor cobra com esse token. O número do cartão nunca passa pelo nosso servidor.
// Em todos, a taxa de serviço dos ingressos vai para os desenvolvedores (application_fee) quando a conta do
// evento está conectada pelo painel.

/**
 * Credencial das cobranças:
 * - conta do vendedor conectada no painel ("Conectar Mercado Pago") → cobrança em nome dele, com a taxa de
 *   serviço separada para os desenvolvedores (marketplace = true);
 * - senão, MP_ACCESS_TOKEN do .env (cobrança simples, sem divisão).
 */
async function client() {
  const seller = await sellerAccessToken();
  const accessToken = seller ?? process.env.MP_ACCESS_TOKEN;
  if (!accessToken) throw new Error("Nenhuma conta Mercado Pago: conecte a do evento no painel (ou configure MP_ACCESS_TOKEN)");
  return { config: new MercadoPagoConfig({ accessToken, options: { timeout: 15_000 } }), marketplace: !!seller };
}

/**
 * Estorno total pelo Mercado Pago (botão do painel, só para os desenvolvedores). Devolve cada pagamento do
 * pedido: o à vista, ou as duas parcelas do Pix em 2x. A comissão dos desenvolvedores (application_fee) volta
 * junto. O pedido vira REFUNDED aqui mesmo (QRs param de valer); o webhook do estorno depois só confirma.
 */
export async function refundPayments(orderId: string) {
  const order = await db.order.findUniqueOrThrow({ where: { id: orderId } });
  // só ids numéricos do Mercado Pago (pedido de demonstração tem "mock_…"; cortesia não tem pagamento)
  const ids = [...new Set([order.firstPaymentRef, order.paymentRef])].filter((x): x is string => !!x && /^\d+$/.test(x));
  if (ids.length === 0) throw new Error("Este pedido não tem pagamento no Mercado Pago (cortesia ou demonstração).");
  const refund = new PaymentRefund((await client()).config);
  for (const id of ids) await refund.total({ payment_id: id, requestOptions: { idempotencyKey: `estorno-${id}` } });
  await refundOrder(orderId);
  return { order, payments: ids };
}

/** Chave pública para os campos do cartão no navegador (da conta conectada; senão MP_PUBLIC_KEY). */
export async function checkoutPublicKey() {
  return (await sellerPublicKey()) || process.env.MP_PUBLIC_KEY || null;
}

const isPublicHttps = (url: string | undefined) => !!url && url.startsWith("https://");

/**
 * Como o cliente vai pagar:
 * - "pix": Pix à vista · "card": cartão de crédito (até 6x) ou débito, à vista no pedido
 * - "pix2x-1" / "pix2x-2": 1ª e 2ª parcelas do Pix em 2x (o ingresso só sai depois da 2ª)
 */
export type CheckoutKind = "pix" | "card" | "pix2x-1" | "pix2x-2";
export type PixKind = Exclude<CheckoutKind, "card">;

/** Liga o pagamento ao pedido e à parcela: "<orderId>" (antigo, à vista), "<orderId>:full", ":p1", ":p2". */
const reference = (orderId: string, kind: CheckoutKind) => `${orderId}:${kind === "pix2x-1" ? "p1" : kind === "pix2x-2" ? "p2" : "full"}`;

type OrderForPay = { id: string; code: string; totalCents: number; feeCents: number; firstPaidCents: number; email: string; cpf: string; buyerName: string; expiresAt: Date; event: { name: string; edition: string; cardFeeBps: number }; tickets: unknown[] };

/** Quanto cobrar nesta forma (cartão já com a taxa do cartão repassada). Sempre calculado no servidor. */
export function amountFor(order: OrderForPay, kind: CheckoutKind) {
  if (kind === "card") return cardTotalCents(order.totalCents, order.event.cardFeeBps);
  if (kind === "pix2x-1") return firstInstallmentCents(order.totalCents);
  if (kind === "pix2x-2") return order.totalCents - order.firstPaidCents;
  return order.totalCents;
}

/** Parte dos desenvolvedores neste pagamento: a taxa de serviço; no Pix em 2x, metade em cada parcela. */
const feeFor = (order: OrderForPay, kind: CheckoutKind) =>
  kind === "pix2x-1" ? Math.floor(order.feeCents / 2) : kind === "pix2x-2" ? order.feeCents - Math.floor(order.feeCents / 2) : order.feeCents;

const describe = (order: OrderForPay, kind: CheckoutKind) =>
  `${order.event.name} ${order.event.edition} · ${order.tickets.length} ingresso(s)${kind === "pix2x-1" ? " · 1ª parcela" : kind === "pix2x-2" ? " · 2ª parcela" : ""}`;

function commonBody(order: OrderForPay, kind: CheckoutKind, marketplace: boolean) {
  const appUrl = process.env.APP_URL;
  const [first, ...rest] = order.buyerName.trim().split(/\s+/);
  const fee = feeFor(order, kind);
  return {
    transaction_amount: amountFor(order, kind) / 100,
    description: describe(order, kind).slice(0, 250),
    external_reference: reference(order.id, kind),
    statement_descriptor: "PEROLAS EVENTOS",
    // O Mercado Pago só aceita notification_url pública em https. Em localhost a confirmação vem da consulta
    // feita logo depois do pagamento (cartão) ou da página do pedido, que confere o Pix a cada poucos segundos.
    ...(isPublicHttps(appUrl) && { notification_url: `${appUrl}/api/webhooks/mercadopago` }),
    ...(marketplace && fee > 0 && { application_fee: fee / 100 }),
    payer: { email: order.email, first_name: first, last_name: rest.join(" ") || first, identification: { type: "CPF", number: order.cpf } },
  };
}

const loadOrder = (orderId: string) =>
  db.order.findUniqueOrThrow({ where: { id: orderId }, include: { event: true, tickets: { select: { id: true } } } });

/**
 * Pix gerado no site: reaproveita o QR ainda válido (mesmo valor) ou cria um pagamento novo.
 * O Pix vale até a reserva acabar (2ª parcela: até o prazo, no máximo 1 dia; a pessoa gera outro se precisar).
 */
export async function createPixCharge(orderId: string, kind: PixKind) {
  const order = await loadOrder(orderId);
  const cents = amountFor(order, kind);
  const reuse = await db.pixCharge.findFirst({
    where: { orderId, kind, amountCents: cents, expiresAt: { gt: new Date(Date.now() + 60_000) } },
    orderBy: { createdAt: "desc" },
  });
  if (reuse) return reuse;

  const mp = await client();
  // o Mercado Pago pede pelo menos ~30 min de validade no Pix; se a reserva acaba antes, o pagamento que
  // chegar depois é aceito como "pago com atraso" (paidLate), como já acontecia no checkout anterior
  const end = kind === "pix2x-2" ? Math.min(order.expiresAt.getTime(), Date.now() + 86_400_000) : order.expiresAt.getTime();
  const expires = new Date(Math.max(end, Date.now() + 31 * 60_000));
  const p = await new Payment(mp.config).create({
    body: { ...commonBody(order, kind, mp.marketplace), payment_method_id: "pix", date_of_expiration: expires.toISOString() },
    requestOptions: { idempotencyKey: `pix-${order.id}-${kind}-${cents}-${expires.getTime()}` },
  });
  const tx = p.point_of_interaction?.transaction_data;
  if (!p.id || !tx?.qr_code || !tx.qr_code_base64) throw new Error("Mercado Pago não devolveu o QR do Pix");
  return db.pixCharge.create({
    data: { orderId, kind, paymentId: String(p.id), amountCents: cents, qrCode: tx.qr_code, qrBase64: tx.qr_code_base64, expiresAt: expires },
  });
}

/** Pix mais recente ainda válido desta forma (para a página do pedido mostrar o QR). */
export function activePixCharge(orderId: string, kind: PixKind) {
  return db.pixCharge.findFirst({ where: { orderId, kind, expiresAt: { gt: new Date() } }, orderBy: { createdAt: "desc" } });
}

export type CardInput = {
  token: string;
  paymentMethodId: string;
  issuerId?: string;
  installments: number;
  /** id do aparelho gerado pelo script de segurança do Mercado Pago (melhora a aprovação) */
  deviceId?: string;
};

/** Cobra no cartão com o token gerado pelos campos seguros do Mercado Pago e já confere o resultado. */
export async function payWithCard(orderId: string, input: CardInput) {
  const order = await loadOrder(orderId);
  const mp = await client();
  const p = await new Payment(mp.config).create({
    body: {
      ...commonBody(order, "card", mp.marketplace),
      token: input.token,
      payment_method_id: input.paymentMethodId,
      ...(input.issuerId && { issuer_id: Number(input.issuerId) }),
      installments: input.installments,
      binary_mode: true, // sem "em análise": aprovado ou recusado, para não segurar ingresso indefinidamente
    },
    requestOptions: { idempotencyKey: `card-${order.id}-${input.token}`, ...(input.deviceId && { meliSessionId: input.deviceId }) },
  });
  if (p.id && p.status === "approved") await reconcilePayment(String(p.id));
  return { status: p.status ?? "unknown", detail: p.status_detail ?? "" };
}

/**
 * Fonte da verdade do pagamento: SEMPRE consulta a API do Mercado Pago pelo id,
 * nunca confia no corpo do webhook nem nos parâmetros da URL de retorno.
 * Chamado pelo webhook, depois do cartão e pela página do pedido (Pix).
 */
export async function reconcilePayment(paymentId: string) {
  const p = await new Payment((await client()).config).get({ id: paymentId });
  const [orderId, part = "full"] = (p.external_reference ?? "").split(":");
  if (!orderId) return { status: p.status, handled: false };

  const order = await db.order.findUnique({ where: { id: orderId } });
  if (!order) return { status: p.status, handled: false };

  if (p.status === "approved") {
    // Conferência de valor: o pagamento tem que cobrir a parte que ele paga (pedido inteiro, 1ª ou 2ª parcela).
    const paidCents = Math.round((p.transaction_amount ?? 0) * 100);
    const due = part === "p1" ? firstInstallmentCents(order.totalCents) : part === "p2" ? order.totalCents - order.firstPaidCents : order.totalCents;
    if (paidCents < due) {
      console.error(`[mercadopago] pagamento ${paymentId} (${part}) de ${paidCents} centavos não cobre ${due} do pedido ${order.code}`);
      return { status: "amount_mismatch", handled: false };
    }
    if (part === "p1") {
      if (await markFirstInstallmentPaid(orderId, String(p.id), paidCents)) await notifyFirstInstallment(orderId);
      return { status: p.status, handled: true };
    }
    // 2ª parcela só vale para pedido com a 1ª paga (senão seria um pagamento parcial do pedido inteiro)
    if (part === "p2" && order.status !== "PARTIAL" && order.status !== "PAID") {
      console.error(`[mercadopago] 2ª parcela ${paymentId} para o pedido ${order.code} sem 1ª parcela paga`);
      return { status: "amount_mismatch", handled: false };
    }
    if (await markOrderPaid(orderId, String(p.id))) await deliverTickets(orderId);
    return { status: p.status, handled: true };
  }

  if ((p.status === "refunded" || p.status === "charged_back") && (order.paymentRef === String(p.id) || order.firstPaymentRef === String(p.id))) {
    await refundOrder(orderId);
    return { status: p.status, handled: true };
  }

  return { status: p.status, handled: false };
}

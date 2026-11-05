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
  /** titular do cartão (o mesmo nome e CPF usados no token; pode não ser quem comprou) */
  holderName: string;
  holderCpf: string;
};

/** Celular do pedido no formato do Mercado Pago (DDD + número), sem o 55 do país. */
function phoneOf(raw: string) {
  let d = raw.replace(/\D/g, "");
  if (d.length >= 12 && d.startsWith("55")) d = d.slice(2);
  return d.length >= 10 ? { area_code: d.slice(0, 2), number: d.slice(2) } : undefined;
}

/**
 * Dados para a análise antifraude do Mercado Pago (additional_info): o que está sendo comprado (ingressos, data
 * do evento), quem compra (telefone, quando fez o pedido) e de onde (IP). Sem isso, o cartão cai muito em
 * "cc_rejected_high_risk". Os itens somam o valor cobrado (ingressos + taxa de serviço + taxa do cartão).
 */
async function antifraudInfo(order: OrderForPay & { phone: string; createdAt: Date; event: { startsAt: Date } }, chargedCents: number, ip: string | undefined, holder: { first: string; last: string }) {
  const tickets = await db.ticket.findMany({
    where: { orderId: order.id },
    select: { priceCents: true, gender: true, batchId: true, batch: { select: { name: true } }, ticketType: { select: { name: true } } },
  });
  const groups = new Map<string, { title: string; quantity: number; cents: number }>();
  for (const t of tickets) {
    const key = `${t.batchId}-${t.gender ?? "c"}-${t.priceCents}`;
    const g = groups.get(key);
    if (g) g.quantity++;
    else groups.set(key, { title: `${t.ticketType.name} · ${t.batch.name}${t.gender === "FEMININO" ? " · Feminino" : t.gender === "MASCULINO" ? " · Masculino" : ""}`, quantity: 1, cents: t.priceCents });
  }
  const eventDate = order.event.startsAt.toISOString();
  const items = [...groups.entries()].map(([id, g]) => ({
    id,
    title: g.title.slice(0, 250),
    description: `Ingresso ${order.event.name} ${order.event.edition}`,
    category_id: "tickets",
    quantity: g.quantity,
    unit_price: g.cents / 100,
    category_descriptor: { event_date: eventDate },
  }));
  const ticketsCents = tickets.reduce((s, t) => s + t.priceCents, 0);
  const extra = (id: string, title: string, cents: number) => cents > 0 && items.push({ id, title, description: title, category_id: "services", quantity: 1, unit_price: cents / 100, category_descriptor: { event_date: eventDate } });
  extra("taxa-servico", "Taxa de serviço", order.feeCents);
  extra("taxa-cartao", "Taxa do cartão", chargedCents - ticketsCents - order.feeCents);
  const phone = phoneOf(order.phone);
  return {
    ...(ip && ip !== "local" && { ip_address: ip }),
    items,
    payer: { first_name: holder.first, last_name: holder.last, ...(phone && { phone }), registration_date: order.createdAt.toISOString() },
  };
}

/** Cobra no cartão com o token gerado pelos campos seguros do Mercado Pago e já confere o resultado. */
export async function payWithCard(orderId: string, input: CardInput, ip?: string) {
  const order = await loadOrder(orderId);
  const mp = await client();
  const base = commonBody(order, "card", mp.marketplace);
  // o pagador do cartão é o TITULAR (nome e CPF iguais aos do token); o e-mail segue o do pedido
  const [first, ...rest] = input.holderName.trim().split(/\s+/);
  const holder = { first, last: rest.join(" ") || first };
  const p = await new Payment(mp.config).create({
    body: {
      ...base,
      payer: { email: order.email, first_name: holder.first, last_name: holder.last, identification: { type: "CPF", number: input.holderCpf } },
      additional_info: await antifraudInfo(order, amountFor(order, "card"), ip, holder),
      token: input.token,
      payment_method_id: input.paymentMethodId,
      ...(input.issuerId && { issuer_id: Number(input.issuerId) }),
      installments: input.installments,
      // 3D Secure: quando o antifraude fica em dúvida, o banco pede confirmação (SMS, app, senha) em vez de recusar.
      // Exige binary_mode false; por isso o pagamento pode ficar "pending" (desafio) ou "in_process" (análise).
      // CARD_3DS=off no .env desliga (volta ao aprovado/recusado na hora) sem precisar de build.
      ...(process.env.CARD_3DS === "off" ? { binary_mode: true } : { three_d_secure_mode: "optional", capture: true, binary_mode: false }),
    },
    requestOptions: { idempotencyKey: `card-${order.id}-${input.token}`, ...(input.deviceId && { meliSessionId: input.deviceId }) },
  });
  const id = p.id ? String(p.id) : "";
  if (id && p.status === "approved") await reconcilePayment(id);
  const tds = p.three_ds_info;
  const challenge = p.status === "pending" && p.status_detail === "pending_challenge" && tds?.external_resource_url && tds.creq
    ? { url: tds.external_resource_url, creq: tds.creq }
    : undefined;
  // segura a vaga enquanto a pessoa confirma no banco (o desafio expira em ~5 min) ou o Mercado Pago analisa
  if (challenge) await holdReservation(orderId, 10);
  else if (p.status === "in_process" || p.status === "pending") await holdReservation(orderId, IN_REVIEW_MINUTES);
  return { status: p.status ?? "unknown", detail: p.status_detail ?? "", paymentId: id, challenge };
}

/** Quanto tempo a vaga fica guardada para um cartão "em análise" no Mercado Pago (se aprovar depois, sai como pago com atraso). */
const IN_REVIEW_MINUTES = 120;
/** Desafio do 3D Secure sem resposta: depois disso a pessoa pode tentar de novo (o Mercado Pago encerra em ~5 min). */
const CHALLENGE_MS = 6 * 60_000;

/** Estende a reserva (nunca encurta) de um pedido ainda pendente. */
async function holdReservation(orderId: string, minutes: number) {
  const until = new Date(Date.now() + minutes * 60_000);
  await db.order.updateMany({ where: { id: orderId, status: "PENDING", expiresAt: { lt: until } }, data: { expiresAt: until } });
}

/**
 * Pagamento no cartão deste pedido que ainda está andando no Mercado Pago (em análise, ou desafio do banco
 * recente). Enquanto existir, o site não cobra de novo: evita cobrar duas vezes quem recarregou a página.
 * Um aprovado que ainda não tinha sido conferido é conferido aqui.
 */
export async function openCardPayment(orderId: string) {
  const mp = await client();
  const r = await new Payment(mp.config).search({ options: { external_reference: reference(orderId, "card"), sort: "date_created", criteria: "desc", limit: 10 } });
  for (const p of r.results ?? []) {
    if (!p.id || !["credit_card", "debit_card"].includes(p.payment_type_id ?? "")) continue;
    if (p.status === "approved") {
      await reconcilePayment(String(p.id));
      return { status: "approved" as const, paymentId: String(p.id) };
    }
    if (p.status === "in_process") return { status: "in_process" as const, paymentId: String(p.id) };
    if (p.status === "pending" && p.status_detail === "pending_challenge" && Date.now() - new Date(p.date_created ?? 0).getTime() < CHALLENGE_MS) {
      return { status: "challenge" as const, paymentId: String(p.id) };
    }
  }
  return null;
}

/** A pessoa fechou a confirmação do banco: cancela o pagamento pendente deste pedido para poder tentar de novo na hora. */
export async function cancelCardChallenge(orderId: string, paymentId: string) {
  const payments = new Payment((await client()).config);
  const p = await payments.get({ id: paymentId });
  if ((p.external_reference ?? "").split(":")[0] !== orderId || p.status !== "pending") return false;
  await payments.cancel({ id: paymentId, requestOptions: { idempotencyKey: `cancelar-${paymentId}` } });
  return true;
}

/** Situação de um pagamento no cartão deste pedido (depois do desafio do banco). Confere se é mesmo deste pedido. */
export async function checkCardPayment(orderId: string, paymentId: string) {
  const p = await new Payment((await client()).config).get({ id: paymentId });
  if ((p.external_reference ?? "").split(":")[0] !== orderId) return null;
  if (p.status === "approved") await reconcilePayment(paymentId);
  else if (p.status === "in_process") await holdReservation(orderId, IN_REVIEW_MINUTES);
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

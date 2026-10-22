"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { deliverTickets, notifyFirstInstallment, sendOrderLinks } from "@/lib/delivery";
import { createPixCharge, payWithCard, type CardInput, type CheckoutKind, type PixKind } from "@/lib/mercadopago";
import { createReservation, firstInstallmentCents, markFirstInstallmentPaid, markOrderPaid, SaleError, splitPixAvailable } from "@/lib/orders";
import { isSimulated, paymentMode } from "@/lib/payment-mode";
import { allow, clientIp } from "@/lib/rate-limit";
import { audit } from "@/lib/audit";
import { verifyTurnstile } from "@/lib/turnstile";
import { orderToken, verifyOrderToken } from "@/lib/tokens";

const onlyDigits = (s: string) => s.replace(/\D/g, "");

function validCpf(raw: string) {
  const cpf = onlyDigits(raw);
  if (cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) return false;
  const digit = (len: number) => {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += Number(cpf[i]) * (len + 1 - i);
    const r = (sum * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return digit(9) === Number(cpf[9]) && digit(10) === Number(cpf[10]);
}

const schema = z.object({
  eventId: z.string().min(1),
  buyerName: z.string().trim().min(5, "Informe nome e sobrenome.").refine((n) => n.includes(" "), "Informe nome e sobrenome."),
  email: z.email("E-mail inválido.").trim().toLowerCase(),
  phone: z.string().transform(onlyDigits).pipe(z.string().min(10, "Celular com DDD.").max(11, "Celular inválido.")),
  cpf: z.string().refine(validCpf, "CPF inválido: confira os 11 números.").transform(onlyDigits),
  items: z
    .array(z.object({ ticketTypeId: z.string().max(40), masc: z.number().int().min(0).max(50), fem: z.number().int().min(0).max(50) }))
    .max(10)
    .refine((items) => new Set(items.map((i) => i.ticketTypeId)).size === items.length, "Pedido inválido: setor repetido."),
});

export type BuyerField = "buyerName" | "email" | "phone" | "cpf";
/** `field` = campo com problema (o formulário marca e foca); `at` muda a cada resposta. */
export type ReserveState = { error?: string; field?: BuyerField; at?: number } | undefined;
const BUYER_FIELDS = new Set<string>(["buyerName", "email", "phone", "cpf"]);

export async function reserveAction(_prev: ReserveState, form: FormData): Promise<ReserveState> {
  const parsed = schema.safeParse({
    eventId: form.get("eventId"),
    buyerName: form.get("buyerName"),
    email: form.get("email"),
    phone: form.get("phone") ?? "",
    cpf: form.get("cpf") ?? "",
    items: JSON.parse(String(form.get("items") ?? "[]")),
  });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const f = String(issue.path[0] ?? "");
    return { error: issue.message, field: BUYER_FIELDS.has(f) ? (f as BuyerField) : undefined, at: Date.now() };
  }
  // Sem cobrança configurada não adianta reservar: o cliente não teria como pagar.
  if (paymentMode() === "off") return { error: "As vendas online abrem em breve." };

  // Freio contra robôs segurando o lote: tentativas por conexão + verificação anti-robô.
  const ip = await clientIp();
  if (!allow(`reserva:${ip}`, 6, 10 * 60_000)) {
    return { error: "Muitas tentativas seguidas. Aguarde alguns minutos e tente de novo." };
  }
  if (!(await verifyTurnstile(String(form.get("cf-turnstile-response") ?? ""), ip))) {
    return { error: "Não conseguimos confirmar que você não é um robô. Recarregue a página e tente de novo." };
  }
  // Um CPF, uma reserva aberta: quem já reservou volta para o próprio pedido em vez de travar mais ingressos.
  const open = await db.order.findFirst({
    where: { eventId: parsed.data.eventId, cpf: parsed.data.cpf, status: "PENDING", expiresAt: { gt: new Date() } },
    select: { id: true },
  });
  if (open) redirect(`/pedido/${orderToken(open.id)}?reserva=existente`);

  let orderId: string;
  try {
    orderId = (await createReservation(parsed.data)).id;
  } catch (e) {
    if (e instanceof SaleError) return { error: e.message };
    // fila do banco cheia num pico de vendas: nada foi reservado, a pessoa só precisa tentar de novo
    if (/transaction/i.test(String((e as Error)?.message))) {
      return { error: "Muita gente comprando agora. Seus ingressos não foram reservados: toque em “Ir para o pagamento” de novo." };
    }
    throw e;
  }
  redirect(`/pedido/${orderToken(orderId)}`);
}

const KINDS = new Set<CheckoutKind>(["pix", "card", "pix2x-1", "pix2x-2"]);

/** O pedido aceita esta forma de pagamento agora? (à vista e 1ª parcela: reserva pendente; 2ª: 1ª paga e no prazo) */
async function canPay(orderId: string, kind: CheckoutKind) {
  const order = await db.order.findUniqueOrThrow({ where: { id: orderId }, include: { event: true } });
  const inTime = order.expiresAt > new Date();
  if (kind === "pix2x-2") return order.status === "PARTIAL" && inTime;
  if (order.status !== "PENDING" || !inTime) return false;
  return kind !== "pix2x-1" || splitPixAvailable(order.event);
}

/**
 * Pix em 2x: a 1ª parcela só é gerada com o aceite dos termos (a 1ª parcela não é devolvida se a 2ª não for paga
 * no prazo). Conferido aqui no servidor (não dá para pular pelo navegador) e registrado na auditoria como prova.
 */
async function acceptSplitTerms(orderId: string, token: string, kind: PixKind, form?: FormData) {
  if (kind !== "pix2x-1") return;
  if (form?.get("aceite") !== "on") redirect(`/pedido/${token}?erro=termos`);
  const order = await db.order.findUnique({ where: { id: orderId }, select: { code: true, buyerName: true, cpf: true } });
  await audit("cliente", "aceitou os termos do Pix em 2x", `pedido ${order?.code} · ${order?.buyerName} · CPF final ${order?.cpf.slice(-3)} · IP ${await clientIp()}`);
}

/** Pix no próprio site (à vista ou parcela do Pix em 2x): gera o QR e volta à página do pedido mostrando-o. */
export async function pixAction(token: string, kind: PixKind = "pix", form?: FormData) {
  const orderId = verifyOrderToken(token);
  if (!orderId) throw new Error("Pedido inválido");
  if (!KINDS.has(kind) || paymentMode() !== "mercadopago" || !(await canPay(orderId, kind))) redirect(`/pedido/${token}`);
  await acceptSplitTerms(orderId, token, kind, form);
  // freio: gerar Pix sem parar (cada um é uma cobrança no Mercado Pago)
  if (!allow(`pix:${orderId}`, 8, 15 * 60_000) || !allow(`pix-ip:${await clientIp()}`, 30, 15 * 60_000)) redirect(`/pedido/${token}?erro=limite`);
  try {
    await createPixCharge(orderId, kind);
  } catch (e) {
    console.error("[mercadopago] não foi possível gerar o Pix:", e);
    redirect(`/pedido/${token}?erro=pagamento`);
  }
  redirect(`/pedido/${token}?pagar=pix&forma=${kind}`);
}

/** Parcelamento máximo no cartão (juros por conta de quem compra). */
const MAX_INSTALLMENTS = 6;

export type CardField = "number" | "expiry" | "cvv" | "name" | "cpf";
export type CardState = { ok?: boolean; error?: string; field?: CardField } | undefined;

// recusa por dado errado: aponta o campo do formulário que a pessoa precisa corrigir
const CARD_FIELD: Record<string, CardField> = {
  cc_rejected_bad_filled_card_number: "number",
  cc_rejected_bad_filled_date: "expiry",
  cc_rejected_bad_filled_security_code: "cvv",
};

// Mensagens para o comprador conforme o motivo da recusa (status_detail do Mercado Pago)
const CARD_REJECTED: Record<string, string> = {
  cc_rejected_bad_filled_card_number: "Confira o número do cartão.",
  cc_rejected_bad_filled_date: "Confira a validade do cartão.",
  cc_rejected_bad_filled_security_code: "Confira o código de segurança (CVV).",
  cc_rejected_bad_filled_other: "Confira os dados do cartão.",
  cc_rejected_insufficient_amount: "Saldo ou limite insuficiente. Tente outro cartão ou pague no Pix.",
  cc_rejected_call_for_authorize: "O banco pediu autorização: ligue para o seu banco e tente de novo, ou pague no Pix.",
  cc_rejected_card_disabled: "Cartão desativado. Ligue para o banco ou use outro cartão.",
  cc_rejected_duplicated_payment: "Você já fez um pagamento igual agora há pouco. Confira o seu extrato antes de tentar de novo.",
  cc_rejected_max_attempts: "Tentativas demais com este cartão. Use outro cartão ou pague no Pix.",
  cc_rejected_high_risk: "O pagamento foi recusado pela análise de segurança. Tente outro cartão ou pague no Pix.",
};

/** Cartão no próprio site: recebe só o token gerado pelos campos seguros do Mercado Pago (nunca o número do cartão). */
export async function cardPayAction(token: string, input: CardInput): Promise<CardState> {
  const orderId = verifyOrderToken(token);
  if (!orderId) return { error: "Pedido inválido." };
  if (paymentMode() !== "mercadopago" || !(await canPay(orderId, "card"))) return { error: "Este pedido não aceita pagamento agora. Atualize a página." };
  const parsed = z
    .object({
      token: z.string().min(8).max(200),
      paymentMethodId: z.string().regex(/^[a-z0-9_]{2,30}$/),
      issuerId: z.string().regex(/^\d{1,12}$/).optional(),
      installments: z.number().int().min(1).max(MAX_INSTALLMENTS),
      deviceId: z.string().max(4000).optional(),
    })
    .safeParse(input);
  if (!parsed.success) {
    console.warn("[mercadopago] dados do cartão recusados na conferência:", parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
    return { error: "Dados do cartão incompletos. Confira e tente de novo." };
  }
  // freio contra teste de cartões roubados: poucas tentativas por pedido e por conexão
  if (!allow(`card:${orderId}`, 6, 15 * 60_000) || !allow(`card-ip:${await clientIp()}`, 12, 15 * 60_000)) {
    return { error: "Tentativas demais. Espere alguns minutos ou pague no Pix." };
  }
  try {
    const r = await payWithCard(orderId, parsed.data);
    if (r.status === "approved") {
      revalidatePath(`/pedido/${token}`);
      return { ok: true };
    }
    return { error: CARD_REJECTED[r.detail] ?? "Pagamento recusado pelo cartão. Tente outro cartão ou pague no Pix.", field: CARD_FIELD[r.detail] };
  } catch (e) {
    console.error("[mercadopago] falha no pagamento com cartão:", e);
    return { error: "Não foi possível falar com o Mercado Pago agora. Tente de novo em instantes." };
  }
}

/** Só funciona com PAYMENT_PROVIDER=mock fora de produção. Em produção, quem confirma é o webhook. */
export async function simulatePaymentAction(token: string, kind: CheckoutKind = "pix", form?: FormData) {
  if (!isSimulated()) throw new Error("Simulação desligada");
  const orderId = verifyOrderToken(token);
  if (!orderId) throw new Error("Pedido inválido");
  if (!KINDS.has(kind) || !(await canPay(orderId, kind))) redirect(`/pedido/${token}`);
  if (kind !== "card") await acceptSplitTerms(orderId, token, kind, form);
  const order = await db.order.findUniqueOrThrow({ where: { id: orderId } });
  if (kind === "pix2x-1") {
    if (await markFirstInstallmentPaid(orderId, `mock_${order.code}_p1`, firstInstallmentCents(order.totalCents))) await notifyFirstInstallment(orderId);
  } else if (await markOrderPaid(orderId, `mock_${order.code}${kind === "pix2x-2" ? "_p2" : ""}`)) {
    await deliverTickets(orderId);
  }
  redirect(`/pedido/${token}`);
}

export type HolderState = { ok?: string; error?: string } | undefined;

/**
 * Cliente troca o nome de quem vai usar um ingresso (dono do link do pedido). O QR ganha versão nova:
 * o anterior, prints e o link individual antigo deixam de valer. Freia cambista que vende o mesmo print.
 */
export async function updateHolderAction(token: string, ticketId: string, _prev: HolderState, form: FormData): Promise<HolderState> {
  const orderId = verifyOrderToken(token);
  if (!orderId) return { error: "Pedido inválido." };
  if (!allow(`titular:${orderId}`, 10, 60 * 60_000)) return { error: "Muitas trocas seguidas. Tente mais tarde." };

  const name = String(form.get("holder") ?? "").trim().replace(/\s+/g, " ");
  if (name.length < 5 || name.length > 80) return { error: "Informe nome e sobrenome." };

  const ticket = await db.ticket.findFirst({ where: { id: ticketId, orderId }, include: { order: { include: { event: true } } } });
  if (!ticket || ticket.status !== "VALID" || ticket.order.status !== "PAID") return { error: "Ingresso indisponível." };
  if (ticket.usedAt) return { error: "Este ingresso já foi usado na entrada." };
  if (ticket.order.event.startsAt <= new Date()) return { error: "Depois do início da festa não dá para trocar o nome." };
  if (ticket.holderName === name) return { ok: "Nome mantido." };

  await db.ticket.update({ where: { id: ticket.id }, data: { holderName: name, qrVersion: { increment: 1 } } });
  await audit("cliente", "trocou o titular", `pedido ${ticket.order.code}: ${ticket.holderName} → ${name}`);
  revalidatePath(`/pedido/${token}`);
  return { ok: `Agora em nome de ${name}. QR novo gerado ✓` };
}

// ───────── Encontrar meu pedido ─────────

export type FindState = { sent?: boolean; error?: string } | undefined;

/**
 * Comprador perdeu o link: informa CPF + e-mail e recebe o link no e-mail CADASTRADO no pedido.
 * A resposta é sempre a mesma, achando ou não (ninguém descobre se um CPF comprou), com limite de
 * tentativas por conexão e por CPF, e o anti-robô quando estiver ligado.
 */
export async function findOrderAction(_prev: FindState, form: FormData): Promise<FindState> {
  const parsed = z
    .object({
      cpf: z.string().refine(validCpf, "CPF inválido: confira os 11 números.").transform(onlyDigits),
      email: z.email("E-mail inválido.").trim().toLowerCase(),
    })
    .safeParse({ cpf: form.get("cpf") ?? "", email: form.get("email") ?? "" });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Confira os dados." };

  const ip = await clientIp();
  if (!allow(`achar-ip:${ip}`, 10, 60 * 60_000) || !allow(`achar-cpf:${parsed.data.cpf}`, 3, 60 * 60_000)) {
    return { error: "Muitas tentativas. Espere um pouco e tente de novo." };
  }
  if (!(await verifyTurnstile(String(form.get("cf-turnstile-response") ?? ""), ip))) {
    return { error: "Não conseguimos confirmar que você não é um robô. Recarregue a página e tente de novo." };
  }

  const orders = await db.order.findMany({
    where: {
      cpf: parsed.data.cpf,
      email: parsed.data.email,
      OR: [{ status: { in: ["PAID", "PARTIAL"] } }, { status: "PENDING", expiresAt: { gt: new Date() } }],
    },
    select: { id: true },
  });
  await sendOrderLinks(orders.map((o) => o.id));
  await audit("cliente", "pediu o link do pedido", `CPF final ${parsed.data.cpf.slice(-3)} · ${orders.length} pedido(s) · IP ${ip}`);
  return { sent: true };
}

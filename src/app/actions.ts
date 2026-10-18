"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { deliverTickets } from "@/lib/delivery";
import { createCheckout } from "@/lib/mercadopago";
import { createReservation, markOrderPaid, SaleError } from "@/lib/orders";
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

/** Leva o cliente ao Checkout Pro do Mercado Pago (Pix ou cartão) para um pedido ainda reservado. */
export async function payAction(token: string) {
  const orderId = verifyOrderToken(token);
  if (!orderId) throw new Error("Pedido inválido");
  const order = await db.order.findUniqueOrThrow({ where: { id: orderId } });
  if (order.status !== "PENDING" || order.expiresAt < new Date() || paymentMode() !== "mercadopago") {
    redirect(`/pedido/${token}`);
  }
  let checkoutUrl: string;
  try {
    checkoutUrl = await createCheckout(orderId);
  } catch (e) {
    console.error("[mercadopago] não foi possível criar o checkout:", e);
    redirect(`/pedido/${token}?erro=pagamento`);
  }
  redirect(checkoutUrl);
}

/** Só funciona com PAYMENT_PROVIDER=mock fora de produção. Em produção, quem confirma é o webhook. */
export async function simulatePaymentAction(token: string) {
  if (!isSimulated()) throw new Error("Simulação desligada");
  const orderId = verifyOrderToken(token);
  if (!orderId) throw new Error("Pedido inválido");
  const order = await db.order.findUniqueOrThrow({ where: { id: orderId } });
  if (await markOrderPaid(orderId, `mock_${order.code}`)) await deliverTickets(orderId);
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

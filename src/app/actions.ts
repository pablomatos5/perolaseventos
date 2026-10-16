"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { deliverTickets } from "@/lib/delivery";
import { createCheckout } from "@/lib/mercadopago";
import { createReservation, markOrderPaid, SaleError } from "@/lib/orders";
import { paymentMode } from "@/lib/payment-mode";
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
  buyerName: z.string().trim().min(5, "Informe nome e sobrenome."),
  email: z.email("E-mail inválido.").trim().toLowerCase(),
  phone: z.string().transform(onlyDigits).pipe(z.string().min(10, "Celular com DDD.").max(11, "Celular inválido.")),
  cpf: z.string().refine(validCpf, "CPF inválido.").transform(onlyDigits),
  whatsappOptIn: z.boolean(),
  items: z.array(
    z.object({ ticketTypeId: z.string(), full: z.number().int().min(0), half: z.number().int().min(0) }),
  ),
});

export type ReserveState = { error?: string } | undefined;

export async function reserveAction(_prev: ReserveState, form: FormData): Promise<ReserveState> {
  const parsed = schema.safeParse({
    eventId: form.get("eventId"),
    buyerName: form.get("buyerName"),
    email: form.get("email"),
    phone: form.get("phone") ?? "",
    cpf: form.get("cpf") ?? "",
    whatsappOptIn: form.get("whatsappOptIn") === "on",
    items: JSON.parse(String(form.get("items") ?? "[]")),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  // Sem cobrança configurada não adianta reservar: o cliente não teria como pagar.
  if (paymentMode() === "off") return { error: "As vendas online abrem em breve." };

  let orderId: string;
  try {
    orderId = (await createReservation(parsed.data)).id;
  } catch (e) {
    if (e instanceof SaleError) return { error: e.message };
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
  if (paymentMode() !== "mock") throw new Error("Simulação desligada");
  const orderId = verifyOrderToken(token);
  if (!orderId) throw new Error("Pedido inválido");
  const order = await db.order.findUniqueOrThrow({ where: { id: orderId } });
  if (await markOrderPaid(orderId, `mock_${order.code}`)) await deliverTickets(orderId);
  redirect(`/pedido/${token}`);
}

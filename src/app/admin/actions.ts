"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { endSession, passwordOk, requireAdmin, startSession } from "@/lib/admin-auth";
import { activeEvent } from "@/lib/admin-data";
import { db } from "@/lib/db";
import { deliverTickets } from "@/lib/delivery";
import { createCourtesy, SaleError } from "@/lib/orders";

export type FormState = { ok?: string; error?: string } | undefined;

// ───────── sessão ─────────

export async function loginAction(_prev: FormState, form: FormData): Promise<FormState> {
  // atraso fixo: freia tentativa de adivinhar a senha
  await new Promise((r) => setTimeout(r, 600));
  if (!passwordOk(String(form.get("password") ?? ""))) return { error: "Senha incorreta." };
  await startSession();
  redirect("/admin");
}

export async function logoutAction() {
  await endSession();
  redirect("/admin/login");
}

// ───────── lotes ─────────

/** Virada manual: encerra o lote agora; o próximo da fila abre sozinho. */
export async function closeBatchAction(batchId: string) {
  await requireAdmin();
  await db.batch.update({ where: { id: batchId }, data: { closedAt: new Date() } });
  revalidatePath("/admin");
}

/** Reabre um lote encerrado (ele volta a vender antes dos lotes seguintes). */
export async function reopenBatchAction(batchId: string) {
  await requireAdmin();
  await db.batch.update({ where: { id: batchId }, data: { closedAt: null, endsAt: null } });
  revalidatePath("/admin");
}

export async function togglePauseAction(ticketTypeId: string) {
  await requireAdmin();
  const t = await db.ticketType.findUniqueOrThrow({ where: { id: ticketTypeId } });
  await db.ticketType.update({ where: { id: ticketTypeId }, data: { paused: !t.paused } });
  revalidatePath("/admin");
}

/** Ajusta a quantidade de um lote. Nunca abaixo do que já foi vendido + reservado agora. */
export async function updateQuantityAction(batchId: string, _prev: FormState, form: FormData): Promise<FormState> {
  await requireAdmin();
  const qty = Number(form.get("quantity"));
  if (!Number.isInteger(qty) || qty < 0 || qty > 100_000) return { error: "Quantidade inválida." };
  const now = new Date();
  const taken = await db.ticket.count({
    where: { batchId, OR: [{ status: "VALID" }, { status: "RESERVED", order: { status: "PENDING", expiresAt: { gt: now } } }] },
  });
  if (qty < taken) return { error: `Mínimo ${taken}: já vendidos/reservados.` };
  await db.batch.update({ where: { id: batchId }, data: { quantity: qty } });
  revalidatePath("/admin");
  return { ok: "Quantidade atualizada." };
}

// ───────── cortesias ─────────

const courtesySchema = z.object({
  batchId: z.string().min(1, "Escolha o lote de cortesia."),
  name: z.string().trim().min(3, "Informe o nome."),
  email: z.email("E-mail inválido.").trim().toLowerCase(),
  phone: z.string().transform((s) => s.replace(/\D/g, "")),
  qty: z.coerce.number().int().min(1, "Mínimo 1.").max(20, "Máximo 20 por vez."),
  note: z.string().trim().max(80),
});

export async function createCourtesyAction(_prev: FormState, form: FormData): Promise<FormState> {
  await requireAdmin();
  const parsed = courtesySchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const event = await activeEvent();
  if (!event) return { error: "Nenhum evento ativo." };
  try {
    const order = await createCourtesy({ eventId: event.id, ...parsed.data });
    await deliverTickets(order.id);
    revalidatePath("/admin/cortesias");
    return { ok: `Cortesia ${order.code} emitida e enviada para ${parsed.data.email}.` };
  } catch (e) {
    if (e instanceof SaleError) return { error: e.message };
    throw e;
  }
}

// ───────── pedidos ─────────

export async function resendAction(orderId: string) {
  await requireAdmin();
  const order = await db.order.findUniqueOrThrow({ where: { id: orderId } });
  if (order.status !== "PAID") throw new Error("Só pedidos pagos têm ingresso para reenviar.");
  await deliverTickets(orderId);
  revalidatePath("/admin/pedidos");
}

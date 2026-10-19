"use server";

import { holdingOrder } from "@/lib/batches";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import QRCode from "qrcode";
import { redirect } from "next/navigation";
import { z } from "zod";
import { endSession, passwordOk, requireAdmin, startSession } from "@/lib/admin-auth";
import { activeEvent } from "@/lib/admin-data";
import { db } from "@/lib/db";
import { deliverTickets } from "@/lib/delivery";
import { createCourtesy, SaleError } from "@/lib/orders";
import { blocked, clientIp, fail } from "@/lib/rate-limit";
import { audit } from "@/lib/audit";
import { createDevice } from "@/lib/portaria-auth";

export type FormState = { ok?: string; error?: string } | undefined;

// ───────── sessão ─────────

export async function loginAction(_prev: FormState, form: FormData): Promise<FormState> {
  // atraso fixo + bloqueio por conexão depois de 5 erros em 15 min: freia quem tenta adivinhar a senha
  await new Promise((r) => setTimeout(r, 600));
  const key = `login:${await clientIp()}`;
  if (blocked(key, 5, 15 * 60_000)) return { error: "Muitas tentativas erradas. Aguarde 15 minutos." };
  if (!passwordOk(String(form.get("password") ?? ""))) {
    fail(key);
    await audit("painel", "login recusado", `IP ${key.slice(6)}`);
    return { error: "Senha incorreta." };
  }
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
  const b = await db.batch.update({ where: { id: batchId }, data: { closedAt: new Date() }, include: { ticketType: true } });
  await audit("painel", "virou o lote", `${b.ticketType.name} · ${b.name}`);
  revalidatePath("/admin");
}

/** Reabre um lote encerrado (ele volta a vender antes dos lotes seguintes). */
export async function reopenBatchAction(batchId: string) {
  await requireAdmin();
  const b = await db.batch.update({ where: { id: batchId }, data: { closedAt: null, endsAt: null }, include: { ticketType: true } });
  await audit("painel", "reabriu o lote", `${b.ticketType.name} · ${b.name}`);
  revalidatePath("/admin");
}

export async function togglePauseAction(ticketTypeId: string) {
  await requireAdmin();
  const t = await db.ticketType.findUniqueOrThrow({ where: { id: ticketTypeId } });
  await db.ticketType.update({ where: { id: ticketTypeId }, data: { paused: !t.paused } });
  await audit("painel", t.paused ? "retomou as vendas" : "pausou as vendas", t.name);
  revalidatePath("/admin");
}

/** Ajusta a quantidade de um lote. Nunca abaixo do que já foi vendido + reservado agora. */
export async function updateQuantityAction(batchId: string, _prev: FormState, form: FormData): Promise<FormState> {
  await requireAdmin();
  const qty = Number(form.get("quantity"));
  if (!Number.isInteger(qty) || qty < 0 || qty > 100_000) return { error: "Quantidade inválida." };
  const now = new Date();
  const taken = await db.ticket.count({
    where: { batchId, OR: [{ status: "VALID" }, { status: "RESERVED", order: holdingOrder(now) }] },
  });
  if (qty < taken) return { error: `Mínimo ${taken}: já vendidos/reservados.` };
  const b = await db.batch.update({ where: { id: batchId }, data: { quantity: qty }, include: { ticketType: true } });
  await audit("painel", "mudou a quantidade do lote", `${b.ticketType.name} · ${b.name}: ${qty}`);
  revalidatePath("/admin");
  return { ok: "Quantidade atualizada." };
}

// ───────── Pix em 2x ─────────

/** Liga/desliga o Pix em 2x e define em quantos dias (depois da 1ª parcela) vence a 2ª. */
export async function updateSplitPixAction(eventId: string, _prev: FormState, form: FormData): Promise<FormState> {
  await requireAdmin();
  const days = Number(form.get("days"));
  if (!Number.isInteger(days) || days < 1 || days > 90) return { error: "Prazo de 1 a 90 dias." };
  const enabled = form.get("enabled") === "on";
  await db.event.update({ where: { id: eventId }, data: { splitPixEnabled: enabled, splitPixDays: days } });
  await audit("painel", enabled ? "ligou o Pix em 2x" : "desligou o Pix em 2x", `prazo da 2ª parcela: ${days} dia(s)`);
  revalidatePath("/admin");
  return { ok: enabled ? `Pix em 2x ligado · 2ª parcela em até ${days} dia(s).` : "Pix em 2x desligado." };
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
    await audit("painel", "emitiu cortesia", `${parsed.data.qty}x para ${parsed.data.name} (${order.code})${parsed.data.note ? ` · ${parsed.data.note}` : ""}`);
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
  await audit("painel", "reenviou ingressos", `pedido ${order.code}`);
  revalidatePath("/admin/pedidos");
}

/**
 * QR vazou (print no Instagram, celular roubado...): todos os ingressos ainda não usados do pedido
 * ganham QR novo, o antigo passa a ser recusado na portaria, e o cliente recebe o link de novo.
 */
export async function reissueAction(orderId: string) {
  await requireAdmin();
  const order = await db.order.findUniqueOrThrow({ where: { id: orderId } });
  if (order.status !== "PAID") throw new Error("Só pedidos pagos têm QR para reemitir.");
  const { count } = await db.ticket.updateMany({ where: { orderId, status: "VALID", usedAt: null }, data: { qrVersion: { increment: 1 } } });
  await deliverTickets(orderId);
  await audit("painel", "reemitiu QR", `pedido ${order.code}: ${count} ingresso(s); os QR anteriores não valem mais`);
  revalidatePath("/admin/pedidos");
}

// ───────── portaria ─────────

export type DeviceState = { error?: string; name?: string; link?: string; qr?: string } | undefined;

/** Autoriza um aparelho e devolve o link de ativação (com QR para o celular do porteiro ler). Aparece uma vez só. */
export async function createDeviceAction(_prev: DeviceState, form: FormData): Promise<DeviceState> {
  await requireAdmin();
  const name = String(form.get("name") ?? "").trim();
  if (name.length < 2) return { error: "Dê um nome ao aparelho (ex.: Portão 1)." };
  const { token } = await createDevice(name);
  // link com o endereço pelo qual o painel foi aberto (funciona no domínio e no IP da rede local em testes)
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") || /^\d/.test(host) ? "http" : "https");
  // o código vai depois do "#": não aparece em log de servidor nem é enviado em requisições
  const link = `${proto}://${host}/portaria/ativar#${token}`;
  const qr = await QRCode.toDataURL(link, { margin: 1, width: 320 });
  await audit("painel", "autorizou aparelho da portaria", name);
  revalidatePath("/admin/portaria");
  return { name, link, qr };
}

export async function revokeDeviceAction(deviceId: string) {
  await requireAdmin();
  const d = await db.portariaDevice.update({ where: { id: deviceId }, data: { revokedAt: new Date() } });
  await audit("painel", "desautorizou aparelho da portaria", d.name);
  revalidatePath("/admin/portaria");
}

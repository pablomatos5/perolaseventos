"use server";

import { holdingOrder } from "@/lib/batches";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import QRCode from "qrcode";
import { redirect } from "next/navigation";
import { z } from "zod";
import { checkPassword, endSession, requireAdmin, requireDev, startSession } from "@/lib/admin-auth";
import { activeEvent } from "@/lib/admin-data";
import { db } from "@/lib/db";
import { deliverTickets } from "@/lib/delivery";
import { createCourtesy, SaleError } from "@/lib/orders";
import { blocked, clientIp, fail } from "@/lib/rate-limit";
import { audit } from "@/lib/audit";
import { formatBRL } from "@/lib/format";
import { createDevice } from "@/lib/portaria-auth";
import { connectedAccount, disconnectAccount } from "@/lib/mp-account";
import { refundPayments } from "@/lib/mercadopago";

export type FormState = { ok?: string; error?: string } | undefined;

// ───────── sessão ─────────

export async function loginAction(_prev: FormState, form: FormData): Promise<FormState> {
  // atraso fixo + bloqueio por conexão depois de 5 erros em 15 min: freia quem tenta adivinhar a senha
  await new Promise((r) => setTimeout(r, 600));
  const key = `login:${await clientIp()}`;
  if (blocked(key, 5, 15 * 60_000)) return { error: "Muitas tentativas erradas. Aguarde 15 minutos." };
  const role = checkPassword(String(form.get("password") ?? ""));
  if (!role) {
    fail(key);
    await audit("painel", "login recusado", `IP ${key.slice(6)}`);
    return { error: "Senha incorreta." };
  }
  await startSession(role);
  await audit(role === "dev" ? "dev" : "painel", "entrou no painel", role === "dev" ? "acesso de desenvolvedor" : "acesso da equipe");
  redirect(safeNext(form.get("next")));
}

/** Para onde voltar depois do login: só páginas do painel ou o "Conectar Mercado Pago" (nunca outro site). */
function safeNext(raw: FormDataEntryValue | null) {
  const next = typeof raw === "string" ? raw : "";
  if (next === "/api/mercadopago/conectar") return next;
  if (/^\/admin(\/[a-z0-9/-]*)?(\?[\w=&%-]*)?$/i.test(next) && !next.startsWith("/admin/login")) return next;
  return "/admin";
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
  const offline = (await db.batch.findUniqueOrThrow({ where: { id: batchId }, select: { soldOffline: true } })).soldOffline;
  const taken =
    offline +
    (await db.ticket.count({
      where: { batchId, OR: [{ status: "VALID" }, { status: "RESERVED", order: holdingOrder(now) }] },
    }));
  if (qty < taken) return { error: `Mínimo ${taken}: já vendidos/reservados${offline ? ` (inclui ${offline} vendidos fora do site)` : ""}.` };
  const b = await db.batch.update({ where: { id: batchId }, data: { quantity: qty }, include: { ticketType: true } });
  await audit("painel", "mudou a quantidade do lote", `${b.ticketType.name} · ${b.name}: ${qty}`);
  revalidatePath("/admin");
  return { ok: "Quantidade atualizada." };
}

/** "180", "180,00", "R$ 1.234,50" → centavos; vazio → null. */
function parseBRL(raw: FormDataEntryValue | null): number | null | "invalido" {
  const t = String(raw ?? "").replace(/[R$\s]/g, "").trim();
  if (!t) return null;
  const norm = t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t;
  const n = Number(norm);
  if (!Number.isFinite(n) || n < 0 || n > 100_000) return "invalido";
  return Math.round(n * 100);
}

/** Preço do lote: masculino obrigatório; feminino vazio = mesmo do masculino. Ingressos já vendidos mantêm o preço deles. */
export async function updatePriceAction(batchId: string, _prev: FormState, form: FormData): Promise<FormState> {
  await requireAdmin();
  const masc = parseBRL(form.get("masc"));
  const fem = parseBRL(form.get("fem"));
  if (masc === null || masc === "invalido") return { error: "Preço masculino inválido." };
  if (fem === "invalido") return { error: "Preço feminino inválido." };
  const b = await db.batch.update({
    where: { id: batchId },
    data: { priceCents: masc, femalePriceCents: fem === null || fem === masc ? null : fem },
    include: { ticketType: true },
  });
  const brl = (c: number) => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  await audit("painel", "mudou o preço do lote", `${b.ticketType.name} · ${b.name}: masc ${brl(masc)} · fem ${brl(fem ?? masc)}`);
  revalidatePath("/admin");
  revalidatePath("/");
  return { ok: "Preço salvo." };
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

// ───────── Mercado Pago (conta do evento + taxa do cartão) ─────────
export async function disconnectMpAction() {
  await requireAdmin();
  const acc = await connectedAccount();
  await disconnectAccount();
  if (acc) await audit("painel", "desconectou a conta Mercado Pago do evento", `${acc.nickname || "conta"} (${acc.mpUserId})`);
  revalidatePath("/admin");
}

export async function updateCardFeeAction(eventId: string, _prev: FormState, form: FormData): Promise<FormState> {
  await requireAdmin();
  const pct = Number(String(form.get("percent") ?? "").replace(",", "."));
  if (!Number.isFinite(pct) || pct < 0 || pct > 15) return { error: "Taxa de 0 a 15%." };
  const bps = Math.round(pct * 100);
  await db.event.update({ where: { id: eventId }, data: { cardFeeBps: bps } });
  const label = `${(bps / 100).toFixed(2).replace(".", ",")}%`;
  await audit("painel", "mudou a taxa do cartão repassada", label);
  revalidatePath("/admin");
  return { ok: bps > 0 ? `Cartão com acréscimo de ${label} (o evento recebe o valor cheio).` : "Cartão pelo mesmo preço do Pix." };
}

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
 * Estorno total pelo Mercado Pago. Só para os desenvolvedores: a equipe não vê o botão, e um POST direto
 * com a sessão da equipe também é recusado aqui (requireDev). Devolve o dinheiro ao comprador, a comissão
 * volta junto e os QRs do pedido param de valer.
 */
export async function refundOrderAction(orderId: string) {
  await requireDev();
  let to = "/admin/pedidos?estorno=ok";
  try {
    const { order, payments } = await refundPayments(orderId);
    await audit("dev", "estornou o pedido", `pedido ${order.code} · ${formatBRL(order.totalCents)} · pagamento(s) ${payments.join(", ")}`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[mercadopago] estorno falhou:", e);
    await audit("dev", "estorno falhou", `pedido ${orderId}: ${msg}`);
    to = `/admin/pedidos?estorno=erro&msg=${encodeURIComponent(msg.slice(0, 160))}`;
  }
  revalidatePath("/admin/pedidos");
  redirect(to);
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

import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { genderLabel } from "@/lib/format";

export type CheckinResult = {
  result: "ok" | "used" | "invalid" | "exit";
  reentry?: boolean; // "ok" de quem já tinha saído (não conta como nova entrada)
  exitsLeft?: number;
  message: string;
  ticketId?: string;
  holder?: string;
  type?: string;
  batch?: string;
  gender?: string;
  code?: string;
  usedAt?: string;
  usedBy?: string;
};

const ticketInclude = { ticketType: true, batch: true, order: { select: { code: true, paymentRef: true } } } satisfies Prisma.TicketInclude;

// Pagamento simulado (modo demonstração) grava paymentRef "mock_<código>": esses ingressos não entram na festa.
const DEMO_REF = "mock_";
/** Filtro de pedido "de verdade" (pago por gateway ou cortesia), para a portaria. */
// (OR com null: no SQL, NOT LIKE de um valor nulo dá nulo e excluiria o pedido)
export const REAL_ORDER = {
  OR: [{ paymentRef: null }, { NOT: { paymentRef: { startsWith: DEMO_REF } } }],
} satisfies Prisma.OrderWhereInput;
type TicketFull = Prisma.TicketGetPayload<{ include: typeof ticketInclude }>;

const info = (t: TicketFull) => ({
  ticketId: t.id,
  holder: t.holderName,
  type: t.ticketType.name,
  batch: t.batch.name,
  gender: genderLabel(t.gender),
  code: t.order.code,
});

const hhmm = (d: Date) => d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Belem" });

/**
 * Dá entrada num ingresso. O UPDATE condicional (usedAt IS NULL) é atômico: se dois aparelhos lerem
 * o mesmo QR ao mesmo tempo, só um recebe "liberado". `version` (do QR) precisa ser a atual:
 * QR reemitido/transferido não passa. `version: null` = liberação manual (busca por nome), sem QR.
 */
export async function checkIn(opts: {
  ticketId: string;
  version: number | null;
  device: string;
  method: "qr" | "manual" | "offline";
  at?: Date;
}): Promise<CheckinResult> {
  const at = opts.at && opts.at < new Date() ? opts.at : new Date();
  const { count } = await db.ticket.updateMany({
    where: { id: opts.ticketId, status: "VALID", usedAt: null, ...(opts.version !== null ? { qrVersion: opts.version } : {}), order: REAL_ORDER },
    data: { usedAt: at, usedBy: opts.device.slice(0, 40), checkinMethod: opts.method },
  });

  const t = await db.ticket.findUnique({ where: { id: opts.ticketId }, include: ticketInclude });
  if (!t) return { result: "invalid", message: "Ingresso não encontrado" };
  if (count === 1) {
    if (t.lastExitAt) return { result: "ok", reentry: true, message: `Reentrada · saiu às ${hhmm(t.lastExitAt)}`, ...info(t), exitsLeft: MAX_EXITS - t.exitCount };
    return { result: "ok", message: "Liberado", ...info(t) };
  }
  if (t.order.paymentRef?.startsWith(DEMO_REF)) return { result: "invalid", message: "Ingresso de demonstração: não vale para o evento", ...info(t) };
  if (t.status !== "VALID") return { result: "invalid", message: "Ingresso não pago ou cancelado", ...info(t) };
  if (opts.version !== null && t.qrVersion !== opts.version) {
    return { result: "invalid", message: "QR antigo: este ingresso foi reemitido ou transferido", ...info(t) };
  }
  return { result: "used", message: `Já utilizado às ${hhmm(t.usedAt!)} (${t.usedBy})`, ...info(t), usedAt: t.usedAt!.toISOString(), usedBy: t.usedBy ?? "" };
}

/** Quantas vezes um convidado pode sair e voltar com o mesmo ingresso. */
export const MAX_EXITS = 2;

/**
 * Saída temporária: o convidado quer sair e voltar. O ingresso precisa estar DENTRO (já usado); a saída
 * zera a entrada para o mesmo QR passar UMA vez de novo. Atômico como a entrada: dois aparelhos não
 * registram a mesma saída duas vezes. Continua valendo uma pessoa dentro por ingresso. Limite MAX_EXITS.
 * `version: null` = pela busca por nome (sem QR).
 */
export async function registerExit(opts: { ticketId: string; version: number | null; device: string; at?: Date }): Promise<CheckinResult> {
  const at = opts.at && opts.at < new Date() ? opts.at : new Date();
  const { count } = await db.ticket.updateMany({
    where: {
      id: opts.ticketId,
      status: "VALID",
      usedAt: { not: null },
      exitCount: { lt: MAX_EXITS },
      ...(opts.version !== null ? { qrVersion: opts.version } : {}),
      order: REAL_ORDER,
    },
    data: { usedAt: null, usedBy: null, exitCount: { increment: 1 }, lastExitAt: at },
  });
  const t = await db.ticket.findUnique({ where: { id: opts.ticketId }, include: ticketInclude });
  if (!t) return { result: "invalid", message: "Ingresso não encontrado" };
  if (count === 1) {
    const left = MAX_EXITS - t.exitCount;
    return { result: "exit", message: `Saída registrada · pode voltar com o mesmo QR`, ...info(t), exitsLeft: left };
  }
  if (t.status !== "VALID" || t.order.paymentRef?.startsWith(DEMO_REF)) return { result: "invalid", message: "Ingresso não pago ou cancelado", ...info(t) };
  if (opts.version !== null && t.qrVersion !== opts.version) return { result: "invalid", message: "QR antigo: este ingresso foi reemitido ou transferido", ...info(t) };
  if (!t.usedAt && t.lastExitAt) return { result: "invalid", message: `Saída já registrada às ${hhmm(t.lastExitAt)}: ainda não voltou`, ...info(t) };
  if (!t.usedAt) return { result: "invalid", message: "Este ingresso ainda não entrou: não há saída para registrar", ...info(t) };
  return { result: "invalid", message: `Limite de ${MAX_EXITS} saídas atingido: se sair, não volta com este ingresso`, ...info(t), exitsLeft: 0 };
}

/** Evento da portaria: o publicado mais próximo, valendo até 36 h depois do início (a festa vira a noite). */
export function portariaEvent() {
  return db.event.findFirst({
    where: { published: true, startsAt: { gt: new Date(Date.now() - 36 * 3_600_000) } },
    orderBy: { startsAt: "asc" },
  });
}

import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";

export type CheckinResult = {
  result: "ok" | "used" | "invalid";
  message: string;
  ticketId?: string;
  holder?: string;
  type?: string;
  batch?: string;
  half?: boolean;
  code?: string;
  usedAt?: string;
  usedBy?: string;
};

const ticketInclude = { ticketType: true, batch: true, order: { select: { code: true } } } satisfies Prisma.TicketInclude;
type TicketFull = Prisma.TicketGetPayload<{ include: typeof ticketInclude }>;

const info = (t: TicketFull) => ({
  ticketId: t.id,
  holder: t.holderName,
  type: t.ticketType.name,
  batch: t.batch.name,
  half: t.isHalf,
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
    where: { id: opts.ticketId, status: "VALID", usedAt: null, ...(opts.version !== null ? { qrVersion: opts.version } : {}) },
    data: { usedAt: at, usedBy: opts.device.slice(0, 40), checkinMethod: opts.method },
  });

  const t = await db.ticket.findUnique({ where: { id: opts.ticketId }, include: ticketInclude });
  if (!t) return { result: "invalid", message: "Ingresso não encontrado" };
  if (count === 1) return { result: "ok", message: "Liberado", ...info(t) };
  if (t.status !== "VALID") return { result: "invalid", message: "Ingresso não pago ou cancelado", ...info(t) };
  if (opts.version !== null && t.qrVersion !== opts.version) {
    return { result: "invalid", message: "QR antigo: este ingresso foi reemitido ou transferido", ...info(t) };
  }
  return { result: "used", message: `Já utilizado às ${hhmm(t.usedAt!)} (${t.usedBy})`, ...info(t), usedAt: t.usedAt!.toISOString(), usedBy: t.usedBy ?? "" };
}

/** Evento da portaria: o publicado mais próximo, valendo até 36 h depois do início (a festa vira a noite). */
export function portariaEvent() {
  return db.event.findFirst({
    where: { published: true, startsAt: { gt: new Date(Date.now() - 36 * 3_600_000) } },
    orderBy: { startsAt: "asc" },
  });
}

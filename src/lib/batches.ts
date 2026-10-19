import type { Batch, Prisma } from "@/generated/prisma/client";

type Tx = Prisma.TransactionClient;

export type BatchState =
  | { state: "open"; batch: Batch; remaining: number; nextBatch: Batch | null }
  | { state: "soon"; batch: Batch } // próximo lote ainda não começou (data de início no futuro)
  | { state: "soldout" }
  | { state: "paused" };

/** Reserva que ainda segura a vaga: pagamento pendente ou Pix em 2x com a 1ª parcela paga, dentro do prazo. */
export const holdingOrder = (now: Date) => ({ status: { in: ["PENDING", "PARTIAL"] as ("PENDING" | "PARTIAL")[] }, expiresAt: { gt: now } });

/** Ingressos que ocupam vaga no lote: pagos + reservas ainda dentro do prazo. */
export function occupiedCount(tx: Tx, batchId: string, now: Date) {
  return tx.ticket.count({
    where: {
      batchId,
      OR: [{ status: "VALID" }, { status: "RESERVED", order: holdingOrder(now) }],
    },
  });
}

/**
 * Descobre o lote à venda de um tipo de ingresso.
 * Regra: o lote encerra no que vier primeiro — esgotar ou passar da data fim — e o próximo abre sozinho.
 * Com `persist`, grava `closedAt` nos lotes vencidos (só dentro da transação de reserva/pagamento).
 */
export async function currentBatch(
  tx: Tx,
  ticketType: { id: string; paused: boolean },
  now: Date,
  persist = false,
): Promise<BatchState> {
  if (ticketType.paused) return { state: "paused" };

  const batches = await tx.batch.findMany({
    where: { ticketTypeId: ticketType.id, hidden: false, closedAt: null },
    orderBy: { sortOrder: "asc" },
  });

  for (let i = 0; i < batches.length; i++) {
    const b = batches[i];
    if (b.endsAt && b.endsAt <= now) {
      if (persist) await tx.batch.update({ where: { id: b.id }, data: { closedAt: now } });
      continue;
    }
    if (b.startsAt && b.startsAt > now) return { state: "soon", batch: b };

    const occupied = await occupiedCount(tx, b.id, now);
    if (occupied >= b.quantity) continue; // cheio (talvez só por reservas pendentes): passa para o próximo

    return { state: "open", batch: b, remaining: b.quantity - occupied, nextBatch: batches[i + 1] ?? null };
  }
  return { state: "soldout" };
}

/** Quando um lote vende, os anteriores fecham de vez: sobras de reservas expiradas não reabrem lote antigo. */
export function closeEarlierBatches(tx: Tx, batch: Batch, now: Date) {
  return tx.batch.updateMany({
    where: { ticketTypeId: batch.ticketTypeId, sortOrder: { lt: batch.sortOrder }, closedAt: null, hidden: false },
    data: { closedAt: now },
  });
}

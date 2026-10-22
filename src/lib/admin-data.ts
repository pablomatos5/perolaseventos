import { holdingOrder } from "@/lib/batches";
import { currentBatch } from "@/lib/batches";
import { db } from "@/lib/db";

/** Evento que o painel administra: o próximo publicado (o mesmo que a página inicial vende). */
export function activeEvent() {
  return db.event.findFirst({ where: { published: true, startsAt: { gt: new Date() } }, orderBy: { startsAt: "asc" } });
}

export type BatchRow = {
  id: string;
  name: string;
  priceCents: number;
  femalePriceCents: number | null; // vazio = mesmo preço do masculino
  quantity: number;
  hidden: boolean;
  sold: number;
  soldOffline: number; // vendidos fora do site: ocupam vaga, não entram na receita
  reserved: number;
  checkedIn: number;
  revenueCents: number;
  remaining: number;
  state: "à venda" | "na fila" | "esgotado" | "encerrado" | "agendado" | "cortesia";
  closedAt: Date | null;
};

const countMap = (rows: { batchId: string; _count: { _all: number }; _sum?: { priceCents: number | null } }[]) =>
  new Map(rows.map((r) => [r.batchId, { n: r._count._all, sum: r._sum?.priceCents ?? 0 }]));

/** Vendas por setor e lote: vendidos, reservados agora, check-ins, receita e estado do lote. */
export async function batchReport(eventId: string) {
  const now = new Date();
  const inEvent = { batch: { ticketType: { eventId } } };
  const [types, sold, reserved, used] = await Promise.all([
    db.ticketType.findMany({ where: { eventId }, orderBy: { sortOrder: "asc" }, include: { batches: { orderBy: { sortOrder: "asc" } } } }),
    db.ticket.groupBy({ by: ["batchId"], where: { ...inEvent, status: "VALID" }, _count: { _all: true }, _sum: { priceCents: true } }),
    db.ticket.groupBy({
      by: ["batchId"],
      where: { ...inEvent, status: "RESERVED", order: holdingOrder(now) },
      _count: { _all: true },
    }),
    db.ticket.groupBy({ by: ["batchId"], where: { ...inEvent, status: "VALID", usedAt: { not: null } }, _count: { _all: true } }),
  ]);
  const soldM = countMap(sold);
  const resM = countMap(reserved);
  const usedM = countMap(used);

  return Promise.all(
    types.map(async (t) => {
      const current = await currentBatch(db, t, now);
      const rows: BatchRow[] = t.batches.map((b) => {
        const s = soldM.get(b.id)?.n ?? 0;
        const r = resM.get(b.id)?.n ?? 0;
        let state: BatchRow["state"];
        if (b.hidden) state = "cortesia";
        else if (b.closedAt) state = "encerrado";
        else if (current.state === "open" && current.batch.id === b.id) state = "à venda";
        else if (b.startsAt && b.startsAt > now) state = "agendado";
        else if (s + r + b.soldOffline >= b.quantity) state = "esgotado";
        else state = "na fila";
        return {
          id: b.id,
          name: b.name,
          priceCents: b.priceCents,
          femalePriceCents: b.femalePriceCents,
          quantity: b.quantity,
          hidden: b.hidden,
          sold: s,
          soldOffline: b.soldOffline,
          reserved: r,
          checkedIn: usedM.get(b.id)?.n ?? 0,
          revenueCents: soldM.get(b.id)?.sum ?? 0,
          remaining: Math.max(0, b.quantity - s - r - b.soldOffline),
          state,
          closedAt: b.closedAt,
        };
      });
      return { id: t.id, name: t.name, paused: t.paused, rows };
    }),
  );
}

export async function kpis(eventId: string) {
  const now = new Date();
  const [paid, courtesies, checkins, pending, revenue, late, partial] = await Promise.all([
    db.ticket.count({ where: { status: "VALID", priceCents: { gt: 0 }, order: { eventId } } }),
    db.ticket.count({ where: { status: "VALID", priceCents: 0, order: { eventId } } }),
    db.ticket.count({ where: { status: "VALID", usedAt: { not: null }, order: { eventId } } }),
    db.order.count({ where: { eventId, status: "PENDING", expiresAt: { gt: now } } }),
    db.order.aggregate({ where: { eventId, status: "PAID" }, _sum: { totalCents: true, feeCents: true } }),
    db.order.count({ where: { eventId, status: "PAID", paidLate: true } }),
    db.order.count({ where: { eventId, status: "PARTIAL", expiresAt: { gt: now } } }),
  ]);
  const feeCents = revenue._sum.feeCents ?? 0;
  return { paid, courtesies, checkins, pending, partial, revenueCents: (revenue._sum.totalCents ?? 0) - feeCents, feeCents, late };
}

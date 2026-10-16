import { db } from "@/lib/db";
import { closeEarlierBatches, currentBatch, occupiedCount } from "@/lib/batches";
import { femalePrice, SERVICE_FEE_CENTS } from "@/lib/format";
import { orderCode } from "@/lib/tokens";

// 15 min: dá tempo de abrir o app do banco para o Pix ou digitar o cartão no Mercado Pago.
export const RESERVATION_MINUTES = 15;

export class SaleError extends Error {}

export type ReservationInput = {
  eventId: string;
  buyerName: string;
  email: string;
  phone: string;
  cpf: string;
  items: { ticketTypeId: string; masc: number; fem: number }[];
};

/**
 * Reserva os ingressos e trava o preço do lote atual por RESERVATION_MINUTES.
 * O `FOR UPDATE` na linha do tipo de ingresso enfileira compradores simultâneos:
 * dois clientes nunca levam o último ingresso do lote ao mesmo tempo.
 */
export async function createReservation(input: ReservationInput) {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + RESERVATION_MINUTES * 60_000);

  // defesa extra: soma itens repetidos do mesmo setor (estoque e máximo por pedido valem para o total)
  const merged = new Map<string, { ticketTypeId: string; masc: number; fem: number }>();
  for (const it of input.items) {
    const m = merged.get(it.ticketTypeId) ?? { ticketTypeId: it.ticketTypeId, masc: 0, fem: 0 };
    m.masc += it.masc;
    m.fem += it.fem;
    merged.set(it.ticketTypeId, m);
  }

  return db.$transaction(async (tx) => {
    const tickets: { ticketTypeId: string; batchId: string; priceCents: number; gender: "MASCULINO" | "FEMININO"; holderName: string }[] = [];

    for (const item of merged.values()) {
      const qty = item.masc + item.fem;
      if (qty <= 0) continue;

      await tx.$queryRaw`SELECT id FROM "TicketType" WHERE id = ${item.ticketTypeId} FOR UPDATE`;
      const type = await tx.ticketType.findFirst({ where: { id: item.ticketTypeId, eventId: input.eventId } });
      if (!type) throw new SaleError("Tipo de ingresso inválido.");
      if (qty > type.maxPerOrder) throw new SaleError(`Máximo de ${type.maxPerOrder} ingressos de ${type.name} por pedido.`);

      const current = await currentBatch(tx, type, now, true);
      if (current.state !== "open") throw new SaleError(`${type.name}: vendas indisponíveis no momento.`);
      if (qty > current.remaining) {
        throw new SaleError(`${type.name}: restam só ${current.remaining} ingresso(s) no ${current.batch.name}.`);
      }
      await closeEarlierBatches(tx, current.batch, now);

      for (let i = 0; i < qty; i++) {
        const fem = i < item.fem;
        tickets.push({
          ticketTypeId: type.id,
          batchId: current.batch.id,
          priceCents: fem ? femalePrice(current.batch) : current.batch.priceCents,
          gender: fem ? "FEMININO" : "MASCULINO",
          holderName: input.buyerName,
        });
      }
    }

    if (tickets.length === 0) throw new SaleError("Escolha pelo menos um ingresso.");
    const feeCents = tickets.length * SERVICE_FEE_CENTS;

    return tx.order.create({
      data: {
        code: orderCode(),
        eventId: input.eventId,
        buyerName: input.buyerName,
        email: input.email,
        phone: input.phone,
        cpf: input.cpf,
        totalCents: tickets.reduce((s, t) => s + t.priceCents, 0) + feeCents,
        feeCents,
        expiresAt,
        tickets: { create: tickets },
      },
    });
  });
}

/**
 * Chamado pelo webhook do gateway (ou pelo botão de simulação em dev). Idempotente:
 * o gateway pode reenviar o mesmo aviso várias vezes, e só a primeira emite os ingressos.
 * Retorna true se esta chamada foi a que confirmou o pedido.
 */
export async function markOrderPaid(orderId: string, paymentRef: string) {
  const now = new Date();
  return db.$transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { id: orderId } });
    if (!order) return false;

    const updated = await tx.order.updateMany({
      where: { id: orderId, status: { in: ["PENDING", "EXPIRED"] } },
      // Pix que cai depois da reserva expirar: o cliente pagou, então o ingresso sai mesmo assim
      // e fica marcado para conferência no painel.
      data: { status: "PAID", paidAt: now, paymentRef, paidLate: order.expiresAt < now },
    });
    if (updated.count === 0) return false;

    await tx.ticket.updateMany({ where: { orderId, status: "RESERVED" }, data: { status: "VALID" } });

    // Lote que esgotou com pagamentos confirmados fecha de vez.
    const batchIds = await tx.ticket.findMany({ where: { orderId }, select: { batchId: true }, distinct: ["batchId"] });
    for (const { batchId } of batchIds) {
      const batch = await tx.batch.findUniqueOrThrow({ where: { id: batchId } });
      const sold = await tx.ticket.count({ where: { batchId, status: "VALID" } });
      if (sold >= batch.quantity && !batch.closedAt) {
        await tx.batch.update({ where: { id: batchId }, data: { closedAt: now } });
      }
    }
    return true;
  });
}

/**
 * Cortesia/lista emitida pelo painel: pedido já PAGO, total zero, ingressos válidos num lote oculto.
 * Mesma trava da venda (FOR UPDATE no setor) para não estourar a quantidade do lote de cortesia.
 */
export async function createCourtesy(input: {
  eventId: string;
  batchId: string;
  name: string;
  email: string;
  phone: string;
  qty: number;
  note: string;
}) {
  const now = new Date();
  return db.$transaction(async (tx) => {
    const batch = await tx.batch.findUnique({ where: { id: input.batchId }, include: { ticketType: true } });
    if (!batch || batch.ticketType.eventId !== input.eventId) throw new SaleError("Lote de cortesia inválido.");
    await tx.$queryRaw`SELECT id FROM "TicketType" WHERE id = ${batch.ticketTypeId} FOR UPDATE`;
    const used = await occupiedCount(tx, batch.id, now);
    if (used + input.qty > batch.quantity) {
      throw new SaleError(`Restam só ${Math.max(0, batch.quantity - used)} cortesia(s) no lote "${batch.name}".`);
    }
    return tx.order.create({
      data: {
        code: orderCode(),
        eventId: input.eventId,
        buyerName: input.name,
        email: input.email,
        phone: input.phone,
        cpf: "",
        status: "PAID",
        totalCents: 0,
        expiresAt: now,
        paidAt: now,
        paymentRef: `cortesia${input.note ? `: ${input.note}` : ""}`.slice(0, 120),
        tickets: {
          create: Array.from({ length: input.qty }, () => ({
            ticketTypeId: batch.ticketTypeId,
            batchId: batch.id,
            priceCents: 0,
            holderName: input.name,
            status: "VALID" as const,
          })),
        },
      },
    });
  });
}

/** Estorno ou chargeback: o pedido sai de PAID e os QR codes deixam de passar na portaria. */
export async function refundOrder(orderId: string) {
  await db.$transaction([
    db.order.updateMany({ where: { id: orderId, status: "PAID" }, data: { status: "REFUNDED" } }),
    db.ticket.updateMany({ where: { orderId }, data: { status: "CANCELED" } }),
  ]);
}

import { db } from "@/lib/db";
import type { OrderStatus } from "@/generated/prisma/enums";

// Números mais detalhados do evento, só para a visão de desenvolvedor (/admin/insights).
// Tudo derivado do banco: ganho da taxa de serviço, funil de conversão, formas de pagamento,
// linha do tempo, entregas, portaria e check-in. Nada de segredo aqui — isso fica no .env.

const DAY_MS = 86_400_000;
const TZ = "America/Belem"; // UTC-3 fixo (sem horário de verão): dia "comercial" do evento

// chave YYYY-MM-DD e rótulo dd/MM no fuso do evento, para agrupar por dia sem pular por causa do fuso
const dayKeyFmt = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });
const dayLabelFmt = new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, day: "2-digit", month: "2-digit" });

export type StatusCounts = Record<OrderStatus, number>;

export type DevInsights = {
  // ganho dos desenvolvedores (taxa de serviço)
  feeConfirmedCents: number; // já recebido (pedidos pagos)
  feePendingCents: number; // em aberto (pendentes + Pix 2x na 1ª parcela)
  paidTickets: number; // ingressos pagos (base da taxa)
  // funil de conversão (só pedidos que cobram; cortesia não entra)
  attempts: number; // pedidos iniciados que cobram
  paidPaying: number; // desses, pagos
  status: StatusCounts; // contagem por situação
  revenueByStatusCents: Record<OrderStatus, number>; // valor em jogo por situação (total do cliente)
  // formas de pagamento (pedidos pagos que cobram)
  pay: { pixAvista: number; pix2x: number; cartaoOutros: number };
  // linha do tempo (últimos 14 dias, fuso do evento)
  timeline: { key: string; label: string; created: number; paid: number; revenueCents: number; feeCents: number }[];
  // ingressos
  gender: { masculino: number; feminino: number; cortesia: number };
  avgTicketCents: number;
  avgTicketsPerOrder: number;
  // operação
  checkins: number;
  delivery: { emailOk: number; emailFail: number; whatsOk: number; whatsFail: number };
  deliveryFails: { code: string; email: string; channel: string; detail: string; at: Date }[];
  devices: { active: number; revoked: number };
  pending: { active: number; soon: number; partialActive: number; partialOverdue: number; late: number };
  // tamanho do evento
  totals: { ticketTypes: number; batches: number };
};

const ZERO_STATUS: StatusCounts = { PENDING: 0, PARTIAL: 0, PAID: 0, EXPIRED: 0, CANCELED: 0, REFUNDED: 0 };

export async function devInsights(eventId: string): Promise<DevInsights> {
  const now = new Date();
  const since = new Date(now.getTime() - 13 * DAY_MS); // janela de 14 dias (hoje inclusive)
  const soon = new Date(now.getTime() + 3 * 60 * 60_000); // "expira em breve" = nas próximas 3h
  const inEvent = { order: { eventId } };

  const [
    byStatus,
    attempts,
    paidPaying,
    feeConfirmed,
    feePending,
    paidTicketsAgg,
    pixAvista,
    pix2x,
    withPix,
    genderRows,
    cortesias,
    avgTicket,
    checkins,
    deliveryRows,
    deliveryFails,
    devActive,
    devRevoked,
    pendingActive,
    pendingSoon,
    partialActive,
    partialOverdue,
    late,
    recent,
    ticketTypes,
    batches,
  ] = await Promise.all([
    db.order.groupBy({ by: ["status"], where: { eventId }, _count: { _all: true }, _sum: { totalCents: true } }),
    db.order.count({ where: { eventId, totalCents: { gt: 0 } } }),
    db.order.count({ where: { eventId, status: "PAID", totalCents: { gt: 0 } } }),
    db.order.aggregate({ where: { eventId, status: "PAID" }, _sum: { feeCents: true } }),
    db.order.aggregate({ where: { eventId, status: { in: ["PENDING", "PARTIAL"] }, expiresAt: { gt: now } }, _sum: { feeCents: true } }),
    db.ticket.count({ where: { status: "VALID", priceCents: { gt: 0 }, ...inEvent } }),
    db.order.count({ where: { eventId, status: "PAID", paymentPlan: "FULL", totalCents: { gt: 0 }, pixCharges: { some: { kind: "pix" } } } }),
    db.order.count({ where: { eventId, status: "PAID", paymentPlan: "PIX_2X" } }),
    db.order.count({ where: { eventId, status: "PAID", paymentPlan: "FULL", totalCents: { gt: 0 } } }),
    db.ticket.groupBy({ by: ["gender"], where: { status: "VALID", priceCents: { gt: 0 }, ...inEvent }, _count: { _all: true } }),
    db.ticket.count({ where: { status: "VALID", priceCents: 0, ...inEvent } }),
    db.ticket.aggregate({ where: { status: "VALID", priceCents: { gt: 0 }, ...inEvent }, _avg: { priceCents: true } }),
    db.ticket.count({ where: { status: "VALID", usedAt: { not: null }, ...inEvent } }),
    db.delivery.groupBy({ by: ["channel", "ok"], where: inEvent, _count: { _all: true } }),
    db.delivery.findMany({ where: { ok: false, ...inEvent }, orderBy: { createdAt: "desc" }, take: 8, include: { order: { select: { code: true, email: true } } } }),
    db.portariaDevice.count({ where: { revokedAt: null } }),
    db.portariaDevice.count({ where: { revokedAt: { not: null } } }),
    db.order.count({ where: { eventId, status: "PENDING", expiresAt: { gt: now } } }),
    db.order.count({ where: { eventId, status: "PENDING", expiresAt: { gt: now, lt: soon } } }),
    db.order.count({ where: { eventId, status: "PARTIAL", expiresAt: { gt: now } } }),
    db.order.count({ where: { eventId, status: "PARTIAL", expiresAt: { lt: now } } }),
    db.order.count({ where: { eventId, status: "PAID", paidLate: true } }),
    db.order.findMany({
      where: { eventId, createdAt: { gte: since } },
      select: { createdAt: true, paidAt: true, status: true, totalCents: true, feeCents: true },
    }),
    db.ticketType.count({ where: { eventId } }),
    db.batch.count({ where: { ticketType: { eventId } } }),
  ]);

  const status = { ...ZERO_STATUS };
  const revenueByStatusCents = { ...ZERO_STATUS };
  for (const r of byStatus) {
    status[r.status] = r._count._all;
    revenueByStatusCents[r.status] = r._sum.totalCents ?? 0;
  }

  // linha do tempo: 14 baldes por dia (do mais antigo ao hoje)
  const buckets = new Map<string, { label: string; created: number; paid: number; revenueCents: number; feeCents: number }>();
  for (let i = 0; i < 14; i++) {
    const d = new Date(since.getTime() + i * DAY_MS);
    buckets.set(dayKeyFmt.format(d), { label: dayLabelFmt.format(d), created: 0, paid: 0, revenueCents: 0, feeCents: 0 });
  }
  for (const o of recent) {
    const c = buckets.get(dayKeyFmt.format(o.createdAt));
    if (c) c.created++;
    if (o.status === "PAID" && o.paidAt) {
      const p = buckets.get(dayKeyFmt.format(o.paidAt));
      if (p) {
        p.paid++;
        p.feeCents += o.feeCents;
        p.revenueCents += o.totalCents - o.feeCents;
      }
    }
  }
  const timeline = [...buckets.entries()].map(([key, v]) => ({ key, ...v }));

  const genderOf = (g: "MASCULINO" | "FEMININO" | null) => genderRows.find((r) => r.gender === g)?._count._all ?? 0;

  return {
    feeConfirmedCents: feeConfirmed._sum.feeCents ?? 0,
    feePendingCents: feePending._sum.feeCents ?? 0,
    paidTickets: paidTicketsAgg,
    attempts,
    paidPaying,
    status,
    revenueByStatusCents,
    pay: { pixAvista, pix2x, cartaoOutros: Math.max(0, withPix - pixAvista) },
    timeline,
    gender: { masculino: genderOf("MASCULINO"), feminino: genderOf("FEMININO"), cortesia: cortesias },
    avgTicketCents: Math.round(avgTicket._avg.priceCents ?? 0),
    avgTicketsPerOrder: paidPaying ? paidTicketsAgg / paidPaying : 0,
    checkins,
    delivery: {
      emailOk: deliveryRows.find((r) => r.channel === "EMAIL" && r.ok)?._count._all ?? 0,
      emailFail: deliveryRows.find((r) => r.channel === "EMAIL" && !r.ok)?._count._all ?? 0,
      whatsOk: deliveryRows.find((r) => r.channel === "WHATSAPP" && r.ok)?._count._all ?? 0,
      whatsFail: deliveryRows.find((r) => r.channel === "WHATSAPP" && !r.ok)?._count._all ?? 0,
    },
    deliveryFails: deliveryFails.map((d) => ({ code: d.order.code, email: d.order.email, channel: d.channel, detail: d.detail, at: d.createdAt })),
    devices: { active: devActive, revoked: devRevoked },
    pending: { active: pendingActive, soon: pendingSoon, partialActive, partialOverdue, late },
    totals: { ticketTypes, batches },
  };
}

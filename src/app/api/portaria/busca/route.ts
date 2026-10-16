import type { Prisma } from "@/generated/prisma/client";
import { portariaEvent } from "@/lib/checkin";
import { db } from "@/lib/db";
import { deviceFromRequest } from "@/lib/portaria-auth";
import { genderLabel } from "@/lib/format";

/** Busca para quem chegou sem o QR (celular sem bateria, tela quebrada): nome, código do pedido ou CPF. */
export async function GET(req: Request) {
  const auth = await deviceFromRequest(req);
  if (!auth.ok) return Response.json({ message: auth.message }, { status: auth.status });

  const q = (new URL(req.url).searchParams.get("q") ?? "").trim().slice(0, 60);
  const event = await portariaEvent();
  if (!event || q.length < 3) return Response.json({ results: [] });

  const digits = q.replace(/\D/g, "");
  const or: Prisma.TicketWhereInput[] = [
    { holderName: { contains: q, mode: "insensitive" } },
    { order: { buyerName: { contains: q, mode: "insensitive" } } },
    { order: { code: q.toUpperCase() } },
  ];
  if (digits.length >= 4) or.push({ order: { cpf: { contains: digits } } });

  const tickets = await db.ticket.findMany({
    where: { status: { in: ["VALID", "CANCELED"] }, order: { eventId: event.id }, OR: or },
    include: { ticketType: true, batch: true, order: { select: { code: true, buyerName: true, cpf: true } } },
    orderBy: { holderName: "asc" },
    take: 30,
  });

  return Response.json({
    results: tickets.map((t) => ({
      ticketId: t.id,
      holder: t.holderName,
      buyer: t.order.buyerName,
      code: t.order.code,
      cpfEnd: t.order.cpf ? `***.${t.order.cpf.slice(6, 9)}-${t.order.cpf.slice(9)}` : "",
      type: t.ticketType.name,
      batch: t.batch.name,
      gender: genderLabel(t.gender),
      status: t.status,
      usedAt: t.usedAt,
      usedBy: t.usedBy,
    })),
  });
}


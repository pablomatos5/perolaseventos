import { portariaEvent, REAL_ORDER } from "@/lib/checkin";
import { db } from "@/lib/db";
import { deviceFromRequest } from "@/lib/portaria-auth";
import { ticketToken, tokenHash } from "@/lib/tokens";
import { genderLabel } from "@/lib/format";

/**
 * Lista para o modo offline: todos os ingressos válidos do evento, cada um com o hash do QR atual.
 * O aparelho compara o hash do QR lido com a lista, sem precisar da chave secreta (não dá para fabricar
 * QR a partir de um hash). Já-usados vêm marcados para o aparelho não liberar duas vezes.
 */
export async function GET(req: Request) {
  const auth = await deviceFromRequest(req);
  if (!auth.ok) return Response.json({ message: auth.message }, { status: auth.status });

  const event = await portariaEvent();
  if (!event) return Response.json({ event: null, at: new Date(), tickets: [] });

  const tickets = await db.ticket.findMany({
    where: { status: "VALID", order: { eventId: event.id, ...REAL_ORDER } },
    include: { ticketType: true, batch: true, order: { select: { code: true, buyerName: true } } },
  });

  return Response.json(
    {
      event: `${event.name} ${event.edition}`,
      at: new Date(),
      tickets: tickets.map((t) => ({
        h: tokenHash(ticketToken(t.id, t.qrVersion)),
        id: t.id,
        v: t.qrVersion,
        holder: t.holderName,
        buyer: t.order.buyerName,
        code: t.order.code,
        type: t.ticketType.name,
        batch: t.batch.name,
        gender: genderLabel(t.gender),
        usedAt: t.usedAt,
        usedBy: t.usedBy,
      })),
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}

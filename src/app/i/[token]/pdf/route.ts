import { connection } from "next/server";
import { db } from "@/lib/db";
import { ticketsPdf } from "@/lib/ticket-pdf";
import { verifyTicketLinkToken } from "@/lib/tokens";
import { genderLabel } from "@/lib/format";

/** PDF de um ingresso só (link individual). Link de versão antiga não gera PDF. */
export async function GET(_req: Request, ctx: { params: Promise<{ token: string }> }) {
  await connection();
  const parsed = verifyTicketLinkToken(decodeURIComponent((await ctx.params).token));
  if (!parsed) return new Response("Link inválido", { status: 404 });

  const t = await db.ticket.findUnique({
    where: { id: parsed.id },
    include: { ticketType: true, batch: true, order: { include: { event: true, tickets: { select: { id: true }, orderBy: { createdAt: "asc" } } } } },
  });
  if (!t || t.order.status !== "PAID" || t.status !== "VALID" || t.qrVersion !== parsed.version) {
    return new Response("Este link não vale mais: o ingresso foi transferido, reemitido ou cancelado.", { status: 410 });
  }

  const bytes = await ticketsPdf({
    event: t.order.event,
    orderCode: t.order.code,
    totalInOrder: t.order.tickets.length,
    startIndex: t.order.tickets.findIndex((x) => x.id === t.id),
    tickets: [
      { id: t.id, qrVersion: t.qrVersion, holder: t.holderName, type: t.ticketType.name, batch: t.batch.name, gender: genderLabel(t.gender), priceCents: t.priceCents, usedAt: t.usedAt },
    ],
  });
  return new Response(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="ingresso-perolas-${t.order.code}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}

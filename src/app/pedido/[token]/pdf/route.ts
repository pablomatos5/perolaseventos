import { connection } from "next/server";
import { db } from "@/lib/db";
import { ticketsPdf } from "@/lib/ticket-pdf";
import { verifyOrderToken } from "@/lib/tokens";

/** Todos os ingressos válidos do pedido num PDF (uma página por ingresso). */
export async function GET(_req: Request, ctx: { params: Promise<{ token: string }> }) {
  await connection();
  const orderId = verifyOrderToken(decodeURIComponent((await ctx.params).token));
  if (!orderId) return new Response("Pedido inválido", { status: 404 });

  const order = await db.order.findUnique({
    where: { id: orderId },
    include: { event: true, tickets: { include: { ticketType: true, batch: true }, orderBy: { createdAt: "asc" } } },
  });
  if (!order || order.status !== "PAID") return new Response("Pedido sem ingressos emitidos", { status: 404 });

  const valid = order.tickets.filter((t) => t.status === "VALID");
  const bytes = await ticketsPdf({
    event: order.event,
    orderCode: order.code,
    tickets: valid.map((t) => ({
      id: t.id,
      qrVersion: t.qrVersion,
      holder: t.holderName,
      type: t.ticketType.name,
      batch: t.batch.name,
      half: t.isHalf,
      priceCents: t.priceCents,
      usedAt: t.usedAt,
    })),
  });
  return new Response(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="ingressos-perolas-${order.code}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}

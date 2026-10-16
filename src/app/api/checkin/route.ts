import { timingSafeEqual } from "node:crypto";
import { db } from "@/lib/db";
import { verifyTicketToken } from "@/lib/tokens";

function pinOk(given: string | null) {
  const pin = process.env.PORTARIA_PIN ?? "";
  if (!pin || !given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(pin);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Validação na portaria. Celular, maquininha e leitor pistola chamam este mesmo endpoint.
 * O UPDATE condicional (usedAt IS NULL) é atômico: se dois aparelhos lerem o mesmo print
 * ao mesmo tempo, só um recebe "liberado".
 */
export async function POST(req: Request) {
  if (!pinOk(req.headers.get("x-portaria-pin"))) {
    return Response.json({ result: "unauthorized", message: "PIN da portaria incorreto" }, { status: 401 });
  }
  const { code, device } = (await req.json().catch(() => ({}))) as { code?: string; device?: string };
  const ticketId = code ? verifyTicketToken(code) : null;
  if (!ticketId) return Response.json({ result: "invalid", message: "QR inválido ou falsificado" });

  const now = new Date();
  const { count } = await db.ticket.updateMany({
    where: { id: ticketId, status: "VALID", usedAt: null },
    data: { usedAt: now, usedBy: (device ?? "portaria").slice(0, 40) },
  });

  const ticket = await db.ticket.findUnique({ where: { id: ticketId }, include: { ticketType: true, batch: true } });
  if (!ticket) return Response.json({ result: "invalid", message: "Ingresso não encontrado" });

  const info = { holder: ticket.holderName, type: ticket.ticketType.name, batch: ticket.batch.name, half: ticket.isHalf };
  if (count === 1) return Response.json({ result: "ok", message: "Liberado", ...info });
  if (ticket.status !== "VALID") return Response.json({ result: "invalid", message: "Ingresso não pago ou cancelado", ...info });

  const at = ticket.usedAt!.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Belem" });
  return Response.json({ result: "used", message: `Já utilizado às ${at} (${ticket.usedBy})`, ...info });
}

import { audit } from "@/lib/audit";
import { checkIn } from "@/lib/checkin";
import { deviceFromRequest } from "@/lib/portaria-auth";
import { verifyTicketToken } from "@/lib/tokens";

/**
 * Validação na portaria (celular, maquininha ou leitor pistola). Só aparelhos autorizados no painel.
 * Corpo: { code } = QR lido; ou { ticketId, manual: true } = liberação pela busca por nome.
 */
export async function POST(req: Request) {
  const auth = await deviceFromRequest(req);
  if (!auth.ok) return Response.json({ result: "unauthorized", message: auth.message }, { status: auth.status });

  const body = (await req.json().catch(() => ({}))) as { code?: string; ticketId?: string; manual?: boolean };

  if (body.manual && typeof body.ticketId === "string") {
    const r = await checkIn({ ticketId: body.ticketId, version: null, device: auth.name, method: "manual" });
    if (r.result === "ok") await audit(`portaria: ${auth.name}`, "entrada manual", `${r.holder} · pedido ${r.code}`);
    return Response.json(r);
  }

  const parsed = typeof body.code === "string" ? verifyTicketToken(body.code) : null;
  if (!parsed) return Response.json({ result: "invalid", message: "QR inválido ou falsificado" });
  return Response.json(await checkIn({ ticketId: parsed.id, version: parsed.version, device: auth.name, method: "qr" }));
}

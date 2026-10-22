import { audit } from "@/lib/audit";
import { MAX_EXITS, registerExit } from "@/lib/checkin";
import { deviceFromRequest } from "@/lib/portaria-auth";
import { verifyTicketToken } from "@/lib/tokens";

/**
 * Saída temporária na portaria (só aparelhos autorizados). Corpo: { code } = QR lido; ou
 * { ticketId } = pela busca por nome. O mesmo QR volta a valer para uma reentrada.
 */
export async function POST(req: Request) {
  const auth = await deviceFromRequest(req);
  if (!auth.ok) return Response.json({ result: "unauthorized", message: auth.message }, { status: auth.status });

  const body = (await req.json().catch(() => ({}))) as { code?: string; ticketId?: string };
  let r;
  if (typeof body.ticketId === "string") {
    r = await registerExit({ ticketId: body.ticketId, version: null, device: auth.name });
  } else {
    const parsed = typeof body.code === "string" ? verifyTicketToken(body.code) : null;
    if (!parsed) return Response.json({ result: "invalid", message: "QR inválido ou falsificado" });
    r = await registerExit({ ticketId: parsed.id, version: parsed.version, device: auth.name });
  }
  if (r.result === "exit") await audit(`portaria: ${auth.name}`, "registrou saída", `${r.holder} · pedido ${r.code} · ${MAX_EXITS - (r.exitsLeft ?? 0)} de ${MAX_EXITS}`);
  return Response.json(r);
}

import { audit } from "@/lib/audit";
import { checkIn, type CheckinResult } from "@/lib/checkin";
import { deviceFromRequest } from "@/lib/portaria-auth";

type Pending = { ticketId: string; version: number | null; at: string; manual?: boolean };

/**
 * Entradas feitas sem internet chegam aqui quando a conexão volta. Cada uma passa pela mesma trava
 * atômica: se outro aparelho já tinha liberado o mesmo ingresso, a resposta avisa (conflito).
 */
export async function POST(req: Request) {
  const auth = await deviceFromRequest(req);
  if (!auth.ok) return Response.json({ message: auth.message }, { status: auth.status });

  const body = (await req.json().catch(() => ({}))) as { checkins?: Pending[] };
  const list = Array.isArray(body.checkins) ? body.checkins.slice(0, 500) : [];
  const results: (CheckinResult & { localAt: string })[] = [];

  for (const p of list) {
    if (typeof p?.ticketId !== "string") continue;
    const at = new Date(p.at);
    const r = await checkIn({
      ticketId: p.ticketId,
      version: p.manual ? null : typeof p.version === "number" ? p.version : 0,
      device: auth.name,
      method: "offline",
      at: Number.isNaN(at.getTime()) ? undefined : at,
    });
    if (p.manual && r.result === "ok") await audit(`portaria: ${auth.name}`, "entrada manual (offline)", `${r.holder} · pedido ${r.code}`);
    results.push({ ...r, localAt: p.at });
  }
  const conflicts = results.filter((r) => r.result !== "ok").length;
  if (conflicts) await audit(`portaria: ${auth.name}`, "sincronização com conflito", `${conflicts} de ${results.length} entrada(s) offline já tinham sido usadas/invalidadas`);
  return Response.json({ results });
}

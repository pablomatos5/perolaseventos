import { db } from "@/lib/db";
import { REMINDER_TAGS, remindSecondInstallment, type ReminderKind } from "@/lib/delivery";

const HOUR = 3_600_000;

/** Hora atual em Belém (UTC−3, sem horário de verão). */
const belemHour = (d: Date) => new Date(d.getTime() - 3 * HOUR).getUTCHours();

/**
 * Pix em 2x: manda o lembrete da 2ª parcela para os pedidos parciais perto do vencimento.
 * - "3 dias": quando faltam até 72 h (pulado se a 1ª parcela entrou há menos de 24 h: o e-mail de
 *   confirmação acabou de informar o prazo);
 * - "último dia": quando faltam até 24 h (o prazo vence às 23h59, então chega na manhã do dia).
 * Só envia das 9h às 20h de Belém (nada de e-mail de madrugada) e nunca repete o mesmo lembrete:
 * cada envio fica em Delivery com o rótulo (REMINDER_TAGS). Chamado de hora em hora pela VPS.
 */
export async function sendSecondInstallmentReminders(now = new Date()) {
  const hour = belemHour(now);
  if (hour < 9 || hour > 20) return { sent: 0, skipped: "fora do horário (9h–20h de Belém)" };

  const orders = await db.order.findMany({
    where: { status: "PARTIAL", expiresAt: { gt: now, lte: new Date(now.getTime() + 72 * HOUR) } },
    select: { id: true, code: true, expiresAt: true, firstPaidAt: true, deliveries: { where: { ok: true }, select: { detail: true } } },
  });

  const sent: string[] = [];
  for (const o of orders) {
    const left = o.expiresAt.getTime() - now.getTime();
    const kind: ReminderKind = left <= 24 * HOUR ? "last" : "early";
    if (kind === "early" && o.firstPaidAt && now.getTime() - o.firstPaidAt.getTime() < 24 * HOUR) continue;
    if (o.deliveries.some((d) => d.detail.startsWith(REMINDER_TAGS[kind]))) continue;
    await remindSecondInstallment(o.id, kind);
    sent.push(`${o.code} (${kind === "last" ? "último dia" : "3 dias"})`);
  }
  return { sent: sent.length, orders: sent };
}

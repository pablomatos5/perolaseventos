import { timingSafeEqual } from "node:crypto";
import { sendSecondInstallmentReminders } from "@/lib/reminders";

/**
 * Tarefas de hora em hora (agendadas na VPS: /opt/perolaseventos-lembretes.sh, crontab do root).
 * Hoje: lembrete por e-mail da 2ª parcela do Pix em 2x. Protegida por CRON_SECRET (Authorization: Bearer).
 */
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET ?? "";
  if (secret.length < 32) return new Response("CRON_SECRET não configurado", { status: 503 });
  const given = Buffer.from((req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, ""));
  const expected = Buffer.from(secret);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return new Response("não autorizado", { status: 401 });

  const reminders = await sendSecondInstallmentReminders();
  if (reminders.sent > 0) console.log(`[lembretes] 2ª parcela: ${reminders.orders?.join(", ")}`);
  return Response.json({ reminders });
}

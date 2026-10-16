import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import { orderToken } from "@/lib/tokens";

export const orderLink = (orderId: string) => `${process.env.APP_URL}/pedido/${orderToken(orderId)}`;

/**
 * Envia o link do pedido (com os QR codes) por e-mail e, se o cliente aceitou, por WhatsApp.
 * Cada tentativa fica registrada em Delivery para o painel mostrar falhas e permitir reenviar.
 * Sem RESEND_API_KEY o e-mail é só impresso no terminal (modo desenvolvimento).
 */
export async function deliverTickets(orderId: string) {
  const order = await db.order.findUniqueOrThrow({ where: { id: orderId }, include: { event: true, tickets: true } });
  const link = orderLink(order.id);
  const subject = `Seus ingressos · ${order.event.name} ${order.event.edition}`;
  const text = [
    `Olá, ${order.buyerName}!`,
    ``,
    `Seu pedido ${order.code} está confirmado: ${order.tickets.length} ingresso(s) para ${order.event.name} ${order.event.edition}.`,
    `${formatDateTime(order.event.startsAt)} · ${order.event.venue}, ${order.event.city}`,
    ``,
    `Acesse seus QR codes: ${link}`,
    ``,
    `Mostre o QR na entrada. Cada ingresso só pode ser usado uma vez, não compartilhe prints.`,
  ].join("\n");

  await record(order.id, "EMAIL", () => sendEmail(order.email, subject, text));

  if (order.whatsappOptIn) {
    // Ligar quando a conta do WhatsApp Business (API oficial da Meta) e o template estiverem aprovados.
    await record(order.id, "WHATSAPP", async () => {
      throw new Error("WhatsApp ainda não configurado");
    });
  }
}

async function record(orderId: string, channel: "EMAIL" | "WHATSAPP", send: () => Promise<string>) {
  try {
    const detail = await send();
    await db.delivery.create({ data: { orderId, channel, ok: true, detail } });
  } catch (e) {
    await db.delivery.create({ data: { orderId, channel, ok: false, detail: String((e as Error).message) } });
  }
}

async function sendEmail(to: string, subject: string, text: string) {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.log(`\n[e-mail simulado] para ${to}\nAssunto: ${subject}\n${text}\n`);
    return "simulado (sem RESEND_API_KEY)";
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: process.env.EMAIL_FROM, to, subject, text }),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
  return "enviado";
}

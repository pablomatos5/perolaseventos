import { db } from "@/lib/db";
import { formatDateTime, genderLabel } from "@/lib/format";
import { ticketsPdf } from "@/lib/ticket-pdf";
import { orderToken } from "@/lib/tokens";

export const orderLink = (orderId: string) => `${process.env.APP_URL}/pedido/${orderToken(orderId)}`;

/**
 * Envia o link do pedido (com os QR codes) e o PDF dos ingressos por e-mail. O mesmo PDF fica para baixar
 * na página do pedido logo depois do pagamento.
 * Cada tentativa fica registrada em Delivery para o painel mostrar falhas e permitir reenviar.
 * Sem RESEND_API_KEY o e-mail é só impresso no terminal (modo desenvolvimento).
 */
export async function deliverTickets(orderId: string) {
  const order = await db.order.findUniqueOrThrow({
    where: { id: orderId },
    include: { event: true, tickets: { include: { ticketType: true, batch: true }, orderBy: { createdAt: "asc" } } },
  });
  const link = orderLink(order.id);
  const subject = `Seus ingressos · ${order.event.name} ${order.event.edition}`;
  const text = [
    `Olá, ${order.buyerName}!`,
    ``,
    `Seu pedido ${order.code} está confirmado: ${order.tickets.length} ingresso(s) para ${order.event.name} ${order.event.edition}.`,
    `${formatDateTime(order.event.startsAt)} · ${order.event.venue}, ${order.event.city}`,
    ``,
    `Seus ingressos estão no PDF anexo (abre sem internet). Para ver ou baixar de novo: ${link}`,
    ``,
    `Atenção:`,
    `- Não compartilhe o seu ingresso. Cada QR vale uma única entrada: depois de lido, não passa de novo.`,
    `- Masculino e feminino são conferidos na entrada. O ingresso feminino só vale para mulheres.`,
  ].join("\n");

  // PDF dos ingressos anexado; se a geração falhar, o e-mail sai mesmo assim com o link
  let pdf: Attachment | undefined;
  try {
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
        gender: genderLabel(t.gender),
        priceCents: t.priceCents,
        usedAt: t.usedAt,
      })),
    });
    pdf = { filename: `ingressos-perolas-${order.code}.pdf`, content: Buffer.from(bytes).toString("base64") };
  } catch (e) {
    console.error("[ingresso] PDF não gerado para o e-mail:", e);
  }

  await record(order.id, "EMAIL", () => sendEmail(order.email, subject, text, pdf));
}

/**
 * Pix em 2x: aviso de que a 1ª parcela entrou. Sem ingresso (ele só sai depois da 2ª):
 * só o valor que falta, o prazo e o link do pedido para pagar.
 */
export async function notifyFirstInstallment(orderId: string) {
  const order = await db.order.findUniqueOrThrow({ where: { id: orderId }, include: { event: true, _count: { select: { tickets: true } } } });
  const fmt = (c: number) => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const due = order.expiresAt.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Belem" });
  const text = [
    `Olá, ${order.buyerName}!`,
    ``,
    `Recebemos a 1ª parcela (${fmt(order.firstPaidCents)}) do seu pedido ${order.code} no Pix em 2x: ${order._count.tickets} ingresso(s) para ${order.event.name} ${order.event.edition}.`,
    ``,
    `Falta a 2ª parcela: ${fmt(order.totalCents - order.firstPaidCents)}, até ${due}.`,
    `Seus ingressos ficam reservados até lá e são liberados (QR e PDF) assim que a 2ª parcela for paga.`,
    ``,
    `Para pagar a 2ª parcela: ${orderLink(order.id)}`,
  ].join("\n");
  await record(order.id, "EMAIL", () => sendEmail(order.email, `1ª parcela recebida · ${order.event.name} ${order.event.edition}`, text));
}

async function record(orderId: string, channel: "EMAIL", send: () => Promise<string>) {
  try {
    const detail = await send();
    await db.delivery.create({ data: { orderId, channel, ok: true, detail } });
  } catch (e) {
    await db.delivery.create({ data: { orderId, channel, ok: false, detail: String((e as Error).message) } });
  }
}

type Attachment = { filename: string; content: string }; // content em base64 (formato da API do Resend)

async function sendEmail(to: string, subject: string, text: string, attachment?: Attachment) {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    const anexo = attachment ? `\nAnexo: ${attachment.filename} (${Math.round((attachment.content.length * 3) / 4 / 1024)} KB)` : "";
    console.log(`\n[e-mail simulado] para ${to}\nAssunto: ${subject}\n${text}${anexo}\n`);
    return "simulado (sem RESEND_API_KEY)";
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: process.env.EMAIL_FROM, to, subject, text, ...(attachment ? { attachments: [attachment] } : {}) }),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
  return "enviado";
}

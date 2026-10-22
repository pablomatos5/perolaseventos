import { db } from "@/lib/db";
import { formatDateTime, genderLabel } from "@/lib/format";
import { ticketsPdf } from "@/lib/ticket-pdf";
import { orderToken } from "@/lib/tokens";
import { whatsappGroupUrl } from "@/lib/whatsapp-group";
import { supportLine } from "@/lib/seller";

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
    ...(whatsappGroupUrl() ? [``, `Entre no grupo do evento no WhatsApp (avisos, horários e novidades): ${whatsappGroupUrl()}`] : []),
    ``,
    `Atenção:`,
    `- Não compartilhe o seu ingresso. Cada QR vale uma única entrada: depois de lido, não passa de novo.`,
    `- Masculino e feminino são conferidos na entrada. O ingresso feminino só vale para mulheres.`,
    `- Evento para maiores de 18 anos: leve documento oficial com foto.`,
    ``,
    `Dúvidas: ${supportLine()}. Termos de compra: ${process.env.APP_URL}/termos`,
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
    `Importante (termos do Pix em 2x aceitos na compra): se a 2ª parcela não for paga até o prazo, a reserva é cancelada e o valor da 1ª parcela não é devolvido (salvo desistência em até 7 dias da compra). Vamos te lembrar por e-mail antes do vencimento.`,
    ``,
    `Para pagar a 2ª parcela: ${orderLink(order.id)}`,
  ].join("\n");
  await record(order.id, "EMAIL", () => sendEmail(order.email, `1ª parcela recebida · ${order.event.name} ${order.event.edition}`, text));
}

/**
 * "Encontrar meu pedido": manda o link de cada pedido ativo para o e-mail CADASTRADO no pedido (nunca para
 * outro). Quem pediu não vê nada na tela; quem sabe só o CPF de outra pessoa não consegue abrir o pedido dela.
 */
export async function sendOrderLinks(orderIds: string[]) {
  if (orderIds.length === 0) return;
  const orders = await db.order.findMany({ where: { id: { in: orderIds } }, include: { event: true, _count: { select: { tickets: true } } }, orderBy: { createdAt: "desc" } });
  const fmt = (c: number) => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const situacao = (o: (typeof orders)[number]) =>
    o.status === "PAID" ? "pago, ingressos liberados" : o.status === "PARTIAL" ? `Pix em 2x, falta a 2ª parcela (${fmt(o.totalCents - o.firstPaidCents)})` : "aguardando pagamento";
  const first = orders[0];
  const text = [
    `Olá, ${first.buyerName}!`,
    ``,
    `Você pediu para encontrar ${orders.length > 1 ? "os seus pedidos" : "o seu pedido"} no site da Pérolas. ${orders.length > 1 ? "Aqui estão os links:" : "Aqui está o link:"}`,
    ``,
    ...orders.flatMap((o) => [`Pedido ${o.code} · ${o._count.tickets} ingresso(s) · ${o.event.name} ${o.event.edition} · ${situacao(o)}`, orderLink(o.id), ``]),
    `O link é pessoal: quem tiver ele consegue ver os seus ingressos. Não compartilhe.`,
    `Se não foi você que pediu, pode ignorar este e-mail.`,
  ].join("\n");
  const subject = `Link do seu pedido · ${first.event.name} ${first.event.edition}`;
  let result = "";
  try {
    result = await sendEmail(first.email, subject, text);
  } catch (e) {
    result = `falhou: ${(e as Error).message}`;
  }
  await db.delivery.createMany({ data: orders.map((o) => ({ orderId: o.id, channel: "EMAIL" as const, ok: !result.startsWith("falhou"), detail: `link do pedido (encontrar meu pedido): ${result}` })) });
}

/** Rótulos gravados em Delivery.detail: servem para não mandar o mesmo lembrete duas vezes. */
export const REMINDER_TAGS = { early: "lembrete 2ª parcela (3 dias)", last: "lembrete 2ª parcela (último dia)" } as const;
export type ReminderKind = keyof typeof REMINDER_TAGS;

/**
 * Pix em 2x: lembrete por e-mail da 2ª parcela (3 dias antes e no último dia). Quem decide quando mandar
 * é sendSecondInstallmentReminders (src/lib/reminders.ts), chamado de hora em hora pela VPS.
 */
export async function remindSecondInstallment(orderId: string, kind: ReminderKind) {
  const order = await db.order.findUniqueOrThrow({ where: { id: orderId }, include: { event: true, _count: { select: { tickets: true } } } });
  const fmt = (c: number) => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const due = order.expiresAt.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Belem" });
  const missing = fmt(order.totalCents - order.firstPaidCents);
  const event = `${order.event.name} ${order.event.edition}`;
  const text = [
    `Olá, ${order.buyerName}!`,
    ``,
    kind === "last"
      ? `Hoje é o último dia para pagar a 2ª parcela do seu pedido ${order.code} (${order._count.tickets} ingresso(s) para ${event}).`
      : `Passando para lembrar: a 2ª parcela do seu pedido ${order.code} (${order._count.tickets} ingresso(s) para ${event}) vence em 3 dias.`,
    ``,
    `Valor: ${missing} no Pix, até ${due}.`,
    `Pague pelo link do seu pedido: ${orderLink(order.id)}`,
    ``,
    `Assim que a 2ª parcela cair, seus ingressos (QR e PDF) chegam por aqui.`,
    `Pelos termos do Pix em 2x aceitos na compra, se o prazo passar sem o pagamento, a reserva é cancelada, os ingressos voltam para a venda e o valor da 1ª parcela não é devolvido (salvo desistência em até 7 dias da compra).`,
    ``,
    `Se você já pagou, pode desconsiderar este e-mail.`,
  ].join("\n");
  const subject = kind === "last" ? `Último dia: 2ª parcela · ${event}` : `Lembrete: 2ª parcela em 3 dias · ${event}`;
  await record(order.id, "EMAIL", () => sendEmail(order.email, subject, text), REMINDER_TAGS[kind]);
}

async function record(orderId: string, channel: "EMAIL", send: () => Promise<string>, tag?: string) {
  const label = (d: string) => (tag ? `${tag}: ${d}` : d);
  try {
    const detail = await send();
    await db.delivery.create({ data: { orderId, channel, ok: true, detail: label(detail) } });
  } catch (e) {
    await db.delivery.create({ data: { orderId, channel, ok: false, detail: label(String((e as Error).message)) } });
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

import MercadoPagoConfig, { Payment, Preference } from "mercadopago";
import { db } from "@/lib/db";
import { genderLabel } from "@/lib/format";
import { deliverTickets, orderLink } from "@/lib/delivery";
import { markOrderPaid, refundOrder } from "@/lib/orders";

function client() {
  const accessToken = process.env.MP_ACCESS_TOKEN;
  if (!accessToken) throw new Error("MP_ACCESS_TOKEN não configurado");
  return new MercadoPagoConfig({ accessToken, options: { timeout: 10_000 } });
}

const isPublicHttps = (url: string | undefined) => !!url && url.startsWith("https://");

/**
 * Cria o Checkout Pro (página do Mercado Pago com Pix e cartão) para um pedido pendente.
 * Boleto fica de fora: compensa em dias e a reserva dura minutos.
 * Retorna a URL para onde o cliente deve ser mandado.
 */
export async function createCheckout(orderId: string) {
  const order = await db.order.findUniqueOrThrow({
    where: { id: orderId },
    include: { event: true, tickets: { include: { ticketType: true, batch: true } } },
  });

  // Uma linha por combinação setor + lote + masculino/feminino, como aparece no comprovante do cliente.
  const lines = new Map<string, { title: string; unit: number; qty: number }>();
  for (const t of order.tickets) {
    const key = `${t.ticketTypeId}|${t.batchId}|${t.gender}`;
    const line = lines.get(key) ?? {
      title: `${order.event.name} ${order.event.edition} · ${t.ticketType.name} ${genderLabel(t.gender).toLowerCase()} (${t.batch.name})`,
      unit: t.priceCents,
      qty: 0,
    };
    line.qty++;
    lines.set(key, line);
  }
  // taxa de serviço numa linha própria: o total cobrado bate com order.totalCents
  if (order.feeCents > 0) {
    lines.set("taxa", { title: "Taxa de serviço", unit: order.feeCents / order.tickets.length, qty: order.tickets.length });
  }

  const appUrl = process.env.APP_URL!;
  const back = orderLink(order.id);
  // O Mercado Pago só aceita notification_url e auto_return com endereço público https.
  // Em localhost a confirmação acontece pela conciliação no retorno (reconcilePayment na página do pedido).
  const publicUrl = isPublicHttps(appUrl);
  const [first, ...rest] = order.buyerName.trim().split(/\s+/);

  const pref = await new Preference(client()).create({
    body: {
      items: [...lines.entries()].map(([id, l]) => ({
        id,
        title: l.title.slice(0, 250),
        quantity: l.qty,
        unit_price: l.unit / 100,
        currency_id: "BRL",
      })),
      payer: {
        name: first,
        surname: rest.join(" "),
        email: order.email,
        identification: { type: "CPF", number: order.cpf },
      },
      external_reference: order.id,
      back_urls: { success: back, pending: back, failure: back },
      ...(publicUrl && { auto_return: "approved", notification_url: `${appUrl}/api/webhooks/mercadopago` }),
      payment_methods: { excluded_payment_types: [{ id: "ticket" }, { id: "atm" }], installments: 12 },
      // O link de pagamento vence junto com a reserva; Pix gerado nele também.
      expires: true,
      expiration_date_to: order.expiresAt.toISOString(),
      date_of_expiration: order.expiresAt.toISOString(),
      statement_descriptor: "PEROLAS EVENTOS",
      binary_mode: true, // sem "em análise": aprovado ou recusado, para não segurar ingresso indefinidamente
    },
    requestOptions: { idempotencyKey: `pref-${order.id}-${order.expiresAt.getTime()}` },
  });

  const url = process.env.MP_ACCESS_TOKEN!.startsWith("TEST-") ? pref.sandbox_init_point : pref.init_point;
  if (!url) throw new Error("Mercado Pago não devolveu o link de pagamento");
  return url;
}

/**
 * Fonte da verdade do pagamento: SEMPRE consulta a API do Mercado Pago pelo id,
 * nunca confia no corpo do webhook nem nos parâmetros da URL de retorno.
 * Chamado pelo webhook e pela página do pedido quando o cliente volta do checkout.
 */
export async function reconcilePayment(paymentId: string) {
  const p = await new Payment(client()).get({ id: paymentId });
  const orderId = p.external_reference;
  if (!orderId) return { status: p.status, handled: false };

  const order = await db.order.findUnique({ where: { id: orderId } });
  if (!order) return { status: p.status, handled: false };

  if (p.status === "approved") {
    // Conferência de valor: o pagamento tem que cobrir o pedido inteiro.
    const paidCents = Math.round((p.transaction_amount ?? 0) * 100);
    if (paidCents < order.totalCents) {
      console.error(`[mercadopago] pagamento ${paymentId} de ${paidCents} centavos não cobre o pedido ${order.code} (${order.totalCents})`);
      return { status: "amount_mismatch", handled: false };
    }
    if (await markOrderPaid(orderId, String(p.id))) await deliverTickets(orderId);
    return { status: p.status, handled: true };
  }

  if ((p.status === "refunded" || p.status === "charged_back") && order.paymentRef === String(p.id)) {
    await refundOrder(orderId);
    return { status: p.status, handled: true };
  }

  return { status: p.status, handled: false };
}

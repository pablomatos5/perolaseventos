import MercadoPagoConfig, { Payment, Preference } from "mercadopago";
import { db } from "@/lib/db";
import { genderLabel } from "@/lib/format";
import { deliverTickets, notifyFirstInstallment, orderLink } from "@/lib/delivery";
import { firstInstallmentCents, markFirstInstallmentPaid, markOrderPaid, refundOrder } from "@/lib/orders";

function client() {
  const accessToken = process.env.MP_ACCESS_TOKEN;
  if (!accessToken) throw new Error("MP_ACCESS_TOKEN não configurado");
  return new MercadoPagoConfig({ accessToken, options: { timeout: 10_000 } });
}

const isPublicHttps = (url: string | undefined) => !!url && url.startsWith("https://");

/**
 * Como o cliente vai pagar:
 * - "pix": Pix à vista · "card": cartão de crédito (até 12x) ou débito, à vista no pedido
 * - "pix2x-1" / "pix2x-2": 1ª e 2ª parcelas do Pix em 2x (o ingresso só sai depois da 2ª)
 */
export type CheckoutKind = "pix" | "card" | "pix2x-1" | "pix2x-2";

/** Liga o pagamento ao pedido e à parcela: "<orderId>" (antigo, à vista), "<orderId>:full", ":p1", ":p2". */
const reference = (orderId: string, kind: CheckoutKind) => `${orderId}:${kind === "pix2x-1" ? "p1" : kind === "pix2x-2" ? "p2" : "full"}`;

/**
 * Cria o Checkout Pro (página do Mercado Pago) para um pedido, já filtrado pela forma escolhida.
 * Boleto fica de fora: compensa em dias e a reserva dura minutos.
 * Retorna a URL para onde o cliente deve ser mandado.
 */
export async function createCheckout(orderId: string, kind: CheckoutKind = "pix") {
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
  // Pix em 2x: uma linha só com o valor da parcela
  if (kind === "pix2x-1" || kind === "pix2x-2") {
    const cents = kind === "pix2x-1" ? firstInstallmentCents(order.totalCents) : order.totalCents - order.firstPaidCents;
    lines.clear();
    lines.set(kind, {
      title: `${order.event.name} ${order.event.edition} · ${order.tickets.length} ingresso(s) · ${kind === "pix2x-1" ? "1ª" : "2ª"} parcela de 2 (Pix)`,
      unit: cents,
      qty: 1,
    });
  }
  const pixOnly = kind !== "card";
  // 2ª parcela: o Pix gerado vale até o prazo, mas no máximo 1 dia (a pessoa gera outro se precisar)
  const expires = kind === "pix2x-2" ? new Date(Math.min(order.expiresAt.getTime(), Date.now() + 86_400_000)) : order.expiresAt;

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
      external_reference: reference(order.id, kind),
      back_urls: { success: back, pending: back, failure: back },
      ...(publicUrl && { auto_return: "approved", notification_url: `${appUrl}/api/webhooks/mercadopago` }),
      // Pix (bank_transfer) ou só cartões, conforme a escolha do cliente
      payment_methods: pixOnly
        ? { excluded_payment_types: [{ id: "ticket" }, { id: "atm" }, { id: "credit_card" }, { id: "debit_card" }, { id: "prepaid_card" }], installments: 1 }
        : { excluded_payment_types: [{ id: "ticket" }, { id: "atm" }, { id: "bank_transfer" }], installments: 12 },
      // O link de pagamento vence junto com a reserva (ou com o prazo da parcela); Pix gerado nele também.
      expires: true,
      expiration_date_to: expires.toISOString(),
      date_of_expiration: expires.toISOString(),
      statement_descriptor: "PEROLAS EVENTOS",
      binary_mode: true, // sem "em análise": aprovado ou recusado, para não segurar ingresso indefinidamente
    },
    requestOptions: { idempotencyKey: `pref-${order.id}-${kind}-${expires.getTime()}` },
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
  const [orderId, part = "full"] = (p.external_reference ?? "").split(":");
  if (!orderId) return { status: p.status, handled: false };

  const order = await db.order.findUnique({ where: { id: orderId } });
  if (!order) return { status: p.status, handled: false };

  if (p.status === "approved") {
    // Conferência de valor: o pagamento tem que cobrir a parte que ele paga (pedido inteiro, 1ª ou 2ª parcela).
    const paidCents = Math.round((p.transaction_amount ?? 0) * 100);
    const due = part === "p1" ? firstInstallmentCents(order.totalCents) : part === "p2" ? order.totalCents - order.firstPaidCents : order.totalCents;
    if (paidCents < due) {
      console.error(`[mercadopago] pagamento ${paymentId} (${part}) de ${paidCents} centavos não cobre ${due} do pedido ${order.code}`);
      return { status: "amount_mismatch", handled: false };
    }
    if (part === "p1") {
      if (await markFirstInstallmentPaid(orderId, String(p.id), paidCents)) await notifyFirstInstallment(orderId);
      return { status: p.status, handled: true };
    }
    // 2ª parcela só vale para pedido com a 1ª paga (senão seria um pagamento parcial do pedido inteiro)
    if (part === "p2" && order.status !== "PARTIAL" && order.status !== "PAID") {
      console.error(`[mercadopago] 2ª parcela ${paymentId} para o pedido ${order.code} sem 1ª parcela paga`);
      return { status: "amount_mismatch", handled: false };
    }
    if (await markOrderPaid(orderId, String(p.id))) await deliverTickets(orderId);
    return { status: p.status, handled: true };
  }

  if ((p.status === "refunded" || p.status === "charged_back") && (order.paymentRef === String(p.id) || order.firstPaymentRef === String(p.id))) {
    await refundOrder(orderId);
    return { status: p.status, handled: true };
  }

  return { status: p.status, handled: false };
}

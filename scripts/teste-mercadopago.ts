// Teste da integração com o Mercado Pago SEM credenciais reais: a API do MP é simulada
// interceptando o fetch. Usa o banco local de dev. Rodar com: npx tsx scripts/teste-mercadopago.ts
import "dotenv/config";
import { createHmac } from "node:crypto";

process.env.MP_ACCESS_TOKEN = "TEST-token-falso";
process.env.MP_WEBHOOK_SECRET = "segredo-de-teste";
process.env.PAYMENT_PROVIDER = "mercadopago";

const payments = new Map<string, { id: number; status: string; transaction_amount: number; external_reference: string }>();
let lastPreference: Record<string, unknown> | null = null;

const realFetch = globalThis.fetch;
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input instanceof Request ? input.url : input);
  if (!url.includes("api.mercadopago.com")) return realFetch(input, init);
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  const pay = url.match(/\/v1\/payments\/(\d+)/);
  if (pay) return payments.has(pay[1]) ? json(payments.get(pay[1])) : json({ message: "not found" }, 404);
  if (/\/checkout\/preferences\/?$/.test(url)) {
    lastPreference = JSON.parse(String(init?.body));
    return json({ id: "pref-1", init_point: "https://mp/prod", sandbox_init_point: "https://mp/sandbox" }, 201);
  }
  return json({ message: `rota não simulada: ${url}` }, 500);
}) as typeof fetch;

const SECRET = process.env.MP_WEBHOOK_SECRET!;
function signedWebhook(paymentId: string, opts: { badSignature?: boolean } = {}) {
  const ts = String(Math.floor(Date.now() / 1000));
  const requestId = `req-${Math.random()}`;
  const v1 = createHmac("sha256", opts.badSignature ? "outro-segredo" : SECRET)
    .update(`id:${paymentId};request-id:${requestId};ts:${ts};`)
    .digest("hex");
  return new Request(`http://localhost/api/webhooks/mercadopago?data.id=${paymentId}&type=payment`, {
    method: "POST",
    headers: { "x-signature": `ts=${ts},v1=${v1}`, "x-request-id": requestId, "content-type": "application/json" },
    body: JSON.stringify({ type: "payment", action: "payment.updated", data: { id: paymentId } }),
  });
}

let failures = 0;
function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "✔" : "✘"} ${name}${detail ? ` (${detail})` : ""}`);
  if (!ok) failures++;
}

async function main() {
  const { db } = await import("../src/lib/db");
  const { createReservation } = await import("../src/lib/orders");
  const { createCheckout } = await import("../src/lib/mercadopago");
  const { POST } = await import("../src/app/api/webhooks/mercadopago/route");

  const pista = await db.ticketType.findFirstOrThrow({ where: { name: "Pista Open Bar" } });
  const buyer = { buyerName: "Teste Mercado Pago", email: "mp@exemplo.com", phone: "91999990000", cpf: "52998224725", whatsappOptIn: false };
  const reserve = () => createReservation({ eventId: pista.eventId, ...buyer, items: [{ ticketTypeId: pista.id, full: 1, half: 1 }] });

  // 1. Checkout Pro: corpo da preferência
  const o1 = await reserve();
  const url = await createCheckout(o1.id);
  const pref = lastPreference as { external_reference: string; items: { unit_price: number; quantity: number }[]; payment_methods: { excluded_payment_types: { id: string }[] }; expiration_date_to: string };
  check("checkout usa link de sandbox com token TEST-", url === "https://mp/sandbox");
  check("external_reference = id do pedido", pref.external_reference === o1.id);
  const prefTotal = Math.round(pref.items.reduce((s, i) => s + i.unit_price * i.quantity, 0) * 100);
  check("itens somam o total do pedido", prefTotal === o1.totalCents, `${prefTotal} vs ${o1.totalCents}`);
  check("boleto excluído", pref.payment_methods.excluded_payment_types.some((t) => t.id === "ticket"));
  check("link vence junto com a reserva", pref.expiration_date_to === o1.expiresAt.toISOString());

  // 2. Webhook aprovado
  payments.set("9001", { id: 9001, status: "approved", transaction_amount: o1.totalCents / 100, external_reference: o1.id });
  let res = await POST(signedWebhook("9001"));
  let order = await db.order.findUniqueOrThrow({ where: { id: o1.id }, include: { tickets: true, deliveries: true } });
  check("webhook aprovado responde 200", res.status === 200);
  check("pedido vira PAID", order.status === "PAID");
  check("ingressos viram VALID", order.tickets.every((t) => t.status === "VALID"));
  check("e-mail enviado uma vez", order.deliveries.filter((d) => d.channel === "EMAIL").length === 1);

  // 3. Mesmo webhook de novo (o MP reenvia)
  res = await POST(signedWebhook("9001"));
  order = await db.order.findUniqueOrThrow({ where: { id: o1.id }, include: { tickets: true, deliveries: true } });
  check("webhook repetido não reenvia nem duplica", res.status === 200 && order.deliveries.filter((d) => d.channel === "EMAIL").length === 1);

  // 4. Assinatura falsa
  res = await POST(signedWebhook("9001", { badSignature: true }));
  check("assinatura falsa é recusada com 401", res.status === 401);

  // 5. Pagamento com valor menor que o pedido
  const o2 = await reserve();
  payments.set("9002", { id: 9002, status: "approved", transaction_amount: 1, external_reference: o2.id });
  await POST(signedWebhook("9002"));
  const o2after = await db.order.findUniqueOrThrow({ where: { id: o2.id } });
  check("valor menor que o pedido não libera ingresso", o2after.status === "PENDING");

  // 6. Estorno do primeiro pagamento
  payments.set("9001", { ...payments.get("9001")!, status: "refunded" });
  await POST(signedWebhook("9001"));
  order = await db.order.findUniqueOrThrow({ where: { id: o1.id }, include: { tickets: true, deliveries: true } });
  check("estorno marca pedido REFUNDED", order.status === "REFUNDED");
  check("estorno cancela os ingressos", order.tickets.every((t) => t.status === "CANCELED"));

  // limpeza: remove os pedidos de teste
  await db.order.deleteMany({ where: { id: { in: [o1.id, o2.id] } } });
  await db.$disconnect();

  console.log(failures ? `\n${failures} falha(s)` : "\nTudo certo.");
  process.exit(failures ? 1 : 0);
}

main();

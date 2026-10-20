// Teste da integração com o Mercado Pago SEM credenciais reais: a API do MP é simulada
// interceptando o fetch. Usa o banco local de dev. Rodar com: npx tsx scripts/teste-mercadopago.ts
import "dotenv/config";
import { createHmac } from "node:crypto";

process.env.MP_ACCESS_TOKEN = "TEST-token-falso";
process.env.MP_WEBHOOK_SECRET = "segredo-de-teste";
process.env.PAYMENT_PROVIDER = "mercadopago";

const payments = new Map<string, { id: number; status: string; transaction_amount: number; external_reference: string }>();
let lastPayment: Record<string, unknown> | null = null;
let nextPaymentId = 7000;

const realFetch = globalThis.fetch;
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input instanceof Request ? input.url : input);
  if (!url.includes("api.mercadopago.com")) return realFetch(input, init);
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  const pay = url.match(/\/v1\/payments\/(\d+)/);
  if (pay) return payments.has(pay[1]) ? json(payments.get(pay[1])) : json({ message: "not found" }, 404);
  // criação de pagamento (Pix no site): devolve o QR
  if (/\/v1\/payments\/?$/.test(url) && init?.method === "POST") {
    lastPayment = JSON.parse(String(init.body));
    const id = ++nextPaymentId;
    return json({ id, status: "pending", point_of_interaction: { transaction_data: { qr_code: `00020126-pix-${id}`, qr_code_base64: "iVBORw0KGgo=" } } }, 201);
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
  const { createPixCharge } = await import("../src/lib/mercadopago");
  const { POST } = await import("../src/app/api/webhooks/mercadopago/route");

  const pista = await db.ticketType.findFirstOrThrow({ where: { name: "Pista Open Bar" } });
  const buyer = { buyerName: "Teste Mercado Pago", email: "mp@exemplo.com", phone: "91999990000", cpf: "52998224725" };
  const reserve = () => createReservation({ eventId: pista.eventId, ...buyer, items: [{ ticketTypeId: pista.id, masc: 1, fem: 1 }] });

  // 1. Pix no próprio site: corpo do pagamento e QR guardado
  const o1 = await reserve();
  const charge = await createPixCharge(o1.id, "pix");
  const body = lastPayment as { external_reference: string; transaction_amount: number; payment_method_id: string; application_fee?: number; date_of_expiration: string };
  check("Pix criado com o método pix", body.payment_method_id === "pix");
  check("external_reference = pedido + parte", body.external_reference === `${o1.id}:full`);
  check("valor = total do pedido", Math.round(body.transaction_amount * 100) === o1.totalCents, `${body.transaction_amount} vs ${o1.totalCents / 100}`);
  const connected = !!(await db.mpAccount.findUnique({ where: { id: "principal" } }));
  check(
    connected ? "conta do evento conectada: taxa de serviço separada para os devs" : "sem conta conectada não há taxa separada",
    connected ? Math.round((body.application_fee ?? 0) * 100) === o1.feeCents : body.application_fee === undefined,
    `application_fee=${body.application_fee}`,
  );
  check("QR guardado para a página do pedido", charge.qrCode.startsWith("00020126") && charge.amountCents === o1.totalCents);
  const again = await createPixCharge(o1.id, "pix");
  check("recarregar a página reaproveita o mesmo Pix", again.id === charge.id);

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

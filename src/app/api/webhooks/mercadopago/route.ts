import { InvalidWebhookSignatureError, WebhookSignatureValidator } from "mercadopago";
import { reconcilePayment } from "@/lib/mercadopago";

/**
 * Notificações do Mercado Pago. A assinatura (x-signature) prova que veio do Mercado Pago;
 * o status do pagamento é sempre lido de novo na API (reconcilePayment), nunca do corpo.
 * Responder 200 rápido: sem confirmação em 22 s, o Mercado Pago reenvia a cada 15 min.
 */
export async function POST(req: Request) {
  const url = new URL(req.url);
  const body = (await req.json().catch(() => ({}))) as { type?: string; data?: { id?: string | number } };
  const dataId = url.searchParams.get("data.id") ?? (body.data?.id != null ? String(body.data.id) : null);

  const secret = process.env.MP_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[mercadopago] MP_WEBHOOK_SECRET não configurado: notificação recusada");
    return new Response("not configured", { status: 503 });
  }
  try {
    WebhookSignatureValidator.validate({
      xSignature: req.headers.get("x-signature"),
      xRequestId: req.headers.get("x-request-id"),
      dataId,
      secret,
      toleranceSeconds: 600,
    });
  } catch (e) {
    if (e instanceof InvalidWebhookSignatureError) {
      console.warn(`[mercadopago] assinatura inválida (${e.reason}) request-id=${e.requestId ?? "-"}`);
      return new Response("invalid signature", { status: 401 });
    }
    throw e;
  }

  const type = url.searchParams.get("type") ?? body.type;
  if (type !== "payment" || !dataId) return new Response("ignored", { status: 200 });

  try {
    const r = await reconcilePayment(dataId);
    console.log(`[mercadopago] pagamento ${dataId}: ${r.status}${r.handled ? " (processado)" : ""}`);
  } catch (e) {
    // 500 faz o Mercado Pago tentar de novo mais tarde; markOrderPaid é idempotente.
    console.error(`[mercadopago] falha ao conciliar ${dataId}:`, e);
    return new Response("retry", { status: 500 });
  }
  return new Response("ok", { status: 200 });
}

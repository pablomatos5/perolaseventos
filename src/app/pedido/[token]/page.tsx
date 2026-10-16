import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import QRCode from "qrcode";
import { Suspense } from "react";
import { payAction, simulatePaymentAction } from "@/app/actions";
import { AutoRefresh } from "@/components/auto-refresh";
import { HolderForm, SaveTicketButton, ShareTicketButton } from "@/components/ticket-actions";
import { db } from "@/lib/db";
import { formatBRL, formatDateTime } from "@/lib/format";
import { reconcilePayment } from "@/lib/mercadopago";
import { RESERVATION_MINUTES } from "@/lib/orders";
import { paymentMode } from "@/lib/payment-mode";
import { ticketLinkToken, ticketToken, verifyOrderToken } from "@/lib/tokens";
import { headers } from "next/headers";

export const metadata = { title: "Seu pedido · Pérolas", robots: { index: false } };

export default function OrderPage({ params, searchParams }: PageProps<"/pedido/[token]">) {
  return (
    <Suspense fallback={<div className="grid min-h-svh place-items-center text-fg-faint">Carregando…</div>}>
      <Order params={params} searchParams={searchParams} />
    </Suspense>
  );
}

type Search = Promise<Record<string, string | string[] | undefined>>;

async function Order({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Search }) {
  await connection();
  const { token } = await params;
  const orderId = verifyOrderToken(decodeURIComponent(token));
  if (!orderId) notFound();

  // Volta do Checkout Pro: ?payment_id=...&status=... . Em localhost não há webhook,
  // então confirmamos aqui consultando a API (o status da URL em si não vale nada).
  const query = await searchParams;
  const paymentId = typeof query.payment_id === "string" ? query.payment_id : null;
  const mode = paymentMode();
  const mpProvider = mode === "mercadopago";
  if (mpProvider && paymentId && /^\d+$/.test(paymentId)) {
    await reconcilePayment(paymentId).catch((e) => console.error("[mercadopago] conciliação no retorno falhou:", e));
  }
  const declined = query.status === "rejected" || query.collection_status === "rejected";
  const existing = query.reserva === "existente";
  const checkoutFailed = query.erro === "pagamento";

  const order = await db.order.findUnique({
    where: { id: orderId },
    include: { event: true, tickets: { include: { ticketType: true, batch: true }, orderBy: { createdAt: "asc" } } },
  });
  if (!order) notFound();

  const expired = order.status === "EXPIRED" || (order.status === "PENDING" && order.expiresAt < new Date());
  // endereço pelo qual a página foi aberta (domínio em produção, IP da rede em testes no celular)
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const origin = `${h.get("x-forwarded-proto") ?? (host.startsWith("localhost") || /^\d/.test(host) ? "http" : "https")}://${host}`;

  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-12 md:py-20">
      <Link href="/" className="font-display text-2xl italic">Pérolas</Link>
      <div className="mt-10">
        <span className="eyebrow rule">Pedido {order.code}</span>
        <h1 className="display mt-4 text-[clamp(2.2rem,6vw,3.6rem)]!">
          {order.status === "PAID" ? <>Te vemos na <em>virada</em></> : expired ? <>Reserva <em>expirada</em></> : <>Falta só o <em>pagamento</em></>}
        </h1>
        <p className="mt-3 text-fg-muted">
          {order.event.name} {order.event.edition} · {formatDateTime(order.event.startsAt)} · {order.event.venue}
        </p>
      </div>

      {order.status === "PENDING" && !expired && (
        <section className="glass-card mt-10 p-6 md:p-8">
          <div className="flex items-end justify-between">
            <span className="text-fg-muted">{order.tickets.length} ingresso(s)</span>
            <span className="font-display text-4xl">{formatBRL(order.totalCents)}</span>
          </div>
          <p className="mt-4 text-sm text-fg-muted">
            Reserva válida até <strong className="text-fg">{order.expiresAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Belem" })}</strong>.
            Depois disso os ingressos voltam para a venda.
          </p>
          {existing && (
            <p role="status" className="mt-4 rounded-lg bg-accent/15 px-4 py-3 text-sm text-accent">
              Você já tinha uma reserva em andamento com este CPF. Finalize o pagamento dela (ou espere ela expirar para fazer outra).
            </p>
          )}
          {checkoutFailed && (
            <p role="alert" className="mt-4 rounded-lg bg-danger/15 px-4 py-3 text-sm text-danger">
              Não conseguimos abrir o pagamento agora. Tente de novo em instantes.
            </p>
          )}
          {mode === "off" && (
            <p className="mt-4 rounded-lg bg-surface px-4 py-3 text-sm text-fg-muted">
              Pagamento online indisponível no momento. Fale com a Pérolas pelo WhatsApp.
            </p>
          )}
          {declined && (
            <p role="alert" className="mt-4 rounded-lg bg-danger/15 px-4 py-3 text-sm text-danger">
              O pagamento não foi aprovado. Tente outro cartão ou pague com Pix.
            </p>
          )}
          {mpProvider && (
            <>
              <form action={payAction.bind(null, token)} className="mt-6">
                <button className="btn solid w-full">Pagar com Pix ou cartão</button>
              </form>
              <p className="mt-3 text-center text-xs text-fg-faint">
                Pagamento processado pelo Mercado Pago. Cartão em até 12x. Esta página atualiza sozinha quando o Pix cair.
              </p>
              <AutoRefresh seconds={5} />
            </>
          )}
          {mode === "mock" && (
            <form action={simulatePaymentAction.bind(null, token)} className="mt-6">
              <button className="btn solid w-full">Simular pagamento aprovado (dev)</button>
            </form>
          )}
        </section>
      )}

      {order.status === "REFUNDED" && (
        <p className="glass-card mt-10 p-6 text-fg-muted">Este pedido foi estornado e os ingressos foram cancelados.</p>
      )}

      {expired && (
        <p className="glass-card mt-10 p-6 text-fg-muted">
          O prazo de {RESERVATION_MINUTES} minutos acabou e os ingressos voltaram para a venda. <Link href="/#ingressos" className="text-accent underline">Fazer novo pedido</Link>.
        </p>
      )}

      {order.status === "PAID" && (
        <section className="mt-10 grid gap-6">
          <p className="text-sm text-fg-muted">
            Mostre o QR na entrada. Cada ingresso vale para <strong className="text-fg">uma pessoa e uma entrada</strong>: depois de lido, o mesmo QR não passa de novo, então não compartilhe prints.
          </p>
          <p className="rounded-lg bg-surface px-4 py-3 text-sm text-fg-muted">
            <strong className="text-fg">Na festa pode faltar sinal.</strong> Toque em “Salvar ingresso” agora: a imagem fica na sua galeria e abre sem internet.
            Ingresso de outra pessoa? Troque o nome e use “Enviar a quem vai usar”.
          </p>
          {await Promise.all(
            order.tickets.map(async (t, i) => {
              const qr = await QRCode.toDataURL(ticketToken(t.id, t.qrVersion), { margin: 1, width: 360, errorCorrectionLevel: "M" });
              const editable = !t.usedAt && t.status === "VALID" && order.event.startsAt > new Date();
              return (
                <article key={t.id} className="glass-card grid items-center gap-6 p-6 sm:grid-cols-[auto_1fr]">
                  {/* fundo branco: leitor lê melhor com contraste máximo, inclusive com brilho baixo */}
                  {/* eslint-disable-next-line @next/next/no-img-element -- data URL gerada no servidor, não há o que otimizar */}
                  <img src={qr} alt={`QR code do ingresso ${i + 1}`} className={`size-48 rounded-xl bg-white p-2 ${t.usedAt ? "opacity-30" : ""}`} />
                  <div>
                    <span className="eyebrow">Ingresso {i + 1} de {order.tickets.length}</span>
                    <h2 className="mt-2 font-display text-3xl">{t.ticketType.name}</h2>
                    <p className="mt-1 text-sm text-fg-muted">
                      {t.batch.name} · {t.isHalf ? "Meia-entrada (leve documento)" : "Inteira"} · {formatBRL(t.priceCents)}
                    </p>
                    <p className="mt-3 text-sm">{t.holderName}</p>
                    {t.usedAt && <p className="mt-3 text-sm text-accent">Utilizado em {formatDateTime(t.usedAt)}</p>}
                    {t.status === "VALID" && !t.usedAt && (
                      <div className="mt-4 flex flex-wrap gap-2">
                        <SaveTicketButton
                          ticket={{
                            qr,
                            holder: t.holderName,
                            title: `${order.event.name} ${order.event.edition}`,
                            when: `${formatDateTime(order.event.startsAt)} · ${order.event.venue}`,
                            type: `${t.ticketType.name} · ${t.batch.name} · ${t.isHalf ? "Meia (leve documento)" : "Inteira"}`,
                            label: `Ingresso ${i + 1} de ${order.tickets.length} · Pedido ${order.code}`,
                            fileName: `ingresso-perolas-${order.code}-${i + 1}`,
                          }}
                        />
                        <ShareTicketButton url={`${origin}/i/${ticketLinkToken(t.id, t.qrVersion)}`} holder={t.holderName} />
                      </div>
                    )}
                    {editable && (
                      <div className="mt-3">
                        <HolderForm orderToken={token} ticketId={t.id} holder={t.holderName} />
                      </div>
                    )}
                  </div>
                </article>
              );
            }),
          )}
        </section>
      )}
    </main>
  );
}

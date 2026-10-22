import { BrandLogo } from "@/components/brand-logo";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { pixAction, simulatePaymentAction } from "@/app/actions";
import { CardPayForm } from "@/components/card-pay-form";
import { PixCopy } from "@/components/pix-copy";
import { TicketRules } from "@/components/ticket-rules";
import { DemoBanner } from "@/components/demo-banner";
import { WhatsappGroup } from "@/components/whatsapp-group";
import { AutoRefresh } from "@/components/auto-refresh";
import { HolderForm, ShareTicketButton, StoryShare } from "@/components/ticket-actions";
import { db } from "@/lib/db";
import { formatBRL, formatDateTime, genderLabel, cardTotalCents } from "@/lib/format";
import { qrDataUrl } from "@/lib/qr";
import { activePixCharge, amountFor, checkoutPublicKey, reconcilePayment, type PixKind } from "@/lib/mercadopago";
import { firstInstallmentCents, RESERVATION_MINUTES, secondInstallmentDue, splitPixAvailable } from "@/lib/orders";
import { isSimulated, paymentMode } from "@/lib/payment-mode";
import { decodeToken, ticketLinkToken, ticketToken, verifyOrderToken } from "@/lib/tokens";
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
  const orderId = verifyOrderToken(decodeToken(token));
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
  // Pagamento no próprio site: ?pagar=pix&forma=<pix|pix2x-1|pix2x-2> mostra o QR · ?pagar=cartao mostra o cartão
  const paying = query.pagar === "pix" || query.pagar === "cartao" ? query.pagar : null;
  const pixKind: PixKind = query.forma === "pix2x-1" || query.forma === "pix2x-2" ? query.forma : "pix";
  const pixCharge = mpProvider && paying === "pix" ? await activePixCharge(orderId, pixKind) : null;
  // o Pix confirma pelo webhook; aqui também confere a cada atualização da página (e é o que vale em localhost)
  if (pixCharge) await reconcilePayment(pixCharge.paymentId).catch((e) => console.error("[mercadopago] conferência do Pix falhou:", e));
  const declined = query.status === "rejected" || query.collection_status === "rejected";
  const tooMany = query.erro === "limite";
  const existing = query.reserva === "existente";
  const checkoutFailed = query.erro === "pagamento";
  const termsMissing = query.erro === "termos";
  const linksSent = query.links === "enviados";

  const order = await db.order.findUnique({
    where: { id: orderId },
    include: { event: true, tickets: { include: { ticketType: true, batch: true }, orderBy: { createdAt: "asc" } } },
  });
  if (!order) notFound();

  const expired = order.status === "EXPIRED" || (order.status === "PENDING" && order.expiresAt < new Date());
  // Pix em 2x: 1ª parcela paga; vencida = prazo da 2ª passou sem pagamento
  const partial = order.status === "PARTIAL";
  const partialOverdue = partial && order.expiresAt < new Date();
  const remainingCents = order.totalCents - order.firstPaidCents;
  const canSplit = order.status === "PENDING" && !expired && splitPixAvailable(order.event);
  const splitDue = canSplit ? secondInstallmentDue(order.event) : null;
  const firstCents = firstInstallmentCents(order.totalCents);
  const cardCents = cardTotalCents(order.totalCents, order.event.cardFeeBps);
  const publicKey = mpProvider && paying === "cartao" ? await checkoutPublicKey() : null;
  const pixPanel = (back: string) =>
    pixCharge ? (
      <div className="pix-panel mt-6">
        <span className="eyebrow">Pague com Pix</span>
        <p className="pix-amount">{formatBRL(pixCharge.amountCents)}</p>
        {/* eslint-disable-next-line @next/next/no-img-element -- QR gerado pelo Mercado Pago (base64) */}
        <img className="pix-qr" src={`data:image/png;base64,${pixCharge.qrBase64}`} alt="QR Code do Pix" width={240} height={240} />
        <ol className="pix-steps">
          <li>Abra o app do seu banco e escolha <strong>Pix → Ler QR Code</strong> ou <strong>Pix Copia e Cola</strong>.</li>
          <li>Confira o valor e o recebedor e confirme.</li>
          <li>Esta página atualiza sozinha quando o pagamento cair.</li>
        </ol>
        <code className="pix-code">{pixCharge.qrCode}</code>
        <PixCopy code={pixCharge.qrCode} />
        <p className="text-center text-xs text-fg-faint">
          Código válido até {pixCharge.expiresAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Belem" })}
          {" · "}
          <Link href={back} className="underline">trocar forma de pagamento</Link>
        </p>
        <AutoRefresh seconds={5} />
      </div>
    ) : null;
  const dayMonth = (d: Date) => d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Belem" });
  // endereço pelo qual a página foi aberta (domínio em produção, IP da rede em testes no celular)
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const origin = `${h.get("x-forwarded-proto") ?? (host.startsWith("localhost") || /^\d/.test(host) ? "http" : "https")}://${host}`;

  return (
    <main className="pagina-noite mx-auto w-full max-w-3xl px-5 py-10 md:py-14">
      <Link href="/" className="page-logo" aria-label="Início">
        <BrandLogo kind="reveillon" tone="dourado" sizes="16rem" priority />
      </Link>
      <div>
        <span className="eyebrow rule">Pedido {order.code}</span>
        <h1 className="display mt-4 text-[clamp(2.2rem,6vw,3.6rem)]!">
          {order.status === "PAID" ? <>Te vemos na <em>virada</em></> : partialOverdue ? <>Prazo da 2ª parcela <em>venceu</em></> : partial ? <>Falta a <em>2ª parcela</em></> : expired ? <>Reserva <em>expirada</em></> : <>Falta só o <em>pagamento</em></>}
        </h1>
        <p className="mt-3 text-fg-muted">
          {order.event.name} {order.event.edition} · {formatDateTime(order.event.startsAt)} · {order.event.venue}
        </p>
        {/* veio do "Encontrar meu pedido" e também tem pedido pago: o link dele foi só para o e-mail */}
        {linksSent && (
          <p role="status" className="glass-card mt-6 px-5 py-4 text-sm">
            Encontramos este pedido. O link dos seus pedidos já pagos (com os ingressos) foi enviado para o seu e-mail.
          </p>
        )}
      </div>

      {order.status === "PENDING" && !expired && (
        <section className="glass-card mt-10 p-6 md:p-8">
          <div className="flex items-end justify-between">
            <span className="text-fg-muted">{order.tickets.length} ingresso(s)</span>
            <span className="font-display text-4xl">{formatBRL(order.totalCents)}</span>
          </div>
          {order.feeCents > 0 && (
            <p className="mt-1 text-right text-xs text-fg-faint">inclui taxa de serviço de {formatBRL(order.feeCents)}</p>
          )}
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
              Pagamento online indisponível no momento. Fale com a Pérolas pelo Instagram @perolaseventos.
            </p>
          )}
          {termsMissing && (
            <p role="alert" className="mt-4 rounded-lg bg-danger/15 px-4 py-3 text-sm text-danger">
              Para pagar no Pix em 2x, marque as duas caixas: a de ciência sobre a 1ª parcela e a de “Li e concordo”.
            </p>
          )}
          {tooMany && (
            <p role="alert" className="mt-4 rounded-lg bg-danger/15 px-4 py-3 text-sm text-danger">
              Muitas tentativas seguidas. Espere alguns minutos e tente de novo.
            </p>
          )}
          {declined && (
            <p role="alert" className="mt-4 rounded-lg bg-danger/15 px-4 py-3 text-sm text-danger">
              O pagamento não foi aprovado. Tente outro cartão ou pague com Pix.
            </p>
          )}
          {mpProvider && paying === "pix" && pixCharge && pixPanel(`/pedido/${token}`)}
          {mpProvider && paying === "cartao" && (
            <div className="pay-panel mt-6">
              <div className="flex items-end justify-between gap-4">
                <span className="eyebrow">Pague com cartão</span>
                <Link href={`/pedido/${token}`} className="text-xs text-fg-faint underline">trocar forma de pagamento</Link>
              </div>
              {cardCents > order.totalCents && (
                <p className="mt-2 text-xs text-fg-faint">Inclui {formatBRL(cardCents - order.totalCents)} de taxa do cartão. No Pix sai por {formatBRL(order.totalCents)}.</p>
              )}
              {publicKey ? (
                <CardPayForm token={token} publicKey={publicKey} amountCents={amountFor(order, "card")} buyerName={order.buyerName} cpf={order.cpf} />
              ) : (
                <p className="pay-result is-error mt-4">Pagamento com cartão indisponível agora. Pague no Pix.</p>
              )}
              <AutoRefresh seconds={20} />
            </div>
          )}
          {(isSimulated(mode) || (mpProvider && !(paying === "pix" && pixCharge) && paying !== "cartao")) && (
            <div className="pay-options mt-6">
              <span className="eyebrow">Como você quer pagar?</span>
              {(
                [
                  { kind: "pix", title: "Pix à vista", price: formatBRL(order.totalCents), note: "Aprovação na hora: os ingressos saem logo depois." },
                  {
                    kind: "card",
                    title: "Cartão de crédito ou débito",
                    price: formatBRL(cardCents),
                    note: cardCents > order.totalCents
                      ? `Inclui ${formatBRL(cardCents - order.totalCents)} de taxa do cartão. Crédito em até 6x (juros do cartão) ou débito.`
                      : "Crédito em até 6x (juros do cartão) ou débito.",
                  },
                ] as const
              ).map((o) => (
                mpProvider && o.kind === "card" ? (
                  <Link key={o.kind} href={`/pedido/${token}?pagar=cartao`} className="pay-option">
                    <span className="pay-option-title">{o.title}</span>
                    <span className="pay-option-price">{o.price}</span>
                    <span className="pay-option-note">{o.note}</span>
                  </Link>
                ) : (
                  <form key={o.kind} action={isSimulated(mode) ? simulatePaymentAction.bind(null, token, o.kind) : pixAction.bind(null, token, o.kind as PixKind)}>
                    <button className={`pay-option ${o.kind === "pix" ? "is-main" : ""}`}>
                      <span className="pay-option-title">{o.title}</span>
                      <span className="pay-option-price">{o.price}</span>
                      <span className="pay-option-note">{o.note}</span>
                    </button>
                  </form>
                )
              ))}
              {canSplit && splitDue && (
                <form
                  action={isSimulated(mode) ? simulatePaymentAction.bind(null, token, "pix2x-1") : pixAction.bind(null, token, "pix2x-1")}
                  className="pay-option pay-option-split"
                >
                  <span className="pay-option-title">Pix em 2x</span>
                  <span className="pay-option-price">2 × {formatBRL(firstCents)}</span>
                  <span className="pay-option-note">1ª agora e 2ª até {dayMonth(splitDue)}. O ingresso fica reservado e é liberado depois da 2ª parcela.</span>
                  <div className="split-terms">
                    <strong>Termos do Pix em 2x</strong>
                    <ul>
                      <li>A 1ª parcela reserva os seus ingressos. O QR e o PDF são liberados só depois do pagamento da 2ª parcela.</li>
                      <li>A 2ª parcela ({formatBRL(order.totalCents - firstCents)}) deve ser paga até {dayMonth(splitDue)}, às 23h59 (horário de Belém). Avisamos por e-mail antes do prazo.</li>
                      <li>
                        Se a 2ª parcela não for paga até o prazo, a reserva é cancelada e os ingressos voltam para a venda. Desistência em até 7 dias da compra:
                        devolvemos tudo.
                      </li>
                    </ul>
                    <p className="split-terms-warn" role="note">
                      <b>Atenção:</b> se você não pagar a 2ª parcela até {dayMonth(splitDue)}, <b>perde os {formatBRL(firstCents)} da 1ª parcela</b>. Esse valor
                      não é devolvido (exceto desistência em até 7 dias da compra).
                    </p>
                    <label className="split-terms-accept">
                      <input type="checkbox" name="ciente" required /> Estou ciente de que, se não pagar a 2ª parcela até {dayMonth(splitDue)}, perco os{" "}
                      {formatBRL(firstCents)} da 1ª parcela, que não são devolvidos.
                    </label>
                    <label className="split-terms-accept">
                      <input type="checkbox" name="aceite" required /> Li e concordo com os termos do Pix em 2x e os{" "}
                      <a href="/termos" target="_blank" className="underline">
                        Termos de compra
                      </a>
                      .
                    </label>
                  </div>
                  <button className="btn solid w-full">Pagar a 1ª parcela no Pix · {formatBRL(firstCents)}</button>
                </form>
              )}
              <p className="text-center text-xs text-fg-faint">
                {isSimulated(mode)
                  ? mode === "demo" ? "Demonstração: o pagamento é simulado." : "Desenvolvimento: o pagamento é simulado."
                  : "Pagamento seguro processado pelo Mercado Pago, aqui mesmo no site."}
              </p>
            </div>
          )}
        </section>
      )}

      {partial && (
        <section className="glass-card mt-10 p-6 md:p-8">
          <span className="eyebrow">Pix em 2x</span>
          <div className="installments mt-4">
            <div className="installment is-paid">
              <span>1ª parcela</span>
              <strong>{formatBRL(order.firstPaidCents)}</strong>
              <em>paga{order.firstPaidAt ? ` em ${dayMonth(order.firstPaidAt)}` : ""} ✓</em>
            </div>
            <div className="installment">
              <span>2ª parcela</span>
              <strong>{formatBRL(remainingCents)}</strong>
              <em>{partialOverdue ? `venceu em ${dayMonth(order.expiresAt)}` : `até ${order.expiresAt.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Belem" })}`}</em>
            </div>
          </div>
          {partialOverdue ? (
            <p className="mt-5 text-sm text-fg-muted">
              O prazo acabou sem a 2ª parcela e os ingressos voltaram para a venda. Conforme os termos do Pix em 2x aceitos na compra, os {formatBRL(order.firstPaidCents)} da 1ª parcela não são devolvidos (salvo se o pedido de desistência foi feito em até 7 dias da compra). Dúvidas: Instagram <strong className="text-fg">@perolaseventos</strong>.
            </p>
          ) : (
            <>
              <p className="mt-5 text-sm text-fg-muted">
                {order.tickets.length > 1 ? `Seus ${order.tickets.length} ingressos estão reservados` : "Seu ingresso está reservado"} até o prazo.
                O QR e o PDF são liberados <strong className="text-fg">assim que a 2ª parcela for paga</strong>.
              </p>
              <p className="split-terms-warn mt-4" role="note">
                <b>Não perca o prazo:</b> se a 2ª parcela não for paga até {dayMonth(order.expiresAt)} às 23h59, a reserva é cancelada e{" "}
                <b>os {formatBRL(order.firstPaidCents)} da 1ª parcela não são devolvidos</b>, conforme os termos aceitos na compra.
              </p>
              {mpProvider && paying === "pix" && pixKind === "pix2x-2" && pixCharge ? (
                pixPanel(`/pedido/${token}`)
              ) : (
                (mpProvider || isSimulated(mode)) && (
                  <form action={isSimulated(mode) ? simulatePaymentAction.bind(null, token, "pix2x-2") : pixAction.bind(null, token, "pix2x-2")} className="mt-6">
                    <button className="btn solid w-full">{isSimulated(mode) ? "Simular 2ª parcela (Pix)" : `Pagar 2ª parcela no Pix · ${formatBRL(remainingCents)}`}</button>
                  </form>
                )
              )}
              {mpProvider && <AutoRefresh seconds={8} />}
            </>
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
        <section className="story-confirm mt-10">
          {/* eslint-disable-next-line @next/next/no-img-element -- imagem gerada no servidor (story 1080×1920) */}
          <img src={`/pedido/${token}/story`} alt="Presença confirmada no Réveillon Pérolas 2K27" width={1080} height={1920} className="story-confirm-img" />
          <div className="grid content-center gap-4">
            <span className="eyebrow rule">Presença confirmada</span>
            <h2 className="display text-[clamp(2rem,5vw,3rem)]!">
              Agora é só <em>contar os dias</em>
            </h2>
            <p className="text-sm text-fg-muted">Mostre para todo mundo que você vai: poste no story ou no feed e marque o <strong className="text-fg">@perolaseventos</strong>. A imagem não mostra o seu QR: pode compartilhar sem medo.</p>
            <div className="flex flex-wrap gap-3">
              <StoryShare src={`/pedido/${token}/story`} filename="presenca-confirmada-perolas.png" label="Postar no story" />
              <StoryShare src={`/pedido/${token}/story?f=feed`} filename="presenca-confirmada-perolas-feed.png" label="Postar no feed" />
            </div>
            <p className="text-xs text-fg-faint">
              No celular, escolha <strong className="text-fg-muted">Instagram</strong> no menu que abrir (Story, Feed ou Direct). No computador, a imagem é baixada.
            </p>
          </div>
        </section>
      )}

      {order.status === "PAID" && (
        <section className="mt-10 grid gap-6">
          <WhatsappGroup />
          <TicketRules />
          <div className="glass-card flex flex-wrap items-center justify-between gap-4 p-5">
            <p className="max-w-md text-sm text-fg-muted">
              <strong className="text-fg">Na festa pode faltar sinal.</strong> Baixe o PDF agora: ele fica no celular e abre sem internet (também dá para imprimir).
              Ingresso de outra pessoa? Troque o nome e use “Enviar a quem vai usar”.
            </p>
            <a href={`/pedido/${token}/pdf`} className="btn solid" download>
              Baixar ingressos (PDF)
            </a>
          </div>
          {await Promise.all(
            order.tickets.map(async (t, i) => {
              const qr = await qrDataUrl(ticketToken(t.id, t.qrVersion));
              const editable = !t.usedAt && t.status === "VALID" && order.event.startsAt > new Date();
              return (
                <article key={t.id} className="glass-card grid items-center gap-x-6 gap-y-4 p-6 sm:grid-cols-[auto_1fr]">
                  <DemoBanner className="sm:col-span-2" />
                  {/* fundo branco: leitor lê melhor com contraste máximo, inclusive com brilho baixo */}
                  {/* eslint-disable-next-line @next/next/no-img-element -- data URL gerada no servidor, não há o que otimizar */}
                  <img src={qr} alt={`QR code do ingresso ${i + 1}`} className={`size-56 rounded-xl bg-white ${t.usedAt ? "opacity-30" : ""}`} />
                  <div>
                    <span className="eyebrow">Ingresso {i + 1} de {order.tickets.length}</span>
                    <h2 className="mt-2 font-display text-3xl">{t.ticketType.name}</h2>
                    <p className="mt-1 text-sm text-fg-muted">
                      {t.batch.name} · {genderLabel(t.gender)} · {formatBRL(t.priceCents)}
                    </p>
                    <p className="mt-3 text-sm">{t.holderName}</p>
                    {t.usedAt && <p className="mt-3 text-sm text-accent">Utilizado em {formatDateTime(t.usedAt)}</p>}
                    {t.status === "VALID" && !t.usedAt && (
                      <div className="mt-4 flex flex-wrap gap-2">
                        <a href={`/i/${ticketLinkToken(t.id, t.qrVersion)}/pdf`} className="btn px-4! py-2!" download>
                          Baixar PDF
                        </a>
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

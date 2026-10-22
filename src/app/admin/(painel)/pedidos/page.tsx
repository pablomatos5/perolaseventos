import { connection } from "next/server";
import type { Prisma } from "@/generated/prisma/client";
import { isDev, requireAdmin } from "@/lib/admin-auth";
import { activeEvent } from "@/lib/admin-data";
import { db } from "@/lib/db";
import { orderLink } from "@/lib/delivery";
import { formatBRL, formatDateTime } from "@/lib/format";
import { refundOrderAction, reissueAction, resendAction } from "../../actions";
import { ConfirmButton } from "../../forms";

const STATUS: Record<string, string> = {
  PENDING: "aguardando pagamento",
  PARTIAL: "Pix 2x · 1ª parcela paga",
  PAID: "pago",
  EXPIRED: "expirado",
  CANCELED: "cancelado",
  REFUNDED: "estornado",
};

export default async function PedidosPage({ searchParams }: PageProps<"/admin/pedidos">) {
  await connection();
  await requireAdmin();
  const event = await activeEvent();
  if (!event) return <p className="text-fg-muted">Nenhum evento publicado.</p>;

  const sp = await searchParams;
  const q = (typeof sp.q === "string" ? sp.q : "").trim();
  const status = typeof sp.status === "string" ? sp.status : "";
  const digits = q.replace(/\D/g, "");
  // botão de estorno: só para os desenvolvedores (a ação também confere no servidor)
  const dev = await isDev();
  const refundResult = sp.estorno === "ok" ? "ok" : sp.estorno === "erro" ? (typeof sp.msg === "string" ? sp.msg : "erro desconhecido") : null;

  const where: Prisma.OrderWhereInput = { eventId: event.id };
  if (status && status in STATUS) where.status = status as Prisma.OrderWhereInput["status"];
  if (q) {
    where.OR = [
      { code: { equals: q.toUpperCase() } },
      { buyerName: { contains: q, mode: "insensitive" } },
      { email: { contains: q.toLowerCase() } },
      ...(digits.length >= 4 ? [{ cpf: { contains: digits } }, { phone: { contains: digits } }] : []),
    ];
  }

  const orders = await db.order.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 60,
    include: {
      _count: { select: { tickets: true } },
      deliveries: { orderBy: { createdAt: "desc" }, take: 4 },
      pixCharges: { select: { kind: true, createdAt: true, paymentId: true }, orderBy: { createdAt: "asc" } },
    },
  });

  // tentativas de pagamento no cartão (o Registro guarda "pedido CÓDIGO · …"): abriu, recusas e erros do formulário
  const cardLogs = orders.length
    ? await db.auditLog.findMany({
        where: {
          action: { in: ["abriu o pagamento com cartão", "cartão recusado", "pagou com cartão", "problema no formulário do cartão"] },
          OR: orders.map((o) => ({ detail: { startsWith: `pedido ${o.code}` } })),
        },
        orderBy: { at: "asc" },
      })
    : [];
  const cardBy = new Map<string, typeof cardLogs>();
  for (const l of cardLogs) {
    const code = l.detail.slice(7, 13);
    cardBy.set(code, [...(cardBy.get(code) ?? []), l]);
  }

  return (
    <div className="grid gap-8">
      <div>
        <span className="eyebrow rule">Suporte</span>
        <h1 className="display mt-3 text-[clamp(2rem,4vw,3rem)]!">
          <em>Pedidos</em>
        </h1>
      </div>

      {refundResult && (
        <p role="status" className={`rounded-xl px-4 py-3 text-sm ${refundResult === "ok" ? "bg-ok/15 text-ok" : "bg-danger/15 text-danger"}`}>
          {refundResult === "ok" ? "Estorno feito: o dinheiro volta ao comprador e os QRs do pedido não valem mais." : `O estorno não foi feito: ${refundResult}`}
        </p>
      )}

      <form className="flex flex-wrap gap-3" role="search">
        <input
          name="q"
          defaultValue={q}
          placeholder="Código, nome, e-mail, CPF ou celular"
          className="min-w-64 flex-1 rounded-xl border border-line bg-bg/60 px-4 py-3 outline-none focus:border-accent"
        />
        <select name="status" defaultValue={status} className="rounded-xl border border-line bg-bg/60 px-4 py-3">
          <option value="">Todos</option>
          {Object.entries(STATUS).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
        <button className="btn">Buscar</button>
      </form>

      <ul className="grid gap-3">
        {orders.map((o) => {
          const lastEmail = o.deliveries.find((d) => d.channel === "EMAIL");
          // reserva que passou do prazo sem pagar continua PENDING no banco (não segura estoque): mostra como expirada
          const lapsed = o.status === "PENDING" && o.expiresAt < new Date();
          return (
            <li key={o.id} className="glass-card grid gap-3 p-5 md:grid-cols-[1fr_auto] md:items-center">
              <div className="grid gap-1 text-sm">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                  <span className="font-mono text-accent">{o.code}</span>
                  <span className="font-medium">{o.buyerName}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs ${o.status === "PAID" ? "bg-ok/15 text-ok" : "bg-surface text-fg-muted"}`}>
                    {lapsed ? "reserva expirada" : STATUS[o.status]}
                    {o.paidLate && " · pago após expirar"}
                    {o.status === "PARTIAL" && ` (${formatBRL(o.firstPaidCents)}) · 2ª ${o.expiresAt < new Date() ? "vencida em" : "até"} ${formatDateTime(o.expiresAt)}`}
                    {o.status === "PAID" && o.paymentPlan === "PIX_2X" && " · Pix 2x"}
                  </span>
                  {(() => {
                    // direito de arrependimento: 7 dias da compra (1º pagamento), e só antes do evento
                    if (o.status !== "PAID" && o.status !== "PARTIAL") return null;
                    const bought = o.firstPaidAt ?? o.paidAt ?? o.createdAt;
                    const until = new Date(Math.min(bought.getTime() + 7 * 86_400_000, event.startsAt.getTime()));
                    if (until <= new Date()) return null;
                    return (
                      <span className="rounded-full bg-accent/15 px-2 py-0.5 text-xs text-accent" title="Dentro do prazo de arrependimento (art. 49 do CDC): pedido de desistência dá reembolso integral">
                        arrependimento até {formatDateTime(until)}
                      </span>
                    );
                  })()}
                </div>
                <div className="text-fg-muted">
                  {o.email} · {o.phone || "sem celular"} · {o._count.tickets} ingresso(s) · {o.totalCents ? formatBRL(o.totalCents) : "cortesia"}
                </div>
                <PaymentTrail
                  status={o.status}
                  createdAt={o.createdAt}
                  paymentRef={o.paymentRef}
                  pix={o.pixCharges}
                  card={cardBy.get(o.code) ?? []}
                />
                <div className="text-xs text-fg-faint">
                  {formatDateTime(o.createdAt)}
                  {lastEmail && ` · e-mail: ${lastEmail.ok ? "enviado" : `falhou (${lastEmail.detail})`}`}
                </div>
              </div>
              {o.status === "PARTIAL" && dev && o.firstPaymentRef && /^\d+$/.test(o.firstPaymentRef) && (
                <div className="flex flex-wrap gap-2">
                  <a href={orderLink(o.id)} target="_blank" rel="noopener noreferrer" className="btn px-4! py-2!">
                    Ver pedido
                  </a>
                  <form action={refundOrderAction.bind(null, o.id)}>
                    <ConfirmButton
                      className="btn btn-danger px-4! py-2!"
                      message={`Estornar o pedido ${o.code} (Pix em 2x, 1ª parcela de ${formatBRL(o.firstPaidCents)}) pelo Mercado Pago? O dinheiro volta para ${o.buyerName}, a reserva é cancelada e os ingressos voltam para a venda. Não dá para desfazer.`}
                    >
                      Estornar 1ª parcela
                    </ConfirmButton>
                  </form>
                </div>
              )}
              {o.status === "PAID" && (
                <div className="flex flex-wrap gap-2">
                  <a href={orderLink(o.id)} target="_blank" rel="noopener noreferrer" className="btn px-4! py-2!">
                    Ver ingressos
                  </a>
                  <form action={resendAction.bind(null, o.id)}>
                    <button className="btn solid px-4! py-2!">Reenviar</button>
                  </form>
                  <form action={reissueAction.bind(null, o.id)}>
                    <ConfirmButton
                      className="btn px-4! py-2!"
                      message={`Reemitir os QR do pedido ${o.code}? Os QR atuais (e prints) deixam de valer e o cliente recebe o link de novo.`}
                    >
                      Reemitir QR
                    </ConfirmButton>
                  </form>
                  {dev && [o.paymentRef, o.firstPaymentRef].some((x) => x && /^\d+$/.test(x)) && (
                    <form action={refundOrderAction.bind(null, o.id)}>
                      <ConfirmButton
                        className="btn btn-danger px-4! py-2!"
                        message={`Estornar o pedido ${o.code} (${formatBRL(o.totalCents)}) pelo Mercado Pago? O dinheiro volta para ${o.buyerName}, a taxa de serviço volta junto e os QR codes param de valer. Não dá para desfazer.`}
                      >
                        Estornar
                      </ConfirmButton>
                    </form>
                  )}
                </div>
              )}
            </li>
          );
        })}
        {orders.length === 0 && <li className="text-fg-faint">Nenhum pedido encontrado.</li>}
      </ul>
    </div>
  );
}

const hhmm = (d: Date) => d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Belem" });

/** Motivos de recusa do cartão (status_detail do Mercado Pago) em português curto. */
const CARD_REASON: Record<string, string> = {
  cc_rejected_high_risk: "antifraude (risco)",
  cc_rejected_insufficient_amount: "sem saldo/limite",
  cc_rejected_call_for_authorize: "banco pediu autorização",
  cc_rejected_card_disabled: "cartão desativado",
  cc_rejected_bad_filled_card_number: "número errado",
  cc_rejected_bad_filled_date: "validade errada",
  cc_rejected_bad_filled_security_code: "CVV errado",
  cc_rejected_bad_filled_other: "dado errado",
  cc_rejected_duplicated_payment: "pagamento duplicado",
  cc_rejected_max_attempts: "tentativas demais",
  cc_rejected_blacklist: "cartão bloqueado",
  cc_rejected_other_reason: "recusado pelo banco",
};
/** A partir daqui a página do pedido registra quem abre o cartão (antes disso, só o Pix ficava salvo). */
const CARD_TRACKING_FROM = new Date("2026-10-22T21:12:00Z");
const PIX_KIND: Record<string, string> = { pix: "Pix", "pix2x-1": "Pix 2x (1ª)", "pix2x-2": "Pix 2x (2ª)" };

/** Como o comprador tentou (ou conseguiu) pagar: Pix gerado, cartão aberto/recusado, erro no formulário. */
function PaymentTrail({
  status,
  createdAt,
  paymentRef,
  pix,
  card,
}: {
  status: string;
  createdAt: Date;
  paymentRef: string | null;
  pix: { kind: string; createdAt: Date; paymentId: string }[];
  card: { at: Date; action: string; detail: string }[];
}) {
  const steps: { text: string; tone: "ok" | "bad" | "info" }[] = [];
  if (status === "PAID" && paymentRef && /^\d+$/.test(paymentRef)) {
    steps.push({ text: pix.some((p) => p.paymentId === paymentRef) ? "pago no Pix" : "pago no cartão", tone: "ok" });
  }
  for (const p of pix) if (!(status === "PAID" && p.paymentId === paymentRef)) steps.push({ text: `${PIX_KIND[p.kind] ?? "Pix"} gerado ${hhmm(p.createdAt)}`, tone: "info" });
  for (const l of card) {
    const part = l.detail.split(" · ");
    if (l.action === "abriu o pagamento com cartão") steps.push({ text: `abriu o cartão ${hhmm(l.at)}`, tone: "info" });
    else if (l.action === "cartão recusado") steps.push({ text: `cartão recusado: ${CARD_REASON[part[1]] ?? part[1] ?? "?"} (${hhmm(l.at)})`, tone: "bad" });
    else if (l.action === "problema no formulário do cartão") steps.push({ text: `erro no formulário do cartão: ${part[1] ?? "?"} (${hhmm(l.at)})`, tone: "bad" });
  }
  if (steps.length === 0) {
    if (status === "PENDING")
      steps.push({ text: createdAt < CARD_TRACKING_FROM ? "nenhum Pix gerado (cartão sem registro antes das 18h12)" : "não escolheu forma de pagamento", tone: "info" });
    else return null;
  }
  const cls = { ok: "bg-ok/15 text-ok", bad: "bg-danger/15 text-danger", info: "bg-surface text-fg-muted" } as const;
  return (
    <div className="flex flex-wrap gap-1.5 text-xs">
      {steps.map((s, i) => (
        <span key={i} className={`rounded-full px-2 py-0.5 ${cls[s.tone]}`}>
          {s.text}
        </span>
      ))}
    </div>
  );
}


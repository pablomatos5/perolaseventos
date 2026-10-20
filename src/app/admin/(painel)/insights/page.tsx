import { connection } from "next/server";
import type { OrderStatus } from "@/generated/prisma/enums";
import { requireDev } from "@/lib/admin-auth";
import { activeEvent } from "@/lib/admin-data";
import { devInsights } from "@/lib/dev-insights";
import { formatBRL, formatDateTime, SERVICE_FEE_CENTS } from "@/lib/format";
import { connectedAccount, marketplaceConfigured } from "@/lib/mp-account";
import { paymentMode } from "@/lib/payment-mode";

const DAY_MS = 86_400_000;

const STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING: "Aguardando pagamento",
  PARTIAL: "Pix 2x · 1ª parcela paga",
  PAID: "Pago",
  EXPIRED: "Expirado (reserva perdida)",
  CANCELED: "Cancelado",
  REFUNDED: "Estornado",
};

const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0);

/** Barra fina proporcional (0–100%). */
function Bar({ value, max, tone = "accent" }: { value: number; max: number; tone?: "accent" | "ok" | "danger" }) {
  const w = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  const bg = tone === "ok" ? "bg-ok" : tone === "danger" ? "bg-danger" : "bg-accent";
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-surface" aria-hidden>
      <div className={`h-full ${bg}`} style={{ width: `${w}%` }} />
    </div>
  );
}

export default async function InsightsPage() {
  await connection();
  await requireDev();
  const event = await activeEvent();
  if (!event) return <p className="text-fg-muted">Nenhum evento publicado.</p>;

  const [d, mpAcc] = await Promise.all([devInsights(event.id), connectedAccount()]);
  const mode = paymentMode();

  const conversion = pct(d.paidPaying, d.attempts);
  const totalValid = d.paidTickets + d.gender.cortesia;
  const checkinRate = pct(d.checkins, totalValid);
  const window = d.timeline.reduce(
    (a, t) => ({ created: a.created + t.created, paid: a.paid + t.paid, revenueCents: a.revenueCents + t.revenueCents, feeCents: a.feeCents + t.feeCents }),
    { created: 0, paid: 0, revenueCents: 0, feeCents: 0 },
  );
  const tlMax = Math.max(1, ...d.timeline.map((t) => Math.max(t.created, t.paid)));
  const payTotal = d.pay.pixAvista + d.pay.pix2x + d.pay.cartaoOutros;
  const simulated = mode === "mock" || mode === "demo";

  const mpDaysLeft = mpAcc ? Math.round((mpAcc.expiresAt.getTime() - new Date().getTime()) / DAY_MS) : 0;

  const earnings = [
    { label: "Taxa recebida", value: formatBRL(d.feeConfirmedCents), hint: `${d.paidTickets} ingresso(s) pago(s) × ${formatBRL(SERVICE_FEE_CENTS)}` },
    { label: "Taxa em aberto", value: formatBRL(d.feePendingCents), hint: "pedidos pendentes / Pix 2x na 1ª parcela" },
  ];

  return (
    <div className="grid gap-12">
      <div>
        <span className="eyebrow rule">Desenvolvedores</span>
        <h1 className="display mt-3 text-[clamp(2rem,4vw,3rem)]!">
          <em>Insights</em> do evento
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-fg-muted">
          {event.name} {event.edition} · {formatDateTime(event.startsAt)}. Números técnicos e de bastidores: ganho da taxa, conversão, formas de
          pagamento, entregas, portaria e saúde do servidor. Visível só para o acesso de desenvolvedor.
        </p>
      </div>

      {/* ───────── Ganho da taxa de serviço ───────── */}
      <section className="grid gap-4">
        <h2 className="font-display text-2xl">Taxa de serviço (desenvolvedores)</h2>
        <dl className="grid gap-4 sm:grid-cols-2">
          {earnings.map((c) => (
            <div key={c.label} className="kpi is-money">
              <dt>{c.label}</dt>
              <dd>{c.value}</dd>
              <span>{c.hint}</span>
            </div>
          ))}
        </dl>
      </section>

      {/* ───────── Funil de conversão ───────── */}
      <section className="grid gap-4">
        <h2 className="font-display text-2xl">Conversão</h2>
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="kpi">
            <dt>Pedidos iniciados</dt>
            <dd>{d.attempts}</dd>
            <span>que cobram (sem cortesia)</span>
          </div>
          <div className="kpi">
            <dt>Pagos</dt>
            <dd>{d.paidPaying}</dd>
          </div>
          <div className="kpi">
            <dt>Conversão</dt>
            <dd>{conversion}%</dd>
            <span>pagos ÷ iniciados</span>
          </div>
          <div className="kpi">
            <dt>Perdidos</dt>
            <dd>{d.status.EXPIRED + d.status.CANCELED}</dd>
            <span>expirados + cancelados</span>
          </div>
        </dl>
        <div className="glass-card grid gap-3 p-6 md:p-8">
          {(Object.keys(STATUS_LABEL) as OrderStatus[]).map((s) => (
            <div key={s} className="grid gap-1.5">
              <div className="flex items-center justify-between gap-4 text-sm">
                <span className="text-fg-muted">{STATUS_LABEL[s]}</span>
                <span className="tabular-nums">
                  <strong>{d.status[s]}</strong>
                  <span className="ml-2 text-xs text-fg-faint">{formatBRL(d.revenueByStatusCents[s])}</span>
                </span>
              </div>
              <Bar value={d.status[s]} max={Math.max(1, ...Object.values(d.status))} tone={s === "PAID" ? "ok" : s === "EXPIRED" || s === "CANCELED" ? "danger" : "accent"} />
            </div>
          ))}
        </div>
      </section>

      {/* ───────── Formas de pagamento ───────── */}
      <section className="grid gap-4">
        <h2 className="font-display text-2xl">Como pagaram</h2>
        <div className="glass-card grid gap-4 p-6 md:p-8">
          {[
            { label: "Pix à vista", value: d.pay.pixAvista },
            { label: "Pix em 2x", value: d.pay.pix2x },
            { label: "Cartão / outros", value: d.pay.cartaoOutros },
          ].map((p) => (
            <div key={p.label} className="grid grid-cols-[9rem_1fr_auto] items-center gap-4 text-sm">
              <span className="text-fg-muted">{p.label}</span>
              <Bar value={p.value} max={Math.max(1, payTotal)} />
              <span className="tabular-nums text-right">
                <strong>{p.value}</strong> <span className="text-xs text-fg-faint">{pct(p.value, payTotal)}%</span>
              </span>
            </div>
          ))}
          {simulated && (
            <p className="text-xs text-fg-faint">
              Pagamento em modo {mode}: a separação Pix × cartão é aproximada (simulações não geram cobrança Pix e caem em “cartão / outros”).
            </p>
          )}
        </div>
      </section>

      {/* ───────── Linha do tempo (14 dias) ───────── */}
      <section className="grid gap-4">
        <h2 className="font-display text-2xl">Últimos 14 dias</h2>
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="kpi"><dt>Pedidos criados</dt><dd>{window.created}</dd></div>
          <div className="kpi"><dt>Pagos</dt><dd>{window.paid}</dd></div>
          <div className="kpi is-money"><dt>Receita</dt><dd>{formatBRL(window.revenueCents)}</dd><span>sem a taxa</span></div>
          <div className="kpi is-money"><dt>Taxa gerada</dt><dd>{formatBRL(window.feeCents)}</dd></div>
        </dl>
        <div className="glass-card grid gap-2 p-6 md:p-8">
          <div className="mb-1 flex items-center gap-4 text-xs text-fg-faint">
            <span className="flex items-center gap-1.5"><i className="inline-block size-2.5 rounded-full bg-accent" />criados</span>
            <span className="flex items-center gap-1.5"><i className="inline-block size-2.5 rounded-full bg-ok" />pagos</span>
          </div>
          {d.timeline.map((t) => (
            <div key={t.key} className="grid grid-cols-[3rem_1fr_auto] items-center gap-3 text-sm">
              <span className="tabular-nums text-xs text-fg-faint">{t.label}</span>
              <div className="grid gap-1">
                <Bar value={t.created} max={tlMax} tone="accent" />
                <Bar value={t.paid} max={tlMax} tone="ok" />
              </div>
              <span className="tabular-nums text-right text-xs text-fg-faint">
                {t.created} / <span className="text-ok">{t.paid}</span>
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* ───────── Ingressos ───────── */}
      <section className="grid gap-4">
        <h2 className="font-display text-2xl">Ingressos</h2>
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="kpi"><dt>Ticket médio</dt><dd>{formatBRL(d.avgTicketCents)}</dd><span>por ingresso pago</span></div>
          <div className="kpi"><dt>Ingressos / pedido</dt><dd>{d.avgTicketsPerOrder.toFixed(1)}</dd></div>
          <div className="kpi"><dt>Masculino</dt><dd>{d.gender.masculino}</dd><span>{pct(d.gender.masculino, d.paidTickets)}% dos pagos</span></div>
          <div className="kpi"><dt>Feminino</dt><dd>{d.gender.feminino}</dd><span>{pct(d.gender.feminino, d.paidTickets)}% dos pagos</span></div>
        </dl>
      </section>

      {/* ───────── Operação ───────── */}
      <section className="grid gap-4">
        <h2 className="font-display text-2xl">Operação</h2>
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          <div className="kpi"><dt>Check-in</dt><dd>{checkinRate}%</dd><span>{d.checkins} de {totalValid} ingressos</span></div>
          <div className="kpi"><dt>Aparelhos ativos</dt><dd>{d.devices.active}</dd>{d.devices.revoked > 0 && <span>{d.devices.revoked} desautorizado(s)</span>}</div>
          <div className="kpi"><dt>E-mails enviados</dt><dd>{d.delivery.emailOk}</dd>{d.delivery.emailFail > 0 && <span className="text-danger">{d.delivery.emailFail} falha(s)</span>}</div>
          <div className="kpi"><dt>Pendentes agora</dt><dd>{d.pending.active}</dd>{d.pending.soon > 0 && <span>{d.pending.soon} expira(m) em 3h</span>}</div>
          <div className="kpi"><dt>Pix 2x esperando 2ª</dt><dd>{d.pending.partialActive}</dd>{d.pending.partialOverdue > 0 && <span className="text-danger">{d.pending.partialOverdue} vencida(s)</span>}</div>
          <div className="kpi"><dt>Pagos após expirar</dt><dd>{d.pending.late}</dd><span>confira os lotes</span></div>
          <div className="kpi"><dt>Setores</dt><dd>{d.totals.ticketTypes}</dd><span>{d.totals.batches} lote(s)</span></div>
          <div className="kpi"><dt>Cortesias</dt><dd>{d.gender.cortesia}</dd></div>
        </dl>
        {d.deliveryFails.length > 0 && (
          <div className="glass-card grid gap-2 p-6 md:p-8">
            <h3 className="text-sm font-semibold">Entregas que falharam (recentes)</h3>
            <ul className="grid gap-px overflow-hidden rounded-xl border border-line bg-line text-sm">
              {d.deliveryFails.map((f, i) => (
                <li key={i} className="grid gap-0.5 bg-bg p-3 sm:grid-cols-[8rem_1fr_auto]">
                  <span className="font-mono text-xs text-accent">{f.code}</span>
                  <span className="text-fg-muted">{f.channel === "EMAIL" ? f.email : f.channel} · {f.detail || "sem detalhe"}</span>
                  <span className="text-xs text-fg-faint tabular-nums">{formatDateTime(f.at)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* ───────── Saúde do sistema ───────── */}
      <section className="grid gap-4">
        <h2 className="font-display text-2xl">Saúde do sistema</h2>
        <div className="glass-card grid gap-4 p-6 md:grid-cols-2 md:p-8">
          <div className="grid gap-2 text-sm">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-fg-faint">Mercado Pago</h3>
            {mpAcc ? (
              <>
                <p>
                  <span className="mr-2 inline-block size-2.5 rounded-full bg-ok align-middle" />
                  <strong>{mpAcc.nickname || "conta conectada"}</strong> <span className="text-fg-faint">(nº {mpAcc.mpUserId})</span>
                  {!mpAcc.liveMode && <span className="ml-2 rounded-full bg-accent/15 px-2 py-0.5 text-xs text-accent">teste</span>}
                </p>
                <p className={`text-xs ${mpDaysLeft < 30 ? "text-danger" : "text-fg-faint"}`}>
                  Autorização válida até {formatDateTime(mpAcc.expiresAt)} ({mpDaysLeft} dia(s)){mpDaysLeft < 30 && " — renova sozinha na próxima cobrança"}
                </p>
              </>
            ) : (
              <p className="text-fg-muted">
                Nenhuma conta conectada. {marketplaceConfigured() ? "A equipe pode conectar em Vendas e lotes." : "Aplicação dos devs não configurada no servidor."}
              </p>
            )}
          </div>
          <div className="grid content-start gap-2 text-sm">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-fg-faint">Configuração do servidor</h3>
            <ul className="grid gap-1.5">
              <ConfigRow label="Modo de pagamento" value={mode} ok={mode === "mercadopago"} warn={mode === "demo" || mode === "mock"} />
              <ConfigRow label="Envio de e-mail (Resend)" value={process.env.RESEND_API_KEY ? "configurado" : "simulado no log"} ok={!!process.env.RESEND_API_KEY} warn={!process.env.RESEND_API_KEY} />
              <ConfigRow label="Anti-robô (Turnstile)" value={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ? "ligado" : "desligado"} ok={!!process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY} />
              <ConfigRow label="Aplicação Mercado Pago dos devs" value={marketplaceConfigured() ? "configurada" : "ausente"} ok={marketplaceConfigured()} warn={!marketplaceConfigured()} />
              <ConfigRow label="Ambiente" value={process.env.NODE_ENV ?? "—"} ok={process.env.NODE_ENV === "production"} />
              <ConfigRow label="APP_URL" value={process.env.APP_URL ?? "—"} />
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}

function ConfigRow({ label, value, ok, warn }: { label: string; value: string; ok?: boolean; warn?: boolean }) {
  return (
    <li className="flex items-center justify-between gap-3 border-b border-line-soft pb-1.5 last:border-0">
      <span className="text-fg-muted">{label}</span>
      <span className="flex items-center gap-2 font-medium">
        {(ok || warn) && <span className={`inline-block size-2 rounded-full ${ok ? "bg-ok" : "bg-danger"}`} />}
        {value}
      </span>
    </li>
  );
}

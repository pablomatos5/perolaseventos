import { connection } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { activeEvent, batchReport, kpis } from "@/lib/admin-data";
import { formatBRL, formatDateTime } from "@/lib/format";
import { connectedAccount, marketplaceConfigured } from "@/lib/mp-account";
import { paymentMode } from "@/lib/payment-mode";
import { closeBatchAction, disconnectMpAction, reopenBatchAction, togglePauseAction } from "../actions";
import { CardFeeForm, PriceForm, QuantityForm, SplitPixForm } from "../forms";

const MP_MESSAGE: Record<string, { ok: boolean; text: string }> = {
  conectado: { ok: true, text: "Conta Mercado Pago conectada. As próximas vendas caem nela, com a taxa de serviço separada." },
  erro: { ok: false, text: "O Mercado Pago não confirmou a conexão. Tente de novo." },
  recusado: { ok: false, text: "Conexão cancelada ou expirada. Toque em “Conectar Mercado Pago” de novo." },
  "sem-aplicacao": { ok: false, text: "A aplicação dos desenvolvedores (MP_CLIENT_ID/MP_CLIENT_SECRET) não está configurada no servidor." },
};

const STATE_STYLE: Record<string, string> = {
  "à venda": "bg-ok/15 text-ok",
  "na fila": "bg-surface text-fg-muted",
  esgotado: "bg-danger/15 text-danger",
  encerrado: "bg-surface text-fg-faint",
  agendado: "bg-accent/15 text-accent",
  cortesia: "bg-ocean/20 text-fg-muted",
};

export default async function AdminHome({ searchParams }: { searchParams: Promise<{ mp?: string }> }) {
  await connection();
  await requireAdmin();
  const event = await activeEvent();
  if (!event) return <p className="text-fg-muted">Nenhum evento publicado.</p>;
  const [k, report, mpAcc, { mp }] = await Promise.all([kpis(event.id), batchReport(event.id), connectedAccount(), searchParams]);
  const mpMsg = mp ? MP_MESSAGE[mp] : undefined;
  const mode = paymentMode();

  const money = [
    { label: "Receita confirmada", value: formatBRL(k.revenueCents), hint: "ingressos pagos (sem a taxa de serviço)" },
    { label: "Taxa de serviço", value: formatBRL(k.feeCents), hint: "vai para os desenvolvedores" },
  ];
  const cards = [
    { label: "Ingressos vendidos", value: k.paid },
    { label: "Cortesias", value: k.courtesies },
    { label: "Check-ins", value: k.checkins },
    { label: "Pagamentos em aberto", value: k.pending },
    { label: "Pix 2x esperando a 2ª", value: k.partial },
  ];

  return (
    <div className="grid gap-12">
      <div>
        <span className="eyebrow rule">
          {event.name} {event.edition}
        </span>
        <h1 className="display mt-3 text-[clamp(2rem,4vw,3rem)]!">
          Vendas e <em>lotes</em>
        </h1>
        <p className="mt-2 text-sm text-fg-muted">
          {formatDateTime(event.startsAt)} · {event.venue}
        </p>
      </div>

      <div className="grid gap-4">
        <dl className="grid gap-4 sm:grid-cols-2">
          {money.map((c) => (
            <div key={c.label} className="kpi is-money">
              <dt>{c.label}</dt>
              <dd>{c.value}</dd>
              <span>{c.hint}</span>
            </div>
          ))}
        </dl>
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {cards.map((c) => (
            <div key={c.label} className="kpi">
              <dt>{c.label}</dt>
              <dd>{c.value}</dd>
            </div>
          ))}
        </dl>
      </div>
      <section className="grid gap-3">
        <h2 className="font-display text-2xl">Mercado Pago</h2>
        {mpMsg && <p className={`rounded-xl px-4 py-3 text-sm ${mpMsg.ok ? "bg-ok/15 text-ok" : "bg-danger/15 text-danger"}`}>{mpMsg.text}</p>}
        <div className="glass-card grid gap-6 p-6 md:p-8">
          {mpAcc ? (
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-sm">
                  <span className="mr-2 inline-block size-2.5 rounded-full bg-ok align-middle" />
                  Conectada: <strong>{mpAcc.nickname || "conta Mercado Pago"}</strong> <span className="text-fg-faint">(nº {mpAcc.mpUserId})</span>
                  {!mpAcc.liveMode && <span className="ml-2 rounded-full bg-accent/15 px-2 py-0.5 text-xs text-accent">modo teste</span>}
                </p>
                <p className="mt-1 text-xs text-fg-faint">
                  Desde {formatDateTime(mpAcc.connectedAt)} · autorização renovada sozinha antes de {formatDateTime(mpAcc.expiresAt)}
                </p>
                <p className="mt-1 text-xs text-fg-faint">O valor dos ingressos cai nesta conta; a taxa de serviço vai direto para os desenvolvedores.</p>
              </div>
              <form action={disconnectMpAction}>
                <button className="btn px-4! py-2!">Desconectar</button>
              </form>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-4">
              <p className="max-w-xl text-sm text-fg-muted">
                Conecte a conta Mercado Pago do evento (de preferência a do CNPJ) para receber as vendas. Você entra na sua conta no site do
                Mercado Pago e autoriza: ninguém precisa passar senha ou chave.
              </p>
              {marketplaceConfigured() ? (
                <a href="/api/mercadopago/conectar" className="btn solid">Conectar Mercado Pago</a>
              ) : (
                <span className="text-xs text-danger">Aplicação dos desenvolvedores não configurada.</span>
              )}
            </div>
          )}
          {mode !== "mercadopago" && (
            <p className="text-xs text-fg-faint">Pagamento real desligado neste servidor (modo {mode}): as vendas ainda não usam o Mercado Pago.</p>
          )}
          <CardFeeForm eventId={event.id} bps={event.cardFeeBps} />
        </div>
      </section>
      <section className="grid gap-3">
        <h2 className="font-display text-2xl">Pix em 2x</h2>
        <SplitPixForm eventId={event.id} enabled={event.splitPixEnabled} days={event.splitPixDays} />
      </section>
      {k.late > 0 && (
        <p className="rounded-xl bg-accent/15 px-4 py-3 text-sm text-accent">
          {k.late} pedido(s) pagos depois da reserva expirar: ingressos emitidos mesmo assim, confira se o lote não estourou.
        </p>
      )}

      {report.map((t) => (
        <section key={t.id} className="glass-card overflow-hidden">
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-6 py-4">
            <h2 className="font-display text-2xl">
              {t.name} {t.paused && <span className="ml-2 align-middle text-xs font-sans text-danger">VENDAS PAUSADAS</span>}
            </h2>
            {!t.rows.every((r) => r.hidden) && (
              <form action={togglePauseAction.bind(null, t.id)}>
                <button className="btn px-4! py-2!">{t.paused ? "Retomar vendas" : "Pausar vendas"}</button>
              </form>
            )}
          </header>
          {/* celular: um cartão por lote (a tabela larga fica para o computador) */}
          <ul className="lot-cards md:hidden">
            {t.rows.map((r) => {
              const pct = r.quantity ? Math.min(100, ((r.sold + r.reserved) / r.quantity) * 100) : 0;
              return (
                <li key={r.id} className="lot-card">
                  <div className="lot-card-head">
                    <strong>{r.name}</strong>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATE_STYLE[r.state]}`}>{r.state}</span>
                  </div>
                  <div className="lot-card-bar" aria-hidden>
                    <i style={{ width: `${pct}%` }} />
                  </div>
                  <dl className="lot-card-stats">
                    <div>
                      <dt>Vendidos</dt>
                      <dd>{r.sold}</dd>
                      {r.checkedIn > 0 && <small>{r.checkedIn} entraram</small>}
                    </div>
                    <div>
                      <dt>Restam</dt>
                      <dd>{r.remaining}</dd>
                      {r.reserved > 0 && <small>{r.reserved} reservados</small>}
                    </div>
                    <div>
                      <dt>Receita</dt>
                      <dd>{formatBRL(r.revenueCents)}</dd>
                    </div>
                  </dl>
                  <div className="lot-card-edit">
                    <div>
                      <span className="lot-card-label">Preço (R$)</span>
                      {r.hidden ? <span className="tabular-nums">{formatBRL(r.priceCents)}</span> : <PriceForm batchId={r.id} priceCents={r.priceCents} femalePriceCents={r.femalePriceCents} />}
                    </div>
                    <div>
                      <span className="lot-card-label">Quantidade</span>
                      <QuantityForm batchId={r.id} quantity={r.quantity} />
                    </div>
                  </div>
                  {r.state === "à venda" && (
                    <form action={closeBatchAction.bind(null, r.id)}>
                      <button className="btn w-full py-2.5!">Virar lote agora</button>
                    </form>
                  )}
                  {r.state === "encerrado" && (
                    <form action={reopenBatchAction.bind(null, r.id)}>
                      <button className="btn w-full py-2.5!">Reabrir lote</button>
                    </form>
                  )}
                </li>
              );
            })}
          </ul>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[920px] text-sm">
              <thead className="text-left text-xs uppercase tracking-widest text-fg-faint">
                <tr>
                  <th className="px-6 py-3 font-medium">Lote</th>
                  <th className="px-3 py-3 font-medium">Preço (R$)</th>
                  <th className="px-3 py-3 font-medium">Vendidos</th>
                  <th className="px-3 py-3 font-medium">Reservados</th>
                  <th className="px-3 py-3 font-medium">Restam</th>
                  <th className="px-3 py-3 font-medium">Quantidade</th>
                  <th className="px-3 py-3 font-medium">Receita</th>
                  <th className="px-3 py-3 font-medium">Estado</th>
                  <th className="px-6 py-3 font-medium" />
                </tr>
              </thead>
              <tbody>
                {t.rows.map((r) => {
                  const pct = r.quantity ? Math.min(100, ((r.sold + r.reserved) / r.quantity) * 100) : 0;
                  return (
                    <tr key={r.id} className="border-t border-line-soft">
                      <td className="px-6 py-3">
                        {r.name}
                        <div className="mt-1.5 h-1 w-28 overflow-hidden rounded-full bg-surface">
                          <div className="h-full bg-accent" style={{ width: `${pct}%` }} />
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        {r.hidden ? (
                          <span className="tabular-nums">{formatBRL(r.priceCents)}</span>
                        ) : (
                          <PriceForm batchId={r.id} priceCents={r.priceCents} femalePriceCents={r.femalePriceCents} />
                        )}
                      </td>
                      <td className="px-3 py-3 tabular-nums">
                        {r.sold}
                        {r.checkedIn > 0 && <span className="text-fg-faint"> ({r.checkedIn} entraram)</span>}
                      </td>
                      <td className="px-3 py-3 tabular-nums">{r.reserved}</td>
                      <td className="px-3 py-3 tabular-nums">{r.remaining}</td>
                      <td className="px-3 py-3">
                        <QuantityForm batchId={r.id} quantity={r.quantity} />
                      </td>
                      <td className="px-3 py-3 tabular-nums">{formatBRL(r.revenueCents)}</td>
                      <td className="px-3 py-3">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATE_STYLE[r.state]}`}>{r.state}</span>
                      </td>
                      <td className="px-6 py-3 text-right">
                        {r.state === "à venda" && (
                          <form action={closeBatchAction.bind(null, r.id)}>
                            <button className="text-xs font-semibold text-accent underline-offset-4 hover:underline">Virar lote agora</button>
                          </form>
                        )}
                        {r.state === "encerrado" && (
                          <form action={reopenBatchAction.bind(null, r.id)}>
                            <button className="text-xs text-fg-faint underline-offset-4 hover:underline">Reabrir</button>
                          </form>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  );
}

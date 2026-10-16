import { connection } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { activeEvent, batchReport, kpis } from "@/lib/admin-data";
import { formatBRL, formatDateTime } from "@/lib/format";
import { closeBatchAction, reopenBatchAction, togglePauseAction } from "../actions";
import { QuantityForm } from "../forms";

const STATE_STYLE: Record<string, string> = {
  "à venda": "bg-ok/15 text-ok",
  "na fila": "bg-surface text-fg-muted",
  esgotado: "bg-danger/15 text-danger",
  encerrado: "bg-surface text-fg-faint",
  agendado: "bg-accent/15 text-accent",
  cortesia: "bg-ocean/20 text-fg-muted",
};

export default async function AdminHome() {
  await connection();
  await requireAdmin();
  const event = await activeEvent();
  if (!event) return <p className="text-fg-muted">Nenhum evento publicado.</p>;
  const [k, report] = await Promise.all([kpis(event.id), batchReport(event.id)]);

  const cards = [
    { label: "Receita confirmada", value: formatBRL(k.revenueCents) },
    { label: "Ingressos vendidos", value: k.paid },
    { label: "Cortesias", value: k.courtesies },
    { label: "Check-ins", value: k.checkins },
    { label: "Pagamentos em aberto agora", value: k.pending },
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

      <dl className="grid grid-cols-2 gap-4 md:grid-cols-5">
        {cards.map((c) => (
          <div key={c.label} className="glass-card p-5">
            <dt className="text-xs uppercase tracking-widest text-fg-faint">{c.label}</dt>
            <dd className="mt-2 font-display text-3xl">{c.value}</dd>
          </div>
        ))}
      </dl>
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
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="text-left text-xs uppercase tracking-widest text-fg-faint">
                <tr>
                  <th className="px-6 py-3 font-medium">Lote</th>
                  <th className="px-3 py-3 font-medium">Preço</th>
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
                      <td className="px-3 py-3 tabular-nums">{formatBRL(r.priceCents)}</td>
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

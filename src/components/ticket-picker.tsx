"use client";

import { useActionState, useState } from "react";
import { reserveAction } from "@/app/actions";
import { TurnstileWidget } from "@/components/turnstile-widget";
import { formatBRL, SERVICE_FEE_CENTS } from "@/lib/format";

// Chave pública do anti-robô (embutida no build). Vazia = checkout sem o quadradinho.
const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

export type PickerType = {
  id: string;
  name: string;
  description: string;
  maxPerOrder: number;
  status: "open" | "soon" | "soldout" | "paused";
  batchName: string | null;
  priceCents: number;
  femaleCents: number;
  remaining: number;
  lowStock: boolean;
  next: { name: string; priceCents: number } | null;
};

type Qty = Record<string, { masc: number; fem: number }>;

function Stepper({ value, onChange, max, label }: { value: number; onChange: (v: number) => void; max: number; label: string }) {
  return (
    <div className="flex items-center gap-3" role="group" aria-label={label}>
      <button type="button" className="size-11 rounded-full border border-line text-lg disabled:opacity-30" onClick={() => onChange(value - 1)} disabled={value <= 0} aria-label={`Menos ${label}`}>
        −
      </button>
      <span className="w-5 text-center tabular-nums">{value}</span>
      <button type="button" className="size-11 rounded-full border border-line text-lg disabled:opacity-30" onClick={() => onChange(value + 1)} disabled={value >= max} aria-label={`Mais ${label}`}>
        +
      </button>
    </div>
  );
}

export function TicketPicker({ eventId, types }: { eventId: string; types: PickerType[] }) {
  const [qty, setQty] = useState<Qty>({});
  const [state, action, pending] = useActionState(reserveAction, undefined);

  const get = (id: string) => qty[id] ?? { masc: 0, fem: 0 };
  const set = (id: string, patch: Partial<{ masc: number; fem: number }>) => setQty((q) => ({ ...q, [id]: { ...get(id), ...patch } }));

  const subtotal = types.reduce((s, t) => s + get(t.id).masc * t.priceCents + get(t.id).fem * t.femaleCents, 0);
  const count = types.reduce((s, t) => s + get(t.id).masc + get(t.id).fem, 0);
  const fee = count * SERVICE_FEE_CENTS;
  const items = types.map((t) => ({ ticketTypeId: t.id, ...get(t.id) })).filter((i) => i.masc + i.fem > 0);

  return (
    <form action={action} className="grid gap-10 lg:grid-cols-[1.4fr_1fr]">
      <input type="hidden" name="eventId" value={eventId} />
      <input type="hidden" name="items" value={JSON.stringify(items)} />

      <div className="grid gap-5">
        {types.map((t) => {
          const q = get(t.id);
          const cap = Math.min(t.maxPerOrder, t.remaining);
          return (
            <article key={t.id} className="glass-card scallop-top p-6 md:p-8">
              <div className="grid items-start gap-4 sm:grid-cols-[1fr_auto]">
                <div>
                  <h3 className="font-display text-3xl font-light">{t.name}</h3>
                  <p className="mt-1 max-w-md text-sm text-fg-muted">{t.description}</p>
                </div>
                {t.status === "open" && (
                  <div className="grid justify-items-start sm:justify-items-end sm:text-right">
                    <span className="eyebrow">{t.batchName}</span>
                    <div className="font-display text-4xl text-accent">
                      {t.femaleCents === t.priceCents ? formatBRL(t.priceCents) : `a partir de ${formatBRL(Math.min(t.priceCents, t.femaleCents))}`}
                    </div>
                  </div>
                )}
              </div>

              {t.status === "open" ? (
                <>
                  {t.lowStock && (
                    <p className="mt-4 inline-block rounded-full bg-accent/15 px-3 py-1 text-xs font-medium text-accent">
                      Últimos ingressos do {t.batchName}
                    </p>
                  )}
                  <div className="mt-6 flex flex-wrap gap-8 border-t border-line pt-6">
                    <div>
                      <div className="mb-2 text-xs uppercase tracking-widest text-fg-faint">Masculino · {formatBRL(t.priceCents)}</div>
                      <Stepper label="masculino" value={q.masc} max={cap - q.fem} onChange={(v) => set(t.id, { masc: v })} />
                    </div>
                    <div>
                      <div className="mb-2 text-xs uppercase tracking-widest text-fg-faint">Feminino · {formatBRL(t.femaleCents)}</div>
                      <Stepper label="feminino" value={q.fem} max={cap - q.masc} onChange={(v) => set(t.id, { fem: v })} />
                    </div>
                  </div>
                  {t.next && (
                    <p className="mt-5 text-xs text-fg-faint">
                      Próximo: {t.next.name} por {formatBRL(t.next.priceCents)}
                    </p>
                  )}
                </>
              ) : (
                <p className="mt-6 border-t border-line pt-6 text-sm text-fg-muted">
                  {t.status === "soon" && "Próximo lote abre em breve."}
                  {t.status === "soldout" && "Esgotado."}
                  {t.status === "paused" && "Vendas pausadas no momento."}
                </p>
              )}
            </article>
          );
        })}
      </div>

      <aside className="glass-card scallop-top h-fit p-6 md:p-8">
        <span className="eyebrow rule">Seus dados</span>
        <div className="mt-6 grid gap-4">
          <Field name="buyerName" label="Nome completo" autoComplete="name" />
          <Field name="email" label="E-mail" type="email" autoComplete="email" />
          <Field name="phone" label="Celular com DDD" type="tel" autoComplete="tel" inputMode="numeric" />
          <Field name="cpf" label="CPF" inputMode="numeric" maxLength={14} />
        </div>

        <dl className="mt-8 grid gap-1.5 border-t border-line pt-6 text-sm text-fg-muted">
          <div className="flex justify-between">
            <dt>{count} ingresso(s)</dt>
            <dd className="tabular-nums">{formatBRL(subtotal)}</dd>
          </div>
          <div className="flex justify-between">
            <dt>Taxa de serviço ({formatBRL(SERVICE_FEE_CENTS)} por ingresso)</dt>
            <dd className="tabular-nums">{formatBRL(fee)}</dd>
          </div>
          <div className="mt-2 flex items-end justify-between text-fg">
            <dt>Total</dt>
            <dd className="font-display text-4xl">{formatBRL(subtotal + fee)}</dd>
          </div>
        </dl>
        {TURNSTILE_SITE_KEY && (
          <div className="mt-6">
            <TurnstileWidget siteKey={TURNSTILE_SITE_KEY} resetKey={state} />
          </div>
        )}
        {state?.error && (
          <p role="alert" className="mt-4 rounded-lg bg-danger/15 px-4 py-3 text-sm text-danger">
            {state.error}
          </p>
        )}
        <button className="btn solid mt-6 w-full" disabled={count === 0 || pending}>
          {pending ? "Reservando…" : "Ir para o pagamento"}
        </button>
        <p className="mt-3 text-center text-xs text-fg-faint">
          Seus ingressos ficam reservados por 15 minutos. Depois do pagamento, baixe o PDF na hora e receba também por e-mail.
        </p>
      </aside>
    </form>
  );
}

function Field({ label, ...props }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="grid gap-1.5 text-xs uppercase tracking-widest text-fg-faint">
      {label}
      <input
        required
        {...props}
        className="rounded-xl border border-line bg-bg/60 px-4 py-3 text-base normal-case tracking-normal text-fg outline-none transition focus:border-accent"
      />
    </label>
  );
}

"use client";

import { useActionState, useState } from "react";
import { reserveAction } from "@/app/actions";
import { TurnstileWidget } from "@/components/turnstile-widget";
import { formatBRL } from "@/lib/format";

// Chave pública do anti-robô (embutida no build). Vazia = checkout sem o quadradinho.
const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

export type PickerType = {
  id: string;
  name: string;
  description: string;
  allowHalf: boolean;
  maxPerOrder: number;
  status: "open" | "soon" | "soldout" | "paused";
  batchName: string | null;
  priceCents: number;
  halfCents: number;
  remaining: number;
  lowStock: boolean;
  next: { name: string; priceCents: number } | null;
};

type Qty = Record<string, { full: number; half: number }>;

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

  const get = (id: string) => qty[id] ?? { full: 0, half: 0 };
  const set = (id: string, patch: Partial<{ full: number; half: number }>) => setQty((q) => ({ ...q, [id]: { ...get(id), ...patch } }));

  const total = types.reduce((s, t) => s + get(t.id).full * t.priceCents + get(t.id).half * t.halfCents, 0);
  const count = types.reduce((s, t) => s + get(t.id).full + get(t.id).half, 0);
  const items = types.map((t) => ({ ticketTypeId: t.id, ...get(t.id) })).filter((i) => i.full + i.half > 0);

  return (
    <form action={action} className="grid gap-10 lg:grid-cols-[1.4fr_1fr]">
      <input type="hidden" name="eventId" value={eventId} />
      <input type="hidden" name="items" value={JSON.stringify(items)} />

      <div className="grid gap-5">
        {types.map((t) => {
          const q = get(t.id);
          const cap = Math.min(t.maxPerOrder, t.remaining);
          return (
            <article key={t.id} className="glass-card p-6 md:p-8">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h3 className="font-display text-3xl font-light">{t.name}</h3>
                  <p className="mt-1 max-w-md text-sm text-fg-muted">{t.description}</p>
                </div>
                {t.status === "open" && (
                  <div className="w-full sm:w-auto sm:text-right">
                    <span className="eyebrow">{t.batchName}</span>
                    <div className="font-display text-4xl text-accent">{formatBRL(t.priceCents)}</div>
                    {t.allowHalf && <div className="text-xs text-fg-faint">meia {formatBRL(t.halfCents)}</div>}
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
                      <div className="mb-2 text-xs uppercase tracking-widest text-fg-faint">Inteira</div>
                      <Stepper label="inteira" value={q.full} max={cap - q.half} onChange={(v) => set(t.id, { full: v })} />
                    </div>
                    {t.allowHalf && (
                      <div>
                        <div className="mb-2 text-xs uppercase tracking-widest text-fg-faint">Meia-entrada</div>
                        <Stepper label="meia" value={q.half} max={cap - q.full} onChange={(v) => set(t.id, { half: v })} />
                      </div>
                    )}
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
        <p className="text-xs leading-relaxed text-fg-faint">
          Meia-entrada (Lei 12.933/2013): estudantes, pessoas com deficiência, jovens de baixa renda e idosos. O documento é conferido na entrada.
        </p>
      </div>

      <aside className="glass-card h-fit p-6 md:p-8 lg:sticky lg:top-8">
        <span className="eyebrow rule">Seus dados</span>
        <div className="mt-6 grid gap-4">
          <Field name="buyerName" label="Nome completo" autoComplete="name" />
          <Field name="email" label="E-mail" type="email" autoComplete="email" />
          <Field name="phone" label="Celular com DDD" type="tel" autoComplete="tel" inputMode="numeric" />
          <Field name="cpf" label="CPF" inputMode="numeric" maxLength={14} />
          <label className="flex cursor-pointer items-start gap-3 py-1 text-sm text-fg-muted">
            <input type="checkbox" name="whatsappOptIn" defaultChecked className="mt-0.5 size-5 shrink-0 accent-[var(--accent)]" />
            Quero receber o ingresso também pelo WhatsApp
          </label>
        </div>

        <div className="mt-8 flex items-end justify-between border-t border-line pt-6">
          <span className="text-sm text-fg-muted">{count} ingresso(s)</span>
          <span className="font-display text-4xl">{formatBRL(total)}</span>
        </div>
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
        <p className="mt-3 text-center text-xs text-fg-faint">Seus ingressos ficam reservados por 15 minutos.</p>
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

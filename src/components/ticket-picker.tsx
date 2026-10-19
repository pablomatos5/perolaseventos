"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { reserveAction, type BuyerField } from "@/app/actions";
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
  soldPct: number;
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
  // dados do comprador guardados aqui: o envio do formulário não apaga o que foi digitado
  const [buyer, setBuyer] = useState<Record<BuyerField, string>>({ buyerName: "", email: "", phone: "", cpf: "" });
  const [errField, setErrField] = useState<BuyerField | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const setField = (f: BuyerField, v: string) => {
    setBuyer((b) => ({ ...b, [f]: v }));
    if (errField === f) setErrField(null);
  };
  // erro do servidor: marca o campo, foca e rola até ele
  useEffect(() => {
    if (!state?.error) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reflete a resposta do servidor
    setErrField(state.field ?? null);
    const el = state.field ? formRef.current?.querySelector<HTMLInputElement>(`[name="${state.field}"]`) : formRef.current?.querySelector<HTMLElement>("[role=alert]");
    el?.scrollIntoView({ block: "center", behavior: "smooth" });
    if (el instanceof HTMLInputElement) el.focus({ preventScroll: true });
  }, [state]);

  const get = (id: string) => qty[id] ?? { masc: 0, fem: 0 };
  const set = (id: string, patch: Partial<{ masc: number; fem: number }>) => setQty((q) => ({ ...q, [id]: { ...get(id), ...patch } }));

  const subtotal = types.reduce((s, t) => s + get(t.id).masc * t.priceCents + get(t.id).fem * t.femaleCents, 0);
  const count = types.reduce((s, t) => s + get(t.id).masc + get(t.id).fem, 0);
  const fee = count * SERVICE_FEE_CENTS;
  const items = types.map((t) => ({ ticketTypeId: t.id, ...get(t.id) })).filter((i) => i.masc + i.fem > 0);

  return (
    <form ref={formRef} action={action} className="grid items-start gap-10 lg:grid-cols-[1.4fr_1fr]">
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
                  {/* barra do lote: dá a noção de como as vendas estão andando */}
                  <div className="lot-progress mt-5" role="img" aria-label={`${t.batchName}: ${t.soldPct}% vendido`}>
                    <div className="flex items-baseline justify-between text-xs">
                      <span className="font-semibold uppercase tracking-[0.18em] text-fg-muted">Vendas do lote</span>
                      <span className="tabular-nums font-semibold text-accent">{t.soldPct}% vendido</span>
                    </div>
                    <div className="lot-bar mt-2">
                      <i style={{ width: `${Math.max(4, t.soldPct)}%` }} />
                    </div>
                  </div>
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
          {BUYER_FIELDS.map(({ name, label, mask, ...rest }) => (
            <Field
              key={name}
              name={name}
              label={label}
              value={buyer[name]}
              onChange={(e) => setField(name, mask ? mask(e.target.value) : e.target.value)}
              error={errField === name ? state?.error : undefined}
              {...rest}
            />
          ))}
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
        {state?.error && !errField && (
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

type FieldDef = { name: BuyerField; label: string; mask?: (v: string) => string } & Omit<React.InputHTMLAttributes<HTMLInputElement>, "name">;
const BUYER_FIELDS: FieldDef[] = [
  { name: "buyerName", label: "Nome completo", autoComplete: "name" },
  { name: "email", label: "E-mail", type: "email", autoComplete: "email", inputMode: "email" },
  { name: "phone", label: "Celular com DDD", type: "tel", autoComplete: "tel", inputMode: "numeric", placeholder: "(91) 99999-9999", mask: (v) => maskPhone(v) },
  { name: "cpf", label: "CPF", inputMode: "numeric", placeholder: "000.000.000-00", mask: (v) => maskCpf(v) },
];

const digits = (v: string, n: number) => v.replace(/\D/g, "").slice(0, n);
function maskCpf(v: string) {
  const d = digits(v, 11);
  return d.replace(/^(\d{3})(\d)/, "$1.$2").replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3").replace(/\.(\d{3})(\d{1,2})$/, ".$1-$2");
}
function maskPhone(v: string) {
  const d = digits(v, 11);
  if (d.length <= 2) return d.length ? `(${d}` : "";
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

function Field({ label, error, ...props }: { label: string; error?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  const id = `f-${props.name}`;
  return (
    <label className="grid gap-1.5 text-xs uppercase tracking-widest text-fg-faint">
      {label}
      <input
        required
        {...props}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-err` : undefined}
        className={`rounded-xl border bg-bg/60 px-4 py-3 text-base normal-case tracking-normal text-fg outline-none transition focus:border-accent ${error ? "border-danger ring-2 ring-danger/25" : "border-line"}`}
      />
      {error && (
        <span id={`${id}-err`} role="alert" className="text-xs font-medium normal-case tracking-normal text-danger">
          {error}
        </span>
      )}
    </label>
  );
}

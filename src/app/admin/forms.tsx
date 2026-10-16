"use client";

import { useActionState } from "react";
import { createCourtesyAction, loginAction, updateQuantityAction, type FormState } from "./actions";

function Feedback({ state }: { state: FormState }) {
  if (!state) return null;
  return (
    <p role="status" className={`mt-3 rounded-lg px-3 py-2 text-sm ${state.error ? "bg-danger/15 text-danger" : "bg-ok/15 text-ok"}`}>
      {state.error ?? state.ok}
    </p>
  );
}

const input = "rounded-xl border border-line bg-bg/60 px-4 py-3 text-base text-fg outline-none focus:border-accent";

export function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, undefined);
  return (
    <form action={action} className="glass-card grid w-full max-w-sm gap-4 p-8">
      <span className="eyebrow rule">Painel Pérolas</span>
      <input name="password" type="password" placeholder="Senha" required autoFocus className={input} autoComplete="current-password" />
      <button className="btn solid" disabled={pending}>
        {pending ? "Entrando…" : "Entrar"}
      </button>
      <Feedback state={state} />
    </form>
  );
}

export function QuantityForm({ batchId, quantity }: { batchId: string; quantity: number }) {
  const [state, action, pending] = useActionState(updateQuantityAction.bind(null, batchId), undefined);
  return (
    <form action={action} className="flex items-center gap-2">
      <input name="quantity" type="number" min={0} defaultValue={quantity} className="w-20 rounded-lg border border-line bg-bg/60 px-2 py-1 text-sm" aria-label="Quantidade do lote" />
      <button className="text-xs text-accent underline-offset-4 hover:underline disabled:opacity-50" disabled={pending}>
        salvar
      </button>
      {state?.error && <span className="text-xs text-danger">{state.error}</span>}
    </form>
  );
}

export function CourtesyForm({ batches }: { batches: { id: string; label: string; remaining: number }[] }) {
  const [state, action, pending] = useActionState(createCourtesyAction, undefined);
  return (
    <form action={action} className="glass-card grid gap-4 p-6 md:grid-cols-2 md:p-8">
      <label className="grid gap-1.5 text-xs uppercase tracking-widest text-fg-faint md:col-span-2">
        Lote de cortesia
        <select name="batchId" required className={input}>
          {batches.map((b) => (
            <option key={b.id} value={b.id} disabled={b.remaining === 0}>
              {b.label} · {b.remaining} disponíveis
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1.5 text-xs uppercase tracking-widest text-fg-faint">
        Nome do convidado
        <input name="name" required className={input} />
      </label>
      <label className="grid gap-1.5 text-xs uppercase tracking-widest text-fg-faint">
        E-mail
        <input name="email" type="email" required className={input} />
      </label>
      <label className="grid gap-1.5 text-xs uppercase tracking-widest text-fg-faint">
        WhatsApp (opcional)
        <input name="phone" type="tel" inputMode="numeric" className={input} />
      </label>
      <label className="grid gap-1.5 text-xs uppercase tracking-widest text-fg-faint">
        Quantidade
        <input name="qty" type="number" min={1} max={20} defaultValue={1} required className={input} />
      </label>
      <label className="grid gap-1.5 text-xs uppercase tracking-widest text-fg-faint md:col-span-2">
        Observação (ex.: patrocinador, imprensa, artista)
        <input name="note" maxLength={80} className={input} />
      </label>
      <div className="md:col-span-2">
        <button className="btn solid" disabled={pending}>
          {pending ? "Emitindo…" : "Emitir e enviar cortesia"}
        </button>
        <Feedback state={state} />
      </div>
    </form>
  );
}

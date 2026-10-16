"use client";

import { useActionState, useState } from "react";
import { updateHolderAction, type HolderState } from "@/app/actions";

/** Link deste ingresso só, para mandar a quem vai usar (WhatsApp etc.). */
export function ShareTicketButton({ url, holder }: { url: string; holder: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="btn px-4! py-2!"
      onClick={async () => {
        const text = `Seu ingresso do Réveillon Pérolas (${holder}): ${url}`;
        if (navigator.share) {
          await navigator.share({ title: "Ingresso Réveillon Pérolas", text, url }).catch(() => {});
          return;
        }
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      }}
    >
      {copied ? "Link copiado ✓" : "Enviar a quem vai usar"}
    </button>
  );
}

/** Nome de quem vai usar o ingresso. Trocar gera QR novo; o antigo (e prints dele) deixa de valer. */
export function HolderForm({ orderToken, ticketId, holder }: { orderToken: string; ticketId: string; holder: string }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<HolderState, FormData>(updateHolderAction.bind(null, orderToken, ticketId), undefined);
  // salvou: fecha o formulário (ajuste de estado durante a renderização, padrão do React)
  const [seen, setSeen] = useState(state);
  if (state !== seen) {
    setSeen(state);
    if (state?.ok) setOpen(false);
  }
  if (!open) {
    return (
      <button type="button" className="text-xs text-accent underline-offset-4 hover:underline" onClick={() => setOpen(true)}>
        {state?.ok ?? "Trocar o nome de quem vai usar"}
      </button>
    );
  }
  return (
    <form action={action} className="grid gap-2">
      <label className="grid gap-1 text-xs uppercase tracking-widest text-fg-faint">
        Nome de quem vai usar
        <input
          name="holder"
          defaultValue={holder}
          required
          minLength={5}
          maxLength={80}
          autoComplete="name"
          className="rounded-xl border border-line bg-bg/60 px-4 py-3 text-base normal-case tracking-normal text-fg outline-none focus:border-accent"
        />
      </label>
      <p className="text-xs text-fg-faint">Ao trocar, um QR novo é gerado e o anterior (inclusive prints e links enviados) deixa de valer.</p>
      {state?.error && <p className="text-xs text-danger">{state.error}</p>}
      <div className="flex gap-2">
        <button className="btn solid px-4! py-2!" disabled={pending}>
          {pending ? "Salvando…" : "Salvar nome"}
        </button>
        <button type="button" className="btn px-4! py-2!" onClick={() => setOpen(false)}>
          Cancelar
        </button>
      </div>
    </form>
  );
}

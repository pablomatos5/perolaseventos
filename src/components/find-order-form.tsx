"use client";

import { useActionState, useState } from "react";
import { findOrderAction } from "@/app/actions";
import { TurnstileWidget } from "@/components/turnstile-widget";

// Chave pública do anti-robô (embutida no build). Vazia = formulário sem a verificação.
const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

const maskCpf = (v: string) => {
  const d = v.replace(/\D/g, "").slice(0, 11);
  return d.replace(/^(\d{3})(\d)/, "$1.$2").replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3").replace(/\.(\d{3})(\d{1,2})$/, ".$1-$2");
};

/** "Encontrar meu pedido": CPF + e-mail da compra → o link vai para o e-mail cadastrado (nada aparece na tela). */
export function FindOrderForm() {
  const [state, action, pending] = useActionState(findOrderAction, undefined);
  // campos controlados: depois de um erro o formulário não apaga o que a pessoa digitou
  const [cpf, setCpf] = useState("");
  const [email, setEmail] = useState("");

  if (state?.sent) {
    return (
      <div className="glass-card grid gap-3 p-6 text-center" role="status">
        <h2 className="font-display text-2xl">Confira o seu e-mail</h2>
        <p className="text-sm text-fg-muted">
          Se existir um pedido com esse CPF e esse e-mail, acabamos de enviar o link para o e-mail usado na compra. Olhe também a caixa de spam e a aba Promoções.
        </p>
        <p className="text-xs text-fg-faint">Não chegou em alguns minutos? Confira se digitou o mesmo e-mail da compra ou fale com a Pérolas pelo Instagram @perolaseventos.</p>
      </div>
    );
  }

  const input = "rounded-xl border border-line bg-bg/60 px-4 py-3 text-base normal-case tracking-normal text-fg outline-none transition focus:border-accent";
  return (
    <form action={action} className="glass-card grid gap-4 p-6">
      <label className="grid gap-1.5 text-xs uppercase tracking-widest text-fg-faint">
        CPF usado na compra
        <input name="cpf" required inputMode="numeric" autoComplete="off" placeholder="000.000.000-00" value={cpf} onChange={(e) => setCpf(maskCpf(e.target.value))} className={input} />
      </label>
      <label className="grid gap-1.5 text-xs uppercase tracking-widest text-fg-faint">
        E-mail usado na compra
        <input name="email" type="email" required autoComplete="email" placeholder="voce@email.com" value={email} onChange={(e) => setEmail(e.target.value)} className={input} />
      </label>
      {TURNSTILE_SITE_KEY && <TurnstileWidget siteKey={TURNSTILE_SITE_KEY} resetKey={state} />}
      {state?.error && (
        <p role="alert" className="rounded-lg bg-danger/15 px-4 py-3 text-sm text-danger">
          {state.error}
        </p>
      )}
      <button className="btn solid w-full" disabled={pending}>
        {pending ? "Enviando…" : "Enviar o link para o meu e-mail"}
      </button>
      <p className="text-xs text-fg-faint">Por segurança, o link vai só para o e-mail cadastrado no pedido. Nada aparece nesta tela.</p>
    </form>
  );
}

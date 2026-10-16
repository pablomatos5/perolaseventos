"use client";

import { useEffect, useState } from "react";
import { saveDevice } from "../offline";

/**
 * Ativação de um aparelho da portaria. O link vem do painel (Portaria → Autorizar novo aparelho)
 * com a chave depois do "#": ela nunca vai para o servidor em logs nem fica no histórico.
 */
export default function AtivarPage() {
  const [msg, setMsg] = useState("Ativando este aparelho…");

  useEffect(() => {
    const token = window.location.hash.slice(1);
    history.replaceState(null, "", "/portaria/ativar"); // tira a chave da barra de endereço
    Promise.resolve(token)
      .then((t) => {
        if (!t) throw new Error("Link de ativação incompleto");
        return fetch("/api/portaria/eu", { headers: { Authorization: `Bearer ${t}` } });
      })
      .then(async (r) => {
        const data = (await r.json()) as { ok: boolean; name?: string; message?: string };
        if (!data.ok) throw new Error(data.message ?? "Aparelho não autorizado");
        saveDevice(token, data.name ?? "Portaria");
        window.location.replace("/portaria");
      })
      .catch((e: Error) => setMsg(`${e.message}. Gere um novo QR no painel e tente de novo.`));
  }, []);

  return (
    <main className="grid min-h-svh place-items-center p-6 text-center">
      <div className="glass-card grid max-w-sm gap-3 p-8">
        <span className="eyebrow rule justify-center">Portaria</span>
        <p className="text-fg-muted">{msg}</p>
      </div>
    </main>
  );
}

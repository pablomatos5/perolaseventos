"use client";

import { useEffect, useRef } from "react";

type TurnstileApi = {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string;
  reset: (id: string) => void;
  remove: (id: string) => void;
};
declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SCRIPT = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
let loading: Promise<void> | null = null;
function loadScript() {
  loading ??= new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = SCRIPT;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      loading = null;
      reject(new Error("turnstile"));
    };
    document.head.appendChild(s);
  });
  return loading;
}

/**
 * Anti-robô da Cloudflare dentro do <form>: injeta o campo "cf-turnstile-response".
 * `resetKey` muda a cada tentativa de envio, porque cada resposta só vale uma vez.
 */
export function TurnstileWidget({ siteKey, resetKey }: { siteKey: string; resetKey: unknown }) {
  const box = useRef<HTMLDivElement>(null);
  const widget = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadScript()
      .then(() => {
        if (cancelled || !box.current || !window.turnstile || widget.current) return;
        // interaction-only: invisível na grande maioria das compras; o quadro só aparece quando a Cloudflare
        // precisa de um clique. Tema claro para combinar com o card do formulário quando aparecer.
        widget.current = window.turnstile.render(box.current, { sitekey: siteKey, theme: "light", size: "flexible", language: "pt-br", appearance: "interaction-only" });
      })
      .catch(() => {}); // sem o script o servidor decide (deixa passar se a Cloudflare estiver fora)
    return () => {
      cancelled = true;
      if (widget.current) window.turnstile?.remove(widget.current);
      widget.current = null;
    };
  }, [siteKey]);

  useEffect(() => {
    if (widget.current) window.turnstile?.reset(widget.current);
  }, [resetKey]);

  // sem altura reservada: quando o quadro não aparece, não sobra espaço vazio no formulário
  return <div ref={box} />;
}

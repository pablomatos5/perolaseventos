"use client";

import { useState } from "react";

/** Botão "Copiar código Pix" (copia e cola) da página do pedido. */
export function PixCopy({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="btn solid w-full"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(code);
        } catch {
          const t = document.createElement("textarea");
          t.value = code;
          document.body.appendChild(t);
          t.select();
          document.execCommand("copy");
          t.remove();
        }
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      }}
    >
      {copied ? "Código copiado ✓" : "Copiar código Pix"}
    </button>
  );
}

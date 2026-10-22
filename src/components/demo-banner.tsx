import { isDemo } from "@/lib/payment-mode";

/**
 * Faixa de "demonstração" sobre o ingresso mostrado na tela, só quando o site está em modo demo
 * (PAYMENT_PROVIDER=demo). Deixa claro que o ingresso não vale para o evento — o PDF já traz a
 * mesma marca (src/lib/ticket-pdf.ts). Fora do modo demo não renderiza nada.
 */
export function DemoBanner({ className = "" }: { className?: string }) {
  if (!isDemo()) return null;
  return (
    <p className={`demo-banner ${className}`} role="note">
      <span aria-hidden>●</span> Ingresso de demonstração · não vale para o evento
    </p>
  );
}

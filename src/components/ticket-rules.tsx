/**
 * Aviso padrão junto dos ingressos (página do pedido e ingresso individual): o QR vale uma entrada só e
 * a portaria confere se o ingresso é masculino ou feminino. Mesmo texto do e-mail e do PDF.
 */
export function TicketRules({ className = "" }: { className?: string }) {
  return (
    <div className={`ticket-rules ${className}`} role="note">
      <strong>Antes da festa, atenção:</strong>
      <ul>
        <li>
          <b>Não compartilhe o seu ingresso.</b> Cada QR vale <b>uma única entrada</b>: depois de lido, não passa de novo. Se alguém usar um print
          antes de você, você fica de fora.
        </li>
        <li>
          <b>Masculino e feminino são conferidos na entrada.</b> O ingresso feminino só vale para mulheres. Se não bater, a entrada é recusada.
        </li>
      </ul>
    </div>
  );
}

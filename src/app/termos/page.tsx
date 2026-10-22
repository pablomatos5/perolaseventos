import { connection } from "next/server";
import { LegalPage, SupportContacts } from "@/components/legal-page";
import { formatBRL, SERVICE_FEE_CENTS } from "@/lib/format";
import { seller } from "@/lib/seller";

export const metadata = { title: "Termos de compra · Pérolas", description: "Regras de compra, uso e reembolso dos ingressos do Réveillon Pérolas." };

export default async function TermosPage() {
  await connection(); // dados do vendedor vêm do .env, lidos a cada acesso
  const s = seller();
  return (
    <LegalPage eyebrow="Ingressos" title={<>Termos de <em>compra</em></>} updated="22 de outubro de 2026">
      <h2>1. Quem vende</h2>
      <p>
        Os ingressos do Réveillon Pérolas são vendidos por <strong>{s.name}</strong>
        {s.doc && <>, {s.doc}</>}, com sede em {s.city}. Atendimento: <SupportContacts />. Os pagamentos são processados pelo
        Mercado Pago, aqui mesmo no site.
      </p>

      <h2>2. O ingresso</h2>
      <ul>
        <li>Cada ingresso tem um <strong>QR code único</strong> e vale para <strong>uma única entrada</strong>: depois de lido na portaria, não passa de novo.</li>
        <li>O ingresso é nominal. O nome do titular pode ser trocado pelo próprio comprador no link do pedido até o início do evento; ao trocar, o QR anterior deixa de valer.</li>
        <li>Masculino e feminino são conferidos na entrada: o <strong>ingresso feminino só vale para mulheres</strong>.</li>
        <li>Não compartilhe nem publique o seu QR. Quem apresentar primeiro um QR válido entra; o mesmo QR não passa duas vezes.</li>
      </ul>

      <h2>3. Idade mínima</h2>
      <p>
        Evento <strong>proibido para menores de 18 anos</strong>. Na entrada, apresente <strong>documento oficial com foto</strong>. O open bar não
        serve bebida alcoólica a menores.
      </p>

      <h2>4. Preços, lotes e taxas</h2>
      <ul>
        <li>Os ingressos são vendidos por lotes. Vale o preço do lote no momento da compra; quando um lote esgota, o próximo abre com o preço dele.</li>
        <li>Há uma <strong>taxa de serviço de {formatBRL(SERVICE_FEE_CENTS)} por ingresso</strong>, mostrada antes do pagamento.</li>
        <li>No cartão, a taxa do cartão é repassada e aparece no valor antes de você confirmar. Crédito em até 6x (juros da operadora) ou débito.</li>
        <li>Ao clicar em “Ir para o pagamento”, os ingressos ficam <strong>reservados por 15 minutos</strong>. Sem pagamento nesse prazo, a reserva expira e eles voltam para a venda.</li>
      </ul>

      <h2>5. Pix em 2x</h2>
      <ul>
        <li>A 1ª parcela reserva os ingressos; o QR e o PDF são liberados só depois do pagamento da 2ª parcela.</li>
        <li>A 2ª parcela deve ser paga até a data informada no pedido (no máximo até 2 dias antes do evento), às 23h59, horário de Belém. Enviamos lembretes por e-mail.</li>
        <li>
          Se a 2ª parcela não for paga no prazo, a reserva é cancelada, os ingressos voltam para a venda e <strong>o valor da 1ª parcela não é devolvido</strong>,
          salvo no direito de arrependimento (item 6).
        </li>
      </ul>

      <h2>6. Direito de arrependimento (desistência)</h2>
      <p>
        Como a compra é feita pela internet, você pode desistir em até <strong>7 dias corridos</strong> a partir da data da compra, desde que antes do
        início do evento, com <strong>reembolso integral</strong> (ingressos, taxa de serviço e taxa do cartão), conforme o artigo 49 do Código de Defesa do
        Consumidor. Para pedir, fale com o atendimento (<SupportContacts />) informando o código do pedido. O reembolso é feito pelo mesmo meio de pagamento,
        e os ingressos do pedido deixam de valer.
      </p>

      <h2>7. Depois de 7 dias</h2>
      <p>
        Passado o prazo de arrependimento, não há reembolso por desistência. Se não puder ir, você pode <strong>trocar o nome do titular</strong> e enviar o
        ingresso a outra pessoa pelo link do pedido.
      </p>

      <h2>8. Cancelamento ou adiamento</h2>
      <ul>
        <li>Se o evento for <strong>cancelado</strong>, todos os pedidos são reembolsados integralmente.</li>
        <li>
          Se for <strong>adiado</strong>, o ingresso vale para a nova data; se não puder comparecer, você pode pedir o reembolso integral pelo atendimento em
          até 30 dias depois do anúncio da nova data.
        </li>
        <li>Mudanças de atrações ou de programação não dão direito a reembolso, exceto quando alterarem de forma essencial o evento.</li>
      </ul>

      <h2>9. Na festa</h2>
      <ul>
        <li>Pode haver revista na entrada. Siga as orientações da equipe de segurança e as regras do local.</li>
        <li>O evento pode ser fotografado e filmado para divulgação da Pérolas.</li>
        <li>Quem colocar em risco a própria segurança ou a de outras pessoas pode ser retirado do evento, sem reembolso.</li>
      </ul>

      <h2>10. Dados pessoais</h2>
      <p>
        Usamos os seus dados só para emitir e entregar os ingressos, validar a entrada e falar com você sobre o evento. Detalhes na{" "}
        <a href="/privacidade">Política de privacidade</a>.
      </p>
    </LegalPage>
  );
}

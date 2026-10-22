import { connection } from "next/server";
import { LegalPage, SupportContacts } from "@/components/legal-page";
import { seller } from "@/lib/seller";

export const metadata = { title: "Privacidade · Pérolas", description: "Como o site do Réveillon Pérolas usa e protege os seus dados pessoais (LGPD)." };

export default async function PrivacidadePage() {
  await connection(); // dados do vendedor vêm do .env, lidos a cada acesso
  const s = seller();
  return (
    <LegalPage eyebrow="LGPD" title={<>Política de <em>privacidade</em></>} updated="22 de outubro de 2026">
      <h2>1. Quem cuida dos seus dados</h2>
      <p>
        O responsável pelos dados (controlador) é <strong>{s.name}</strong>
        {s.doc && <>, {s.doc}</>}, {s.city}. Fale com a gente por <SupportContacts />.
      </p>

      <h2>2. O que coletamos</h2>
      <ul>
        <li><strong>Na compra:</strong> nome, e-mail, celular e CPF, além dos ingressos escolhidos e do nome de cada titular.</li>
        <li><strong>No pagamento:</strong> a situação e o valor do pagamento. Os dados do cartão são digitados em campos seguros do Mercado Pago e <strong>não passam pelo nosso servidor</strong>.</li>
        <li><strong>Segurança:</strong> o endereço IP de quem compra ou pede o link do pedido, para limitar tentativas e evitar fraude, e a verificação anti-robô da Cloudflare.</li>
        <li><strong>Na entrada:</strong> o registro de que o ingresso foi usado (data, hora e portão).</li>
      </ul>

      <h2>3. Para que usamos</h2>
      <ul>
        <li>Emitir, enviar e validar os seus ingressos.</li>
        <li>Confirmar o pagamento e, no Pix em 2x, lembrar você da 2ª parcela.</li>
        <li>Atender pedidos de suporte, troca de titular e reembolso.</li>
        <li>Prevenir fraude e uso indevido dos ingressos.</li>
        <li>Cumprir obrigações legais, como manter registros de vendas e pagamentos.</li>
      </ul>
      <p>
        O CPF serve para identificar o comprador, emitir o pagamento e evitar compras duplicadas. Não vendemos nem cedemos seus dados para propaganda de
        terceiros.
      </p>

      <h2>4. Com quem compartilhamos</h2>
      <ul>
        <li><strong>Mercado Pago:</strong> processa os pagamentos (Pix e cartão).</li>
        <li><strong>Resend:</strong> envia os e-mails com os ingressos e os avisos do pedido.</li>
        <li><strong>Cloudflare:</strong> faz a verificação anti-robô no formulário de compra.</li>
        <li><strong>Hospedagem do site:</strong> servidor onde o site e o banco de dados ficam guardados.</li>
      </ul>
      <p>Cada um recebe só o necessário para fazer a sua parte.</p>

      <h2>5. Cookies e rastreamento</h2>
      <p>
        O site <strong>não usa cookies de propaganda nem ferramentas de rastreamento</strong>. Os únicos cookies são os necessários para o painel interno da
        equipe funcionar.
      </p>

      <h2>6. Por quanto tempo guardamos</h2>
      <p>
        Os dados do pedido ficam guardados enquanto forem necessários para o evento e, depois, pelo tempo exigido por lei para registros de vendas e
        pagamentos. O que não for mais necessário é apagado.
      </p>

      <h2>7. Seus direitos</h2>
      <p>
        Pela Lei Geral de Proteção de Dados (Lei 13.709/2018), você pode pedir para saber quais dados temos sobre você, corrigir, apagar o que não for
        obrigatório guardar, ou tirar dúvidas sobre o uso. Peça pelo atendimento (<SupportContacts />) informando o CPF ou o código do pedido; respondemos em
        até 15 dias.
      </p>

      <h2>8. Segurança</h2>
      <p>
        O site usa conexão criptografada (HTTPS), os links dos pedidos e os QR codes são assinados digitalmente e o acesso ao painel interno é restrito à
        equipe.
      </p>
    </LegalPage>
  );
}

# Pérolas Eventos · Ingressos

Venda de ingressos do Réveillon Pérolas com lotes, QR code assinado e validação na portaria.
Next.js 16 + Prisma 7 + PostgreSQL.

## Rodar localmente

```bash
npm install
npm run db:start      # Postgres local leve (prisma dev), sem Docker
npm run db:migrate    # cria as tabelas
npm run db:seed       # evento de exemplo (preços FICTÍCIOS)
npm run dev           # http://localhost:3000
```

Copie `.env.example` para `.env` e gere um `TICKET_SECRET` novo. A URL do banco aparece no `npm run db:start`.

| Página | O quê |
|---|---|
| `/` | Evento, lote atual de cada setor, checkout |
| `/pedido/<token>` | Pagamento (simulado em dev) e, depois de pago, os QR codes |
| `/portaria` | Leitor: câmera (com lanterna), leitor pistola ou busca por nome; funciona **sem internet** (lista baixada + fila que sincroniza) |
| `/admin/portaria` | Autorizar/desautorizar cada aparelho da portaria (QR de ativação; substitui o antigo PIN) |
| `/admin/registro` | Registro de ações: viradas de lote, cortesias, reemissões, entradas manuais, trocas de titular |
| `/i/<token>` | Ingresso individual (link que o comprador manda a quem vai usar) |
| `POST /api/checkin` | Validação usada pela portaria |
| `/admin` | Painel (senha em `ADMIN_PASSWORD`): vendas e receita por lote, virada manual, reabrir lote, pausar setor, ajustar quantidade |
| `/admin/pedidos` | Busca por código, nome, e-mail, CPF ou celular; ver ingressos e **reenviar** |
| `/admin/cortesias` | Emitir cortesia/lista (lote oculto, QR igual ao vendido, enviada por e-mail) |

Testar no celular na mesma rede: `http://<IP-do-PC>:3000` (o `next.config.ts` já libera IPs 192.168.x.x e 10.x.x.x no dev).

## Conteúdo do site

- `src/content/site.ts`: textos institucionais tirados do Instagram da Pérolas (campanha 2027, manifesto, história, relatos, patrocinadores 2026, FAQ) e o tema de cores ativo (`CURRENT_EDITION`: `2k27` lilás ou `2k26` azul).
- Banco (`prisma/seed.ts`): evento, setores, lotes, destaques da festa e line-up (`announced: false` aparece como "Em breve"). Atração com `videoUrl` vira card que toca o vídeo ao virar e ganha uma onda própria na "maré de atrações".
- Mídia das atrações em `public/atracoes/`. Para preparar um vídeo novo (cortar, desgirar e comprimir), use o ffmpeg que vem no projeto:
  `node_modules/ffmpeg-static/ffmpeg.exe -ss 0 -t 14 -i entrada.mp4 -vf "scale=854:-2" -an -c:v libx264 -crf 28 -movflags +faststart public/atracoes/nome.mp4`

## Regras que o código garante

- **Lote** encerra ao esgotar ou ao passar da data fim, o que vier primeiro; o próximo abre sozinho. Lote antigo não reabre com sobras de reservas expiradas.
- **Reserva** trava o preço por 15 minutos. `SELECT … FOR UPDATE` no setor impede vender acima da quantidade com compradores simultâneos.
- **QR** é `PE1.<id>.<HMAC>`: sem o `TICKET_SECRET` ninguém fabrica ingresso.
- **Portaria**: o check-in é um `UPDATE … WHERE usedAt IS NULL` atômico. O mesmo QR lido em vários aparelhos ao mesmo tempo libera uma vez só.
- **Pagamento confirmado** é idempotente: webhook repetido não emite ingresso duplicado.
- **QR com versão**: reemitir (painel) ou trocar o titular (cliente) gera QR novo e o anterior é recusado ("QR antigo"). Ingressos de versão 0 usam o formato original `PE1`.
- **Portaria offline**: o aparelho baixa `/api/portaria/lista` (hash SHA-256 de cada QR, sem a chave secreta), valida sem sinal e sincroniza em `/api/portaria/sync`; conflito entre aparelhos aparece na tela e no registro.
- **Freios de abuso** (`src/lib/rate-limit.ts`, em memória): 6 reservas/10 min por IP, 1 reserva aberta por CPF, login do painel trava 15 min após 5 erros, portaria trava após 10 chaves erradas. Turnstile opcional no checkout.
- **IP do cliente** vem de `X-Real-IP`: no nginx use `proxy_set_header X-Real-IP $remote_addr;` (senão todos parecem o mesmo IP e o cliente poderia forjar o cabeçalho).
- **Cabeçalhos de segurança** em `next.config.ts` (CSP e HSTS só em produção).

## Mercado Pago (Pix e cartão)

Checkout Pro: o cliente paga na página do Mercado Pago (Pix ou cartão em até 12x; boleto desligado porque a reserva dura 15 min).

1. Em mercadopago.com.br/developers → Suas integrações → crie a aplicação → **Credenciais de teste**.
2. No `.env`: `PAYMENT_PROVIDER="mercadopago"`, `MP_ACCESS_TOKEN="TEST-..."`.
3. Em **Webhooks**, cadastre `https://perolaseventos.store/api/webhooks/mercadopago` (evento *Pagamentos*) e copie a **assinatura secreta** para `MP_WEBHOOK_SECRET`.

Como a confirmação funciona:
- **Produção:** o webhook chega, a assinatura `x-signature` é validada e o pagamento é consultado na API do MP. O corpo da notificação nunca é usado como verdade.
- **Localhost:** o MP não alcança o seu PC, então a página do pedido concilia sozinha quando o cliente volta do checkout (`?payment_id=`) e se atualiza a cada 5 s esperando o Pix.
- Valor pago menor que o pedido não libera ingresso. Estorno ou chargeback cancela os QR codes.

`npm run test:mp` testa tudo isso com a API do MP simulada (não precisa de credencial).

**Travas de segurança do modo de pagamento** (`src/lib/payment-mode.ts`):
- `PAYMENT_PROVIDER=mock` (botão "simular pagamento") **nunca liga em produção**.
- Sem cobrança configurada, o site não deixa reservar: mostra "As vendas online abrem em breve".
- Se o Mercado Pago falhar ao abrir o checkout, o cliente vê um aviso para tentar de novo, não uma tela de erro.

`npm run check:config` confere o `.env` (sem mostrar valores) e diz o que falta. No servidor: `NODE_ENV=production npm run check:config`.

### Quando tiver a chave
1. `.env`: `PAYMENT_PROVIDER="mercadopago"`, `MP_ACCESS_TOKEN="TEST-..."` (depois a de produção).
2. Depois do deploy: cadastrar o webhook e preencher `MP_WEBHOOK_SECRET`.
3. `npm run check:config` até aparecer "Pronto para rodar".

## Falta ligar

- Credenciais reais do Mercado Pago (o código já está pronto).
- E-mail real: preencher `RESEND_API_KEY` e configurar SPF/DKIM do domínio.
- WhatsApp: API oficial da Meta, depois da verificação da empresa e da aprovação do template.
- Painel admin: vendas por lote, virada manual, cortesias, reenvio.
- Deploy no VPS (`/opt/ingressos`, atrás do nginx compartilhado) com build no GitHub Actions.

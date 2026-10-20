# Continuação do projeto Pérolas Eventos (cole isto numa sessão nova)

Você vai continuar um site de venda de ingressos para o **Réveillon Pérolas 2K27** (6ª edição, Cametá-PA, @perolaseventos).
Converse comigo em **português**. Projeto em `D:\Downloads\perolaseventos`. Leia `README.md` e este arquivo antes de mexer.
Siga as regras do meu `~/.claude/CLAUDE.md` (máquina desliga sob carga: rode o hw-check antes/depois de carga pesada; no fim, desligue servidores e cace órfãos).

## Abrindo num OUTRO computador (ex.: o notebook do usuário)
O git NÃO leva os segredos nem os brutos: `.env`, `.env.producao-acessos`, `.midia-bruta/` e a chave SSH da VPS
(`~/.ssh/nexos_deploy`) ficam só no PC de casa. No notebook:
1. `git clone https://github.com/pablomatos5/perolaseventos.git` (repo privado; precisa estar logado no GitHub) e `npm install`.
2. Copiar `.env.example` para `.env` e gerar valores NOVOS de teste (TICKET_SECRET etc.) — nunca copiar os de produção para o chat.
   `PAYMENT_PROVIDER=demo` ou `mock`. Banco: `npm run db:start`, `npm run db:migrate`, `npm run db:seed`.
3. Sem a chave SSH não dá para publicar na VPS a partir do notebook: deixar o deploy para o PC de casa (ou o usuário copia a chave).
4. As regras do `~/.claude/CLAUDE.md` do PC (queda de energia, hw-check) valem só para o PC de casa.

## Stack e como rodar
Next.js 16.4 (App Router, `cacheComponents` ligado → toda leitura de banco/cookies dentro de `<Suspense>` + `await connection()`), React 19, Tailwind v4, Prisma 7 + PostgreSQL, zod, `qrcode`, `html5-qrcode`, `mercadopago` SDK, `ffmpeg-static` (só dev, para vídeos).
```
npm run db:start     # Postgres local (prisma dev, sem Docker — Docker Desktop não sobe nesta máquina)
npm run dev          # http://localhost:3000  | celular na mesma rede: http://192.168.1.21:3000
npm run db:migrate / db:seed / test:mp / check:config
```
`.env` (não versionado) já tem DATABASE_URL, SHADOW_DATABASE_URL (porta 51215), DATABASE_POOL_MAX=1, TICKET_SECRET, PORTARIA_PIN, ADMIN_PASSWORD, PAYMENT_PROVIDER=mock. Docs do Next 16 em `node_modules/next/dist/docs/` (APIs mudaram: leia antes).

## O que está pronto (tudo testado no navegador)
- **Vendas**: setores e **lotes** com virada automática (esgota ou data fim), lote antigo não reabre, reserva de 15 min com `SELECT … FOR UPDATE` (sem overbooking), meia-entrada, CPF validado. `src/lib/orders.ts`, `batches.ts`.
- **Pagamento**: Mercado Pago Checkout Pro (Pix + cartão 12x, boleto off) + webhook com `x-signature` validada e conciliação via API; estorno cancela QR. Modo `mock` (botão simular) **nunca liga em produção**; sem chave o site bloqueia reservas. 14 testes: `npm run test:mp`. **Falta só a chave** (`MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET`).
- **Ingresso**: QR `PE1.<id>.<HMAC>`, página `/pedido/<token>`, e-mail via Resend (simulado no terminal sem `RESEND_API_KEY`), WhatsApp registrado como "não configurado" (API oficial Meta pendente).
- **Portaria** `/portaria`: câmera ou leitor pistola, PIN, check-in atômico (6 leituras simultâneas → 1 liberado).
- **Admin** `/admin` (senha `ADMIN_PASSWORD`, cookie HMAC 12h): vendas/receita por lote, virar lote agora, reabrir, pausar setor, ajustar quantidade; `/admin/pedidos` busca + reenviar; `/admin/cortesias` emite cortesia (lote oculto).
- **Site (visual 2K27 lilás/dourado, tokens em `globals.css` `[data-edition="2k27"]`)**:
  hero com concha em linhas douradas que se desenha + contagem regressiva; ao rolar, a **pérola cai no mar** (splash) → **maré de atrações** (`tide-reveal.tsx`): praia fixa, cada trecho de rolagem manda uma onda que revela na areia: 31·12 → Baltazar (com foto em medalhão) → "+3 em breve" → convite; pérolas cintilando na areia. Faixa rolando (✦), campanha 2027, "A festa", **cards viráveis grandes** das atrações do ano (Baltazar: foto na frente, verso toca o anúncio **com som**; "Em breve" vira com recado), "Já passaram pelo palco" (fotos 2026), ingressos, relatos, história, patrocinadores 2026, FAQ, botão fixo de compra.
- Conteúdo do Instagram em `src/content/site.ts` (campanha, manifesto, histórico, relatos, line-up 2026, patrocinadores 2026, FAQ). Mídia em `public/atracoes/`; brutos em `.midia-bruta/` (ignorado).

## Fatos levantados (Instagram, out/2026)
2026 = 5ª edição, Ponte do Assunção, 7h open bar, 500+ participantes, 70% vendidos em 20/12. Line-up 2026: Davi Alencar (@davialenncar), Rebelo (@rebelodj_), DJ Ferrugem (@dj.ferrugem), Swing do Panda (@swingdopanda). **1ª atração 2027: Baltazar (@alexandrebaltazar_)**, anunciada em 10/09/2026 no destaque 2K27. Campanha 2027: "Uma nova era, infinitas possibilidades." / "Algo grandioso. Algo único. Algo Pérolas."

## Identidade 2027 (feedback do cliente em 16/10/2026)
O cliente aprovou o site e as ondas que revelam as informações, e pediu a temática das artes oficiais de 2027,
principalmente a sereia **como está na arte**. Originais em `.midia-bruta/referencias-2027/`; recortes sem os
textos gravados em `public/2027/` (sereia-dir = arte "31 dezembro", sereia-esq = "Save the date", mar = faixa
de água da arte principal). Paleta: #0B1A3D #6A4ECF #B99AF7 #F7A8C7 #FFC9A3 #FFE3B2 #F7F5F0. Frase: "Um novo
ciclo. Infinitas possibilidades." Local 2027 confirmado: Ponte do Assunção. PDF e prévia do link no mesmo visual.

**Feito em 16/10 (tarde), commits 894b4f2 → 9629aac:**
- **Topo único** (pedido do usuário): a antiga seção "Save the date" foi fundida no topo (`save-the-date.tsx` apagado).
  `src/components/hero-2027.tsx` tem logo, `HeroMermaids` (sereia-esq no canto esquerdo, sereia-dir no direito,
  esfumadas na borda), `PearlHorizon` e a linha "Save the date ★ 31 de dezembro ★ local" (`.hero-save`).
- **Site inteiro no céu claro** da paleta (sai o azul-marinho estrelado): tokens `[data-edition="2k27"]` em
  `globals.css` agora claros (fundo #f1ebfb, texto violeta #2e2466, dourado-caramelo #a26f32 nos destaques),
  `.starfield` = degradê lavanda → rosa → pêssego, cartões de vidro branco, botão dourado com degradê fixo.
- **Maré corrigida**: ao rolar rápido as ondas não pulam mais atrações; passa por cada uma em sequência com
  ondas mais rápidas (`tide-reveal.tsx`: passo de 1 em 1, `FAST = 0.55`).
- **Novas atrações confirmadas** (pedido do usuário, com os links do Instagram deles):
  **DJ Caçulinha** (@djcaculinha_ofc, nome no perfil "Wellington Caçulinha", 30 mil seguidores) e
  **Guilherme Menezes** (@guilhermemenezesgm, 22 mil). Já estão no `prisma/seed.ts` e no banco LOCAL como
  2ª e 3ª atração (`genre` = "2ª/3ª atração confirmada", sem foto: aparece a pérola com as iniciais).
  **Faltam a foto e o vídeo** (ver Pendência 0).

## Produção (VPS) — estado em 16/10/2026
- Repo **privado**: github.com/pablomatos5/perolaseventos (branch main). Deploy: `git archive HEAD | ssh root@92.112.178.48 'tar -x -C /opt/perolaseventos'` (chave `~/.ssh/nexos_deploy`) + `docker compose -f docker-compose.prod.yml up -d --build app` (build na VPS, ~3 min; carga sobe, Nexos/jess seguiram 200).
- **Isolamento (exigência do usuário: cada site da VPS é um trabalho separado):** rede própria `perolas_edge` (só `perolas-app` + `nexos-nginx-1`, ligado com `docker network connect`, sem restart); banco `perolas-db` em rede `internal`; volume, `.env` (600, só na VPS), certificados (`/opt/sites-extra/perolas/{certs,acme}`), backup e túnel próprios; `mem_limit`. Testado: perolas-app NÃO alcança nexos-db/redis/web nem jessassinaturas; nexos não resolve perolas-db. **Se o nginx do Nexos for recriado: `docker network connect perolas_edge nexos-nginx-1`.**
- Vhost fase 1 (só HTTP) em `/opt/sites-extra/conf/perolaseventos.store.conf` (fonte: `infra/`). Fase 2 (HTTPS): `infra/perolaseventos.store.https.conf`, depois do certificado.
- `.env` da VPS: `PAYMENT_PROVIDER=demo` (faixa + pagamento simulado + marca d'água no PDF), senhas novas; senha do painel copiada para `.env.producao-acessos` (local, ignorado pelo git).
- Backup: `/opt/perolaseventos-backup.sh` às 04:20 → `/opt/perolaseventos-backups` (14 dias). **Cópia fora da VPS: pendente.**
- **Demo sem domínio:** container `perolas-tunel` (Cloudflare quick tunnel, rede perolas_edge). URL atual `https://notebooks-idle-trades-squad.trycloudflare.com` — **muda se o container/VPS reiniciar** (`docker logs perolas-tunel | grep trycloudflare`). Remover quando o domínio estiver no ar: `docker rm -f perolas-tunel`.

## Feito em 16/10 (noite)
- No ar em https://perolaseventos.store (HTTPS). Logo novo (caixa-alta fina + pérola no lugar do O, selo 2K27),
  céu do amanhecer com brilhos de 4 pontas, sereias encostadas na borda (esfumado no alfa do webp), relatos em carrossel.
- **Ingressos**: sem meia-entrada. Cada setor vende **Masculino** e **Feminino** (`Ticket.gender`; preço feminino em
  `Batch.femalePriceCents`, vazio = mesmo preço do masculino — os preços reais ainda dependem da Pérolas).
- **Taxa de serviço R$ 2,50 por ingresso** (`SERVICE_FEE_CENTS` em `src/lib/format.ts`), dos desenvolvedores: somada no
  total, linha própria no Mercado Pago, `Order.feeCents`; o painel mostra a receita da Pérolas sem a taxa e a taxa à parte.
  O repasse é manual (o Mercado Pago recebe tudo na conta da Pérolas); split automático exigiria Mercado Pago marketplace.
- Entrega só por **e-mail (PDF anexo) + PDF para baixar na página do pedido**; opção de WhatsApp removida.
- DJ Caçulinha e Guilherme Menezes anunciados no banco de produção (sem foto: aparecem as iniciais).

## Auditoria de 16-17/10 (front, back, segurança) — feito
- Segurança: ingresso de pagamento simulado (paymentRef "mock_") é recusado na portaria e fica fora da lista
  offline/busca (`REAL_ORDER` em `src/lib/checkin.ts`); pedido com o mesmo setor repetido é somado antes da
  checagem de estoque e do máximo por pedido (antes dava para vender além do lote); túnel trycloudflare removido
  (deixava falsificar o IP dos limites de tentativa); robots.txt + sitemap (painel/pedido/portaria fora da busca);
  backups com permissão 600; renovação do certificado: `/opt/perolaseventos-cert-renew.sh` (cron terça 03:40).
  Verificado ok: sem portas do app/banco expostas, ufw 22/80/443, SSH só chave + fail2ban, HSTS/CSP/X-Frame,
  `npm audit` sem vulnerabilidades, /admin sem login não vaza dados.
- Front: carrossel da areia (antigo "maré") não depende mais da rolagem: troca sozinho a cada 5,6 s e responde a
  arrasto/setas/pontinhos/teclado, uma etapa por gesto. Patrocinadores giram e podem ser arrastados (laço só roda
  na tela). Relatos em carrossel com setas. Portaria em modo noturno de alto contraste.
- Celular: animações de SVG só no computador; **modo leve** automático (`html.lite`, script no layout) para
  aparelho com ≤4 GB/≤4 núcleos/economia de dados; seções de baixo com `content-visibility: auto`; máscara da
  praia só na camada parada da areia. Lighthouse: acessibilidade 93→97, desktop ~92-97, celular ~60-66 (limitado
  pela hidratação do React; rolagem medida com CPU 6× mais lenta: quadros travados 158→24 no modo leve).
- Scripts de captura/medição na VPS: `/opt/perolas-shots/*.mjs` (playwright em container; `--ipc=host`).

## Ambiente de desenvolvimento ao vivo (18/10)
`next dev` roda NA VPS (notebook é fraco): containers `pdev-app` (porta 127.0.0.1:3100, código em
`/opt/perolas-dev/src-app`, env em `/opt/perolas-dev/dev.env`: pagamento mock, senha do painel `desenvolvimento`)
e `pdev-db` (banco de teste próprio, com seed). Atualizar: `rsync -az --exclude node_modules --exclude .git
--exclude .next --exclude src/generated --exclude .env ./ root@92.112.178.48:/opt/perolas-dev/src-app/` (recarrega
sozinho). Ver no notebook: `ssh -N -L 3100:127.0.0.1:3100 root@92.112.178.48` e abrir http://localhost:3100.
Desligar quando não precisar: `docker rm -f pdev-app pdev-db`.

## Varredura de prontidão para vendas (18/10)
- Capacidade testada (banco descartável): 2000 ingressos, 400 compradores simultâneos → vendeu os 2000 sem perda,
  sem overbooking; 1200 leituras de portaria simultâneas a 2 ms cada, sem entrada dupla. Para isso: transações de
  venda com fila de 20 s (`TX` em src/lib/orders.ts) e pool de 20 conexões (src/lib/db.ts).
- Pico de acessos: microcache no nginx (infra/perolaseventos.store.https.conf): `/` 10 s, mídia 1 dia → 435 req/s com
  300 conexões, app ocioso. Reserva/pedido/painel/portaria nunca passam pelo cache.
- Ingresso PDF redesenhado (sereias e mar das artes, logo 2K27, moldura com conchas, picote de canhoto).
- Portaria: leitura repetida não deixa mais a tela verde parada (trava de 1,5 s só para a câmera; pistola/digitação
  conferem sempre → amarelo "já liberado neste aparelho").
- Fluxos testados ponta a ponta (dev, celular e PC): compra M/F + taxa, simular pagamento, PDF, e-mail, painel
  (vendas, pedidos/busca, cortesia, aparelhos, registro), portaria (QR válido, repetido, falso, busca e liberar).

## 18/10 (noite)
- Logo do topo como o flyer oficial (Cinzel dourada, pérola no aro, arabesco) DENTRO da concha do flyer
  (`public/2027/concha-logo.webp`); o mesmo logo vai no ingresso (`assets/pdf/logo-2027.png`, renderizado do site)
  e na prévia do link (`src/app/opengraph-image.jpg`, estática).
- Presença confirmada: `/pedido/<token>/story` (1080×1920) e `?f=feed` (1080×1350), só para pedido pago, sem QR;
  botões abrem o compartilhar do celular (Instagram story/feed/direct). Fontes/imagens em `assets/story` e
  `assets/fonts/Cinzel.ttf` (estática: a variável quebra o next/og).
- Portaria: câmera quadrada com mira, aviso fecha com um toque (Próximo / Tentar de novo / Buscar por nome).
- Formulário: dados não somem em erro, erro no campo, máscaras de CPF/celular.
- Varredura em produção (Playwright, `/opt/perolas-shots/sweep2.mjs`): 45 checagens ok (as falhas da 1ª rodada
  eram do roteiro: hover pausa patrocinadores; câmera relendo QR inválido; ingressos de demonstração não entram na
  lista da portaria — de propósito). O `next dev` (pdev-app) recarrega a página de pedido em loop e cai sob carga:
  é só do modo dev, produção ok.
- Pedido de teste criado pela varredura em produção: "Ana Varredura" — apagar junto com os outros de teste.

## 19/10 — pedidos do cliente (Thiago) e publicação
Fluxo do dia: tudo testado primeiro no localhost (pdev-app na VPS) e só publicado com "pode subir" do usuário.
Produção = `main` = `alteracoes-cliente` = **cd6edad** (19/10, fim da tarde). Backup do banco antes de cada deploy.

**Identidade / visual**
- Logotipo oficial do kit (`public/2027/logo/`, componente `src/components/brand-logo.tsx`): sempre imagem
  (`<picture>` WebP + PNG, 600/1200/2400 px), nunca recriado com fonte; margem livre = altura do "R".
  Capa: "Réveillon Pérolas" + **2K27 dentro da concha dourada** (mesmo dourado do logo). Canto do topo: assinatura
  concha + @perolaseventos (`assinatura-creme`). Ingresso PDF e story usam o mesmo logo (exportado do site).
- Concha da marca (`concha-icone.png`, `concha-dourada.*`) em todos os enfeites; concha 3D da areia no estilo da logo
  (faixas onduladas em cima, aro + raios embaixo, peça única) — `src/lib/sea3d.ts`; versão 2D igual.
- Sereias: recorte com rembg (`scripts/sereias-recorte.py`, máscaras em scratch), a da direita = a da esquerda
  espelhada no CSS. Celular: grandes e mais ao centro emoldurando a pérola. Ingressos: 1 sereia de areia centralizada
  no celular, 2 nas bordas no PC.
- **Céu da capa = arte "Lote promocional"** (violeta → lavanda → rosa → pêssego luminoso, sol atrás da pérola), com as
  estrelas de antes. Textos do meio em violeta-escuro.
- **Anoitecer**: a página escurece do fim de tarde (praia) até a noite (rodapé) — degradê em `main.pagina-inicio::before`,
  estrelas surgem com a rolagem, areia dos ingressos e fundo do mar à luz da lua, textos claros nas seções da noite.
- Areia: conchas, pérolas, estrelas-do-mar e caranguejos (seção ingressos e maré); maré com uma água só.
- Páginas de pedido/ingresso (`.pagina-noite`): noite estrelada, logo oficial, cards creme com borda dourada.
  Imagem de presença confirmada (story/feed) refeita no visual atual (`assets/story/`).
- Ingresso PDF: concha como marca d'água, selo no picote e assinatura @perolaseventos; versão noturna em `?tema=noite`
  (alternativa, não é o padrão).

**Pagamento — Pix em 2x (novo)**
- No pedido: Pix à vista · Cartão (crédito até 12x / débito) · Pix em 2x. Migração `20261019180000_pix_parcelado`
  (status `PARTIAL`, `PaymentPlan`, `firstPaidCents/At/Ref`, `Event.splitPixEnabled/splitPixDays`).
- 1ª parcela (metade, arredondada para cima) → pedido `PARTIAL`, ingressos RESERVED até o prazo (seguram a vaga do
  lote, sem QR/PDF/story), e-mail com o que falta. 2ª parcela → `PAID` e entrega normal. Prazo vencido → vaga volta à
  venda; a 1ª parcela NÃO é devolvida automaticamente (decidir regra com o cliente / termos).
- Mercado Pago: `external_reference` = `<orderId>:full|p1|p2`, conferência de valor por parte (`src/lib/mercadopago.ts`).
- Painel `/admin`: liga/desliga e prazo em dias. **Produção: ligado, 30 dias** (nunca passa de 2 dias antes da festa).

**Produção / dados**
- Lotes de produção: só "Lote promocional" R$ 150 (200 un.) aberto; 1º/2º/3º/final fechados (7 ingressos de teste no
  2º), Camarote fechado e escondido. Nada apagado.
- Otimização para celular: imagens menores (srcset), sem filtros/animações contínuas pesadas, 3D preparado em ocioso.
- Ambiente de testes: túnel do notebook em `0.0.0.0:3100` (celular na rede: http://192.168.0.117:3100), vigia que
  religa o túnel sozinho (script no scratchpad da sessão).

## Onde paramos (19/10)
Último pedido atendido: sereias da capa no celular maiores e mais ao centro (publicado, cd6edad). Nada pendente de
publicar. Próximos passos naturais:
1. Regra para a 1ª parcela quando a 2ª vence (devolver / aceitar atrasado / não devolver) e lembrete automático
   antes do vencimento da 2ª parcela.
2. Prévia de link (`src/app/opengraph-image.jpg` / twitter) ainda com o logo antigo.
3. Decidir se o ingresso noturno (`?tema=noite`) vira o padrão.

## Pagamento dentro do site + divisão da taxa (20/10) — no ar, ainda em modo demonstração
- **Checkout Transparente** (API de Payments): Pix com QR/"copia e cola" na página do pedido (`PixCharge` guarda o QR;
  reaproveita ao recarregar) e cartão com os Secure Fields do Mercado Pago no visual do site
  (`src/components/card-pay-form.tsx`, erros por campo). O número do cartão nunca passa pelo servidor (token).
- **Conta do evento por OAuth**: painel → "Conectar Mercado Pago" (`/api/mercadopago/conectar` → retorno
  `/api/mercadopago/conectar/retorno`). Tokens cifrados (AES-256-GCM, chave `MP_TOKEN_KEY` ou derivada do TICKET_SECRET)
  na tabela `MpAccount`, renovados sozinhos 30 dias antes de vencer (180 dias).
- **Divisão**: cada pagamento leva `application_fee` = taxa de serviço (R$ 2,50/ingresso; Pix 2x: metade em cada
  parcela) → cai na conta dona da aplicação (devs, app 4338262596056762, conta 652589285). Testado com contas de teste:
  R$ 182,50 cobrados → MP R$ 5,46 · devs R$ 2,50 · vendedor R$ 174,54.
- **Taxa do cartão** repassada (painel, `Event.cardFeeBps`): total = valor ÷ (1 − taxa). Com 2,99% o vendedor recebe cheio.
- Teste local: `MP_OAUTH_TEST=true` + `MP_TEST_CLIENT_ID/SECRET` (app de teste 2589722219554257 da conta de teste
  "Devs teste") — o MP não mistura conta real e de teste. Contas de teste: Vendedor TESTUSER8964343317901825292,
  Comprador TESTUSER7266408720541848324, Devs teste TESTUSER4535046512479514634 (senhas com o usuário). Cartão de teste
  5031 4332 1540 6351, 11/30, CVV 123, nome APRO. Pix de teste não pode ser pago (só gerado).
- Retorno do OAuth está cadastrado só com o domínio: no teste local o retorno é desviado para o localhost pelo Chrome.

### Para ligar o pagamento REAL (em ordem)
1. Painel do MP, aplicação real 4338262596056762: Produto integrado → Checkout Transparente / API de Payments;
   **Webhooks** (modo produção) → URL `https://perolaseventos.store/api/webhooks/mercadopago`, evento "Pagamentos" →
   copiar a assinatura secreta.
2. `.env` da VPS: ✅ `MP_CLIENT_ID`, `MP_CLIENT_SECRET`, `MP_TOKEN_KEY` já estão lá (20/10; backup `.env.bak-20261020-0142`),
   o botão "Conectar" já aparece no painel do site no ar. Falta `MP_WEBHOOK_SECRET` e, na hora de vender,
   `PAYMENT_PROVIDER=mercadopago` (sai o demo: sem faixa e sem marca d'água) + recriar o container. `MP_ACCESS_TOKEN` fica VAZIO.
3. Antes: apagar pedidos de teste, trocar a senha do painel, `check:config`, valores dos lotes, taxa do cartão, termos.
4. A Pérolas entra no painel e clica "Conectar Mercado Pago" com a conta dela (CNPJ de preferência).
5. Compra real pequena para conferir (e estornar), e-mail de entrega (Resend) funcionando.

## Pendências / próximos passos (antes das vendas reais)
1. **Mercado Pago**: `PAYMENT_PROVIDER=mercadopago` + `MP_ACCESS_TOKEN`/`MP_WEBHOOK_SECRET` (produção hoje sem cobrança real).
2. **E-mail**: Resend (`RESEND_API_KEY`, SPF/DKIM).
3. Valores do 1º lote com o cliente (~R$ 185 masc / R$ 175 fem); termos de compra e privacidade (+ CNPJ, regra do Pix 2x).
4. Apagar pedidos de teste (demo e varreduras: "Ana Varredura", "Teste Varredura" etc.), trocar a senha do admin,
   `check:config` em produção.
5. Certificado: cron de renovação próprio; backup fora da VPS.
6. Mais atrações conforme forem anunciadas; WhatsApp oficial quando a Meta aprovar.

## Armadilhas conhecidas
- **Depois de cada deploy, limpe o microcache do Pérolas** (mídia fica 1 dia no nginx; sem isso imagens trocadas com o mesmo nome continuam velhas): `docker exec nexos-nginx-1 sh -c "find /var/cache/nginx/perolas -type f -delete"` — só a pasta do Pérolas, nunca reiniciar o nginx compartilhado.
- **Migração em produção**: o serviço `migrate` usa imagem própria (target deps). Depois de mudar `prisma/`, rode
  `docker compose -f docker-compose.prod.yml --profile tools build migrate` ANTES do `run --rm migrate` (senão ele
  diz "No pending migrations" com a imagem velha). Ordem: backup (pg_dump) → build app → build+run migrate → up app.
- **Build de produção pode falhar 1x por memória** na VPS: rode o `up -d --build app` de novo (o site antigo segue no ar).
- O `next dev` às vezes **não percebe mudança no `globals.css`**: depois de editar, salve de novo (`printf '\n' >> src/app/globals.css`) e confira o CSS compilado.
- Mudou schema do Prisma? `npx prisma migrate dev` + `npx prisma generate` **e reinicie o `npm run dev`** (o cliente fica em memória).
- Ao parar o dev server em segundo plano, o processo do Next pode ficar órfão na porta 3000 — mate pelo PID (`Get-NetTCPConnection -LocalPort 3000`).
- `prisma dev` é PGlite: todos os nomes de banco são o mesmo banco; por isso o shadow DB usa a porta separada (51215) e o pool é 1 conexão em dev.
- Imagens do Instagram: `og:image` vem com ícone de play desenhado; use o `currentSrc` das miniaturas da grade do perfil (resolução maior, sem ícone).
- Vídeos do Instagram só com sessão logada: Chrome visível com `--remote-debugging-port` (o usuário loga), capturar respostas de rede com `video_versions` (script na sessão de 16/10). Apagar o perfil do Chrome depois.
- Deploy por SSH: nunca termine a cadeia do `tar -x` com `&` (o processo em segundo plano não recebe o stdin e extrai nada). Separar: `tar -x ... || exit 1; ...; nohup ... &`.
- Testes: `npm run test:qr` (QR: adulteração, chute, leitura óptica degradada) não usa banco. `npm run test:mp` usa o banco direto: rodar com o `npm run dev` parado (PGlite derruba conexões simultâneas).
- Animações: nada de `backdrop-filter`, `filter` animado, `box-shadow` animado ou `mask-position` animado (travavam o celular). Pérolas que seguem a rolagem usam `animation-timeline` (CSS) com JS só de reserva.

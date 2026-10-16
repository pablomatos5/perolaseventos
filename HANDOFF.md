# Continuação do projeto Pérolas Eventos (cole isto numa sessão nova)

Você vai continuar um site de venda de ingressos para o **Réveillon Pérolas 2K27** (6ª edição, Cametá-PA, @perolaseventos).
Converse comigo em **português**. Projeto em `D:\Downloads\perolaseventos`. Leia `README.md` e este arquivo antes de mexer.
Siga as regras do meu `~/.claude/CLAUDE.md` (máquina desliga sob carga: rode o hw-check antes/depois de carga pesada; no fim, desligue servidores e cace órfãos).

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
ciclo. Infinitas possibilidades." Local 2027 confirmado: Ponte do Assunção. Topo em `hero-2027.tsx`, seção
"Save the date" em `save-the-date.tsx`, PDF e prévia do link no mesmo visual.

## Produção (VPS) — estado em 16/10/2026
- Repo **privado**: github.com/pablomatos5/perolaseventos (branch main). Deploy: `git archive HEAD | ssh root@92.112.178.48 'tar -x -C /opt/perolaseventos'` (chave `~/.ssh/nexos_deploy`) + `docker compose -f docker-compose.prod.yml up -d --build app` (build na VPS, ~3 min; carga sobe, Nexos/jess seguiram 200).
- **Isolamento (exigência do usuário: cada site da VPS é um trabalho separado):** rede própria `perolas_edge` (só `perolas-app` + `nexos-nginx-1`, ligado com `docker network connect`, sem restart); banco `perolas-db` em rede `internal`; volume, `.env` (600, só na VPS), certificados (`/opt/sites-extra/perolas/{certs,acme}`), backup e túnel próprios; `mem_limit`. Testado: perolas-app NÃO alcança nexos-db/redis/web nem jessassinaturas; nexos não resolve perolas-db. **Se o nginx do Nexos for recriado: `docker network connect perolas_edge nexos-nginx-1`.**
- Vhost fase 1 (só HTTP) em `/opt/sites-extra/conf/perolaseventos.store.conf` (fonte: `infra/`). Fase 2 (HTTPS): `infra/perolaseventos.store.https.conf`, depois do certificado.
- `.env` da VPS: `PAYMENT_PROVIDER=demo` (faixa + pagamento simulado + marca d'água no PDF), senhas novas; senha do painel copiada para `.env.producao-acessos` (local, ignorado pelo git).
- Backup: `/opt/perolaseventos-backup.sh` às 04:20 → `/opt/perolaseventos-backups` (14 dias). **Cópia fora da VPS: pendente.**
- **Demo sem domínio:** container `perolas-tunel` (Cloudflare quick tunnel, rede perolas_edge). URL atual `https://notebooks-idle-trades-squad.trycloudflare.com` — **muda se o container/VPS reiniciar** (`docker logs perolas-tunel | grep trycloudflare`). Remover quando o domínio estiver no ar: `docker rm -f perolas-tunel`.

## Pendências / próximos passos (em ordem)
1. **Domínio perolaseventos.store**: está registrado mas NÃO resolve (NXDOMAIN em 16/10). Usuário confere no hPanel (verificação de e-mail do titular / nameservers) e cria A `@` e `www` → 92.112.178.48. O token do MCP da Hostinger em `~/.claude.json` está revogado (401) — trocar pelo token novo para eu poder mexer no DNS.
2. Com o domínio resolvendo: certbot webroot em `/opt/sites-extra/perolas` (`docker run --rm -v /opt/sites-extra/perolas/certs:/etc/letsencrypt -v /opt/sites-extra/perolas/acme:/var/www/certbot certbot/certbot certonly --webroot -w /var/www/certbot -d perolaseventos.store -d www.perolaseventos.store`), instalar o vhost https, `nginx -t` + reload, cron de renovação próprio, remover o túnel.
3. **Confirmar com a Pérolas**: preços/lotes reais (seed tem valores FICTÍCIOS), local de 2027 (está "Ponte do Assunção", que foi 2026), patrocinadores 2027 (Bió Costa = cartaz de casa de apostas, não publicado), uso das fotos/vídeos, textos de termos e privacidade (+ CNPJ).
4. **Antes das vendas reais**: `PAYMENT_PROVIDER=mercadopago` + chaves, apagar pedidos de teste, `check:config` em produção, Resend (SPF/DKIM), backup fora da VPS, trocar o túnel pelo domínio.
5. Termos de compra e política de privacidade (+ aceite no checkout, anonimização após o evento).
6. Mais atrações conforme forem anunciadas (banco: `name, genre, instagram, imageUrl, videoUrl, headliner, announced`; vídeo com `node_modules/ffmpeg-static/ffmpeg.exe`). WhatsApp oficial quando a Meta aprovar.

## Armadilhas conhecidas
- O `next dev` às vezes **não percebe mudança no `globals.css`**: depois de editar, salve de novo (`printf '\n' >> src/app/globals.css`) e confira o CSS compilado.
- Mudou schema do Prisma? `npx prisma migrate dev` + `npx prisma generate` **e reinicie o `npm run dev`** (o cliente fica em memória).
- Ao parar o dev server em segundo plano, o processo do Next pode ficar órfão na porta 3000 — mate pelo PID (`Get-NetTCPConnection -LocalPort 3000`).
- `prisma dev` é PGlite: todos os nomes de banco são o mesmo banco; por isso o shadow DB usa a porta separada (51215) e o pool é 1 conexão em dev.
- Imagens do Instagram: `og:image` vem com ícone de play desenhado; use o `currentSrc` das miniaturas da grade do perfil (resolução maior, sem ícone).
- Vídeos do Instagram só com sessão logada: Chrome visível com `--remote-debugging-port` (o usuário loga), capturar respostas de rede com `video_versions` (script na sessão de 16/10). Apagar o perfil do Chrome depois.
- Deploy por SSH: nunca termine a cadeia do `tar -x` com `&` (o processo em segundo plano não recebe o stdin e extrai nada). Separar: `tar -x ... || exit 1; ...; nohup ... &`.
- Testes: `npm run test:qr` (QR: adulteração, chute, leitura óptica degradada) não usa banco. `npm run test:mp` usa o banco direto: rodar com o `npm run dev` parado (PGlite derruba conexões simultâneas).
- Animações: nada de `backdrop-filter`, `filter` animado, `box-shadow` animado ou `mask-position` animado (travavam o celular). Pérolas que seguem a rolagem usam `animation-timeline` (CSS) com JS só de reserva.

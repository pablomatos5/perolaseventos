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

## Pendências / próximos passos (em ordem)
1. **Git**: ainda NÃO há repositório. `git init`, primeiro commit (checar `.gitignore`: `.env*`, `src/generated`, `.midia-bruta/`), repo privado no GitHub.
2. Conferir no desktop/celular os **cards viráveis grandes** (`.card-rail-xl` em `globals.css`, `attraction-cards.tsx`) — último ajuste feito, só olhei rápido.
3. **Confirmar com a Pérolas**: preços/lotes reais (seed tem valores FICTÍCIOS), local de 2027 (está "Ponte do Assunção", que foi 2026), patrocinadores 2027, autorização de uso das fotos dos artistas.
4. **Deploy no VPS Hostinger** (KVM2, Ubuntu 24.04, IP 92.112.178.48, tudo em Docker): seguir padrão do `/opt/jessassinaturas` → `/opt/ingressos` com compose (app + Postgres 17 próprio, `mem_limit`), vhost em `/opt/sites-extra/conf/perolaseventos.store.conf` no nginx compartilhado do nexos (`nginx -t` antes do reload), certbot, **build no GitHub Actions** (não buildar no VPS). Domínio: perolaseventos.store. Backup diário do banco **com cópia fora do VPS**. Em produção: remover `DATABASE_POOL_MAX`, `PAYMENT_PROVIDER=mercadopago`, `NODE_ENV=production npm run check:config`.
5. Ligar Resend (SPF/DKIM do domínio) e, quando a Meta aprovar, WhatsApp oficial.
6. Melhorias: offline da portaria, app na maquininha smart (depende da adquirente), mais atrações conforme forem anunciadas (cadastrar no banco: `name, genre, instagram, imageUrl, videoUrl, headliner, announced`; vídeo: cortar/comprimir com `node_modules/ffmpeg-static/ffmpeg.exe`, ver README).

## Armadilhas conhecidas
- O `next dev` às vezes **não percebe mudança no `globals.css`**: depois de editar, salve de novo (`printf '\n' >> src/app/globals.css`) e confira o CSS compilado.
- Mudou schema do Prisma? `npx prisma migrate dev` + `npx prisma generate` **e reinicie o `npm run dev`** (o cliente fica em memória).
- Ao parar o dev server em segundo plano, o processo do Next pode ficar órfão na porta 3000 — mate pelo PID (`Get-NetTCPConnection -LocalPort 3000`).
- `prisma dev` é PGlite: todos os nomes de banco são o mesmo banco; por isso o shadow DB usa a porta separada (51215) e o pool é 1 conexão em dev.
- Imagens do Instagram: `og:image` vem com ícone de play desenhado; use o `currentSrc` das miniaturas da grade do perfil (resolução maior, sem ícone).

# Imagem de produção (VPS). Build "standalone" do Next: o container final não carrega o node_modules todo.
# Mesmo modelo do jessassinaturas, que divide a VPS:
#
#   docker compose -f docker-compose.prod.yml up -d db
#   docker compose -f docker-compose.prod.yml run --rm migrate      # migrations
#   docker compose -f docker-compose.prod.yml run --rm seed         # só na 1ª vez (evento de exemplo)
#   docker compose -f docker-compose.prod.yml up -d --build app

FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json prisma.config.ts ./
COPY prisma ./prisma
# prisma.config.ts exige DATABASE_URL só para existir; o "prisma generate" (postinstall) não conecta.
RUN DATABASE_URL="postgresql://build@localhost/build" npm ci --no-audit --no-fund

FROM deps AS build
WORKDIR /app
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# Variáveis NEXT_PUBLIC_ são gravadas no código durante o build, e o .env fica fora da imagem (.dockerignore):
# a chave pública do Turnstile chega como argumento (docker-compose.prod.yml lê do .env da VPS).
ARG NEXT_PUBLIC_TURNSTILE_SITE_KEY=""
ENV NEXT_PUBLIC_TURNSTILE_SITE_KEY=$NEXT_PUBLIC_TURNSTILE_SITE_KEY
# O build instancia o Prisma client sem conectar (páginas com banco são dinâmicas: connection()).
RUN DATABASE_URL="postgresql://build@localhost/build" TICKET_SECRET="build-somente-build-somente-build-0000" npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
RUN addgroup -S app && adduser -S app -G app
COPY --from=build --chown=app:app /app/.next/standalone ./
COPY --from=build --chown=app:app /app/.next/static ./.next/static
COPY --from=build --chown=app:app /app/public ./public
# fontes e arte do ingresso em PDF (lidas do disco em tempo de execução)
COPY --from=build --chown=app:app /app/assets ./assets
USER app
EXPOSE 3000
CMD ["node", "server.js"]

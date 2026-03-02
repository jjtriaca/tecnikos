## ── Stage 1: Build ──────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Instalar dependências (cache layer)
COPY package.json package-lock.json ./
RUN npm ci

# Copiar código e gerar Prisma Client
COPY prisma ./prisma
RUN npx prisma generate

# Copiar restante e buildar
COPY . .
RUN npm run build

## ── Stage 2: Produção ──────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Criar usuário não-root
RUN addgroup -g 1001 -S appgroup && \
    adduser -S appuser -u 1001 -G appgroup

# Instalar apenas dependências de produção
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copiar Prisma schema + client gerado
COPY prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# Copiar build
COPY --from=builder /app/dist ./dist

# Copiar version.json (gerado pelo script de deploy)
COPY version.json* ./

# Criar diretório de uploads com permissões
RUN mkdir -p uploads && chown -R appuser:appgroup uploads

# Usar usuário não-root
USER appuser

EXPOSE 4000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:4000/health || exit 1

CMD ["node", "dist/src/main.js"]

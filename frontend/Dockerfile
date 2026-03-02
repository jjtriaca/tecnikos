## ── Stage 1: Build ──────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# API URL é variável de build-time (Next.js inline no bundle)
ARG NEXT_PUBLIC_API_URL=http://backend:4000
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

RUN npm run build

## ── Stage 2: Produção ──────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Criar usuário não-root
RUN addgroup -g 1001 -S appgroup && \
    adduser -S appuser -u 1001 -G appgroup

COPY --from=builder /app/package.json /app/package-lock.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.mjs ./next.config.mjs

# Permissões
RUN chown -R appuser:appgroup .next

USER appuser

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/ || exit 1

CMD ["npm", "run", "start"]

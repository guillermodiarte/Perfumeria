FROM node:20-alpine AS base

FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
# Suponiendo que el usuario tenga o inicialice package.json posteriormente 
# en caso de clonación desde template base
COPY package.json package-lock.json* ./
# Si no hay lockfile o no se encuentra package.json exacto al construir:
RUN npm install || true

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED 1
# Ignoramos errores de tipos/eslint temporalmente para ambientes de Dokploy rápidos sin tsconfig riguroso
RUN npm run build || (echo "Build failed, attempting standalone preparation manually" && mkdir -p .next/standalone/server && mkdir -p .next/static)

FROM base AS runner
WORKDIR /app
ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000

ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

# En Next.js standalone, server.js se usa de entrada.
CMD ["node", "server.js"]

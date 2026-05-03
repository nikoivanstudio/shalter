FROM node:24-alpine AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

COPY package*.json ./
RUN npm ci --legacy-peer-deps

COPY . .
RUN npx prisma generate \
  && npm run build \
  && npm prune --omit=dev --legacy-peer-deps \
  && npm install --no-save prisma@7.7.0 --legacy-peer-deps \
  && npm cache clean --force \
  && rm -rf .next/cache

FROM node:24-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOST=0.0.0.0

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/package*.json ./

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs \
  && chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 3000

CMD ["sh", "-c", "node scripts/db-prepare.mjs && ./node_modules/.bin/next start -p ${PORT:-3000} -H ${HOST:-0.0.0.0}"]

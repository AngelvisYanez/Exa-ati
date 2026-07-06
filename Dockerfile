# ===================================================
# Dockerfile — OFSERCONT IA (Next.js + Playwright)
# Basado en mcr.microsoft.com/playwright que incluye
# Chrome, dependencias del sistema y Node.js.
# ===================================================

# ─── STAGE 1: Instalación de dependencias ─────────────────────
FROM mcr.microsoft.com/playwright:v1.61.0-jammy AS deps

WORKDIR /app

COPY package*.json ./
COPY prisma/schema.prisma ./prisma/schema.prisma
COPY prisma.config.ts ./prisma.config.ts

RUN npm ci

RUN npx playwright install chrome

RUN npx prisma generate

# ─── STAGE 2: Build ─────────────────────────────────────────
FROM deps AS builder

WORKDIR /app

COPY . .

RUN npm run build

# ─── STAGE 3: Producción ────────────────────────────────────
FROM mcr.microsoft.com/playwright:v1.61.0-jammy

WORKDIR /app

ENV NODE_ENV=production
ENV HEADLESS=true
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
ENV NEXT_TELEMETRY_DISABLED=1

RUN apt-get update && apt-get install -y --no-install-recommends \
  tini \
  curl \
  && rm -rf /var/lib/apt/lists/*

RUN addgroup --system --gid 1001 nextjs \
  && adduser --system --uid 1001 --gid 1001 --home /app nextjs

COPY --from=builder --chown=nextjs:nextjs /app/package*.json ./
COPY --from=builder --chown=nextjs:nextjs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nextjs /app/.next ./.next
COPY --from=builder --chown=nextjs:nextjs /app/public ./public
COPY --from=builder --chown=nextjs:nextjs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nextjs /app/next.config.ts ./
COPY --from=builder --chown=nextjs:nextjs /app/tsconfig.json ./
COPY --from=deps --chown=nextjs:nextjs /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder --chown=nextjs:nextjs /app/scripts/entrypoint.sh ./scripts/entrypoint.sh

RUN mkdir -p /app/downloads/xmls /app/downloads/certs /app/downloads/pdfs /app/downloads/templates /app/downloads/debug /app/downloads/RIDE /app/browser_session /app/logs \
  && chmod +x /app/scripts/entrypoint.sh \
  && chown nextjs:nextjs /app

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:3001/api/health || exit 1

USER nextjs

ENTRYPOINT ["tini", "--", "/app/scripts/entrypoint.sh"]

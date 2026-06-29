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

RUN npm ci

# Instalar Chrome adicional para Playwright
RUN npx playwright install chrome

# Generar Prisma Client
RUN npx prisma generate

# ─── STAGE 2: Build ─────────────────────────────────────────
FROM deps AS builder

WORKDIR /app

COPY . .

# Build de Next.js
RUN npm run build

# ─── STAGE 3: Producción ────────────────────────────────────
FROM mcr.microsoft.com/playwright:v1.61.0-jammy

WORKDIR /app

# Variables de entorno por defecto
ENV NODE_ENV=production
ENV HEADLESS=true
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
ENV NEXT_TELEMETRY_DISABLED=1

# Instalar PM2 para gestión de procesos en producción
RUN npm install -g pm2

# Copiar desde builder
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/next.config.ts ./
COPY --from=builder /app/tsconfig.json ./

# Crear directorios para datos persistentes (montados como volúmenes)
RUN mkdir -p /app/downloads/xmls /app/downloads/certs /app/downloads/pdfs /app/downloads/templates /app/downloads/debug /app/downloads/RIDE /app/browser_session /app/logs

# Puerto de la aplicación
EXPOSE 3001

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:3001/api/health || exit 1

# Iniciar con PM2 en modo fork
CMD ["pm2-runtime", "start", "npm", "--", "start"]

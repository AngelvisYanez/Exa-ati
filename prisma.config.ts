import { defineConfig } from 'prisma/config';
import { PrismaNeon } from '@prisma/adapter-neon';

// prisma.config.ts — Configuración de Prisma 7 para Neon PostgreSQL
// Este archivo reemplaza las propiedades `url` y `directUrl` del schema.prisma

export default defineConfig({
  earlyAccess: true,
  schema: './prisma/schema.prisma',
  migrate: {
    async adapter() {
      const { neonConfig, Pool } = await import('@neondatabase/serverless');
      const { PrismaNeon } = await import('@prisma/adapter-neon');

      // Neon requiere WebSockets en entornos serverless
      // En Node.js local usamos el driver HTTP de Neon
      neonConfig.webSocketConstructor =
        typeof globalThis.WebSocket !== 'undefined'
          ? globalThis.WebSocket
          : (await import('ws')).default;

      const connectionString = process.env.DATABASE_URL;
      if (!connectionString) {
        throw new Error('DATABASE_URL is not set');
      }

      const pool = new Pool({ connectionString });
      return new PrismaNeon(pool);
    },
  },
});

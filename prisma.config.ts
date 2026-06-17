import { defineConfig } from 'prisma/config';
import { PrismaNeon } from '@prisma/adapter-neon';
import { Pool } from '@neondatabase/serverless';
import { config } from 'dotenv';

// Cargar .env manualmente — prisma.config.ts se ejecuta antes que Next.js
config({ path: '.env' });

// prisma.config.ts — Configuración Prisma 7 para Neon PostgreSQL
//
// Para migraciones usamos la URL pooled (pgbouncer) que es más accesible.
// La URL directa (DIRECT_DATABASE_URL) se puede usar en entornos que lo soporten.

const migrationUrl =
  process.env.DATABASE_URL ??
  process.env.DIRECT_DATABASE_URL ??
  '';

export default defineConfig({
  earlyAccess: true,
  schema: './prisma/schema.prisma',
  datasource: {
    url: migrationUrl,
  },
  migrate: {
    async adapter() {
      if (!migrationUrl) {
        throw new Error(
          'Necesitas definir DATABASE_URL en tu .env'
        );
      }
      const pool = new Pool({ connectionString: migrationUrl });
      return new PrismaNeon(pool);
    },
  },
});

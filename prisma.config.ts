import { defineConfig } from 'prisma/config';
import dotenv from 'dotenv';
dotenv.config();

// Prefer direct (non-pooled) URL for migrations / db push on Neon.
const url =
  process.env.DIRECT_DATABASE_URL ||
  process.env.DATABASE_URL ||
  'postgresql://postgres:postgres@db:5432/exa_ati';

export default defineConfig({
  schema: './prisma/schema.prisma',
  datasource: {
    url,
  },
  migrations: {
    seed: 'tsx prisma/seed.ts',
  },
});

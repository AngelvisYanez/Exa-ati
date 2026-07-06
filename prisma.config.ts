import { defineConfig } from 'prisma/config';

const url = process.env.DATABASE_URL;

export default defineConfig({
  schema: './prisma/schema.prisma',
  datasource: {
    url: url || 'postgresql://postgres:postgres@db:5432/exa_ati',
  },
  migrations: {
    seed: 'tsx prisma/seed.ts',
  },
});

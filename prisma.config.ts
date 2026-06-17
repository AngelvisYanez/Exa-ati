import { defineConfig } from 'prisma/config';
import { config } from 'dotenv';

config({ path: '.env' });

const migrationUrl =
  process.env.DATABASE_URL ??
  process.env.DIRECT_DATABASE_URL ??
  '';

export default defineConfig({
  schema: './prisma/schema.prisma',
  datasource: {
    url: migrationUrl,
  },
});

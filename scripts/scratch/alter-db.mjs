import { db } from '../../src/lib/sri-api/db.js';

async function alterDb() {
  console.log('Starting DB migration/alteration...');
  try {
    const usesPrisma = Boolean(process.env.DATABASE_URL);
    if (usesPrisma) {
      console.log('Running on PostgreSQL (Prisma)...');
      await db.query(`ALTER TABLE "usuarios" ADD COLUMN IF NOT EXISTS "ruc" VARCHAR(20)`);
      console.log('PostgreSQL: Column "ruc" verified/added to "usuarios" table.');
    } else {
      console.log('Running on MySQL (Development)...');
      // Check if column exists in MySQL
      const columns = await db.queryAll(`
        SHOW COLUMNS FROM \`usuarios\` LIKE 'ruc'
      `);
      if (columns.length === 0) {
        await db.query(`
          ALTER TABLE \`usuarios\` ADD COLUMN \`ruc\` VARCHAR(20) DEFAULT NULL AFTER \`tenant_id\`
        `);
        console.log('MySQL: Column "ruc" successfully added to "usuarios" table.');
      } else {
        console.log('MySQL: Column "ruc" already exists in "usuarios" table.');
      }
    }
    console.log('DB migration completed successfully.');
    process.exit(0);
  } catch (error) {
    console.error('Error altering DB:', error);
    process.exit(1);
  }
}

alterDb();

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';

dotenv.config();

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL is not defined in .env');
  process.exit(1);
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Conectando a Neon PostgreSQL...');
  
  let tenant = await prisma.tenant.findFirst({ where: { activo: true } });
  if (!tenant) {
    tenant = await prisma.tenant.create({
      data: {
        nombre: 'OFSERCONT Admin Tenant',
        ruc: '1790000000001',
        activo: true,
      },
    });
    console.log('Created tenant:', tenant.id);
  } else {
    console.log('Using tenant:', tenant.id);
  }

  const passwordHash = await bcrypt.hash('Admin123!', 12);

  const adminEmails = ['admin@exacontable.com', 'admin@ofsercont.com'];

  for (const email of adminEmails) {
    const user = await prisma.usuario.upsert({
      where: { email },
      update: {
        passwordHash,
        rol: 'ADMIN',
        activo: true,
        tenantId: tenant.id,
      },
      create: {
        email,
        passwordHash,
        nombre: 'Administrador General',
        rol: 'ADMIN',
        tenantId: tenant.id,
        activo: true,
      },
    });
    console.log(`✓ Admin user created/updated: ${user.email} (Password: Admin123!)`);
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('Error creating admin user:', err);
  process.exit(1);
});

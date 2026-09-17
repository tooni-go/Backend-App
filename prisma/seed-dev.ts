import { PrismaClient } from '../generated/prisma/client';
import { PrismaLibSql } from '@prisma/adapter-libsql';

async function main() {
  const adapter = new PrismaLibSql({
    url: process.env.DATABASE_URL || 'file:./dev.db',
  });
  const prisma = new PrismaClient({ adapter });

  const profesorId = 'user-dev-id';
  
  const existingProf = await prisma.profesor.findUnique({
    where: { id: profesorId }
  });

  if (!existingProf) {
    await prisma.profesor.create({
      data: {
        id: profesorId,
        nombre: 'Profesor',
        apellido: 'Desarrollo',
        email: 'dev@evalia.com',
        googleId: 'google-dev-id',
      }
    });
    console.log('Mock professor created with id:', profesorId);
  } else {
    console.log('Mock professor already exists.');
  }

  await prisma.$disconnect();
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});

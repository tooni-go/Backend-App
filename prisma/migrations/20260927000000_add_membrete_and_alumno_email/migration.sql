-- AlterTable
ALTER TABLE "Curso" ADD COLUMN IF NOT EXISTS "preferenciasMembrete" TEXT;

-- AlterTable
ALTER TABLE "Alumno" ADD COLUMN IF NOT EXISTS "email" TEXT;

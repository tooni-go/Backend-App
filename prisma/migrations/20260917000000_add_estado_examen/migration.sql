-- CreateEnum
CREATE TYPE "EstadoExamen" AS ENUM ('BORRADOR', 'PUBLICADO', 'ARCHIVADO');

-- AlterTable
ALTER TABLE "Examen" ADD COLUMN "estado" "EstadoExamen" NOT NULL DEFAULT 'BORRADOR';

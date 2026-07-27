/*
  Warnings:

  - Added the required column `apellido` to the `Alumno` table without a default value. This is not possible if the table is not empty.
  - Added the required column `apellido` to the `Profesor` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Alumno" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nombre" TEXT NOT NULL,
    "apellido" TEXT NOT NULL,
    "legajo" TEXT NOT NULL
);
INSERT INTO "new_Alumno" ("id", "legajo", "nombre") SELECT "id", "legajo", "nombre" FROM "Alumno";
DROP TABLE "Alumno";
ALTER TABLE "new_Alumno" RENAME TO "Alumno";
CREATE UNIQUE INDEX "Alumno_legajo_key" ON "Alumno"("legajo");
CREATE TABLE "new_Profesor" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nombre" TEXT NOT NULL,
    "apellido" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "googleId" TEXT NOT NULL
);
INSERT INTO "new_Profesor" ("email", "googleId", "id", "nombre") SELECT "email", "googleId", "id", "nombre" FROM "Profesor";
DROP TABLE "Profesor";
ALTER TABLE "new_Profesor" RENAME TO "Profesor";
CREATE UNIQUE INDEX "Profesor_email_key" ON "Profesor"("email");
CREATE UNIQUE INDEX "Profesor_googleId_key" ON "Profesor"("googleId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

/*
  Warnings:

  - You are about to drop the column `A` on the `_AlumnoToCurso` table. All the data in the column will be lost.
  - You are about to drop the column `B` on the `_AlumnoToCurso` table. All the data in the column will be lost.
  - Added the required column `idAlumno` to the `_AlumnoToCurso` table without a default value. This is not possible if the table is not empty.
  - Added the required column `idCurso` to the `_AlumnoToCurso` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new__AlumnoToCurso" (
    "idAlumno" TEXT NOT NULL,
    "idCurso" TEXT NOT NULL,

    PRIMARY KEY ("idAlumno", "idCurso"),
    CONSTRAINT "_AlumnoToCurso_idAlumno_fkey" FOREIGN KEY ("idAlumno") REFERENCES "Alumno" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_AlumnoToCurso_idCurso_fkey" FOREIGN KEY ("idCurso") REFERENCES "Curso" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
DROP TABLE "_AlumnoToCurso";
ALTER TABLE "new__AlumnoToCurso" RENAME TO "_AlumnoToCurso";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateTable
CREATE TABLE "Profesor" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nombre" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "googleId" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Curso" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "materia" TEXT NOT NULL,
    "anio" INTEGER NOT NULL,
    "division" TEXT NOT NULL,
    "anioLectivo" INTEGER NOT NULL,
    "profesorId" TEXT NOT NULL,
    CONSTRAINT "Curso_profesorId_fkey" FOREIGN KEY ("profesorId") REFERENCES "Profesor" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Alumno" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nombre" TEXT NOT NULL,
    "legajo" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Examen" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "titulo" TEXT NOT NULL,
    "fecha" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cursoId" TEXT NOT NULL,
    CONSTRAINT "Examen_cursoId_fkey" FOREIGN KEY ("cursoId") REFERENCES "Curso" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Pregunta" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "examenId" TEXT NOT NULL,
    "enunciado" TEXT NOT NULL,
    "respuestaEsperada" TEXT NOT NULL,
    "puntajeMaximo" REAL NOT NULL,
    "criteriosIA" TEXT,
    "esEvaluacionVisual" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "Pregunta_examenId_fkey" FOREIGN KEY ("examenId") REFERENCES "Examen" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Entrega" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "examenId" TEXT NOT NULL,
    "alumnoId" TEXT NOT NULL,
    "archivo" TEXT NOT NULL,
    "estado" TEXT NOT NULL,
    CONSTRAINT "Entrega_examenId_fkey" FOREIGN KEY ("examenId") REFERENCES "Examen" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Entrega_alumnoId_fkey" FOREIGN KEY ("alumnoId") REFERENCES "Alumno" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Correccion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entregaId" TEXT NOT NULL,
    "notaIA" REAL,
    "notaFinal" REAL,
    "nivelConfianza" TEXT,
    "feedbackJSON" TEXT,
    "fechaAprobacion" DATETIME,
    CONSTRAINT "Correccion_entregaId_fkey" FOREIGN KEY ("entregaId") REFERENCES "Entrega" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "_AlumnoToCurso" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,
    CONSTRAINT "_AlumnoToCurso_A_fkey" FOREIGN KEY ("A") REFERENCES "Alumno" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_AlumnoToCurso_B_fkey" FOREIGN KEY ("B") REFERENCES "Curso" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Profesor_email_key" ON "Profesor"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Profesor_googleId_key" ON "Profesor"("googleId");

-- CreateIndex
CREATE UNIQUE INDEX "Alumno_legajo_key" ON "Alumno"("legajo");

-- CreateIndex
CREATE UNIQUE INDEX "Correccion_entregaId_key" ON "Correccion"("entregaId");

-- CreateIndex
CREATE UNIQUE INDEX "_AlumnoToCurso_AB_unique" ON "_AlumnoToCurso"("A", "B");

-- CreateIndex
CREATE INDEX "_AlumnoToCurso_B_index" ON "_AlumnoToCurso"("B");

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "Profesor" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "apellido" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "googleId" TEXT NOT NULL,

    CONSTRAINT "Profesor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Curso" (
    "id" TEXT NOT NULL,
    "materia" TEXT NOT NULL,
    "anio" INTEGER NOT NULL,
    "division" TEXT NOT NULL,
    "anioLectivo" INTEGER NOT NULL,
    "profesorId" TEXT NOT NULL,

    CONSTRAINT "Curso_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Alumno" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "apellido" TEXT NOT NULL,
    "legajo" TEXT NOT NULL,

    CONSTRAINT "Alumno_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_AlumnoToCurso" (
    "idAlumno" TEXT NOT NULL,
    "idCurso" TEXT NOT NULL,

    CONSTRAINT "_AlumnoToCurso_pkey" PRIMARY KEY ("idAlumno","idCurso")
);

-- CreateTable
CREATE TABLE "Examen" (
    "id" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "puntajeTotal" DOUBLE PRECISION NOT NULL DEFAULT 10,
    "cursoId" TEXT NOT NULL,

    CONSTRAINT "Examen_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pregunta" (
    "id" TEXT NOT NULL,
    "examenId" TEXT NOT NULL,
    "enunciado" TEXT NOT NULL,
    "respuestaEsperada" TEXT NOT NULL,
    "puntajeMaximo" DOUBLE PRECISION NOT NULL,
    "criteriosIA" TEXT,
    "esEvaluacionVisual" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Pregunta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Entrega" (
    "id" TEXT NOT NULL,
    "examenId" TEXT NOT NULL,
    "alumnoId" TEXT NOT NULL,
    "archivo" TEXT NOT NULL,
    "estado" TEXT NOT NULL,

    CONSTRAINT "Entrega_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Correccion" (
    "id" TEXT NOT NULL,
    "entregaId" TEXT NOT NULL,
    "notaIA" DOUBLE PRECISION,
    "notaFinal" DOUBLE PRECISION,
    "nivelConfianza" TEXT,
    "feedbackJSON" TEXT,
    "fechaAprobacion" TIMESTAMP(3),

    CONSTRAINT "Correccion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Profesor_email_key" ON "Profesor"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Profesor_googleId_key" ON "Profesor"("googleId");

-- CreateIndex
CREATE UNIQUE INDEX "Alumno_legajo_key" ON "Alumno"("legajo");

-- CreateIndex
CREATE UNIQUE INDEX "Correccion_entregaId_key" ON "Correccion"("entregaId");

-- AddForeignKey
ALTER TABLE "Curso" ADD CONSTRAINT "Curso_profesorId_fkey" FOREIGN KEY ("profesorId") REFERENCES "Profesor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_AlumnoToCurso" ADD CONSTRAINT "_AlumnoToCurso_idAlumno_fkey" FOREIGN KEY ("idAlumno") REFERENCES "Alumno"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_AlumnoToCurso" ADD CONSTRAINT "_AlumnoToCurso_idCurso_fkey" FOREIGN KEY ("idCurso") REFERENCES "Curso"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Examen" ADD CONSTRAINT "Examen_cursoId_fkey" FOREIGN KEY ("cursoId") REFERENCES "Curso"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pregunta" ADD CONSTRAINT "Pregunta_examenId_fkey" FOREIGN KEY ("examenId") REFERENCES "Examen"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Entrega" ADD CONSTRAINT "Entrega_examenId_fkey" FOREIGN KEY ("examenId") REFERENCES "Examen"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Entrega" ADD CONSTRAINT "Entrega_alumnoId_fkey" FOREIGN KEY ("alumnoId") REFERENCES "Alumno"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Correccion" ADD CONSTRAINT "Correccion_entregaId_fkey" FOREIGN KEY ("entregaId") REFERENCES "Entrega"("id") ON DELETE CASCADE ON UPDATE CASCADE;

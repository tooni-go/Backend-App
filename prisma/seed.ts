import { PrismaClient } from '../generated/prisma/client.js';
import { PrismaLibSql } from '@prisma/adapter-libsql';

const adapter = new PrismaLibSql({
  url: process.env.DATABASE_URL || 'file:dev.db',
});
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Iniciando poblamiento de la base de datos (seeding)...');

  // 1. Limpieza de datos existentes en orden inverso de dependencias
  console.log('Limpiando tablas...');
  await prisma.correccion.deleteMany({});
  await prisma.entrega.deleteMany({});
  await prisma.pregunta.deleteMany({});
  await prisma.examen.deleteMany({});
  await prisma.alumnoCurso.deleteMany({});
  await prisma.alumno.deleteMany({});
  await prisma.curso.deleteMany({});
  await prisma.profesor.deleteMany({});

  // 2. Crear Profesor por defecto
  console.log('Creando profesor por defecto...');
  const profesor = await prisma.profesor.create({
    data: {
      nombre: 'Juan',
      apellido: 'Perez',
      email: 'default@evalia.com',
      googleId: 'default-google-id',
    },
  });

  // 3. Crear Curso
  console.log('Creando curso de prueba...');
  const curso = await prisma.curso.create({
    data: {
      materia: 'Química Orgánica',
      anio: 5,
      division: 'A',
      anioLectivo: 2026,
      profesorId: profesor.id,
    },
  });

  // 4. Crear Alumnos
  console.log('Creando alumnos...');
  const alumno1 = await prisma.alumno.create({
    data: {
      nombre: 'Mateo',
      apellido: 'Fernández',
      legajo: 'L-50001',
    },
  });

  const alumno2 = await prisma.alumno.create({
    data: {
      nombre: 'Sofía',
      apellido: 'Rodríguez',
      legajo: 'L-50002',
    },
  });

  const alumno3 = await prisma.alumno.create({
    data: {
      nombre: 'Santiago',
      apellido: 'Gómez',
      legajo: 'L-50003',
    },
  });

  // Asociar alumnos al curso
  await prisma.alumnoCurso.createMany({
    data: [
      { alumnoId: alumno1.id, cursoId: curso.id },
      { alumnoId: alumno2.id, cursoId: curso.id },
      { alumnoId: alumno3.id, cursoId: curso.id },
    ],
  });

  // 5. Crear Examen y Preguntas
  console.log('Creando examen y preguntas...');
  const examen = await prisma.examen.create({
    data: {
      titulo: 'Primer Parcial de Compuestos de Carbono',
      cursoId: curso.id,
      preguntas: {
        create: [
          {
            enunciado: '¿Cuál es la fórmula química del benceno y describa su estructura molecular?',
            respuestaEsperada: 'La fórmula del benceno es C6H6, estructurada en un anillo hexagonal plano con dobles enlaces conjugados resonantes.',
            puntajeMaximo: 5.0,
            criteriosIA: 'Verificar mención a C6H6, anillo hexagonal y resonancia o hibridación sp2.',
            esEvaluacionVisual: false,
          },
          {
            enunciado: 'Dibuje la estructura geométrica del isómero cis-2-buteno.',
            respuestaEsperada: 'Estructura con los dos grupos metilo (-CH3) del mismo lado del doble enlace carbono-carbono.',
            puntajeMaximo: 5.0,
            criteriosIA: 'Evaluar disposición espacial espacial de los metilos del mismo lado del doble enlace.',
            esEvaluacionVisual: true, // Pregunta visual para gatillar revisión manual
          },
        ],
      },
    },
  });

  console.log('Seeding completado de forma exitosa! 🎉');
  console.log(`Profesor ID: ${profesor.id}`);
  console.log(`Curso ID: ${curso.id}`);
  console.log(`Examen ID: ${examen.id}`);
}

main()
  .catch((e) => {
    console.error('Error durante el seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

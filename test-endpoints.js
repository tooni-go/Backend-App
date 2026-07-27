/**
 * Script de prueba para validar que todos los endpoints del backend funcionen correctamente.
 * Para ejecutarlo:
 * 1. Inicia el servidor del backend en una terminal: `npm run start:dev` (o `cmd /c npm run start:dev` si hay restricciones de permisos).
 * 2. Ejecuta este script en otra terminal: `node test-endpoints.js`
 */

const BACKEND_URL = 'http://localhost:3000';

async function runTests() {
  console.log('🚀 Iniciando pruebas de integración para la API del Backend de EvalIA...');

  try {
    // 1. Crear un Curso
    console.log('\n1. Creando un nuevo curso (POST /api/v1/cursos)...');
    const cursoRes = await fetch(`${BACKEND_URL}/api/v1/cursos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        materia: 'Matemática',
        anio: 5,
        division: 'A',
        anioLectivo: 2026,
      }),
    });
    if (!cursoRes.ok) throw new Error(`Error creando curso: ${await cursoRes.text()}`);
    const curso = await cursoRes.json();
    console.log('✅ Curso creado con éxito:', curso);

    // 2. Obtener listado de Cursos
    console.log('\n2. Obteniendo listado de cursos (GET /api/v1/cursos)...');
    const cursosRes = await fetch(`${BACKEND_URL}/api/v1/cursos`);
    if (!cursosRes.ok) throw new Error(`Error obteniendo cursos: ${await cursosRes.text()}`);
    const cursos = await cursosRes.json();
    console.log(`✅ Cursos encontrados: ${cursos.length}`);

    // 3. Registrar un Alumno en el Curso
    console.log(`\n3. Registrando un alumno en el curso ${curso.id} (POST /api/v1/cursos/:id/alumnos)...`);
    const alumnoRes = await fetch(`${BACKEND_URL}/api/v1/cursos/${curso.id}/alumnos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nombre: 'Juan',
        apellido: 'Pérez',
        legajo: `L-${Math.floor(Math.random() * 100000)}`,
      }),
    });
    if (!alumnoRes.ok) throw new Error(`Error registrando alumno: ${await alumnoRes.text()}`);
    const alumno = await alumnoRes.json();
    console.log('✅ Alumno registrado con éxito:', alumno);

    // 4. Crear un Examen para el Curso
    console.log(`\n4. Creando un examen para el curso ${curso.id} (POST /api/v1/cursos/:id/examenes)...`);
    const examenRes = await fetch(`${BACKEND_URL}/api/v1/cursos/${curso.id}/examenes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        titulo: 'Examen de Álgebra',
        preguntas: [
          {
            enunciado: '¿Cuánto es 2 + 2?',
            respuestaEsperada: '4',
            puntajeMaximo: 5,
            criteriosIA: 'Aceptar resolución paso a paso',
            esEvaluacionVisual: false,
          },
          {
            enunciado: 'Dibuje una función lineal creciente.',
            respuestaEsperada: 'Un gráfico con una recta de pendiente positiva',
            puntajeMaximo: 5,
            esEvaluacionVisual: true, // Esto forzará estado REQUIERE_REVISION por ser pregunta visual
          },
        ],
      }),
    });
    if (!examenRes.ok) throw new Error(`Error creando examen: ${await examenRes.text()}`);
    const examen = await examenRes.json();
    console.log('✅ Examen creado con éxito:', examen);

    // 5. Crear una Entrega (Subida de archivo)
    console.log('\n5. Creando una entrega con un archivo ficticio (POST /api/v1/entregas)...');
    
    // Creamos un archivo dummy en memoria
    const fileContent = 'Contenido del examen de prueba';
    const blob = new Blob([fileContent], { type: 'text/plain' });
    const formData = new FormData();
    formData.append('examId', examen.id);
    formData.append('alumnoId', alumno.id);
    formData.append('file', blob, 'examen_algebra.txt');

    const entregaRes = await fetch(`${BACKEND_URL}/api/v1/entregas`, {
      method: 'POST',
      body: formData, // Fetch mapea automáticamente los headers y boundary para FormData
    });
    if (!entregaRes.ok) throw new Error(`Error subiendo entrega: ${await entregaRes.text()}`);
    let entrega = await entregaRes.json();
    console.log('✅ Entrega subida con éxito (en estado PENDIENTE):', entrega);

    // 6. Consultar la entrega (esperando el procesamiento asíncrono en background)
    console.log('\n6. Consultando el estado de la entrega en background (GET /api/v1/entregas/:id)...');
    console.log('Esperando 3 segundos a que actúe la IA (Gemini/OpenRouter)...');
    await new Promise((resolve) => setTimeout(resolve, 3000));

    const consultaRes = await fetch(`${BACKEND_URL}/api/v1/entregas/${entrega.id}`);
    if (!consultaRes.ok) throw new Error(`Error consultando entrega: ${await consultaRes.text()}`);
    entrega = await consultaRes.json();
    console.log('✅ Estado actual de la entrega:', entrega.estado);
    console.log('   Sugerencias de Corrección:', entrega.correccion ? entrega.correccion : 'No procesada aún por la IA');

    // 7. Aprobar la entrega por parte del profesor
    console.log(`\n7. Aprobando la entrega ${entrega.id} (PUT /api/v1/entregas/:id/aprobar)...`);
    const aprobarRes = await fetch(`${BACKEND_URL}/api/v1/entregas/${entrega.id}/aprobar`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        notaFinal: 8.5,
        observaciones: 'Buen intento, faltó precisión en el dibujo.',
      }),
    });
    if (!aprobarRes.ok) throw new Error(`Error aprobando entrega: ${await aprobarRes.text()}`);
    const entregaAprobada = await aprobarRes.ok ? await aprobarRes.json() : null;
    console.log('✅ Entrega aprobada con éxito:', entregaAprobada);

    console.log('\n🎉 ¡Todas las pruebas de la API finalizaron con éxito!');

  } catch (error) {
    console.error('\n❌ Ocurrió un error al ejecutar las pruebas:', error.message);
  }
}

runTests();

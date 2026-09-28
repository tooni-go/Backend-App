const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3000';

async function runLiveRegeneracionTests() {
  console.log('🚀 Iniciando pruebas en vivo para el endpoint de Regeneración Atómica con IA...');

  try {
    // 1. Crear un curso
    console.log('\n1. Creando curso de prueba...');
    const cursoRes = await fetch(`${BACKEND_URL}/api/v1/cursos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        materia: 'Física Clásica',
        anio: 4,
        division: 'B',
        anioLectivo: 2026,
      }),
    });
    if (!cursoRes.ok) throw new Error(`Error creando curso: ${await cursoRes.text()}`);
    const curso = await cursoRes.json();
    console.log('✅ Curso creado:', curso.id);

    // 2. Crear un examen con una pregunta de física
    console.log('\n2. Creando examen con pregunta base en el curso...');
    const examenRes = await fetch(`${BACKEND_URL}/api/v1/cursos/${curso.id}/examenes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        titulo: 'Parcial de Dinámica y Leyes de Newton',
        preguntas: [
          {
            enunciado: '¿Qué es la primera ley de Newton y cómo se define la inercia?',
            respuestaEsperada:
              'Un cuerpo permanece en reposo o MRU a menos que actúe una fuerza neta. La inercia es la resistencia del cuerpo al cambio en su estado de movimiento.',
            puntajeMaximo: 10,
            criteriosIA: 'Evaluar mención explícita a la fuerza neta o externa y relación masa-inercia.',
            esEvaluacionVisual: false,
          },
        ],
      }),
    });
    if (!examenRes.ok) throw new Error(`Error creando examen: ${await examenRes.text()}`);
    const examen = await examenRes.json();
    const preguntaBase = examen.preguntas[0];
    console.log('✅ Examen creado con pregunta ID:', preguntaBase.id);
    console.log('   Enunciado original:', preguntaBase.enunciado);

    // 3. Test REFRASEO
    console.log('\n3. Probando regeneración con REFRASEO (POST /api/v1/examenes/preguntas/regenerar-individual)...');
    const refraseoRes = await fetch(`${BACKEND_URL}/api/v1/examenes/preguntas/regenerar-individual`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        preguntaId: preguntaBase.id,
        tipoAjuste: 'REFRASEO',
      }),
    });
    if (!refraseoRes.ok) throw new Error(`Error en REFRASEO: ${await refraseoRes.text()}`);
    const refraseoData = await refraseoRes.json();
    console.log('✅ REFRASEO response status:', refraseoRes.status);
    console.log('   Pregunta original:', refraseoData.preguntaOriginal);
    console.log('   Sugerencia generada:', refraseoData.sugerencia);
    console.log('   Tipo de ajuste:', refraseoData.tipoAjuste);

    if (!refraseoData.sugerencia.enunciado || !refraseoData.sugerencia.respuestaEsperada || typeof refraseoData.sugerencia.esEvaluacionVisual !== 'boolean') {
      throw new Error('La estructura de la sugerencia en REFRASEO no coincide con el schema esperado.');
    }
    if (refraseoData.sugerencia.puntajeMaximo !== undefined) {
      throw new Error('puntajeMaximo no debería existir en sugerencia.');
    }

    // 4. Test CAMBIO_DIFICULTAD -> DIFICIL
    console.log('\n4. Probando regeneración con CAMBIO_DIFICULTAD -> DIFICIL...');
    const difRes = await fetch(`${BACKEND_URL}/api/v1/examenes/preguntas/regenerar-individual`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        preguntaId: preguntaBase.id,
        tipoAjuste: 'CAMBIO_DIFICULTAD',
        parametros: {
          nivelDificultad: 'DIFICIL',
        },
      }),
    });
    if (!difRes.ok) throw new Error(`Error en CAMBIO_DIFICULTAD: ${await difRes.text()}`);
    const difData = await difRes.json();
    console.log('✅ CAMBIO_DIFICULTAD (DIFICIL) response status:', difRes.status);
    console.log('   Sugerencia difícil:', difData.sugerencia);
    console.log('   Parámetros devueltos:', difData.parametros);

    // 5. Test CAMBIO_FORMATO -> MULTIPLE_CHOICE
    console.log('\n5. Probando regeneración con CAMBIO_FORMATO -> MULTIPLE_CHOICE...');
    const formatoRes = await fetch(`${BACKEND_URL}/api/v1/examenes/preguntas/regenerar-individual`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        preguntaId: preguntaBase.id,
        tipoAjuste: 'CAMBIO_FORMATO',
        parametros: {
          formatoDestino: 'MULTIPLE_CHOICE',
        },
      }),
    });
    if (!formatoRes.ok) throw new Error(`Error en CAMBIO_FORMATO: ${await formatoRes.text()}`);
    const formatoData = await formatoRes.json();
    console.log('✅ CAMBIO_FORMATO (MULTIPLE_CHOICE) response status:', formatoRes.status);
    console.log('   Sugerencia multiple choice:', formatoData.sugerencia);

    // 6. Test 404 con preguntaId inexistente
    console.log('\n6. Validando respuesta 404 para preguntaId inexistente...');
    const fakeId = 'uuid-pregunta-inexistente-999';
    const notFoundRes = await fetch(`${BACKEND_URL}/api/v1/examenes/preguntas/regenerar-individual`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        preguntaId: fakeId,
        tipoAjuste: 'REFRASEO',
      }),
    });
    const notFoundData = await notFoundRes.json();
    console.log('   Status recibido:', notFoundRes.status, '(Esperado: 404)');
    console.log('   Mensaje recibido:', notFoundData.message);
    if (notFoundRes.status !== 404 || notFoundData.message !== `Pregunta con ID ${fakeId} no encontrada.`) {
      throw new Error(`Error en validación 404: esperado mensaje estándar, recibido: ${JSON.stringify(notFoundData)}`);
    }

    // 7. Test 400 cuando falta nivelDificultad en CAMBIO_DIFICULTAD
    console.log('\n7. Validando respuesta 400 cuando falta nivelDificultad en CAMBIO_DIFICULTAD...');
    const badDifRes = await fetch(`${BACKEND_URL}/api/v1/examenes/preguntas/regenerar-individual`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        preguntaId: preguntaBase.id,
        tipoAjuste: 'CAMBIO_DIFICULTAD',
      }),
    });
    const badDifData = await badDifRes.json();
    console.log('   Status recibido:', badDifRes.status, '(Esperado: 400)');
    console.log('   Mensaje recibido:', badDifData.message);
    if (badDifRes.status !== 400) {
      throw new Error(`Esperado 400 en falta de nivelDificultad, recibido: ${badDifRes.status}`);
    }

    // 8. Test 400 cuando falta formatoDestino en CAMBIO_FORMATO
    console.log('\n8. Validando respuesta 400 cuando falta formatoDestino en CAMBIO_FORMATO...');
    const badFormatRes = await fetch(`${BACKEND_URL}/api/v1/examenes/preguntas/regenerar-individual`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        preguntaId: preguntaBase.id,
        tipoAjuste: 'CAMBIO_FORMATO',
      }),
    });
    const badFormatData = await badFormatRes.json();
    console.log('   Status recibido:', badFormatRes.status, '(Esperado: 400)');
    console.log('   Mensaje recibido:', badFormatData.message);
    if (badFormatRes.status !== 400) {
      throw new Error(`Esperado 400 en falta de formatoDestino, recibido: ${badFormatRes.status}`);
    }

    // 9. Verificar que la pregunta en la BD no fue alterada (inmutabilidad)
    console.log('\n9. Verificando que la pregunta original permanece inalterada en BD...');
    const examenCheckRes = await fetch(`${BACKEND_URL}/api/v1/examenes/${examen.id}`);
    const examenCheck = await examenCheckRes.json();
    const preguntaInDb = examenCheck.preguntas.find(p => p.id === preguntaBase.id);
    console.log('   Pregunta en BD después de las regeneraciones:', preguntaInDb);
    if (preguntaInDb.enunciado !== preguntaBase.enunciado || preguntaInDb.respuestaEsperada !== preguntaBase.respuestaEsperada) {
      throw new Error('¡Alerta! La pregunta fue modificada en la base de datos.');
    }
    console.log('✅ Inmutabilidad confirmada en base de datos.');

    console.log('\n🎉 ¡TODAS LAS PRUEBAS EN VIVO DE REGENERACIÓN PASARON EXITOSAMENTE!');
  } catch (err) {
    console.error('❌ Error ejecutando pruebas en vivo:', err);
    process.exit(1);
  }
}

runLiveRegeneracionTests();

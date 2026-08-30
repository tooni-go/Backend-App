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

    // 4. Extracción de Texto de Documentos (POST /api/v1/documentos/extraer-texto)
    console.log('\n4. Probando Extracción de Texto de Documentos (POST /api/v1/documentos/extraer-texto)...');

    // 4a. Extracción de archivo TXT
    console.log('   4a. Extrayendo texto de archivo TXT plano...');
    const docTxtContent = 'Consignas del Examen de Historia:\n1. Causas de la Revolución Francesa.\n2. Consecuencias de la Revolución Industrial.';
    const docTxtBlob = new Blob([docTxtContent], { type: 'text/plain' });
    const formDataTxt = new FormData();
    formDataTxt.append('file', docTxtBlob, 'historia.txt');

    const extraerTxtRes = await fetch(`${BACKEND_URL}/api/v1/documentos/extraer-texto`, {
      method: 'POST',
      body: formDataTxt,
    });
    if (!extraerTxtRes.ok) throw new Error(`Error en extracción TXT: ${await extraerTxtRes.text()}`);
    const resultadoTxt = await extraerTxtRes.json();
    console.log('   ✅ Extracción TXT exitosa:', resultadoTxt);

    // 4b. Extracción de archivo DOCX
    console.log('   4b. Extrayendo texto de archivo DOCX real...');
    const JSZip = require('jszip');
    const zip = new JSZip();
    zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`);
    zip.file('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`);
    zip.file('word/document.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Examen de Química General</w:t></w:r></w:p><w:p><w:r><w:t>Pregunta 1: Balancear la ecuación redox.</w:t></w:r></w:p></w:body></w:document>`);
    const docxNodeBuffer = await zip.generateAsync({ type: 'nodebuffer' });
    const docxBlob = new Blob([docxNodeBuffer], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
    const formDataDocx = new FormData();
    formDataDocx.append('file', docxBlob, 'examen.docx');

    const extraerDocxRes = await fetch(`${BACKEND_URL}/api/v1/documentos/extraer-texto`, {
      method: 'POST',
      body: formDataDocx,
    });
    if (!extraerDocxRes.ok) throw new Error(`Error en extracción DOCX: ${await extraerDocxRes.text()}`);
    const resultadoDocx = await extraerDocxRes.json();
    console.log('   ✅ Extracción DOCX exitosa:', resultadoDocx);

    // 4c. Validación de rechazo ante solicitud sin archivo (Error 400)
    console.log('   4c. Verificando validación 400 ante solicitud sin archivo...');
    const extraerSinArchivoRes = await fetch(`${BACKEND_URL}/api/v1/documentos/extraer-texto`, {
      method: 'POST',
      body: new FormData(),
    });
    if (extraerSinArchivoRes.status === 400) {
      console.log('   ✅ Error 400 retornado correctamente ante solicitud sin archivo.');
    } else {
      throw new Error(`Se esperaba status 400 pero se recibió ${extraerSinArchivoRes.status}`);
    }

    // 4d. Validación de rechazo ante tipo MIME no soportado (Error 400)
    console.log('   4d. Verificando validación 400 ante tipo MIME no soportado (audio/mp3)...');
    const audioBlob = new Blob(['audio-content'], { type: 'audio/mp3' });
    const formAudio = new FormData();
    formAudio.append('file', audioBlob, 'audio.mp3');
    const extraerAudioRes = await fetch(`${BACKEND_URL}/api/v1/documentos/extraer-texto`, {
      method: 'POST',
      body: formAudio,
    });
    if (extraerAudioRes.status === 400) {
      console.log('   ✅ Error 400 retornado correctamente ante formato no soportado.');
    } else {
      throw new Error(`Se esperaba status 400 pero se recibió ${extraerAudioRes.status}`);
    }

    // 5. Carga Inteligente de Examen con IA (POST /api/v1/examenes/generar)
    console.log('\n5. Probando Carga Inteligente de Exámenes con IA (POST /api/v1/examenes/generar)...');
    
    // 4a. Generación a partir de texto en JSON
    console.log('   4a. Generando examen a partir de consignas en JSON...');
    const generarJsonRes = await fetch(`${BACKEND_URL}/api/v1/examenes/generar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        texto: 'Crear una evaluación de Álgebra y Funciones: 1 pregunta sobre funciones lineales y 1 pregunta pidiendo graficar una función cuadrática.',
      }),
    });
    if (!generarJsonRes.ok) throw new Error(`Error en Carga Inteligente (JSON): ${await generarJsonRes.text()}`);
    const examenGeneradoJson = await generarJsonRes.json();
    console.log('   ✅ Examen generado desde JSON:', examenGeneradoJson.titulo);
    console.log(`      Preguntas generadas: ${examenGeneradoJson.preguntas.length}`);

    // 4b. Generación a partir de archivo multipart/form-data
    console.log('   4b. Generando examen a partir de archivo TXT multipart/form-data...');
    const temarioContent = 'Temario: Cinemática y Movimiento Rectilíneo Uniforme (MRU)\n1. Defina velocidad media.\n2. Problema de encuentro de dos móviles.';
    const temarioBlob = new Blob([temarioContent], { type: 'text/plain' });
    const formDataGenerar = new FormData();
    formDataGenerar.append('file', temarioBlob, 'temario.txt');
    formDataGenerar.append('texto', 'Generar 2 preguntas con respuestas modelo.');

    const generarFileRes = await fetch(`${BACKEND_URL}/api/v1/examenes/generar`, {
      method: 'POST',
      body: formDataGenerar,
    });
    if (!generarFileRes.ok) throw new Error(`Error en Carga Inteligente (Multipart): ${await generarFileRes.text()}`);
    const examenGeneradoFile = await generarFileRes.json();
    console.log('   ✅ Examen generado desde archivo:', examenGeneradoFile.titulo);

    // 4c. Validación de rechazo ante entrada vacía (Error 400)
    console.log('   4c. Verificando validación 400 ante payload vacío...');
    const generarVacioRes = await fetch(`${BACKEND_URL}/api/v1/examenes/generar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    if (generarVacioRes.status === 400) {
      console.log('   ✅ Error 400 retornado correctamente ante solicitud sin texto ni archivo.');
    } else {
      throw new Error(`Se esperaba status 400 pero se recibió ${generarVacioRes.status}`);
    }

    // 5. Guardar el Examen Generado por IA en el Curso
    console.log(`\n5. Guardando el examen generado en el curso ${curso.id} (POST /api/v1/cursos/:id/examenes)...`);
    const examenRes = await fetch(`${BACKEND_URL}/api/v1/cursos/${curso.id}/examenes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        titulo: examenGeneradoJson.titulo,
        preguntas: examenGeneradoJson.preguntas,
      }),
    });
    if (!examenRes.ok) throw new Error(`Error creando examen: ${await examenRes.text()}`);
    const examen = await examenRes.json();
    console.log('✅ Examen guardado con éxito en la base de datos:', examen.id, `(Preguntas: ${examen.preguntas.length})`);

    // 6. Validaciones y Creación de Entrega (POST /api/v1/entregas)
    console.log('\n6. Probando validaciones y subida de entregas (POST /api/v1/entregas)...');
    
    // 6a. Validación de rechazo por tipo de archivo no soportado (ej. text/plain o zip)
    console.log('   6a. Verificando rechazo 400 ante tipo MIME no soportado (text/plain)...');
    const invalidMimeBlob = new Blob(['Contenido de texto no soportado'], { type: 'text/plain' });
    const invalidMimeForm = new FormData();
    invalidMimeForm.append('examId', examen.id);
    invalidMimeForm.append('alumnoId', alumno.id);
    invalidMimeForm.append('file', invalidMimeBlob, 'documento.txt');

    const invalidMimeRes = await fetch(`${BACKEND_URL}/api/v1/entregas`, {
      method: 'POST',
      body: invalidMimeForm,
    });
    if (invalidMimeRes.status === 400) {
      const errorJson = await invalidMimeRes.json();
      console.log('   ✅ Error 400 retornado correctamente:', errorJson.message);
    } else {
      throw new Error(`Se esperaba status 400 por tipo no soportado pero se recibió ${invalidMimeRes.status}`);
    }

    // 6b. Validación de rechazo por tamaño de archivo excesivo (> 10MB)
    console.log('   6b. Verificando rechazo 400 ante archivo que excede el tamaño máximo (11MB)...');
    const largeBuffer = new Uint8Array(11 * 1024 * 1024); // 11MB
    const largeBlob = new Blob([largeBuffer], { type: 'application/pdf' });
    const largeForm = new FormData();
    largeForm.append('examId', examen.id);
    largeForm.append('alumnoId', alumno.id);
    largeForm.append('file', largeBlob, 'archivo_gigante.pdf');

    const largeRes = await fetch(`${BACKEND_URL}/api/v1/entregas`, {
      method: 'POST',
      body: largeForm,
    });
    if (largeRes.status === 400) {
      const errorJson = await largeRes.json();
      console.log('   ✅ Error 400 retornado correctamente ante archivo excedido:', errorJson.message);
    } else {
      throw new Error(`Se esperaba status 400 por tamaño pero se recibió ${largeRes.status}`);
    }

    // 6c. Subida exitosa con formato soportado (application/pdf)
    console.log('   6c. Subiendo entrega válida con formato PDF soportado...');
    const validPdfContent = '%PDF-1.4 Examen resuelto de Matematica';
    const validPdfBlob = new Blob([validPdfContent], { type: 'application/pdf' });
    const validForm = new FormData();
    validForm.append('examId', examen.id);
    validForm.append('alumnoId', alumno.id);
    validForm.append('file', validPdfBlob, 'examen_algebra.pdf');

    const entregaRes = await fetch(`${BACKEND_URL}/api/v1/entregas`, {
      method: 'POST',
      body: validForm,
    });
    if (!entregaRes.ok) throw new Error(`Error subiendo entrega válida: ${await entregaRes.text()}`);
    let entrega = await entregaRes.json();
    console.log('   ✅ Entrega subida con éxito (en estado PENDIENTE):', entrega.id);

    // 7. Probar Endpoints de Listado de Entregas (GET /api/v1/entregas)
    console.log('\n7. Probando endpoints de listado de entregas (GET /api/v1/entregas)...');

    // 7a. Listar entregas por examenId
    console.log(`   7a. Listando entregas por examenId=${examen.id}...`);
    const listExamenRes = await fetch(`${BACKEND_URL}/api/v1/entregas?examenId=${examen.id}`);
    if (!listExamenRes.ok) throw new Error(`Error listando entregas por examen: ${await listExamenRes.text()}`);
    const entregasExamen = await listExamenRes.json();
    console.log(`   ✅ Entregas encontradas para el examen: ${entregasExamen.length}`);

    // 7b. Listar entregas por alumnoId
    console.log(`   7b. Listando entregas por alumnoId=${alumno.id}...`);
    const listAlumnoRes = await fetch(`${BACKEND_URL}/api/v1/entregas?alumnoId=${alumno.id}`);
    if (!listAlumnoRes.ok) throw new Error(`Error listando entregas por alumno: ${await listAlumnoRes.text()}`);
    const entregasAlumno = await listAlumnoRes.json();
    console.log(`   ✅ Entregas encontradas para el alumno: ${entregasAlumno.length}`);

    // 7c. Verificación de rechazo 400 si no se envían parámetros de filtro
    console.log('   7c. Verificando rechazo 400 en listado sin parámetros...');
    const listSinFiltroRes = await fetch(`${BACKEND_URL}/api/v1/entregas`);
    if (listSinFiltroRes.status === 400) {
      const errorJson = await listSinFiltroRes.json();
      console.log('   ✅ Error 400 retornado correctamente sin filtros:', errorJson.message);
    } else {
      throw new Error(`Se esperaba status 400 al listar sin filtros pero se recibió ${listSinFiltroRes.status}`);
    }

    // 8. Consultar la entrega (esperando el procesamiento asíncrono en background)
    console.log('\n8. Consultando el estado de la entrega en background (GET /api/v1/entregas/:id)...');
    console.log('Esperando 3 segundos a que actúe la IA (Gemini/OpenRouter)...');
    await new Promise((resolve) => setTimeout(resolve, 3000));

    const consultaRes = await fetch(`${BACKEND_URL}/api/v1/entregas/${entrega.id}`);
    if (!consultaRes.ok) throw new Error(`Error consultando entrega: ${await consultaRes.text()}`);
    entrega = await consultaRes.json();
    console.log('✅ Estado actual de la entrega:', entrega.estado);
    console.log('   Sugerencias de Corrección:', entrega.correccion ? entrega.correccion : 'No procesada aún por la IA');

    // 9. Aprobar la entrega por parte del profesor
    console.log(`\n9. Aprobando la entrega ${entrega.id} (PUT /api/v1/entregas/:id/aprobar)...`);
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

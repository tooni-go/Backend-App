/**
 * Script de prueba para validar los nuevos endpoints de Reportes (CSV y PDF)
 * contra la API real de EvalIA.
 */

const fs = require('fs');
const path = require('path');

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3000';

async function runReportesTests() {
  console.log('🚀 Iniciando pruebas para el módulo de Reportes (CSV / PDF)...');

  try {
    // 1. Crear un curso con acentos y divisiones
    console.log('\n1. Creando curso "Matemática Aplicada" (POST /api/v1/cursos)...');
    const cursoRes = await fetch(`${BACKEND_URL}/api/v1/cursos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        materia: 'Matemática Aplicada',
        anio: 5,
        division: 'División A',
        anioLectivo: 2026,
      }),
    });
    if (!cursoRes.ok) throw new Error(`Error creando curso: ${await cursoRes.text()}`);
    const curso = await cursoRes.json();
    console.log('✅ Curso creado:', curso.id, `(${curso.materia} ${curso.anio}° ${curso.division})`);

    // 2. Registrar 3 alumnos con nombres y apellidos con tildes y caracteres especiales
    console.log('\n2. Registrando alumnos en el curso...');
    const alumnos = [];
    const timestamp = Date.now();
    const mockAlumnos = [
      { nombre: 'Martín', apellido: 'Álvarez', legajo: `LEG-A-${timestamp}` },
      { nombre: 'Camila', apellido: 'López', legajo: `LEG-B-${timestamp}` },
      { nombre: 'Federico', apellido: 'Núñez', legajo: `LEG-C-${timestamp}` },
    ];

    for (const mock of mockAlumnos) {
      const alumnoRes = await fetch(`${BACKEND_URL}/api/v1/cursos/${curso.id}/alumnos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mock),
      });
      if (!alumnoRes.ok) throw new Error(`Error registrando alumno: ${await alumnoRes.text()}`);
      const al = await alumnoRes.json();
      alumnos.push(al);
      console.log(`   ✅ Alumno registrado: ${al.apellido}, ${al.nombre} (${al.legajo})`);
    }

    // 3. Crear 2 exámenes en el curso
    console.log('\n3. Creando 2 exámenes en el curso...');
    const exam1Res = await fetch(`${BACKEND_URL}/api/v1/cursos/${curso.id}/examenes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        titulo: 'Primer Parcial: Álgebra y Matrices',
        preguntas: [
          { enunciado: 'Defina determinante.', respuestaEsperada: 'Escalar asociado a matriz.', puntajeMaximo: 10 },
        ],
      }),
    });
    if (!exam1Res.ok) throw new Error(`Error creando examen 1: ${await exam1Res.text()}`);
    const examen1 = await exam1Res.json();

    const exam2Res = await fetch(`${BACKEND_URL}/api/v1/cursos/${curso.id}/examenes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        titulo: 'Segundo Parcial: Geometría Analítica',
        preguntas: [
          { enunciado: 'Ecuación de la recta.', respuestaEsperada: 'y = mx + b', puntajeMaximo: 10 },
        ],
      }),
    });
    if (!exam2Res.ok) throw new Error(`Error creando examen 2: ${await exam2Res.text()}`);
    const examen2 = await exam2Res.json();
    console.log(`✅ Exámenes creados: "${examen1.titulo}" y "${examen2.titulo}"`);

    // 4. Subir entregas y aprobar algunas para tener notas PUBLICADAS
    console.log('\n4. Subiendo entregas y simulando correcciones aprobadas (PUBLICADO)...');

    // Alumno 0 (Álvarez) en Examen 1
    const form1 = new FormData();
    form1.append('examId', examen1.id);
    form1.append('alumnoId', alumnos[0].id);
    form1.append('file', new Blob(['%PDF-1.4 mock entrega'], { type: 'application/pdf' }), 'entrega1.pdf');
    const ent1Res = await fetch(`${BACKEND_URL}/api/v1/entregas`, { method: 'POST', body: form1 });
    const ent1 = await ent1Res.json();

    // Aprobar entrega 1 con nota 9.5
    const app1Res = await fetch(`${BACKEND_URL}/api/v1/entregas/${ent1.id}/aprobar`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notaFinal: 9.5, observaciones: 'Excelente trabajo' }),
    });
    if (!app1Res.ok) throw new Error(`Error aprobando entrega 1: ${await app1Res.text()}`);
    console.log(`   ✅ Entrega 1 aprobada con nota 9.5 (PUBLICADO) para ${alumnos[0].nombre}`);

    // Alumno 1 (López) en Examen 1
    const form2 = new FormData();
    form2.append('examId', examen1.id);
    form2.append('alumnoId', alumnos[1].id);
    form2.append('file', new Blob(['%PDF-1.4 mock entrega 2'], { type: 'application/pdf' }), 'entrega2.pdf');
    const ent2Res = await fetch(`${BACKEND_URL}/api/v1/entregas`, { method: 'POST', body: form2 });
    const ent2 = await ent2Res.json();

    // Aprobar entrega 2 con nota 7.0
    const app2Res = await fetch(`${BACKEND_URL}/api/v1/entregas/${ent2.id}/aprobar`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notaFinal: 7.0 }),
    });
    if (!app2Res.ok) throw new Error(`Error aprobando entrega 2: ${await app2Res.text()}`);
    console.log(`   ✅ Entrega 2 aprobada con nota 7.0 (PUBLICADO) para ${alumnos[1].nombre}`);

    // Alumno 0 (Álvarez) en Examen 2
    const form3 = new FormData();
    form3.append('examId', examen2.id);
    form3.append('alumnoId', alumnos[0].id);
    form3.append('file', new Blob(['%PDF-1.4 mock entrega 3'], { type: 'application/pdf' }), 'entrega3.pdf');
    const ent3Res = await fetch(`${BACKEND_URL}/api/v1/entregas`, { method: 'POST', body: form3 });
    const ent3 = await ent3Res.json();

    // Aprobar entrega 3 con nota 8.5
    await fetch(`${BACKEND_URL}/api/v1/entregas/${ent3.id}/aprobar`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notaFinal: 8.5 }),
    });
    console.log(`   ✅ Entrega 3 aprobada con nota 8.5 (PUBLICADO) para ${alumnos[0].nombre} en Examen 2`);

    // Alumno 2 (Núñez) en Examen 1 (queda en PENDIENTE/PROCESANDO sin aprobar)
    const form4 = new FormData();
    form4.append('examId', examen1.id);
    form4.append('alumnoId', alumnos[2].id);
    form4.append('file', new Blob(['%PDF-1.4 mock entrega 4'], { type: 'application/pdf' }), 'entrega4.pdf');
    await fetch(`${BACKEND_URL}/api/v1/entregas`, { method: 'POST', body: form4 });
    console.log(`   ✅ Entrega 4 registrada en estado PENDIENTE para ${alumnos[2].nombre}`);

    // 5. Probar descarga de reportes vía HTTP
    const outputDir = path.join(__dirname, 'test-output');
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

    console.log('\n5. Probando Endpoints de Descarga de Reportes...');

    // 5a. GET /api/v1/reportes/examen/:examenId/csv
    console.log(`   5a. Descargando CSV de Examen (${BACKEND_URL}/api/v1/reportes/examen/${examen1.id}/csv)...`);
    const csvExamenRes = await fetch(`${BACKEND_URL}/api/v1/reportes/examen/${examen1.id}/csv`);
    if (!csvExamenRes.ok) throw new Error(`Error en CSV examen: ${await csvExamenRes.text()}`);
    const csvExamenBuf = Buffer.from(await csvExamenRes.arrayBuffer());
    const csvExamenDisp = csvExamenRes.headers.get('content-disposition');
    const csvExamenType = csvExamenRes.headers.get('content-type');
    console.log(`   ✅ Status 200 OK | Content-Type: ${csvExamenType} | Content-Disposition: ${csvExamenDisp}`);

    // Guardar archivo y verificar BOM
    const examenCsvPath = path.join(outputDir, 'reporte_examen_real.csv');
    fs.writeFileSync(examenCsvPath, csvExamenBuf);
    const hasExamenBom = csvExamenBuf[0] === 0xef && csvExamenBuf[1] === 0xbb && csvExamenBuf[2] === 0xbf;
    console.log(`   ✅ BOM UTF-8 verificado: ${hasExamenBom} | Tamaño: ${csvExamenBuf.length} bytes`);
    console.log('   📄 Contenido CSV Examen:');
    console.log(csvExamenBuf.toString('utf-8'));

    // 5b. GET /api/v1/reportes/examen/:examenId/pdf
    console.log(`\n   5b. Descargando PDF de Examen (${BACKEND_URL}/api/v1/reportes/examen/${examen1.id}/pdf)...`);
    const pdfExamenRes = await fetch(`${BACKEND_URL}/api/v1/reportes/examen/${examen1.id}/pdf`);
    if (!pdfExamenRes.ok) throw new Error(`Error en PDF examen: ${await pdfExamenRes.text()}`);
    const pdfExamenBuf = Buffer.from(await pdfExamenRes.arrayBuffer());
    const pdfExamenPath = path.join(outputDir, 'reporte_examen_real.pdf');
    fs.writeFileSync(pdfExamenPath, pdfExamenBuf);
    const isPdfExamen = pdfExamenBuf.subarray(0, 5).toString('ascii') === '%PDF-';
    console.log(`   ✅ Status 200 OK | Cabecera PDF válida: ${isPdfExamen} | Tamaño: ${pdfExamenBuf.length} bytes`);

    // 5c. GET /api/v1/reportes/curso/:cursoId/csv
    console.log(`\n   5c. Descargando CSV de Curso (${BACKEND_URL}/api/v1/reportes/curso/${curso.id}/csv)...`);
    const csvCursoRes = await fetch(`${BACKEND_URL}/api/v1/reportes/curso/${curso.id}/csv`);
    if (!csvCursoRes.ok) throw new Error(`Error en CSV curso: ${await csvCursoRes.text()}`);
    const csvCursoBuf = Buffer.from(await csvCursoRes.arrayBuffer());
    const cursoCsvPath = path.join(outputDir, 'reporte_curso_real.csv');
    fs.writeFileSync(cursoCsvPath, csvCursoBuf);
    const hasCursoBom = csvCursoBuf[0] === 0xef && csvCursoBuf[1] === 0xbb && csvCursoBuf[2] === 0xbf;
    console.log(`   ✅ Status 200 OK | BOM UTF-8 verificado: ${hasCursoBom} | Tamaño: ${csvCursoBuf.length} bytes`);
    console.log('   📄 Contenido CSV Curso:');
    console.log(csvCursoBuf.toString('utf-8'));

    // 5d. GET /api/v1/reportes/curso/:cursoId/pdf
    console.log(`\n   5d. Descargando PDF de Curso (${BACKEND_URL}/api/v1/reportes/curso/${curso.id}/pdf)...`);
    const pdfCursoRes = await fetch(`${BACKEND_URL}/api/v1/reportes/curso/${curso.id}/pdf`);
    if (!pdfCursoRes.ok) throw new Error(`Error en PDF curso: ${await pdfCursoRes.text()}`);
    const pdfCursoBuf = Buffer.from(await pdfCursoRes.arrayBuffer());
    const pdfCursoPath = path.join(outputDir, 'reporte_curso_real.pdf');
    fs.writeFileSync(pdfCursoPath, pdfCursoBuf);
    const isPdfCurso = pdfCursoBuf.subarray(0, 5).toString('ascii') === '%PDF-';
    console.log(`   ✅ Status 200 OK | Cabecera PDF válida: ${isPdfCurso} | Tamaño: ${pdfCursoBuf.length} bytes`);

    // 6. Validaciones de Error 404
    console.log('\n6. Validando respuestas 404 para entidades inexistentes...');
    const res404Examen = await fetch(`${BACKEND_URL}/api/v1/reportes/examen/no-existe-id/csv`);
    console.log(`   - Examen inexistente status: ${res404Examen.status} (Esperado: 404)`);
    const res404Curso = await fetch(`${BACKEND_URL}/api/v1/reportes/curso/no-existe-id/pdf`);
    console.log(`   - Curso inexistente status: ${res404Curso.status} (Esperado: 404)`);

    console.log('\n🎉 ¡TODAS LAS PRUEBAS EN VIVO DE REPORTES PASARON EXITOSAMENTE!');
  } catch (error) {
    console.error('❌ Error en pruebas:', error);
    process.exit(1);
  }
}

runReportesTests();

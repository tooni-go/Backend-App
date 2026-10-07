## Context

En la arquitectura actual de EvalIA, los modelos de datos principales (`Curso`, `Examen`, `Pregunta`, `Entrega`, `Correccion`, `AlumnoCurso`) tienen relaciones jerárquicas directas o indirectas con el modelo `Profesor`. Sin embargo, varias rutas de la API carecían de verificación de sesión (`JwtAuthGuard`) o de validación de titularidad (*ownership validation*).

Este documento describe el diseño técnico para implementar el aislamiento estricto de datos por docente y la protección uniforme contra accesos cruzados.

## Goals / Non-Goals

**Goals:**
- Proteger todos los controladores de negocio (`Cursos`, `Examenes`, `Alumnos`, `Entregas`, `Reportes`) con `JwtAuthGuard` y `ApiBearerAuth`.
- Garantizar que toda consulta a la base de datos filtre o valide que el recurso pertenezca al `profesorId` del token JWT.
- Responder con `404 Not Found` ante accesos a recursos no pertenecientes al docente autenticado.
- Implementar la eliminación inteligente de alumnos (*Smart Unlink & Clean*).
- Proveer un decorador `@CurrentUser()` para simplificar la extracción de la identidad del docente en los controladores.

**Non-Goals:**
- Modificar el esquema relacional de Prisma (las relaciones actuales en `schema.prisma` ya soportan completamente este aislamiento).
- Cambiar el sistema de autenticación existente (Google OAuth y JWT se mantienen intactos).

## Decisions

### Decisión 1: Decorador `@CurrentUser()`
- **Decisión**: Crear el decorador `@CurrentUser()` en `src/common/decorators/current-user.decorator.ts` que extraiga `request.user` inyectado por `JwtStrategy`.
- **Razón**: Mejora la legibilidad del código de los controladores evitando acceder a `req.user` manualmente mediante `any`.

```typescript
// Ejemplo de uso
@Get()
async getCursos(@CurrentUser() user: Profesor) {
  return this.cursosService.getCursos(user.id);
}
```

### Decisión 2: Política de Respuesta 404 Not Found Uniforme
- **Decisión**: Si un docente intenta acceder, modificar o eliminar un curso, examen, entrega o reporte que pertenece a otro profesor, el backend responderá con `NotFoundException('Recurso no encontrado')` en lugar de `403 Forbidden`.
- **Razón**: Previene la enumeración de identificadores de recursos en la plataforma (OWASP BOLA Protection).

```
   Petición: GET /api/v1/cursos/:id
                  │
                  ▼
   ¿Existe el curso Y curso.profesorId == user.id?
                /    \
          [SÍ] /      \ [NO]
              ▼        ▼
       Retorna Datos   throw new NotFoundException('Curso no encontrado')
```

### Decisión 3: Cadena de Validación de Pertenencia en Servicios

1. **Cursos (`CursosService`)**:
   - `createCurso(dto, profesorId)`: Asocia directamente el curso a `profesorId`.
   - `getCursos(profesorId)`: `prisma.curso.findMany({ where: { profesorId } })`.
   - `getCurso(id, profesorId)`: `prisma.curso.findFirst({ where: { id, profesorId } })`.
   - `updateCurso` y `deleteCurso`: Verificar `curso.profesorId === profesorId`.
   - `addAlumnoToCurso`, `createExamen`, `importarAlumnosMasivo`: Verificar que el curso pertenezca a `profesorId`.

2. **Exámenes (`ExamenesService`)**:
   - Para toda operación por `id`: buscar el examen incluyendo `curso: true`.
   - Validar `examen.curso.profesorId === profesorId`.
   - En `duplicarExamen(id, dto, profesorId)`: Validar que el examen origen Y el `cursoDestinoId` pertenezcan a `profesorId`.

3. **Alumnos (`AlumnosService`)**:
   - `getAlumnos(profesorId, cursoId, page, limit)`:
     - Si `cursoId`: Validar que `curso.profesorId === profesorId` y filtrar alumnos del curso.
     - Si no hay `cursoId`: `where: { cursos: { some: { curso: { profesorId } } } }`.
   - `deleteAlumno(alumnoId, profesorId)` (*Smart Unlink & Clean*):
     1. Obtener cursos del docente donde esté matriculado el alumno.
     2. Si no está en ninguno, lanzar `NotFoundException`.
     3. Eliminar los registros de `AlumnoCurso` correspondientes a los cursos de ese docente.
     4. Verificar si el alumno queda matriculado en algún otro curso de la BD (`prisma.alumnoCurso.count({ where: { alumnoId } }) === 0`).
     5. Si no le quedan cursos, eliminar el registro de `Alumno` físicamente de la base de datos.

4. **Entregas (`EntregasService`)**:
   - `getEntregas({ examenId, alumnoId, profesorId })`: Filtrar entregas donde `examen.curso.profesorId === profesorId`.
   - `getEntrega(id, profesorId)` y `approveEntrega(id, profesorId, ...)`: Validar que `entrega.examen.curso.profesorId === profesorId`.

5. **Reportes (`ReportesService`)**:
   - `generateExamenCsv / generateExamenPdf(examenId, profesorId)`: Validar pertenencia del examen.
   - `generateCursoCsv / generateCursoPdf(cursoId, profesorId)`: Validar pertenencia del curso.

## Risks / Trade-offs

- **[Riesgo] Pruebas existentes sin Token**: Tests anteriores que llamaban directamente a endpoints de exámenes o entregas sin cabecera de autenticación podrían fallar.
  - *Mitigación*: En pruebas unitarias se inyectará el `user` mockeado; en pruebas e2e se utilizará el token devuelto por el bypass local de login (`mock-token-juan`).
- **[Riesgo] Performance en Alumnos Multi-Curso**: Consultas con relaciones anidadas (`cursos.some.curso.profesorId`).
  - *Mitigación*: Prisma genera índices sobre las claves foráneas en SQLite/PostgreSQL, manteniendo tiempos de respuesta en milisegundos.

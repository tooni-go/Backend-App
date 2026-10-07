## Why

Durante la demo del 27/09/2026 se detectó una vulnerabilidad crítica de seguridad y privacidad: un profesor autenticado podía visualizar, modificar o eliminar cursos, exámenes, entregas y listados de alumnos pertenecientes a otros docentes. Esto se debió a la falta de Guards de autenticación en varios controladores (`ExamenesController`, `EntregasController`, `ReportesController`) y al uso de mecanismos de fallback en `CursosService` (`resolveTeacherId` que recurría a `prisma.profesor.findFirst()`).

Es fundamental blindar el backend para garantizar el aislamiento estricto de datos por docente (Multi-tenant data isolation), asegurando que cada profesor solo pueda acceder a los recursos que le pertenecen.

## What Changes

- **Eliminación de Fallbacks Inseguros**: Deprecar y remover el método `resolveTeacherId` con fallback a `prisma.profesor.findFirst()` en `CursosService`. Requerir explícitamente el `profesorId` proveniente del token JWT verificado (`req.user.id`).
- **Decorador Personalizado `@CurrentUser()`**: Crear un decorador reutilizable en `src/common/decorators/current-user.decorator.ts` para extraer de forma tipada y limpia los datos del docente autenticado.
- **Protección Global de Controladores**:
  - Aplicar `@UseGuards(JwtAuthGuard)` y `@ApiBearerAuth('JWT-auth')` a nivel de clase en `ExamenesController`, `EntregasController` y `ReportesController`.
- **Aislamiento en Servicios**:
  - `CursosService`: Filtrar siempre por `profesorId` en `findMany`, validar titularidad antes de `getCurso`, `updateCurso`, `deleteCurso`, `addAlumnoToCurso`, `createExamen` e `importarAlumnosMasivo`.
  - `ExamenesService`: Validar pertenencia del curso (`examen.curso.profesorId === user.id`) en `getExamen`, `updateExamen`, `updateEstado`, `deleteExamen`, `duplicarExamen` y `getMetricasExamen`.
  - `AlumnosService`: Restringir `getAlumnos` a los alumnos matriculados en cursos del docente logueado (`where: { cursos: { some: { curso: { profesorId: user.id } } } }`).
  - `EntregasService`: Restringir `getEntregas`, `getEntrega` y `approveEntrega` a exámenes de cursos pertenecientes al docente.
  - `ReportesService`: Validar pertenencia antes de generar y emitir reportes CSV y PDF de exámenes o cursos.
- **Estrategia Uniforme de Error (404 Not Found)**: Retornar `404 Not Found` en lugar de `403 Forbidden` cuando se intente acceder a un recurso ajeno o inexistente, previniendo la enumeración no autorizada de identificadores.
- **Eliminación Inteligente de Alumnos (*Smart Unlink & Clean*)**: Al eliminar un alumno, desvincularlo de los cursos del docente; si no queda matriculado en ningún otro curso de la plataforma, eliminar el registro de `Alumno` de la base de datos para evitar registros huérfanos.

## Capabilities

### Modified Capabilities
- `cursos-management`: Aislamiento estricto de cursos por `profesorId`.
- `examenes-management`: Protección por JWT y verificación de titularidad por curso.
- `alumnos-management`: Consulta acotada a cursos del profesor y eliminación inteligente sin registros huérfanos.
- `entregas-management`: Aprobación y consulta de entregas restringidas al docente titular.
- `reportes-export`: Exportación de CSV/PDF protegida por JWT y validada por titularidad.

## Impact

- **Código Afectado**:
  - `src/common/decorators/current-user.decorator.ts` [NEW]
  - `src/cursos/cursos.controller.ts` & `src/cursos/cursos.service.ts`
  - `src/examenes/examenes.controller.ts` & `src/examenes/examenes.service.ts`
  - `src/alumnos/alumnos.controller.ts` & `src/alumnos/alumnos.service.ts`
  - `src/entregas/entregas.controller.ts` & `src/entregas/entregas.service.ts`
  - `src/reportes/reportes.controller.ts` & `src/reportes/reportes.service.ts`
- **APIs**: Todos los endpoints de las entidades mencionadas ahora requieren `Authorization: Bearer <JWT>` válido.
- **Seguridad**: Se mitiga el riesgo OWASP de Broken Object Level Authorization (BOLA).

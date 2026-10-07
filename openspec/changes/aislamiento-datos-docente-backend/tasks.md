## 1. Setup Común y Decoradores

- [x] 1.1 Crear el decorador `@CurrentUser()` en `src/common/decorators/current-user.decorator.ts`.
- [x] 1.2 Exportar `@CurrentUser()` desde `src/common` o index para su uso en todos los controladores.

## 2. Aislamiento en el Módulo de Cursos (`CursosModule`)

- [x] 2.1 En `CursosService`, remover el fallback inseguro `resolveTeacherId()` y tipar los métodos para recibir obligatoriamente `profesorId: string`.
- [x] 2.2 Actualizar `getCursos`, `createCurso`, `updateCurso`, `deleteCurso` y `getCurso` para filtrar/validar pertenencia por `profesorId` (retornando 404 si no pertenece).
- [x] 2.3 Actualizar `addAlumnoToCurso`, `createExamen` e `importarAlumnosMasivo` para validar pertenencia del `cursoId` al `profesorId` antes de operar.
- [x] 2.4 Actualizar `CursosController` para inyectar `@CurrentUser()` en todos los endpoints y pasar el `profesorId` a `CursosService`.

## 3. Aislamiento en el Módulo de Exámenes (`ExamenesModule`)

- [x] 3.1 Proteger `ExamenesController` con `@UseGuards(JwtAuthGuard)` y `@ApiBearerAuth('JWT-auth')`.
- [x] 3.2 En `ExamenesService`, actualizar `getExamen`, `updateExamen`, `updateEstado`, `deleteExamen` y `getMetricasExamen` para verificar que `examen.curso.profesorId === profesorId` (retornando 404 si no coincide).
- [x] 3.3 En `ExamenesService.duplicarExamen`, validar que tanto el examen de origen como el curso de destino pertenezcan al `profesorId`.
- [x] 3.4 Actualizar `ExamenesController` para inyectar `@CurrentUser()` y propagar el `profesorId` al servicio.

## 4. Aislamiento en el Módulo de Alumnos (`AlumnosModule`)

- [x] 4.1 En `AlumnosService.getAlumnos`, restringir la búsqueda a los alumnos vinculados a cursos del `profesorId` (y validar pertenencia de `cursoId` si se provee como query param).
- [x] 4.2 En `AlumnosService.getAlumno` y `updateAlumno`, validar que el alumno pertenezca al menos a un curso del docente logueado.
- [x] 4.3 En `AlumnosService.deleteAlumno`, implementar la eliminación inteligente (*Smart Unlink & Clean*): desvincular de los cursos del docente y, si no tiene otros cursos en la BD, eliminar físicamente el registro de `Alumno`.
- [x] 4.4 Actualizar `AlumnosController` para inyectar `@CurrentUser()` y propagar `profesorId` a `AlumnosService`.

## 5. Aislamiento en el Módulo de Entregas y Reportes (`EntregasModule`, `ReportesModule`)

- [x] 5.1 Proteger `EntregasController` con `@UseGuards(JwtAuthGuard)` y `@ApiBearerAuth('JWT-auth')`.
- [x] 5.2 En `EntregasService`, validar pertenencia por `profesorId` en `createEntrega`, `getEntregas`, `getEntrega` y `approveEntrega`.
- [x] 5.3 Proteger `ReportesController` con `@UseGuards(JwtAuthGuard)` y `@ApiBearerAuth('JWT-auth')`.
- [x] 5.4 En `ReportesService`, validar titularidad del examen o curso antes de generar los reportes CSV y PDF.

## 6. Verificación y Pruebas de Seguridad

- [x] 6.1 Ejecutar pruebas de regresión automáticas (`npm test` o scripts de prueba) y verificar que no haya errores de compilación (`npm run build`).
- [x] 6.2 Validar que un usuario A autenticado no pueda acceder ni modificar recursos del usuario B (comprobando respuestas `404 Not Found`).

## 1. Setup Inicial y Base de Datos (Prisma)

- [x] 1.1 Inicializar el proyecto base de NestJS en la raíz del repositorio.
- [x] 1.2 Instalar las dependencias de Prisma ORM (`prisma`, `@prisma/client`).
- [x] 1.3 Configurar Prisma para usar SQLite localmente y definir los modelos `Profesor`, `Curso`, `Alumno`, `Examen`, `Pregunta`, `Entrega`, `Correccion` estableciendo sus relaciones jerárquicas e incorporando los campos requeridos.
- [x] 1.4 Ejecutar las migraciones iniciales de Prisma para configurar SQLite y generar el cliente de Prisma.

## 2. Integración de IA y Motor de Fallback

- [x] 2.1 Crear el módulo y servicio de IA para evaluar exámenes (Gemini API y OpenRouter).
- [x] 2.2 Implementar el cliente principal de Gemini API utilizando su SDK oficial para sugerencias de calificaciones.
- [x] 2.3 Implementar el cliente secundario de OpenRouter utilizando fetch o SDK compatible.
- [x] 2.4 Implementar la lógica del motor de Fallback: interceptar fallas en Gemini (429, 500, 503 o timeout de 15s) y reenrutar automáticamente a OpenRouter de manera invisible al usuario.
- [x] 2.5 Añadir la lógica de validación de esquema JSON de la IA y determinar transiciones a `REQUIERE_REVISION` (si la confianza es baja o el examen contiene preguntas con `esEvaluacionVisual = true`) o a `PENDIENTE_APROBACION`.

## 3. Endpoints de la API REST (NestJS)

- [x] 3.1 Implementar endpoints de gestión de Cursos (POST `/api/v1/cursos` para creación y GET `/api/v1/cursos` para listado).
- [x] 3.2 Implementar endpoint para registrar alumnos en un curso (POST `/api/v1/cursos/:id/alumnos`).
- [x] 3.3 Implementar endpoint para crear exámenes vinculados a un curso (POST `/api/v1/cursos/:id/examenes`).
- [x] 3.4 Implementar el endpoint POST `/api/v1/entregas` para recibir archivos (JPG, PNG, WEBP, PDF), guardar ruta en `archivo` e iniciar el flujo de corrección en estado `PENDIENTE`.
- [x] 3.5 Implementar el endpoint GET `/api/v1/entregas/:id` para consultar el estado, archivo, y sugerencias de corrección.
- [x] 3.6 Implementar el endpoint PUT `/api/v1/entregas/:id/aprobar` para guardar la nota definitiva del profesor, actualizar `fechaAprobación` y marcar la entrega como `PUBLICADO`.
- [x] 3.7 Conectar los endpoints de entregas con el motor de IA para orquestar los estados de las entregas (`PROCESANDO`, `REQUIERE_REVISION`, `PENDIENTE_APROBACION`).

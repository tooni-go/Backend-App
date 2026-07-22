## 1. Setup Inicial y Base de Datos (Prisma)

- [ ] 1.1 Inicializar el proyecto base de NestJS en la raíz del repositorio.
- [ ] 1.2 Instalar las dependencias de Prisma ORM (`prisma`, `@prisma/client`).
- [ ] 1.3 Configurar Prisma para usar SQLite localmente y definir los modelos `Profesor`, `Alumno`, `Examen`, `Pregunta`, `Entrega`, `Correccion` con sus relaciones y estados.
- [ ] 1.4 Ejecutar las migraciones iniciales de Prisma para configurar SQLite y generar el cliente de Prisma.

## 2. Integración de IA y Motor de Fallback

- [ ] 2.1 Crear el módulo y servicio de IA para evaluar exámenes (Gemini API y OpenRouter).
- [ ] 2.2 Implementar el cliente principal de Gemini API utilizando su SDK oficial para sugerencias de calificaciones.
- [ ] 2.3 Implementar el cliente secundario de OpenRouter utilizando fetch o SDK compatible.
- [ ] 2.4 Implementar la lógica del motor de Fallback: interceptar fallas en Gemini (429, 500, 503 o timeout de 15s) y reenrutar automáticamente a OpenRouter de manera invisible al usuario.
- [ ] 2.5 Añadir la lógica de validación de esquema JSON del resultado de la IA para determinar si el estado transita a `PENDIENTE_APROBACION` o `REQUIERE_REVISION`.

## 3. Endpoints de la API REST (NestJS)

- [ ] 3.1 Implementar el endpoint POST `/api/v1/entregas` para recibir archivos (JPG, PNG, WEBP, PDF) e iniciar el flujo de corrección en estado `PENDIENTE`.
- [ ] 3.2 Implementar el endpoint GET `/api/v1/entregas/:id` para consultar el estado y sugerencias de corrección.
- [ ] 3.3 Implementar el endpoint PUT `/api/v1/entregas/:id/aprobar` para guardar la nota definitiva del profesor y marcar la entrega como `PUBLICADO`.
- [ ] 3.4 Conectar los endpoints de entregas con el motor de IA para actualizar los estados de las entregas (`PROCESANDO`, `REQUIERE_REVISION`, `PENDIENTE_APROBACION`).

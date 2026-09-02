1 - Setup, Auth & Base de Datos

1.1: Inicialización de Next.js y Migración Base

1.2: Base de Datos y Autenticación

    Specs & Contratos (OpenSpec)

        - Definir openspec con schemas JSON de entrada/salida para el flujo de login (Google OAuth) y sesión.

    Backend (evalia-backend)

        - [x] Setup - Inicializar Prisma y definir esquema completo de DB (Profesor, Alumno, Examen, Pregunta, Entrega, Corrección).
        - [x] Auth - Implementar validación de tokens de Google OAuth y DTOs con class-validator.
        - [x] Auth - Crear servicio y endpoint `/auth/login` para manejar el login y devolver JWT interno.
        - [x] Profesores - Crear módulo, schema DTO y endpoints CRUD básicos para Profesor (alta/consulta al loguearse).
        - [x] Seed - Crear script de seed (prisma/seed.ts) con datos de prueba: profesor, cursos, alumnos y examen de ejemplo.

    Frontend (evalia-frontend)

        - [x] Auth - Configurar NextAuth.js (Auth.js) con Google Provider.
        - [x] UI - Crear componente y página de Login con redirección.
        - [x] Core - Implementar middleware para protección de rutas privadas.
        - [x] Guard de Sesión - Conectar el routing raíz (/) y el layout protegido al estado real de sesión (hoy redirige siempre a /dashboard sin validar login).

1.3: DevOps y Despliegue (o CI/CD y Docker)

    Dockerizar la aplicación (Frontend y Backend).

        - [ ] Crear Dockerfile optimizado para NestJS (Backend).
        - [ ] Crear Dockerfile optimizado para Next.js (Frontend)
        - [ ] Configurar docker-compose.yml para levantar toda la app localmente con base de datos SQLite.
        - [ ] Puertos - Resolver conflicto de puerto 3000 entre backend y frontend antes de armar docker-compose.yml.

    Configurar Deploy Automático en GitHub (Actions / CI/CD).

        - [ ] Configurar GitHub Actions para integración continua (CI) (que corra linter y build en cada PR)
        - [ ] Configurar script de despliegue continuo (CD) hacia el servidor de hosting.

    [ ] Realizar despliegue inicial en el servidor (Deploy).

    Configuración y Seguridad de Entorno

        - [ ] Rotación de Keys - Rotar las API keys de Gemini/OpenRouter expuestas en el .env actual.
        - [x] Env Backend - Crear .env.example documentando las variables necesarias del backend.


2 - Frontend y Backend (Desarrollo por Módulos en Next.js)

2.1: Gestión de Cursos y Alumnos

    Definir openspec con DTOs para CRUD de Alumnos y agrupación en Cursos.

    Backend (evalia-backend)

        - [x] Alumnos - Crear esquema DTO y endpoints CRUD (`GET`, `POST`, `PUT`, `DELETE` en `/alumnos`).
        - [x] Cursos - Crear endpoint para obtener agrupaciones lógicas de exámenes por curso (`GET /cursos`).
        - [ ] Cursos CRUD - Completar POST, PUT, DELETE /cursos (hoy solo existe GET - *POST ya implementado*).
        - [ ] Perfil Profesor - Endpoint para editar datos del profesor logueado (PUT /profesor/me).

    Frontend (evalia-frontend)

        - [x] UI - Crear página y ruteo de Vista de Cursos (`/cursos`).
        - [x] UI - Crear página de Detalle de Curso (`/cursos/[id]`).                            
        - [ ] UI - Desarrollar formulario y tabla de datos para CRUD de Alumnos y Perfil. (Postergado: Edición de perfil docente)
        - [x] Routing Real - Migrar navegación interna de setScreen a router.push/<Link>/useParams en Cursos, Alumnos y Exámenes.
        - [x] Edición de Alumno - Crear ruta /alumnos/[id]/editar (la lógica ya existe, falta la página).
        - [x] Estados Vacíos - Agregar estado vacío en /cursos y /alumnos sin datos cargados.

2.2: Exámenes y Subida de Entregas

    Specs & Contratos (OpenSpec)

        - Definir openspec para creación de evaluaciones, manejo del campo `esEvaluacionVisual` y carga de PDF.

    Backend (evalia-backend)

        - [ ] Exámenes - Endpoints CRUD para Exámenes y Preguntas (incluyendo criterios adicionales de IA y flag `esEvaluacionVisual` - *POST y GET implementados*).
        - [x] Entregas - Endpoint de subida de archivos de entrega (PDF/imágenes) y procesamiento multipart.
        - [x] Entregas - Implementar máquina de estados del ciclo de entrega (`PENDIENTE` ──► `PROCESANDO` ──► `REQUIERE_REVISION` / `PENDIENTE_APROBACION` ──► `PUBLICADO`).

    Frontend (evalia-frontend)

        - [x] UI - Ruteo y Vista de Exámenes (`/examenes`).
        - [x] UI - Formulario de creación/edición de Exámenes (manual) y agregar criterios adicionales de corrección.
        - [x] UI - Componente de Subida de Entregas (Carga de PDF e imágenes con cámara móvil).
        - [x] Alta de Examen - Crear el flujo/ruta que genera el examen inicial antes de elegir método (manual/IA).
        - [ ] Gestión de Examen - Agregar edición, eliminación y duplicado de examen. (Postergado al Sprint 2)
        - [x] Validación de Puntaje - Validar que el puntaje total de las preguntas sume el máximo esperado, con aviso visual.


3 - Motores de IA

3.1: Procesamiento de IA (Integración)

    Specs & Contratos (OpenSpec)

        - Definir openspec para el Generador de Consignas (Carga Inteligente).
        - Definir openspec para el JSON de respuesta de IA (notaIA, nivelConfianza, feedbackJSON, etc).
    
    Backend (evalia-backend)

        - [x] IA - Implementar endpoint y prompt de "Carga Inteligente de Examen" (Generador de Consignas y respuestas esperadas).
        - [x] IA - Configurar cliente principal de la IA (Gemini API).
        - [x] IA - Implementar Mecanismo de Fallback (Gemini API ──► OpenRouter) ante cuotas agotadas o errores.
        - [x] IA - Implementar Guardrails para forzar/validar que la salida de la IA sea siempre un JSON estricto válido.
        - [x] IA - Servicio de Corrección: Procesar texto/imágenes, evaluar contra rúbrica, y devolver puntaje/observaciones.
        - [x] IA - Lógica de revisión: Marcar entrega como `REQUIERE_REVISION` si `nivelConfianza` es bajo o tiene preguntas gráficas (`esEvaluacionVisual`).
        - [x] Subida para Carga Inteligente - Endpoint propio de subida/extracción de texto (PDF/DOCX) para el examen fuente del generador de consignas, separado del endpoint de entregas.
    
    Frontend (evalia-frontend)

        - [x] UI - Modal/Pantalla para "Carga Inteligente" (pegar texto del examen) y vista para editar las consignas generadas antes de guardar.
        - [x] UI - Vista de Revisión de Corrección Asistida (comparar nota IA vs nota final, mostrar `nivelConfianza`, métricas de certidumbre).
        - [x] UI - Indicador visual y flujo manual para preguntas gráficas o de baja confianza.
        - [x] UI - Botón y flujo para Aprobar Corrección (transición final a `PUBLICADO`).
        - [x] Loading Real de Procesamiento - Atar la pantalla de "Analizando/Detectando..." al estado real de la respuesta de IA en vez de un timer fijo.
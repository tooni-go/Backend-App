# EvalIA

> Aplicación web de asistencia inteligente para la corrección de exámenes escritos.

EvalIA utiliza Inteligencia Artificial para analizar exámenes manuscritos, generar una sugerencia de corrección y brindar observaciones por pregunta.

La IA funciona como asistente: **la decisión final siempre pertenece al docente**.

---

# Problema

Los docentes dedican muchas horas a corregir exámenes escritos manualmente. 
Esto retrasa la devolución de resultados y aumenta la carga de trabajo fuera del horario escolar.

---

# Objetivo

Desarrollar una aplicación web que permita asistir al docente durante la corrección mediante IA, reduciendo el tiempo necesario para evaluar exámenes escritos sin reemplazar el criterio profesional.

---

# Público objetivo

- Profesores de nivel secundario.

El portal para alumnos queda fuera del MVP.

---

# Alcance del MVP

El profesor podrá:

- Iniciar sesión con Google.
- Crear cursos.
- Registrar alumnos dentro de cursos.
- Crear exámenes.
- Crear preguntas manualmente.
- Crear exámenes mediante Carga Inteligente.
- Subir documentos o imágenes del examen.
- Obtener una sugerencia de corrección mediante IA.
- Revisar y modificar la nota.
- Aprobar la corrección final.

---

# Creación de exámenes

El profesor podrá crear un examen de dos formas:

## Creación manual

Ingresando:

- título;
- materia;
- curso;
- fecha;
- preguntas;
- respuestas esperadas;
- puntaje máximo por pregunta.

El puntaje total se calculará automáticamente sumando los puntajes asignados por el docente.

---

## Carga Inteligente

El profesor podrá:

- pegar el contenido del examen;
- subir un archivo Word;
- subir un PDF.

La IA generará:

- preguntas;
- respuestas esperadas;
- puntajes sugeridos.

Antes de guardar, el docente podrá revisar y modificar la información generada.

---

# Flujo principal

```text
Login
  │
  ▼
Dashboard
  │
  ▼
Cursos
  │
  ▼
Seleccionar curso
  │
  ▼
Crear examen
  │
  ├── Manual
  │
  └── Carga Inteligente
          │
          ▼
      Revisar examen
          │
          ▼
      Crear entrega
          │
          ▼
      Procesamiento IA
          │
          ▼
      Revisión docente
          │
          ▼
      Aprobar corrección
```

---

# Corrección mediante IA

La IA analiza:

- imágenes del examen;
- documentos PDF;
- respuestas del alumno.

Devuelve:

- texto detectado;
- nivel de confianza;
- puntaje sugerido;
- observaciones por pregunta.

El docente puede modificar cualquier resultado antes de aprobarlo.

---

# Preguntas especiales

Si una pregunta requiere analizar:

- gráficos;
- dibujos;
- esquemas;
- trazados manuscritos complejos;

la IA marcará la pregunta para revisión manual.

---

# Arquitectura

```text
              Profesor

                  │

        Frontend (Next.js)

                  │

            REST API

                  │

          Backend (NestJS)

          ┌───────────────┐
          │               │
          ▼               ▼

     Prisma + SQLite   Gemini API

                          │

                 Fallback OpenRouter
```

---

# Tecnologías

## Frontend

- Next.js
- React
- Tailwind CSS
- Auth.js

## Backend

- NestJS
- Prisma ORM

## Base de datos

- SQLite

## Inteligencia Artificial

- Gemini API
- OpenRouter como fallback

---

# Modelo de datos

## Profesor

- id
- nombre
- email
- googleId


## Curso

- id
- profesorId
- materia
- año
- división
- añoLectivo


## Alumno

- id
- cursoId
- nombre
- legajo


## Examen

- id
- cursoId
- título
- fecha


## Pregunta

- id
- examenId
- enunciado
- respuestaEsperada
- puntajeMáximo
- criteriosIA
- evaluaciónVisual


## Entrega

- id
- examenId
- alumnoId
- archivos
- estado


## Corrección

- id
- entregaId
- notaIA
- notaFinal
- nivelConfianza
- feedback

---

# Estados de una entrega

```text
PENDIENTE

    ↓

PROCESANDO

    ↓

PENDIENTE_APROBACION

    ↓

PUBLICADO


PROCESANDO

    ↓

REQUIERE_REVISION
```

---

# Mecanismo de Fallback

Gemini será el proveedor principal.

Si ocurre:

- límite de cuota;
- timeout;
- error del servicio;

el backend utilizará automáticamente OpenRouter.

El cambio será transparente para el usuario.

---

# User Stories

## Profesor

Como profesor quiero:

- iniciar sesión con Google;
- crear cursos;
- registrar alumnos;
- crear exámenes;
- utilizar IA para generar preguntas;
- subir entregas;
- obtener una sugerencia de corrección;
- modificar la nota;
- aprobar la corrección final.

---

# Futuras mejoras

- Portal para alumnos.
- Aplicación móvil.
- Estadísticas de rendimiento.
- Exportación de informes.
- Integración con plataformas educativas.

---

# Propuesta de valor

EvalIA no reemplaza al docente.

La IA analiza, sugiere y explica.

**El profesor siempre decide.**
````

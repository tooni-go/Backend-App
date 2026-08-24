# db-schema Specification

## Purpose
Define the hierarchical relational data models for EvalIA (Profesor, Curso, Alumno, Examen, Pregunta, Entrega, Correccion) using Prisma ORM with SQLite for development and PostgreSQL for production.

## Requirements

### Requirement: Database Schema Definition
The database schema MUST be defined using Prisma ORM with SQLite for development and PostgreSQL support for production, structuring the relationships hierarchically.

#### Scenario: Verify schema definitions
- **WHEN** the Prisma schema is validated
- **THEN** the schema contains models for:
  - Profesor (id, nombre, email, googleId, relación con Curso)
  - Curso (id, materia, anio, division, anioLectivo, profesorId, relación con Profesor, Alumno y Examen)
  - Alumno (id, nombre, legajo, relación con Curso)
  - Examen (id, título, fecha, cursoId, relación con Curso, Pregunta y Entrega)
  - Pregunta (id, examenId, enunciado, respuestaEsperada, puntajeMáximo, criteriosIA, esEvaluacionVisual, relación con Examen)
  - Entrega (id, examenId, alumnoId, archivo, estado, relación con Examen, Alumno y Corrección)
  - Corrección (id, entregaId, notaIA, notaFinal, nivelConfianza, feedbackJSON, fechaAprobación, relación con Entrega)

### Requirement: Submission State Validation
The system MUST validate that any change to the status of an `Entrega` conforms to the allowed states: `PENDIENTE`, `PROCESANDO`, `REQUIERE_REVISION`, `PENDIENTE_APROBACION`, and `PUBLICADO`.

#### Scenario: Transition to valid state
- **WHEN** updating an Entrega status to a valid value
- **THEN** the update succeeds and the new state is saved.

## ADDED Requirements

### Requirement: Database Schema Definition
The database schema MUST be defined using Prisma ORM with SQLite for development and PostgreSQL support for production.

#### Scenario: Verify schema definitions
- **WHEN** the Prisma schema is validated
- **THEN** the schema contains models for Profesor, Alumno, Examen, Pregunta, Entrega, and Correccion with all fields, relations, and indexes.

### Requirement: Submission State Validation
The system MUST validate that any change to the status of an `Entrega` conforms to the allowed states: `PENDIENTE`, `PROCESANDO`, `REQUIERE_REVISION`, `PENDIENTE_APROBACION`, and `PUBLICADO`.

#### Scenario: Transition to valid state
- **WHEN** updating an Entrega status to a valid value
- **THEN** the update succeeds and the new state is saved.

# submissions-api Specification

## Purpose
Provide REST API endpoints for managing courses, registering students and exams, handling submission file uploads with background AI correction, and processing teacher approval workflows.

## Requirements

### Requirement: File Upload Endpoint
The REST API MUST provide a POST endpoint at `/api/v1/entregas` to accept image (JPG, PNG, WEBP) or PDF files for a given Exam and Student.

#### Scenario: File upload and processing initiation
- **WHEN** a valid JPG, PNG, or PDF file is uploaded with examId and alumnoId
- **THEN** the system saves the file, creates an Entrega record with status PENDIENTE, saves the path in the `archivo` field, and initiates AI processing.

### Requirement: Get Submission Details
The REST API MUST provide a GET endpoint at `/api/v1/entregas/:id` to retrieve details and correction suggestions.

#### Scenario: Fetch submission details
- **WHEN** requesting a valid entrega ID
- **THEN** the system returns the metadata, the `archivo` reference, the Entrega status, and any linked Correccion record including `nivelConfianza` and `feedbackJSON`.

### Requirement: Teacher Correction Approval
The REST API MUST provide a PUT endpoint at `/api/v1/entregas/:id/aprobar` to allow the teacher to save final scores, observations, and set the status to PUBLICADO.

#### Scenario: Approve correction
- **WHEN** the teacher submits final grades and observations
- **THEN** the system updates the Correccion record, sets the status of the Entrega to PUBLICADO, and saves the `fechaAprobación`.

### Requirement: Course Management Endpoints
The REST API MUST provide endpoints for creating courses and fetching all courses for a teacher.

#### Scenario: Create a new course
- **WHEN** a teacher creates a course (POST `/api/v1/cursos`) with materia, anio, division, and anioLectivo
- **THEN** the course is saved in the database associated with the teacher.

#### Scenario: Fetch courses for a teacher
- **WHEN** fetching courses (GET `/api/v1/cursos`)
- **THEN** the system returns all courses managed by the authenticated teacher.

### Requirement: Course Student and Exam Registration
The REST API MUST provide endpoints to register students and exams belonging to a specific course.

#### Scenario: Register a student in a course
- **WHEN** adding a student to a course (POST `/api/v1/cursos/:id/alumnos`) with name and legajo
- **THEN** the student is created/registered and linked to the course.

#### Scenario: Create an exam for a course
- **WHEN** creating an exam inside a course (POST `/api/v1/cursos/:id/examenes`) with titulo and questions
- **THEN** the exam and its questions are created and linked to the course.

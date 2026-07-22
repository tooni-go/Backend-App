## ADDED Requirements

### Requirement: File Upload Endpoint
The REST API MUST provide a POST endpoint at `/api/v1/entregas` to accept image (JPG, PNG, WEBP) or PDF files for a given Exam and Student.

#### Scenario: File upload and processing initiation
- **WHEN** a valid JPG, PNG, or PDF file is uploaded with examId and alumnoId
- **THEN** the system saves the file, creates an Entrega record with status PENDIENTE, and initiates AI processing.

### Requirement: Get Submission Details
The REST API MUST provide a GET endpoint at `/api/v1/entregas/:id` to retrieve details and correction suggestions.

#### Scenario: Fetch submission details
- **WHEN** requesting a valid entrega ID
- **THEN** the system returns the metadata, files, and any linked AI grading suggestion.

### Requirement: Teacher Correction Approval
The REST API MUST provide a PUT endpoint at `/api/v1/entregas/:id/aprobar` to allow the teacher to save final scores, observations, and set the status to PUBLICADO.

#### Scenario: Approve correction
- **WHEN** the teacher submits final grades and observations
- **THEN** the system updates the Correccion record, sets the status of the Entrega to PUBLICADO, and saves the approval timestamp.

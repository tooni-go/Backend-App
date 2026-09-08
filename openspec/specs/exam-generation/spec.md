# exam-generation Specification

## Purpose
Provide intelligent exam generation capabilities allowing teachers to submit prompts, syllabus topics, or documents (PDF, TXT, images) to automatically produce structured exams with expected model answers and scoring criteria.

## Requirements

### Requirement: Smart Exam Generation Endpoint
The system MUST provide a POST endpoint at `/api/v1/examenes/generar` accepting text prompts or uploaded files to generate a structured exam.

#### Scenario: Generate exam from plain text consignas
- **WHEN** a teacher sends a text prompt with exam topics or instructions via JSON or multipart form
- **THEN** the system generates a structured exam JSON containing a title and a list of questions with expected answers, maximum score, and visual evaluation flag.

#### Scenario: Generate exam from uploaded file
- **WHEN** a teacher uploads a valid file (PDF, TXT, JPG, PNG, or WEBP)
- **THEN** the system processes the file content using AI vision/document analysis and returns the structured exam.

#### Scenario: Unsupported file format
- **WHEN** a file with an unsupported MIME type is sent
- **THEN** the system rejects the request with a 400 Bad Request status code.

### Requirement: AI Resilience and Fallback for Exam Generation
The system SHALL attempt exam generation with the primary Gemini API provider (with a 15-second timeout) and automatically fallback to OpenRouter upon failure.

#### Scenario: Gemini failure fallback
- **WHEN** Gemini API times out or returns an error (429, 500, 503)
- **THEN** the request is seamlessly sent to OpenRouter and the generated result is validated.

#### Scenario: Total AI provider failure
- **WHEN** both Gemini and OpenRouter fail
- **THEN** the system returns an explicit error without returning simulated or fake exam data.

### Requirement: Structured Output Schema Validation
The AI output MUST be validated against `GeneratedExamSchema` before being returned to the client.

#### Scenario: Output adheres to required structure
- **WHEN** the AI response is received
- **THEN** the system verifies that `titulo` is a non-empty string and `preguntas` is a non-empty array of questions, each with `enunciado`, `respuestaEsperada`, `puntajeMaximo` (between 1 and 100), `criteriosIA` (non-empty string), and boolean `esEvaluacionVisual`.

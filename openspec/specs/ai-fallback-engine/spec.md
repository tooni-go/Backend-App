# ai-fallback-engine Specification

## Purpose
Provide a resilient AI grading and evaluation engine integrating Gemini API as the primary provider with automatic transparent fallback to OpenRouter, enforcing strict JSON output validation, confidence scoring, and state transitions.

## Requirements

### Requirement: Primary AI Grading Request
The system SHALL request exam grading suggestions from the Gemini API using multimodal analysis (supporting image/jpeg, image/png, image/webp, and application/pdf).

#### Scenario: Successful Gemini response
- **WHEN** Gemini API is healthy and returns structured evaluation within the 15-second timeout
- **THEN** the system parses the grading suggestions and does not trigger fallback.

### Requirement: AI Fallback Activation
The system SHALL intercept failures from Gemini API and route the grading request to OpenRouter.

#### Scenario: Gemini quota exceeded, offline, or timed out
- **WHEN** Gemini API returns error 429 (quota exceeded), 500/503 (server error), or times out after 15 seconds
- **THEN** the request is automatically retried using OpenRouter (e.g. `openai/gpt-4o-mini` or compatible vision model) without exposing the error to the client.

### Requirement: Structured AI Grading JSON Contract
The system MUST validate the JSON output received from either AI provider against a strict Zod schema before processing.

#### Scenario: AI Response Schema validation
- **WHEN** the AI produces its evaluation JSON
- **THEN** it must contain:
  - `notaIA`: Non-negative float representing the total suggested grade (sum of individual question scores).
  - `nivelConfianza`: Enum with allowed values `"BAJO"`, `"MEDIO"`, `"ALTO"`.
  - `preguntas`: Array of question evaluation objects, each containing:
    - `preguntaId`: String matching the database ID of the evaluated question.
    - `textoDetectado`: String with transcription of the student's handwritten response.
    - `observaciones`: String with detailed rationale explaining points awarded/deducted compared to `respuestaEsperada`.
    - `puntajeSugerido`: Non-negative float score between 0 and `puntajeMaximo`.

### Requirement: Persistence in Correccion Entity
When an evaluation succeeds, the system MUST persist the structured evaluation data into the `Correccion` record associated with the `Entrega`.

#### Scenario: Save AI evaluation to Correccion record
- **WHEN** a valid AI evaluation is generated
- **THEN** a `Correccion` record is created or updated containing:
  - `notaIA`: Storing the suggested grade from the AI.
  - `nivelConfianza`: Storing the confidence level (`"BAJO"`, `"MEDIO"`, or `"ALTO"`).
  - `feedbackJSON`: Storing the complete serialized JSON evaluation (including per-question `textoDetectado`, `observaciones`, and `puntajeSugerido`).

### Requirement: State Transition Rules
The system MUST evaluate the confidence level and exam attributes to set the appropriate `Entrega` state.

#### Scenario: Schema validation success and high/medium confidence without visual questions
- **WHEN** the AI response JSON matches the required grading schema, `nivelConfianza` is `"ALTO"` or `"MEDIO"`, and none of the exam questions have `esEvaluacionVisual = true`
- **THEN** the submission status is set to `PENDIENTE_APROBACION`.

#### Scenario: Low confidence returned by AI
- **WHEN** the AI response JSON is valid but `nivelConfianza` is `"BAJO"`
- **THEN** the submission status is set to `REQUIERE_REVISION`.

#### Scenario: Exam contains visual questions
- **WHEN** any question in the exam has `esEvaluacionVisual = true`
- **THEN** the submission status is set to `REQUIERE_REVISION` (forcing teacher manual review).

#### Scenario: Schema validation failure or catastrophic AI error
- **WHEN** the AI response is not valid JSON, fails Zod schema validation, or both providers fail
- **THEN** the submission status is set to `REQUIERE_REVISION` and evaluation is set to null, allowing manual teacher correction.

## ADDED Requirements

### Requirement: Primary AI Grading Request
The system SHALL request exam grading suggestions from Gemini API.

#### Scenario: Successful Gemini response
- **WHEN** Gemini API is healthy and returns the structured evaluation
- **THEN** the system parses the grading suggestions and does not trigger fallback.

### Requirement: AI Fallback Activation
The system SHALL intercept failures from Gemini API and route the grading request to OpenRouter.

#### Scenario: Gemini quota exceeded or offline
- **WHEN** Gemini API returns error 429, 500, 503, or times out (exceeds 15 seconds)
- **THEN** the request is automatically retried using OpenRouter client without exposing the error to the user.

### Requirement: JSON Response Validation
The system MUST validate the JSON output received from either AI provider to ensure it contains: text detected, legibility flag, suggested scores, and observations per question.

#### Scenario: Schema validation success
- **WHEN** the AI response JSON matches the required grading schema and legibility is true
- **THEN** the submission status is set to PENDIENTE_APROBACION.

#### Scenario: Schema validation failure or illegible
- **WHEN** the AI response JSON is invalid or legibility is marked false
- **THEN** the submission status is set to REQUIERE_REVISION.

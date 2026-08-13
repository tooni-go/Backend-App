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

### Requirement: JSON Response Validation and State Transition
The system MUST validate the JSON output received from either AI provider and evaluate the confidence level and exam attributes to set the appropriate `Entrega` state.

#### Scenario: Schema validation success and high confidence
- **WHEN** the AI response JSON matches the required grading schema, the confidence level is high or medium, and there are no visual questions (`esEvaluacionVisual = false`)
- **THEN** the submission status is set to PENDIENTE_APROBACION.

#### Scenario: Low confidence returned by AI
- **WHEN** the AI response JSON is valid but the confidence level returned is low
- **THEN** the submission status is set to REQUIERE_REVISION.

#### Scenario: Exam contains visual questions
- **WHEN** the exam contains visual questions (`esEvaluacionVisual = true`)
- **THEN** the submission status is set to REQUIERE_REVISION (forcing teacher validation).

#### Scenario: Schema validation failure
- **WHEN** the AI response is not valid JSON or does not match the expected structure
- **THEN** the submission status is set to REQUIERE_REVISION.

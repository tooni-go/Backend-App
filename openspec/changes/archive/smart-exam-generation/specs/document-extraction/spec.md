# document-extraction Specification

## Purpose
Provide a dedicated document text extraction capability allowing teachers to upload files (TXT, DOCX, PDF, images) and obtain raw transcribed text for review and editing before initiating AI-assisted exam generation.

## Requirements

### Requirement: Dedicated Document Text Extraction Endpoint
The system MUST provide a POST endpoint at `/api/v1/documentos/extraer-texto` accepting a single file in `multipart/form-data` with the field `file`.

#### Scenario: Deterministic extraction from plain text file (TXT)
- **WHEN** a teacher uploads a `.txt` file (`text/plain`)
- **THEN** the system extracts the text directly from the buffer without invoking external AI services, returning `fuenteTipo: 'txt'` and `requiereRevision: false`.

#### Scenario: Deterministic extraction from Word document (DOCX)
- **WHEN** a teacher uploads a `.docx` file (`application/vnd.openxmlformats-officedocument.wordprocessingml.document`)
- **THEN** the system extracts the text deterministically using `mammoth` without invoking external AI services, returning `fuenteTipo: 'docx'` and `requiereRevision: false`.

#### Scenario: AI-assisted text extraction from PDF document
- **WHEN** a teacher uploads a `.pdf` file (`application/pdf`)
- **THEN** the system transcribes the content using AI vision/document processing with faithful verbatim transcription, returning `fuenteTipo: 'pdf'` and `requiereRevision: true`.

#### Scenario: AI-assisted text extraction from image files
- **WHEN** a teacher uploads an image file (`image/jpeg`, `image/png`, `image/webp`)
- **THEN** the system transcribes all visible handwritten or printed text using AI vision, returning `fuenteTipo: 'imagen'` and `requiereRevision: true`.

#### Scenario: Blank, blurry, or unreadable document/image
- **WHEN** the uploaded document or image contains no legible text
- **THEN** the system returns `textoExtraido: ''` with `requiereRevision: true` without generating fabricated or placeholder content.

#### Scenario: Missing file in request
- **WHEN** a request is submitted without an attached file in the `file` field
- **THEN** the system rejects the request with a 400 Bad Request status code.

#### Scenario: Unsupported MIME type
- **WHEN** a file with an unsupported MIME type is submitted
- **THEN** the system rejects the request with a 400 Bad Request status code indicating the accepted formats.

#### Scenario: File size exceeding maximum limit
- **WHEN** an uploaded file exceeds the configured maximum upload size (`MAX_UPLOAD_SIZE_MB`)
- **THEN** the system rejects the request with a 400 Bad Request status code.

### Requirement: AI Resilience and Fallback for Text Extraction
The system SHALL attempt AI text extraction using the primary Gemini API provider and automatically fallback to OpenRouter upon failure (timeout, 429 quota, or 5xx server errors).

#### Scenario: Gemini failure fallback
- **WHEN** Gemini API times out or fails
- **THEN** the extraction request is transparently retried with OpenRouter.

#### Scenario: Total AI provider failure
- **WHEN** both Gemini and OpenRouter fail
- **THEN** the system returns an explicit 500 error without returning fake transcribed data.

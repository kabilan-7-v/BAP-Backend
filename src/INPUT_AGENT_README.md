# Input Agent - Phase 1

## Overview

The Input Agent is a critical component responsible for receiving, processing, and normalizing multimodal user inputs (text, voice, files) into a unified format that can be consumed by the Planner Agent.

## Architecture

### Core Components

1. **Input Reception Layer**
   - Text Input Handler (`text-input-handler.service.ts`)
   - Voice Input Handler (`voice-input-handler.service.ts`)
   - File Input Handler (`file-input-handler.service.ts`)
   - Asset Context Handler (`asset-context-handler.service.ts`)

2. **Processing Pipeline**
   - Envelope Generator (`envelope-generator.service.ts`)
   - Context Aggregator (`context-aggregator.service.ts`)
   - Audit Logger (`audit-logger.service.ts`)

3. **Output Interface**
   - Planner Agent Service (`planner-agent.service.ts`)

## API Endpoints

### Text Input
```
POST /api/input-agent/text
```
Process text input and generate an envelope.

**Request Body:**
```json
{
  "text": "User message",
  "session_id": "uuid",
  "asset_context": [{ "asset_id": "...", "data_item": "..." }],
  "send_to_planner": true
}
```

### Voice Input

#### Start Voice Session
```
POST /api/input-agent/voice/start
```
Start a voice streaming session.

**Request Body:**
```json
{
  "session_id": "uuid",
  "conversation_id": "optional-uuid",
  "config": {
    "sample_rate": 16000,
    "bit_depth": 16,
    "channels": 1,
    "codec": "opus",
    "vad_enabled": true
  }
}
```

#### End Voice Session
```
POST /api/input-agent/voice/end
```
End voice session and get final transcript.

**Request Body:**
```json
{
  "session_id": "uuid",
  "asset_context": [],
  "send_to_planner": true
}
```

### File Upload
```
POST /api/input-agent/file
```
Upload and process files.

**Form Data:**
- `session_id`: Required session identifier
- `files`: One or more files
- `asset_context`: Optional JSON string
- `send_to_planner`: "true" or "false"

```
GET /api/input-agent/file
```
Get supported file types and limits.

### Multimodal Input
```
POST /api/input-agent/multimodal
```
Process combined text, voice transcript, files, and asset context.

**Request Body (JSON):**
```json
{
  "session_id": "uuid",
  "text": "Optional text",
  "voice_transcript": "Optional transcript",
  "asset_ids": ["uuid1", "uuid2"],
  "send_to_planner": true
}
```

### Envelope Management
```
GET /api/input-agent/envelope?session_id=xxx&envelope_id=xxx&limit=50
```
Retrieve envelopes by session or ID.

### Planner Integration
```
POST /api/input-agent/planner
```
Send envelope to Planner Agent.

**Request Body:**
```json
{
  "envelope_id": "uuid"
}
```

```
GET /api/input-agent/planner
```
Get Planner Agent status.

### Audit Logs
```
GET /api/input-agent/audit?session_id=xxx&type=errors|all|analytics
```
Retrieve audit logs for compliance and analytics.

## Socket.IO Events

### Voice Streaming

**Client to Server:**
- `input:voice:start` - Start voice session
- `input:voice:chunk` - Send audio chunk
- `input:voice:end` - End session and get transcript
- `input:voice:cancel` - Cancel session
- `input:voice:status` - Get session status

**Server to Client:**
- `input:voice:started` - Session started confirmation
- `input:voice:transcript` - Interim/final transcript
- `input:voice:ended` - Session ended confirmation
- `input:voice:cancelled` - Session cancelled confirmation

### Text Input

**Client to Server:**
- `input:text:send` - Process text input

**Server to Client:**
- `input:text:processed` - Text processed confirmation

### Multimodal Input

**Client to Server:**
- `input:multimodal:send` - Process multimodal input

**Server to Client:**
- `input:multimodal:processed` - Input processed confirmation
- `input:planner:response` - Planner Agent response

## Unified Input Envelope Structure

```json
{
  "envelope_id": "uuid",
  "timestamp": "ISO 8601 date string",
  "user_id": "string",
  "session_id": "string",
  "input_type": "text|voice|file|multimodal",
  "content": {
    "text": "string",
    "transcript": {
      "raw": "string",
      "interim": ["array of strings"],
      "final": "string",
      "confidence": 0.95,
      "speaker_info": {
        "speaker_id": "string",
        "diarization": true
      }
    },
    "files": [{
      "id": "uuid",
      "name": "string",
      "type": "mime-type",
      "size": 12345,
      "url": "string"
    }],
    "asset_context": [{
      "asset_id": "uuid",
      "data_item": "string",
      "metadata": {}
    }]
  },
  "metadata": {
    "voice_mode_active": true,
    "interaction_method": "typing|speaking|upload",
    "client_info": {}
  }
}
```

## Configuration

### Environment Variables

Add these to your `.env.local`:

```env
# Planner Agent
PLANNER_AGENT_URL=http://localhost:3003/api/planner
PLANNER_AGENT_API_KEY=your-api-key
PLANNER_AGENT_TIMEOUT=30000

# File Storage (implement your own)
FILE_STORAGE_URL=http://localhost:3001/uploads
```

### Default Limits

- **Max File Size:** 100MB
- **Max Files per Conversation:** 50
- **Max Audio Duration:** 5 minutes
- **Voice Latency Target:** < 300ms
- **Text Processing Timeout:** < 100ms
- **Envelope Generation Timeout:** < 50ms

### Supported File Types

- PDF (`application/pdf`)
- Word Documents (`.doc`, `.docx`)
- Excel Spreadsheets (`.xls`, `.xlsx`)
- Plain Text (`.txt`)
- CSV (`.csv`)
- Images (`.jpg`, `.png`, `.gif`, `.webp`)

## Error Codes

| Code | Description | Recoverable |
|------|-------------|-------------|
| `ASR_FAILURE` | Speech-to-text processing failed | Yes |
| `AUDIO_STREAM_ERROR` | Audio stream connection issue | Yes |
| `DIARIZATION_ERROR` | Speaker identification failed | Yes |
| `UNSUPPORTED_FORMAT` | File type not supported | Yes |
| `FILE_TOO_LARGE` | File exceeds size limit | Yes |
| `FILE_CORRUPTED` | File validation failed | Yes |
| `ASSET_CONNECTION_FAILURE` | Asset service unavailable | Yes |
| `ASSET_PERMISSION_DENIED` | No access to asset | No |
| `PROCESSING_TIMEOUT` | Request took too long | Yes |
| `VALIDATION_ERROR` | Invalid input data | Yes |

## TODO: Integrations Required

1. **ASR Service (Whisper V3)**
   - Integrate with OpenAI Whisper API or self-hosted instance
   - Update `voice-input-handler.service.ts` - `processASR()` method

2. **File Storage**
   - Implement file upload to S3, GCS, or Azure Blob
   - Update `file-input-handler.service.ts` - `uploadToStorage()` method
   - Add AES-256 encryption before storage

3. **Asset Service**
   - Connect to enterprise asset/data sources
   - Update `asset-context-handler.service.ts` - `fetchAssetData()` method
   - Implement permission checks

4. **Planner Agent**
   - Deploy or connect to Planner Agent service
   - Configure `PLANNER_AGENT_URL` and `PLANNER_AGENT_API_KEY`

## Database Models

- `InputEnvelope` - Stores all processed envelopes
- `AuditLog` - Records all input activities
- `VoiceSession` - Manages voice streaming sessions

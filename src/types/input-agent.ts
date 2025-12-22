/**
 * Input Agent Types - Phase 1
 * Unified envelope structure for multimodal input processing
 */

// =============================================================================
// ENUMS & CONSTANTS
// =============================================================================

export type InputType = 'text' | 'voice' | 'file' | 'multimodal';
export type InteractionMethod = 'typing' | 'speaking' | 'upload';
export type ProcessingStatus = 'pending' | 'processing' | 'completed' | 'failed';

// =============================================================================
// TRANSCRIPT TYPES (Voice Processing)
// =============================================================================

export interface SpeakerInfo {
    speaker_id: string;
    diarization: boolean;
    confidence?: number;
}

export interface Transcript {
    raw: string;
    interim: string[];
    final: string;
    confidence: number;
    speaker_info?: SpeakerInfo;
    language?: string;
    duration_ms?: number;
}

// =============================================================================
// FILE TYPES
// =============================================================================

export interface InputFile {
    id: string;
    name: string;
    type: string; // MIME type
    size: number; // bytes
    url: string;
    checksum?: string;
    extracted_text?: string;
    metadata?: Record<string, any>;
}

// =============================================================================
// ASSET CONTEXT TYPES
// =============================================================================

export interface AssetContext {
    asset_id: string;
    data_item: string;
    metadata: Record<string, any>;
    last_updated?: string;
}

// =============================================================================
// INPUT CONTENT STRUCTURE
// =============================================================================

export interface InputContent {
    text?: string;
    transcript?: Transcript;
    files?: InputFile[];
    asset_context?: AssetContext[];
}

// =============================================================================
// METADATA TYPES
// =============================================================================

export interface ClientInfo {
    user_agent?: string;
    platform?: string;
    browser?: string;
    ip_address?: string;
    device_type?: 'desktop' | 'mobile' | 'tablet';
}

export interface InputMetadata {
    voice_mode_active: boolean;
    interaction_method: InteractionMethod;
    client_info?: ClientInfo;
    processing_time_ms?: number;
    retry_count?: number;
}

// =============================================================================
// UNIFIED INPUT ENVELOPE
// =============================================================================

export interface InputEnvelope {
    envelope_id: string;
    timestamp: string;
    user_id: string;
    session_id: string;
    input_type: InputType;
    content: InputContent;
    metadata: InputMetadata;
    status?: ProcessingStatus;
    error?: InputError;
}

// =============================================================================
// ERROR HANDLING TYPES
// =============================================================================

export interface InputError {
    code: string;
    message: string;
    details?: Record<string, any>;
    recoverable: boolean;
    fallback_action?: string;
}

export type ErrorCode =
    | 'ASR_FAILURE'
    | 'AUDIO_STREAM_ERROR'
    | 'DIARIZATION_ERROR'
    | 'UNSUPPORTED_FORMAT'
    | 'FILE_TOO_LARGE'
    | 'FILE_CORRUPTED'
    | 'ASSET_CONNECTION_FAILURE'
    | 'ASSET_PERMISSION_DENIED'
    | 'PROCESSING_TIMEOUT'
    | 'VALIDATION_ERROR';

// =============================================================================
// API REQUEST/RESPONSE TYPES
// =============================================================================

export interface TextInputRequest {
    text: string;
    session_id: string;
    asset_context?: AssetContext[];
}

export interface VoiceInputRequest {
    audio_data: string; // Base64 encoded audio
    session_id: string;
    is_final: boolean;
    asset_context?: AssetContext[];
}

export interface FileInputRequest {
    session_id: string;
    asset_context?: AssetContext[];
}

export interface MultimodalInputRequest {
    text?: string;
    audio_data?: string;
    session_id: string;
    asset_context?: AssetContext[];
}

export interface InputEnvelopeResponse {
    success: boolean;
    envelope?: InputEnvelope;
    error?: InputError;
}

// =============================================================================
// VOICE STREAMING TYPES (WebSocket/Socket.IO)
// =============================================================================

export interface VoiceStreamConfig {
    sample_rate: number; // Default: 16000
    bit_depth: number;   // Default: 16
    channels: number;    // Default: 1 (mono)
    codec: 'opus' | 'pcm';
    vad_enabled: boolean;
}

export interface VoiceStreamChunk {
    session_id: string;
    chunk_id: string;
    audio_data: string; // Base64 encoded
    timestamp: number;
    is_speech: boolean;
    sequence_number: number;
}

export interface VoiceStreamResponse {
    chunk_id: string;
    interim_transcript?: string;
    final_transcript?: string;
    is_final: boolean;
    confidence?: number;
    error?: InputError;
}

// =============================================================================
// AUDIT LOG TYPES
// =============================================================================

export interface AuditLogEntry {
    id: string;
    timestamp: string;
    user_id: string;
    session_id: string;
    envelope_id: string;
    action: 'input_received' | 'processing_started' | 'processing_completed' | 'processing_failed' | 'sent_to_planner';
    input_type: InputType;
    metadata?: Record<string, any>;
}

// =============================================================================
// CONFIGURATION TYPES
// =============================================================================

export interface InputAgentConfig {
    max_file_size_bytes: number;        // Default: 100MB
    max_files_per_conversation: number; // Default: 50
    max_audio_duration_ms: number;      // Default: 300000 (5 min)
    supported_file_types: string[];
    voice_latency_target_ms: number;    // Default: 300
    text_processing_timeout_ms: number; // Default: 100
    envelope_generation_timeout_ms: number; // Default: 50
    retry_config: {
        max_retries: number;
        backoff_multiplier: number;
        initial_delay_ms: number;
    };
}

// Default configuration
export const DEFAULT_INPUT_AGENT_CONFIG: InputAgentConfig = {
    max_file_size_bytes: 100 * 1024 * 1024, // 100MB
    max_files_per_conversation: 50,
    max_audio_duration_ms: 300000, // 5 minutes
    supported_file_types: [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'text/plain',
        'text/csv',
        'image/jpeg',
        'image/png',
        'image/gif',
        'image/webp',
    ],
    voice_latency_target_ms: 300,
    text_processing_timeout_ms: 100,
    envelope_generation_timeout_ms: 50,
    retry_config: {
        max_retries: 3,
        backoff_multiplier: 2,
        initial_delay_ms: 1000,
    },
};

import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * Input Envelope Model - Phase 1
 * Stores all processed input envelopes for audit and analytics
 */

// =============================================================================
// INTERFACES
// =============================================================================

export interface ISpeakerInfo {
    speaker_id: string;
    diarization: boolean;
    confidence?: number;
}

export interface ITranscript {
    raw: string;
    interim: string[];
    final: string;
    confidence: number;
    speaker_info?: ISpeakerInfo;
    language?: string;
    duration_ms?: number;
}

export interface IInputFile {
    id: string;
    name: string;
    type: string;
    size: number;
    url: string;
    checksum?: string;
    extracted_text?: string;
    metadata?: Record<string, any>;
}

export interface IAssetContext {
    asset_id: string;
    data_item: string;
    metadata: Record<string, any>;
    last_updated?: Date;
}

export interface IInputContent {
    text?: string;
    transcript?: ITranscript;
    files?: IInputFile[];
    asset_context?: IAssetContext[];
}

export interface IClientInfo {
    user_agent?: string;
    platform?: string;
    browser?: string;
    ip_address?: string;
    device_type?: 'desktop' | 'mobile' | 'tablet';
}

export interface IInputMetadata {
    voice_mode_active: boolean;
    interaction_method: 'typing' | 'speaking' | 'upload';
    client_info?: IClientInfo;
    processing_time_ms?: number;
    retry_count?: number;
}

export interface IInputError {
    code: string;
    message: string;
    details?: Record<string, any>;
    recoverable: boolean;
    fallback_action?: string;
}

export interface IInputEnvelope extends Document {
    envelope_id: string;
    timestamp: Date;
    user_id: mongoose.Types.ObjectId;
    session_id: string;
    input_type: 'text' | 'voice' | 'file' | 'multimodal';
    content: IInputContent;
    metadata: IInputMetadata;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    error?: IInputError;
    sent_to_planner: boolean;
    planner_response_id?: string;
    createdAt: Date;
    updatedAt: Date;
}

// =============================================================================
// SCHEMAS
// =============================================================================

const SpeakerInfoSchema = new Schema<ISpeakerInfo>({
    speaker_id: { type: String, required: true },
    diarization: { type: Boolean, default: false },
    confidence: { type: Number, min: 0, max: 1 },
}, { _id: false });

const TranscriptSchema = new Schema<ITranscript>({
    raw: { type: String, default: '' },
    interim: [{ type: String }],
    final: { type: String, default: '' },
    confidence: { type: Number, min: 0, max: 1, default: 0 },
    speaker_info: SpeakerInfoSchema,
    language: { type: String },
    duration_ms: { type: Number },
}, { _id: false });

const InputFileSchema = new Schema<IInputFile>({
    id: { type: String, required: true },
    name: { type: String, required: true },
    type: { type: String, required: true },
    size: { type: Number, required: true },
    url: { type: String, required: true },
    checksum: { type: String },
    extracted_text: { type: String },
    metadata: { type: Schema.Types.Mixed },
}, { _id: false });

const AssetContextSchema = new Schema<IAssetContext>({
    asset_id: { type: String, required: true },
    data_item: { type: String, required: true },
    metadata: { type: Schema.Types.Mixed, default: {} },
    last_updated: { type: Date },
}, { _id: false });

const InputContentSchema = new Schema<IInputContent>({
    text: { type: String },
    transcript: TranscriptSchema,
    files: [InputFileSchema],
    asset_context: [AssetContextSchema],
}, { _id: false });

const ClientInfoSchema = new Schema<IClientInfo>({
    user_agent: { type: String },
    platform: { type: String },
    browser: { type: String },
    ip_address: { type: String },
    device_type: { type: String, enum: ['desktop', 'mobile', 'tablet'] },
}, { _id: false });

const InputMetadataSchema = new Schema<IInputMetadata>({
    voice_mode_active: { type: Boolean, default: false },
    interaction_method: {
        type: String,
        enum: ['typing', 'speaking', 'upload'],
        required: true
    },
    client_info: ClientInfoSchema,
    processing_time_ms: { type: Number },
    retry_count: { type: Number, default: 0 },
}, { _id: false });

const InputErrorSchema = new Schema<IInputError>({
    code: { type: String, required: true },
    message: { type: String, required: true },
    details: { type: Schema.Types.Mixed },
    recoverable: { type: Boolean, default: false },
    fallback_action: { type: String },
}, { _id: false });

const InputEnvelopeSchema = new Schema<IInputEnvelope>(
    {
        envelope_id: {
            type: String,
            required: true,
            unique: true,
            index: true
        },
        timestamp: { type: Date, required: true, default: Date.now },
        user_id: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true
        },
        session_id: {
            type: String,
            required: true,
            index: true
        },
        input_type: {
            type: String,
            enum: ['text', 'voice', 'file', 'multimodal'],
            required: true
        },
        content: { type: InputContentSchema, required: true },
        metadata: { type: InputMetadataSchema, required: true },
        status: {
            type: String,
            enum: ['pending', 'processing', 'completed', 'failed'],
            default: 'pending',
            index: true
        },
        error: InputErrorSchema,
        sent_to_planner: { type: Boolean, default: false },
        planner_response_id: { type: String },
    },
    {
        timestamps: true,
        collection: 'input_envelopes'
    }
);

// Compound indexes for efficient queries
InputEnvelopeSchema.index({ user_id: 1, session_id: 1 });
InputEnvelopeSchema.index({ session_id: 1, timestamp: -1 });
InputEnvelopeSchema.index({ status: 1, sent_to_planner: 1 });

// =============================================================================
// MODEL EXPORT
// =============================================================================

const InputEnvelope: Model<IInputEnvelope> =
    mongoose.models.InputEnvelope ||
    mongoose.model<IInputEnvelope>('InputEnvelope', InputEnvelopeSchema);

export default InputEnvelope;

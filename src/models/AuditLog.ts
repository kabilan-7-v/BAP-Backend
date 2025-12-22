import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * Audit Log Model - Phase 1
 * Comprehensive logging of all input activities for compliance and analytics
 */

export interface IAuditLog extends Document {
    audit_id: string;
    timestamp: Date;
    user_id: mongoose.Types.ObjectId;
    session_id: string;
    envelope_id?: string;
    action:
    | 'input_received'
    | 'processing_started'
    | 'processing_completed'
    | 'processing_failed'
    | 'sent_to_planner'
    | 'voice_stream_started'
    | 'voice_stream_ended'
    | 'file_uploaded'
    | 'file_processed'
    | 'asset_context_loaded'
    | 'error_occurred'
    | 'retry_attempted';
    input_type?: 'text' | 'voice' | 'file' | 'multimodal';
    metadata: {
        processing_time_ms?: number;
        file_count?: number;
        file_sizes?: number[];
        audio_duration_ms?: number;
        error_code?: string;
        error_message?: string;
        retry_count?: number;
        confidence_score?: number;
        ip_address?: string;
        user_agent?: string;
        [key: string]: any;
    };
    severity: 'info' | 'warning' | 'error' | 'critical';
    createdAt: Date;
}

const AuditLogSchema = new Schema<IAuditLog>(
    {
        audit_id: {
            type: String,
            required: true,
            unique: true,
            index: true
        },
        timestamp: { type: Date, required: true, default: Date.now, index: true },
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
        envelope_id: { type: String, index: true },
        action: {
            type: String,
            enum: [
                'input_received',
                'processing_started',
                'processing_completed',
                'processing_failed',
                'sent_to_planner',
                'voice_stream_started',
                'voice_stream_ended',
                'file_uploaded',
                'file_processed',
                'asset_context_loaded',
                'error_occurred',
                'retry_attempted',
            ],
            required: true,
            index: true
        },
        input_type: {
            type: String,
            enum: ['text', 'voice', 'file', 'multimodal']
        },
        metadata: { type: Schema.Types.Mixed, default: {} },
        severity: {
            type: String,
            enum: ['info', 'warning', 'error', 'critical'],
            default: 'info',
            index: true
        },
    },
    {
        timestamps: true,
        collection: 'audit_logs'
    }
);

// Compound indexes for efficient queries
AuditLogSchema.index({ user_id: 1, timestamp: -1 });
AuditLogSchema.index({ session_id: 1, timestamp: -1 });
AuditLogSchema.index({ action: 1, timestamp: -1 });
AuditLogSchema.index({ severity: 1, timestamp: -1 });

// TTL index for automatic cleanup (optional - 90 days retention)
// AuditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

const AuditLog: Model<IAuditLog> =
    mongoose.models.AuditLog ||
    mongoose.model<IAuditLog>('AuditLog', AuditLogSchema);

export default AuditLog;

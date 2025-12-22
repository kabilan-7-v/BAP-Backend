import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * Voice Session Model - Phase 1
 * Manages voice streaming sessions and their state
 */

export interface IVoiceSession extends Document {
    session_id: string;
    user_id: mongoose.Types.ObjectId;
    conversation_id?: string;
    status: 'active' | 'paused' | 'ended' | 'error';
    config: {
        sample_rate: number;
        bit_depth: number;
        channels: number;
        codec: 'opus' | 'pcm';
        vad_enabled: boolean;
    };
    stats: {
        total_audio_duration_ms: number;
        total_chunks_received: number;
        total_transcripts_generated: number;
        average_confidence: number;
        errors_count: number;
    };
    current_transcript: {
        interim: string[];
        final_segments: string[];
    };
    started_at: Date;
    ended_at?: Date;
    last_activity_at: Date;
    createdAt: Date;
    updatedAt: Date;
}

const VoiceSessionSchema = new Schema<IVoiceSession>(
    {
        session_id: {
            type: String,
            required: true,
            unique: true,
            index: true
        },
        user_id: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true
        },
        conversation_id: { type: String },
        status: {
            type: String,
            enum: ['active', 'paused', 'ended', 'error'],
            default: 'active',
            index: true
        },
        config: {
            sample_rate: { type: Number, default: 16000 },
            bit_depth: { type: Number, default: 16 },
            channels: { type: Number, default: 1 },
            codec: { type: String, enum: ['opus', 'pcm'], default: 'opus' },
            vad_enabled: { type: Boolean, default: true },
        },
        stats: {
            total_audio_duration_ms: { type: Number, default: 0 },
            total_chunks_received: { type: Number, default: 0 },
            total_transcripts_generated: { type: Number, default: 0 },
            average_confidence: { type: Number, default: 0 },
            errors_count: { type: Number, default: 0 },
        },
        current_transcript: {
            interim: [{ type: String }],
            final_segments: [{ type: String }],
        },
        started_at: { type: Date, default: Date.now },
        ended_at: { type: Date },
        last_activity_at: { type: Date, default: Date.now },
    },
    {
        timestamps: true,
        collection: 'voice_sessions'
    }
);

// Compound indexes
VoiceSessionSchema.index({ user_id: 1, status: 1 });
VoiceSessionSchema.index({ status: 1, last_activity_at: 1 });

const VoiceSession: Model<IVoiceSession> =
    mongoose.models.VoiceSession ||
    mongoose.model<IVoiceSession>('VoiceSession', VoiceSessionSchema);

export default VoiceSession;

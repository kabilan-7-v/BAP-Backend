import { v4 as uuidv4 } from 'uuid';
import InputEnvelope, { IInputEnvelope } from '../models/InputEnvelope';
import AuditLog from '../models/AuditLog';
import {
    InputEnvelope as InputEnvelopeType,
    InputContent,
    InputMetadata,
    InputType,
    InputError,
    AssetContext,
    DEFAULT_INPUT_AGENT_CONFIG,
} from '../types/input-agent';

/**
 * Envelope Generator Service - Phase 1
 * Creates unified JSON structures for all input types
 */

export class EnvelopeGeneratorService {
    private config = DEFAULT_INPUT_AGENT_CONFIG;

    /**
     * Generate a new input envelope
     */
    async generateEnvelope(params: {
        user_id: string;
        session_id: string;
        input_type: InputType;
        content: InputContent;
        metadata: Partial<InputMetadata>;
        client_info?: {
            user_agent?: string;
            ip_address?: string;
        };
    }): Promise<InputEnvelopeType> {
        const startTime = Date.now();
        const envelope_id = uuidv4();
        const timestamp = new Date().toISOString();

        // Determine interaction method based on input type
        const interaction_method = this.determineInteractionMethod(params.input_type, params.metadata);

        const envelope: InputEnvelopeType = {
            envelope_id,
            timestamp,
            user_id: params.user_id,
            session_id: params.session_id,
            input_type: params.input_type,
            content: params.content,
            metadata: {
                voice_mode_active: params.metadata.voice_mode_active ?? params.input_type === 'voice',
                interaction_method,
                client_info: params.client_info,
                processing_time_ms: Date.now() - startTime,
                retry_count: params.metadata.retry_count ?? 0,
            },
            status: 'pending',
        };

        // Check if envelope generation meets latency target
        const generationTime = Date.now() - startTime;
        if (generationTime > this.config.envelope_generation_timeout_ms) {
            console.warn(`Envelope generation exceeded target: ${generationTime}ms > ${this.config.envelope_generation_timeout_ms}ms`);
        }

        return envelope;
    }

    /**
     * Save envelope to database
     */
    async saveEnvelope(envelope: InputEnvelopeType): Promise<IInputEnvelope> {
        const dbEnvelope = new InputEnvelope({
            envelope_id: envelope.envelope_id,
            timestamp: new Date(envelope.timestamp),
            user_id: envelope.user_id,
            session_id: envelope.session_id,
            input_type: envelope.input_type,
            content: envelope.content,
            metadata: envelope.metadata,
            status: envelope.status || 'pending',
            error: envelope.error,
            sent_to_planner: false,
        });

        await dbEnvelope.save();

        // Log the envelope creation
        await this.logAuditEvent({
            user_id: envelope.user_id,
            session_id: envelope.session_id,
            envelope_id: envelope.envelope_id,
            action: 'input_received',
            input_type: envelope.input_type,
            metadata: {
                processing_time_ms: envelope.metadata.processing_time_ms,
            },
        });

        return dbEnvelope;
    }

    /**
     * Update envelope status
     */
    async updateEnvelopeStatus(
        envelope_id: string,
        status: 'pending' | 'processing' | 'completed' | 'failed',
        error?: InputError
    ): Promise<IInputEnvelope | null> {
        const update: any = { status };
        if (error) {
            update.error = error;
        }

        const envelope = await InputEnvelope.findOneAndUpdate(
            { envelope_id },
            update,
            { new: true }
        );

        if (envelope) {
            const action = status === 'completed'
                ? 'processing_completed'
                : status === 'failed'
                    ? 'processing_failed'
                    : 'processing_started';

            await this.logAuditEvent({
                user_id: envelope.user_id.toString(),
                session_id: envelope.session_id,
                envelope_id,
                action,
                input_type: envelope.input_type,
                metadata: error ? { error_code: error.code, error_message: error.message } : {},
            });
        }

        return envelope;
    }

    /**
     * Mark envelope as sent to planner
     */
    async markSentToPlanner(envelope_id: string, planner_response_id?: string): Promise<IInputEnvelope | null> {
        const envelope = await InputEnvelope.findOneAndUpdate(
            { envelope_id },
            {
                sent_to_planner: true,
                planner_response_id,
            },
            { new: true }
        );

        if (envelope) {
            await this.logAuditEvent({
                user_id: envelope.user_id.toString(),
                session_id: envelope.session_id,
                envelope_id,
                action: 'sent_to_planner',
                input_type: envelope.input_type,
                metadata: { planner_response_id },
            });
        }

        return envelope;
    }

    /**
     * Get envelopes by session
     */
    async getEnvelopesBySession(session_id: string, limit = 50): Promise<IInputEnvelope[]> {
        return InputEnvelope.find({ session_id })
            .sort({ timestamp: -1 })
            .limit(limit)
            .exec();
    }

    /**
     * Get envelope by ID
     */
    async getEnvelopeById(envelope_id: string): Promise<IInputEnvelope | null> {
        return InputEnvelope.findOne({ envelope_id }).exec();
    }

    /**
     * Private: Determine interaction method
     */
    private determineInteractionMethod(
        input_type: InputType,
        metadata: Partial<InputMetadata>
    ): 'typing' | 'speaking' | 'upload' {
        if (metadata.interaction_method) {
            return metadata.interaction_method;
        }

        switch (input_type) {
            case 'voice':
                return 'speaking';
            case 'file':
                return 'upload';
            case 'text':
            default:
                return 'typing';
        }
    }

    /**
     * Private: Log audit event
     */
    private async logAuditEvent(params: {
        user_id: string;
        session_id: string;
        envelope_id: string;
        action: string;
        input_type?: InputType;
        metadata?: Record<string, any>;
    }): Promise<void> {
        try {
            const auditLog = new AuditLog({
                audit_id: uuidv4(),
                timestamp: new Date(),
                user_id: params.user_id,
                session_id: params.session_id,
                envelope_id: params.envelope_id,
                action: params.action,
                input_type: params.input_type,
                metadata: params.metadata || {},
                severity: params.action.includes('failed') || params.action.includes('error') ? 'error' : 'info',
            });

            await auditLog.save();
        } catch (error) {
            console.error('Failed to log audit event:', error);
        }
    }
}

export const envelopeGeneratorService = new EnvelopeGeneratorService();

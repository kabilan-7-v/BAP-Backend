import { v4 as uuidv4 } from 'uuid';
import {
    InputEnvelope,
    InputContent,
    TextInputRequest,
    InputError,
    AssetContext,
    DEFAULT_INPUT_AGENT_CONFIG,
} from '../types/input-agent';
import { envelopeGeneratorService } from './envelope-generator.service';
import { auditLoggerService } from './audit-logger.service';

/**
 * Text Input Handler Service - Phase 1
 * Processes typed messages from the conversational interface
 */

export class TextInputHandlerService {
    private config = DEFAULT_INPUT_AGENT_CONFIG;

    /**
     * Process text input and generate envelope
     */
    async processTextInput(params: {
        user_id: string;
        session_id: string;
        text: string;
        asset_context?: AssetContext[];
        client_info?: {
            user_agent?: string;
            ip_address?: string;
        };
    }): Promise<{ success: boolean; envelope?: InputEnvelope; error?: InputError }> {
        const startTime = Date.now();

        // ===== REAL-TIME CONSOLE LOG =====
        console.log('\n' + '='.repeat(60));
        console.log('📝 INPUT AGENT - TEXT MESSAGE RECEIVED');
        console.log('='.repeat(60));
        console.log(`👤 User ID: ${params.user_id}`);
        console.log(`🔗 Session: ${params.session_id}`);
        console.log(`💬 Message: "${params.text}"`);
        console.log(`📅 Time: ${new Date().toLocaleString()}`);
        console.log('='.repeat(60));

        try {
            // Validate text input
            const validationResult = this.validateTextInput(params.text);
            if (!validationResult.valid) {
                return {
                    success: false,
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: validationResult.message || 'Invalid text input',
                        recoverable: true,
                        fallback_action: 'Please provide valid text input',
                    },
                };
            }

            // Sanitize text
            const sanitizedText = this.sanitizeText(params.text);

            // Build content
            const content: InputContent = {
                text: sanitizedText,
                asset_context: params.asset_context,
            };

            // Generate envelope
            const envelope = await envelopeGeneratorService.generateEnvelope({
                user_id: params.user_id,
                session_id: params.session_id,
                input_type: 'text',
                content,
                metadata: {
                    voice_mode_active: false,
                    interaction_method: 'typing',
                },
                client_info: params.client_info,
            });

            // Update processing time
            const processingTime = Date.now() - startTime;
            envelope.metadata.processing_time_ms = processingTime;

            // Check latency target
            if (processingTime > this.config.text_processing_timeout_ms) {
                console.warn(`Text processing exceeded target: ${processingTime}ms > ${this.config.text_processing_timeout_ms}ms`);
            }

            // Save envelope
            await envelopeGeneratorService.saveEnvelope(envelope);

            // Update status to completed
            await envelopeGeneratorService.updateEnvelopeStatus(envelope.envelope_id, 'completed');

            console.log(`✅ Text processed successfully in ${processingTime}ms`);
            console.log(`📦 Envelope ID: ${envelope.envelope_id}\n`);

            return { success: true, envelope };
        } catch (error) {
            console.error('Error processing text input:', error);

            const inputError: InputError = {
                code: 'PROCESSING_TIMEOUT',
                message: error instanceof Error ? error.message : 'Failed to process text input',
                recoverable: true,
                fallback_action: 'Please try again',
            };

            await auditLoggerService.logError({
                user_id: params.user_id,
                session_id: params.session_id,
                error_code: inputError.code,
                error_message: inputError.message,
                input_type: 'text',
            });

            return { success: false, error: inputError };
        }
    }

    /**
     * Validate text input
     */
    private validateTextInput(text: string): { valid: boolean; message?: string } {
        if (!text || typeof text !== 'string') {
            return { valid: false, message: 'Text input is required' };
        }

        const trimmedText = text.trim();
        if (trimmedText.length === 0) {
            return { valid: false, message: 'Text input cannot be empty' };
        }

        if (trimmedText.length > 50000) {
            return { valid: false, message: 'Text input exceeds maximum length of 50,000 characters' };
        }

        return { valid: true };
    }

    /**
     * Sanitize text input
     */
    private sanitizeText(text: string): string {
        // Trim whitespace
        let sanitized = text.trim();

        // Remove null bytes
        sanitized = sanitized.replace(/\0/g, '');

        // Normalize unicode
        sanitized = sanitized.normalize('NFC');

        return sanitized;
    }

    /**
     * Batch process multiple text inputs
     */
    async processTextInputBatch(params: {
        user_id: string;
        session_id: string;
        texts: string[];
        asset_context?: AssetContext[];
        client_info?: {
            user_agent?: string;
            ip_address?: string;
        };
    }): Promise<{ success: boolean; envelopes: InputEnvelope[]; errors: InputError[] }> {
        const envelopes: InputEnvelope[] = [];
        const errors: InputError[] = [];

        for (const text of params.texts) {
            const result = await this.processTextInput({
                user_id: params.user_id,
                session_id: params.session_id,
                text,
                asset_context: params.asset_context,
                client_info: params.client_info,
            });

            if (result.success && result.envelope) {
                envelopes.push(result.envelope);
            } else if (result.error) {
                errors.push(result.error);
            }
        }

        return {
            success: errors.length === 0,
            envelopes,
            errors,
        };
    }
}

export const textInputHandlerService = new TextInputHandlerService();

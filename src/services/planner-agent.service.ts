import {
    InputEnvelope,
    InputError,
} from '../types/input-agent';
import { envelopeGeneratorService } from './envelope-generator.service';
import { auditLoggerService } from './audit-logger.service';

/**
 * Planner Agent Interface Service - Phase 1
 * Delivers processed inputs to the reasoning engine (Planner Agent)
 */

export interface PlannerResponse {
    response_id: string;
    status: 'received' | 'processing' | 'completed' | 'error';
    message?: string;
    data?: Record<string, any>;
}

export class PlannerAgentService {
    private plannerEndpoint: string;
    private apiKey: string;
    private timeout: number;

    constructor() {
        this.plannerEndpoint = process.env.PLANNER_AGENT_URL || 'http://localhost:3003/api/planner';
        this.apiKey = process.env.PLANNER_AGENT_API_KEY || '';
        this.timeout = parseInt(process.env.PLANNER_AGENT_TIMEOUT || '30000', 10);
    }

    /**
     * Send envelope to Planner Agent
     */
    async sendToPlanner(envelope: InputEnvelope): Promise<{
        success: boolean;
        response?: PlannerResponse;
        error?: InputError;
    }> {
        try {
            // Validate envelope before sending
            const validationResult = this.validateEnvelopeForPlanner(envelope);
            if (!validationResult.valid) {
                return {
                    success: false,
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: validationResult.message || 'Invalid envelope for planner',
                        recoverable: false,
                    },
                };
            }

            // Prepare payload
            const payload = this.preparePayload(envelope);

            // Send to Planner Agent
            // Note: This is a placeholder - integrate with actual Planner Agent API
            const response = await this.sendRequest(payload);

            if (response.success && response.data) {
                // ===== REAL-TIME CONSOLE LOG - PLANNER RESPONSE =====
                console.log('\n' + '='.repeat(60));
                console.log('🧠 PLANNER AGENT RESPONSE RECEIVED');
                console.log('='.repeat(60));
                console.log(`📦 Envelope ID: ${envelope.envelope_id}`);
                console.log(`🔗 Response ID: ${response.data.response_id}`);
                console.log(`📊 Status: ${response.data.status}`);
                if (response.data.message) {
                    console.log(`💬 Message: ${response.data.message}`);
                }
                if (response.data.data) {
                    console.log(`📋 Data: ${JSON.stringify(response.data.data, null, 2)}`);
                }
                console.log(`📅 Time: ${new Date().toLocaleString()}`);
                console.log('='.repeat(60));

                // Mark envelope as sent to planner
                await envelopeGeneratorService.markSentToPlanner(
                    envelope.envelope_id,
                    response.data.response_id
                );

                return {
                    success: true,
                    response: response.data,
                };
            }

            return {
                success: false,
                error: response.error,
            };
        } catch (error) {
            console.error('Error sending to planner:', error);

            const inputError: InputError = {
                code: 'ASSET_CONNECTION_FAILURE',
                message: 'Failed to communicate with Planner Agent',
                recoverable: true,
                fallback_action: 'Request will be queued and retried',
            };

            await auditLoggerService.logError({
                user_id: envelope.user_id,
                session_id: envelope.session_id,
                envelope_id: envelope.envelope_id,
                error_code: inputError.code,
                error_message: inputError.message,
            });

            return { success: false, error: inputError };
        }
    }

    /**
     * Send batch of envelopes to Planner Agent
     */
    async sendBatchToPlanner(envelopes: InputEnvelope[]): Promise<{
        success: boolean;
        responses: { envelope_id: string; response?: PlannerResponse; error?: InputError }[];
    }> {
        const responses: { envelope_id: string; response?: PlannerResponse; error?: InputError }[] = [];

        for (const envelope of envelopes) {
            const result = await this.sendToPlanner(envelope);
            responses.push({
                envelope_id: envelope.envelope_id,
                response: result.response,
                error: result.error,
            });
        }

        return {
            success: responses.every(r => !r.error),
            responses,
        };
    }

    /**
     * Get Planner Agent status
     */
    async getPlannerStatus(): Promise<{
        available: boolean;
        latency_ms?: number;
        error?: string;
    }> {
        try {
            const startTime = Date.now();

            // Health check to Planner Agent
            const response = await fetch(`${this.plannerEndpoint}/health`, {
                method: 'GET',
                headers: this.getHeaders(),
                signal: AbortSignal.timeout(5000),
            });

            const latency_ms = Date.now() - startTime;

            if (response.ok) {
                return { available: true, latency_ms };
            }

            return {
                available: false,
                latency_ms,
                error: `Planner returned status ${response.status}`,
            };
        } catch (error) {
            return {
                available: false,
                error: error instanceof Error ? error.message : 'Connection failed',
            };
        }
    }

    /**
     * Queue envelope for later processing (when Planner is unavailable)
     */
    async queueForProcessing(envelope: InputEnvelope): Promise<{ success: boolean; queue_id: string }> {
        // TODO: Implement message queue integration (Redis, RabbitMQ, etc.)
        // For now, store in database with pending status

        const queue_id = `queue_${envelope.envelope_id}`;

        // The envelope is already saved, just update status
        await envelopeGeneratorService.updateEnvelopeStatus(
            envelope.envelope_id,
            'pending'
        );

        return { success: true, queue_id };
    }

    /**
     * Private: Validate envelope before sending to planner
     */
    private validateEnvelopeForPlanner(envelope: InputEnvelope): { valid: boolean; message?: string } {
        if (!envelope.envelope_id) {
            return { valid: false, message: 'Envelope ID is required' };
        }

        if (!envelope.user_id) {
            return { valid: false, message: 'User ID is required' };
        }

        if (!envelope.session_id) {
            return { valid: false, message: 'Session ID is required' };
        }

        // Check if there's actual content
        const hasContent =
            envelope.content.text ||
            envelope.content.transcript?.final ||
            (envelope.content.files && envelope.content.files.length > 0);

        if (!hasContent) {
            return { valid: false, message: 'Envelope must contain content' };
        }

        return { valid: true };
    }

    /**
     * Private: Prepare payload for Planner Agent
     */
    private preparePayload(envelope: InputEnvelope): Record<string, any> {
        return {
            envelope_id: envelope.envelope_id,
            timestamp: envelope.timestamp,
            user_id: envelope.user_id,
            session_id: envelope.session_id,
            input_type: envelope.input_type,
            content: {
                // Send text or transcript
                text: envelope.content.text || envelope.content.transcript?.final,
                // Include file references (not full content)
                files: envelope.content.files?.map(f => ({
                    id: f.id,
                    name: f.name,
                    type: f.type,
                    url: f.url,
                    extracted_text: f.extracted_text,
                })),
                // Include asset context
                asset_context: envelope.content.asset_context,
            },
            metadata: {
                input_type: envelope.input_type,
                voice_mode: envelope.metadata.voice_mode_active,
                interaction_method: envelope.metadata.interaction_method,
                confidence: envelope.content.transcript?.confidence,
            },
        };
    }

    /**
     * Private: Send HTTP request to Planner Agent
     */
    private async sendRequest(payload: Record<string, any>): Promise<{
        success: boolean;
        data?: PlannerResponse;
        error?: InputError;
    }> {
        try {
            const response = await fetch(`${this.plannerEndpoint}/process`, {
                method: 'POST',
                headers: this.getHeaders(),
                body: JSON.stringify(payload),
                signal: AbortSignal.timeout(this.timeout),
            });

            if (!response.ok) {
                return {
                    success: false,
                    error: {
                        code: 'ASSET_CONNECTION_FAILURE',
                        message: `Planner returned status ${response.status}`,
                        recoverable: response.status >= 500,
                        fallback_action: 'Request will be retried',
                    },
                };
            }

            const data = await response.json();
            return { success: true, data };
        } catch (error) {
            if (error instanceof Error && error.name === 'AbortError') {
                return {
                    success: false,
                    error: {
                        code: 'PROCESSING_TIMEOUT',
                        message: 'Request to Planner Agent timed out',
                        recoverable: true,
                        fallback_action: 'Request will be retried',
                    },
                };
            }

            return {
                success: false,
                error: {
                    code: 'ASSET_CONNECTION_FAILURE',
                    message: 'Failed to connect to Planner Agent',
                    recoverable: true,
                    fallback_action: 'Request will be queued',
                },
            };
        }
    }

    /**
     * Private: Get request headers
     */
    private getHeaders(): Record<string, string> {
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
        };

        if (this.apiKey) {
            headers['Authorization'] = `Bearer ${this.apiKey}`;
        }

        return headers;
    }
}

export const plannerAgentService = new PlannerAgentService();

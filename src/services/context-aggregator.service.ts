import { v4 as uuidv4 } from 'uuid';
import {
    InputEnvelope,
    InputContent,
    InputError,
    AssetContext,
} from '../types/input-agent';
import { envelopeGeneratorService } from './envelope-generator.service';
import { textInputHandlerService } from './text-input-handler.service';
import { voiceInputHandlerService } from './voice-input-handler.service';
import { fileInputHandlerService } from './file-input-handler.service';
import { assetContextHandlerService } from './asset-context-handler.service';
import { auditLoggerService } from './audit-logger.service';

/**
 * Context Aggregator Service - Phase 1
 * Combines multimodal inputs with asset context
 */

export interface MultimodalInput {
    text?: string;
    voice_transcript?: string;
    files?: {
        buffer: Buffer;
        originalname: string;
        mimetype: string;
        size: number;
    }[];
    asset_ids?: string[];
}

export class ContextAggregatorService {
    /**
     * Process multimodal input combining text, voice, files, and asset context
     */
    async processMultimodalInput(params: {
        user_id: string;
        session_id: string;
        input: MultimodalInput;
        client_info?: {
            user_agent?: string;
            ip_address?: string;
        };
    }): Promise<{ success: boolean; envelope?: InputEnvelope; error?: InputError }> {
        try {
            const aggregatedContent: InputContent = {};
            const errors: InputError[] = [];

            // Process text if provided
            if (params.input.text) {
                aggregatedContent.text = params.input.text;
            }

            // Add voice transcript if provided
            if (params.input.voice_transcript) {
                aggregatedContent.transcript = {
                    raw: params.input.voice_transcript,
                    interim: [],
                    final: params.input.voice_transcript,
                    confidence: 1.0, // Direct transcript, not from ASR
                };
            }

            // Process files if provided
            if (params.input.files && params.input.files.length > 0) {
                const fileResult = await fileInputHandlerService.processFileUpload({
                    user_id: params.user_id,
                    session_id: params.session_id,
                    files: params.input.files,
                });

                if (fileResult.success && fileResult.envelope) {
                    aggregatedContent.files = fileResult.envelope.content.files;
                } else if (fileResult.error) {
                    errors.push(fileResult.error);
                }
            }

            // Load asset context if provided
            if (params.input.asset_ids && params.input.asset_ids.length > 0) {
                const assetResult = await assetContextHandlerService.loadAssetContext({
                    user_id: params.user_id,
                    session_id: params.session_id,
                    asset_ids: params.input.asset_ids,
                });

                if (assetResult.contexts.length > 0) {
                    aggregatedContent.asset_context = assetResult.contexts;
                }

                if (assetResult.errors.length > 0) {
                    errors.push(...assetResult.errors);
                }
            }

            // Determine input type based on what was provided
            const inputType = this.determineInputType(params.input);

            // Determine interaction method
            const interactionMethod = this.determineInteractionMethod(params.input);

            // Generate envelope
            const envelope = await envelopeGeneratorService.generateEnvelope({
                user_id: params.user_id,
                session_id: params.session_id,
                input_type: inputType,
                content: aggregatedContent,
                metadata: {
                    voice_mode_active: !!params.input.voice_transcript,
                    interaction_method: interactionMethod,
                },
                client_info: params.client_info,
            });

            // Add any non-critical errors to envelope metadata
            if (errors.length > 0) {
                envelope.metadata = {
                    ...envelope.metadata,
                    warnings: errors.filter(e => e.recoverable).map(e => e.message),
                } as any;
            }

            // Check for critical errors
            const criticalErrors = errors.filter(e => !e.recoverable);
            if (criticalErrors.length > 0) {
                return {
                    success: false,
                    error: criticalErrors[0],
                };
            }

            // Save envelope
            await envelopeGeneratorService.saveEnvelope(envelope);
            await envelopeGeneratorService.updateEnvelopeStatus(envelope.envelope_id, 'completed');

            return { success: true, envelope };
        } catch (error) {
            console.error('Error in context aggregation:', error);

            const inputError: InputError = {
                code: 'PROCESSING_TIMEOUT',
                message: error instanceof Error ? error.message : 'Failed to aggregate multimodal input',
                recoverable: true,
                fallback_action: 'Please try again',
            };

            await auditLoggerService.logError({
                user_id: params.user_id,
                session_id: params.session_id,
                error_code: inputError.code,
                error_message: inputError.message,
                input_type: 'multimodal',
            });

            return { success: false, error: inputError };
        }
    }

    /**
     * Determine input type based on provided inputs
     */
    private determineInputType(input: MultimodalInput): 'text' | 'voice' | 'file' | 'multimodal' {
        const hasText = !!input.text;
        const hasVoice = !!input.voice_transcript;
        const hasFiles = input.files && input.files.length > 0;

        const inputCount = [hasText, hasVoice, hasFiles].filter(Boolean).length;

        if (inputCount > 1) {
            return 'multimodal';
        }

        if (hasVoice) return 'voice';
        if (hasFiles) return 'file';
        return 'text';
    }

    /**
     * Determine primary interaction method
     */
    private determineInteractionMethod(input: MultimodalInput): 'typing' | 'speaking' | 'upload' {
        // Priority: voice > upload > typing
        if (input.voice_transcript) return 'speaking';
        if (input.files && input.files.length > 0) return 'upload';
        return 'typing';
    }

    /**
     * Merge multiple envelopes into a single aggregated envelope
     */
    async mergeEnvelopes(params: {
        user_id: string;
        session_id: string;
        envelope_ids: string[];
        client_info?: {
            user_agent?: string;
            ip_address?: string;
        };
    }): Promise<{ success: boolean; envelope?: InputEnvelope; error?: InputError }> {
        try {
            const envelopes = await Promise.all(
                params.envelope_ids.map(id => envelopeGeneratorService.getEnvelopeById(id))
            );

            const validEnvelopes = envelopes.filter(e => e !== null);

            if (validEnvelopes.length === 0) {
                return {
                    success: false,
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: 'No valid envelopes found to merge',
                        recoverable: false,
                    },
                };
            }

            // Aggregate content from all envelopes
            const aggregatedContent: InputContent = {
                text: '',
                files: [],
                asset_context: [],
            };

            

            for (const envelope of validEnvelopes) {
                if (envelope!.content.text) {
                    aggregatedContent.text = (aggregatedContent.text || '') + ' ' + envelope!.content.text;
                }
                if (envelope!.content.transcript) {
                    aggregatedContent.transcript = envelope!.content.transcript;
                }
                if (envelope!.content.files) {
                    aggregatedContent.files = [...(aggregatedContent.files || []), ...envelope!.content.files];
                }
                if (envelope!.content.asset_context) {
                    aggregatedContent.asset_context = [
                        ...(aggregatedContent.asset_context || []),
                        ...envelope!.content.asset_context,
                    ];
                }
            }

            // Trim aggregated text
            if (aggregatedContent.text) {
                aggregatedContent.text = aggregatedContent.text.trim();
            }

            // Generate merged envelope
            const mergedEnvelope = await envelopeGeneratorService.generateEnvelope({
                user_id: params.user_id,
                session_id: params.session_id,
                input_type: 'multimodal',
                content: aggregatedContent,
                metadata: {
                    voice_mode_active: !!aggregatedContent.transcript,
                    interaction_method: 'typing',
                },
                client_info: params.client_info,
            });

            await envelopeGeneratorService.saveEnvelope(mergedEnvelope);
            await envelopeGeneratorService.updateEnvelopeStatus(mergedEnvelope.envelope_id, 'completed');

            return { success: true, envelope: mergedEnvelope };
        } catch (error) {
            console.error('Error merging envelopes:', error);

            return {
                success: false,
                error: {
                    code: 'PROCESSING_TIMEOUT',
                    message: 'Failed to merge envelopes',
                    recoverable: true,
                    fallback_action: 'Please try again',
                },
            };
        }
    }
}

export const contextAggregatorService = new ContextAggregatorService();

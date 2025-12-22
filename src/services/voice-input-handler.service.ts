import { v4 as uuidv4 } from 'uuid';
import { HfInference } from '@huggingface/inference';
import {
    InputEnvelope,
    InputContent,
    Transcript,
    InputError,
    AssetContext,
    VoiceStreamConfig,
    DEFAULT_INPUT_AGENT_CONFIG,
} from '../types/input-agent';
import { envelopeGeneratorService } from './envelope-generator.service';
import { auditLoggerService } from './audit-logger.service';
import VoiceSession from '../models/VoiceSession';

/**
 * Voice Input Handler Service - Phase 1
 * Manages WebRTC audio streams and real-time transcription
 * Uses Hugging Face Whisper API for speech-to-text conversion (FREE)
 */

// Initialize Hugging Face Inference Client
const hf = new HfInference(process.env.HUGGINGFACE_API_KEY);
const WHISPER_MODEL = 'openai/whisper-large-v3';

export interface VoiceProcessingResult {
    success: boolean;
    transcript?: Transcript;
    envelope?: InputEnvelope;
    error?: InputError;
}

export class VoiceInputHandlerService {
    private config = DEFAULT_INPUT_AGENT_CONFIG;
    private activeSessions: Map<string, {
        user_id: string;
        config: VoiceStreamConfig;
        chunks: Buffer[];
        interim_transcripts: string[];
        started_at: Date;
    }> = new Map();

    /**
     * Start a voice session
     */
    async startVoiceSession(params: {
        user_id: string;
        session_id: string;
        config?: Partial<VoiceStreamConfig>;
        conversation_id?: string;
    }): Promise<{ success: boolean; session_id: string; error?: InputError }> {
        // ===== REAL-TIME CONSOLE LOG =====
        console.log('\n' + '='.repeat(60));
        console.log('🎤 INPUT AGENT - VOICE SESSION STARTED');
        console.log('='.repeat(60));
        console.log(`👤 User ID: ${params.user_id}`);
        console.log(`🔗 Session: ${params.session_id}`);
        console.log(`📅 Time: ${new Date().toLocaleString()}`);
        console.log('='.repeat(60));

        try {
            const voiceConfig: VoiceStreamConfig = {
                sample_rate: params.config?.sample_rate ?? 16000,
                bit_depth: params.config?.bit_depth ?? 16,
                channels: params.config?.channels ?? 1,
                codec: params.config?.codec ?? 'opus',
                vad_enabled: params.config?.vad_enabled ?? true,
            };

            // Create session in memory
            this.activeSessions.set(params.session_id, {
                user_id: params.user_id,
                config: voiceConfig,
                chunks: [],
                interim_transcripts: [],
                started_at: new Date(),
            });

            // Create or update session in database (upsert to prevent duplicate key errors)
            await VoiceSession.findOneAndUpdate(
                { session_id: params.session_id },
                {
                    $set: {
                        user_id: params.user_id,
                        conversation_id: params.conversation_id,
                        status: 'active',
                        config: voiceConfig,
                        stats: {
                            total_audio_duration_ms: 0,
                            total_chunks_received: 0,
                            total_transcripts_generated: 0,
                            average_confidence: 0,
                            errors_count: 0,
                        },
                        current_transcript: {
                            interim: [],
                            final_segments: [],
                        },
                        started_at: new Date(),
                        last_activity_at: new Date(),
                    }
                },
                { upsert: true, new: true }
            );

            await auditLoggerService.logVoiceEvent({
                user_id: params.user_id,
                session_id: params.session_id,
                action: 'voice_stream_started',
                metadata: { config: voiceConfig },
            });

            return { success: true, session_id: params.session_id };
        } catch (error) {
            console.error('Error starting voice session:', error);
            return {
                success: false,
                session_id: params.session_id,
                error: {
                    code: 'AUDIO_STREAM_ERROR',
                    message: 'Failed to start voice session',
                    recoverable: true,
                    fallback_action: 'Please try again or use text input',
                },
            };
        }
    }

    /**
     * Process audio chunk from voice stream
     */
    async processAudioChunk(params: {
        session_id: string;
        audio_data: string; // Base64 encoded
        chunk_id: string;
        is_speech: boolean;
        sequence_number: number;
    }): Promise<{
        success: boolean;
        interim_transcript?: string;
        error?: InputError;
    }> {
        try {
            const session = this.activeSessions.get(params.session_id);
            if (!session) {
                return {
                    success: false,
                    error: {
                        code: 'AUDIO_STREAM_ERROR',
                        message: 'Voice session not found',
                        recoverable: false,
                        fallback_action: 'Please start a new voice session',
                    },
                };
            }

            // Decode and store audio chunk
            const audioBuffer = Buffer.from(params.audio_data, 'base64');
            session.chunks.push(audioBuffer);

            // Update session stats in database
            await VoiceSession.findOneAndUpdate(
                { session_id: params.session_id },
                {
                    $inc: { 'stats.total_chunks_received': 1 },
                    last_activity_at: new Date(),
                }
            );

            // If speech detected, process for transcription
            if (params.is_speech) {
                // Note: Actual ASR processing would happen here
                // This is a placeholder for Whisper V3 integration
                const interimTranscript = await this.processASR(audioBuffer, session.config);

                if (interimTranscript) {
                    session.interim_transcripts.push(interimTranscript);
                    return { success: true, interim_transcript: interimTranscript };
                }
            }

            return { success: true };
        } catch (error) {
            console.error('Error processing audio chunk:', error);

            // Update error count
            await VoiceSession.findOneAndUpdate(
                { session_id: params.session_id },
                { $inc: { 'stats.errors_count': 1 } }
            );

            return {
                success: false,
                error: {
                    code: 'ASR_FAILURE',
                    message: 'Failed to process audio chunk',
                    recoverable: true,
                    fallback_action: 'Continue speaking, audio is being buffered',
                },
            };
        }
    }

    /**
     * End voice session and generate final envelope
     */
    async endVoiceSession(params: {
        session_id: string;
        asset_context?: AssetContext[];
        client_info?: {
            user_agent?: string;
            ip_address?: string;
        };
    }): Promise<VoiceProcessingResult> {
        try {
            const session = this.activeSessions.get(params.session_id);
            if (!session) {
                return {
                    success: false,
                    error: {
                        code: 'AUDIO_STREAM_ERROR',
                        message: 'Voice session not found',
                        recoverable: false,
                    },
                };
            }

            // Process all buffered audio for final transcript
            const allAudio = Buffer.concat(session.chunks);
            const finalTranscript = await this.processASR(allAudio, session.config);

            // Calculate duration
            const durationMs = Date.now() - session.started_at.getTime();

            // Build transcript object
            const transcript: Transcript = {
                raw: session.interim_transcripts.join(' '),
                interim: session.interim_transcripts,
                final: finalTranscript || session.interim_transcripts.join(' '),
                confidence: 0.85, // Placeholder - actual confidence from ASR
                duration_ms: durationMs,
            };

            // ===== REAL-TIME CONSOLE LOG =====
            console.log('\n' + '='.repeat(60));
            console.log('🎤➡️📝 INPUT AGENT - VOICE TO TEXT CONVERSION');
            console.log('='.repeat(60));
            console.log(`👤 User ID: ${session.user_id}`);
            console.log(`🔗 Session: ${params.session_id}`);
            console.log(`⏱️ Duration: ${(durationMs / 1000).toFixed(2)}s`);
            console.log(`📊 Chunks: ${session.chunks.length}`);
            console.log(`💬 Transcript: "${transcript.final || '(No speech detected)'}"`);
            console.log(`🎯 Confidence: ${(transcript.confidence * 100).toFixed(1)}%`);
            console.log(`📅 Time: ${new Date().toLocaleString()}`);
            console.log('='.repeat(60));

            // Build content
            const content: InputContent = {
                transcript,
                asset_context: params.asset_context,
            };

            // Generate envelope
            const envelope = await envelopeGeneratorService.generateEnvelope({
                user_id: session.user_id,
                session_id: params.session_id,
                input_type: 'voice',
                content,
                metadata: {
                    voice_mode_active: true,
                    interaction_method: 'speaking',
                },
                client_info: params.client_info,
            });

            // Save envelope
            await envelopeGeneratorService.saveEnvelope(envelope);
            await envelopeGeneratorService.updateEnvelopeStatus(envelope.envelope_id, 'completed');

            // Update voice session in database
            await VoiceSession.findOneAndUpdate(
                { session_id: params.session_id },
                {
                    status: 'ended',
                    ended_at: new Date(),
                    'stats.total_audio_duration_ms': durationMs,
                    'current_transcript.final_segments': [transcript.final],
                }
            );

            // Log event
            await auditLoggerService.logVoiceEvent({
                user_id: session.user_id,
                session_id: params.session_id,
                action: 'voice_stream_ended',
                metadata: {
                    duration_ms: durationMs,
                    chunks_count: session.chunks.length,
                    final_transcript_length: transcript.final.length,
                },
            });

            // Cleanup memory
            this.activeSessions.delete(params.session_id);

            console.log(`✅ Voice session completed successfully`);
            console.log(`📦 Envelope ID: ${envelope.envelope_id}\n`);

            return { success: true, transcript, envelope };
        } catch (error) {
            console.error('Error ending voice session:', error);

            // Cleanup on error
            this.activeSessions.delete(params.session_id);

            return {
                success: false,
                error: {
                    code: 'ASR_FAILURE',
                    message: 'Failed to process voice session',
                    recoverable: false,
                    fallback_action: 'Please use text input mode',
                },
            };
        }
    }

    /**
     * Process audio using Hugging Face Whisper API (FREE)
     * Converts audio buffer to text using Whisper large-v3 model
     */
    private async processASR(audioBuffer: Buffer, config: VoiceStreamConfig): Promise<string | null> {
        // Check if API key is configured
        if (!process.env.HUGGINGFACE_API_KEY) {
            console.warn('⚠️ HUGGINGFACE_API_KEY not configured - ASR disabled');
            console.log('   Get your free API key at: https://huggingface.co/settings/tokens');
            return null;
        }

        // Skip if buffer is too small (likely no audio)
        if (audioBuffer.length < 1000) {
            console.log('Audio buffer too small, skipping ASR');
            return null;
        }

        try {
            console.log(`🎤 Sending ${(audioBuffer.length / 1024).toFixed(2)} KB audio to Whisper...`);

            // Convert Buffer to Uint8Array, then to Blob for the HfInference client
            const uint8Array = new Uint8Array(audioBuffer);
            const audioBlob = new Blob([uint8Array], { type: 'audio/wav' });

            // Use Hugging Face Inference Client for ASR
            const result = await hf.automaticSpeechRecognition({
                model: WHISPER_MODEL,
                data: audioBlob,
            });

            // Result contains { text: "transcribed text" }
            const transcribedText = result.text?.trim() || null;

            if (transcribedText) {
                console.log(`✅ Whisper transcription: "${transcribedText}"`);
            }

            return transcribedText;
        } catch (error: unknown) {
            // Handle model loading (common with free tier)
            if (error instanceof Error && error.message?.includes('loading')) {
                console.log('⏳ Whisper model is loading, please wait...');
                return null;
            }

            console.error('Error calling Hugging Face Whisper API:', error);
            return null;
        }
    }

    /**
     * Get active session info
     */
    getActiveSession(session_id: string) {
        return this.activeSessions.get(session_id);
    }

    /**
     * Check if session is active
     */
    isSessionActive(session_id: string): boolean {
        return this.activeSessions.has(session_id);
    }

    /**
     * Handle reconnection for dropped audio streams
     */
    async handleReconnection(params: {
        session_id: string;
        last_chunk_id?: string;
    }): Promise<{ success: boolean; resume_from?: number; error?: InputError }> {
        const session = this.activeSessions.get(params.session_id);

        if (!session) {
            return {
                success: false,
                error: {
                    code: 'AUDIO_STREAM_ERROR',
                    message: 'Session expired or not found',
                    recoverable: false,
                    fallback_action: 'Please start a new voice session',
                },
            };
        }

        return {
            success: true,
            resume_from: session.chunks.length,
        };
    }
}

export const voiceInputHandlerService = new VoiceInputHandlerService();

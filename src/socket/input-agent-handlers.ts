import { Server as SocketIOServer, Socket } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import { voiceInputHandlerService } from '../services/voice-input-handler.service';
import { textInputHandlerService } from '../services/text-input-handler.service';
import { contextAggregatorService } from '../services/context-aggregator.service';
import { plannerAgentService } from '../services/planner-agent.service';
import { auditLoggerService } from '../services/audit-logger.service';

/**
 * Input Agent Socket Handlers - Phase 1
 * Real-time voice streaming and input processing via WebSocket
 */

interface AuthenticatedSocket extends Socket {
    userId?: string;
    userEmail?: string;
}

interface VoiceSessionState {
    session_id: string;
    user_id: string;
    started_at: Date;
    chunk_count: number;
    is_active: boolean;
}

// Track active voice sessions
const activeVoiceSessions = new Map<string, VoiceSessionState>();

export function initializeInputAgentSocketHandlers(io: SocketIOServer) {
    console.log('Input Agent socket handlers initialized');

    io.on('connection', (socket: AuthenticatedSocket) => {
        const userId = socket.userId;

        if (!userId) {
            console.log('Input Agent: Unauthenticated socket connection');
            return;
        }

        console.log(`Input Agent: User ${userId} connected for input processing`);

        // ==================== VOICE INPUT EVENTS ====================

        /**
         * Start a voice session
         * Client sends: { conversation_id?: string, config?: VoiceStreamConfig }
         */
        socket.on('input:voice:start', async (data, callback) => {
            try {
                const session_id = uuidv4();

                const result = await voiceInputHandlerService.startVoiceSession({
                    user_id: userId,
                    session_id,
                    config: data?.config,
                    conversation_id: data?.conversation_id,
                });

                if (result.success) {
                    // Track session
                    activeVoiceSessions.set(session_id, {
                        session_id,
                        user_id: userId,
                        started_at: new Date(),
                        chunk_count: 0,
                        is_active: true,
                    });

                    // Join voice session room
                    socket.join(`voice:${session_id}`);

                    callback?.({
                        success: true,
                        voice_session_id: session_id,
                        message: 'Voice session started',
                    });

                    // Emit session started event
                    socket.emit('input:voice:started', { session_id });
                } else {
                    callback?.({
                        success: false,
                        error: result.error,
                    });
                }
            } catch (error) {
                console.error('Error starting voice session:', error);
                callback?.({
                    success: false,
                    error: { code: 'AUDIO_STREAM_ERROR', message: 'Failed to start voice session' },
                });
            }
        });

        /**
         * Send audio chunk for processing
         * Client sends: { session_id, audio_data (base64), is_speech, sequence_number }
         */
        socket.on('input:voice:chunk', async (data, callback) => {
            try {
                const { session_id, audio_data, is_speech, sequence_number } = data;

                if (!session_id || !audio_data) {
                    return callback?.({
                        success: false,
                        error: { code: 'VALIDATION_ERROR', message: 'session_id and audio_data are required' },
                    });
                }

                // Verify session exists and belongs to user
                const session = activeVoiceSessions.get(session_id);
                if (!session || session.user_id !== userId) {
                    return callback?.({
                        success: false,
                        error: { code: 'AUDIO_STREAM_ERROR', message: 'Invalid or expired session' },
                    });
                }

                // Process chunk
                const chunk_id = uuidv4();
                const result = await voiceInputHandlerService.processAudioChunk({
                    session_id,
                    audio_data,
                    chunk_id,
                    is_speech: is_speech ?? true,
                    sequence_number: sequence_number ?? session.chunk_count,
                });

                // Update chunk count
                session.chunk_count++;

                // Log every 10th chunk to avoid flooding console
                if (session.chunk_count % 10 === 0) {
                    console.log(`🎤 Voice Session ${session_id.substring(0, 8)}... - Received ${session.chunk_count} audio chunks`);
                }

                if (result.success) {
                    // Send interim transcript if available
                    if (result.interim_transcript) {
                        socket.emit('input:voice:transcript', {
                            session_id,
                            type: 'interim',
                            text: result.interim_transcript,
                            chunk_id,
                        });
                    }

                    callback?.({
                        success: true,
                        chunk_id,
                        interim_transcript: result.interim_transcript,
                    });
                } else {
                    callback?.({
                        success: false,
                        error: result.error,
                    });
                }
            } catch (error) {
                console.error('Error processing voice chunk:', error);
                callback?.({
                    success: false,
                    error: { code: 'ASR_FAILURE', message: 'Failed to process audio' },
                });
            }
        });

        /**
         * End voice session and get final transcript
         * Client sends: { session_id, asset_context?: AssetContext[], send_to_planner?: boolean }
         */
        socket.on('input:voice:end', async (data, callback) => {
            try {
                const { session_id, asset_context, send_to_planner } = data;

                if (!session_id) {
                    return callback?.({
                        success: false,
                        error: { code: 'VALIDATION_ERROR', message: 'session_id is required' },
                    });
                }

                // Verify session
                const session = activeVoiceSessions.get(session_id);
                if (!session || session.user_id !== userId) {
                    return callback?.({
                        success: false,
                        error: { code: 'AUDIO_STREAM_ERROR', message: 'Invalid or expired session' },
                    });
                }

                // End session and generate envelope
                const result = await voiceInputHandlerService.endVoiceSession({
                    session_id,
                    asset_context,
                });

                // Clean up session tracking
                activeVoiceSessions.delete(session_id);
                socket.leave(`voice:${session_id}`);

                if (result.success && result.envelope) {
                    // ===== REAL-TIME CONSOLE LOG - VOICE SESSION ENDED =====
                    console.log('\n' + '='.repeat(60));
                    console.log('🎤✅ VOICE SESSION ENDED - FINAL TRANSCRIPT');
                    console.log('='.repeat(60));
                    console.log(`👤 User ID: ${userId}`);
                    console.log(`🔗 Session: ${session_id}`);
                    console.log(`📊 Total Chunks: ${session?.chunk_count || 0}`);
                    console.log(`⏱️ Duration: ${result.transcript?.duration_ms ? (result.transcript.duration_ms / 1000).toFixed(2) + 's' : 'N/A'}`);
                    console.log('─'.repeat(60));
                    console.log(`💬 TRANSCRIPT: "${result.transcript?.final || '(No speech detected)'}"`);
                    console.log('─'.repeat(60));
                    if (result.transcript?.confidence) {
                        console.log(`🎯 Confidence: ${(result.transcript.confidence * 100).toFixed(1)}%`);
                    }
                    console.log(`📅 Time: ${new Date().toLocaleString()}`);
                    console.log('='.repeat(60) + '\n');

                    // Emit final transcript
                    socket.emit('input:voice:transcript', {
                        session_id,
                        type: 'final',
                        text: result.transcript?.final,
                        confidence: result.transcript?.confidence,
                    });

                    // Send to planner if requested
                    if (send_to_planner) {
                        const plannerResult = await plannerAgentService.sendToPlanner(result.envelope);

                        // ===== REAL-TIME CONSOLE LOG - AGENT RESPONSE =====
                        if (plannerResult.response) {
                            console.log('\n' + '='.repeat(60));
                            console.log('🤖 AGENT RESPONSE (Voice Session)');
                            console.log('='.repeat(60));
                            console.log(`📦 Envelope ID: ${result.envelope.envelope_id}`);
                            console.log(`💬 Response: ${JSON.stringify(plannerResult.response, null, 2)}`);
                            console.log(`📅 Time: ${new Date().toLocaleString()}`);
                            console.log('='.repeat(60));
                        }

                        callback?.({
                            success: true,
                            transcript: result.transcript,
                            envelope: result.envelope,
                            planner_response: plannerResult.response,
                            planner_error: plannerResult.error,
                        });
                    } else {
                        callback?.({
                            success: true,
                            transcript: result.transcript,
                            envelope: result.envelope,
                        });
                    }

                    // Emit session ended event
                    socket.emit('input:voice:ended', {
                        session_id,
                        envelope_id: result.envelope.envelope_id,
                    });
                } else {
                    callback?.({
                        success: false,
                        error: result.error,
                    });
                }
            } catch (error) {
                console.error('Error ending voice session:', error);
                callback?.({
                    success: false,
                    error: { code: 'ASR_FAILURE', message: 'Failed to end voice session' },
                });
            }
        });

        /**
         * Cancel voice session (discard audio)
         */
        socket.on('input:voice:cancel', async (data, callback) => {
            try {
                const { session_id } = data;

                if (!session_id) {
                    return callback?.({ success: false });
                }

                // Clean up session
                const session = activeVoiceSessions.get(session_id);
                if (session && session.user_id === userId) {
                    activeVoiceSessions.delete(session_id);
                    socket.leave(`voice:${session_id}`);

                    await auditLoggerService.logVoiceEvent({
                        user_id: userId,
                        session_id,
                        action: 'voice_stream_ended',
                        metadata: { cancelled: true },
                    });
                }

                callback?.({ success: true });
                socket.emit('input:voice:cancelled', { session_id });
            } catch (error) {
                console.error('Error cancelling voice session:', error);
                callback?.({ success: false });
            }
        });

        // ==================== REAL-TIME VOICE TRANSCRIPT EVENTS ====================

        /**
         * Receive real-time voice transcript from frontend (Web Speech API)
         * Client sends: { session_id, text, is_final, confidence? }
         */
        socket.on('input:voice:realtime-transcript', async (data, callback) => {
            try {
                const { session_id, text, is_final, confidence } = data;

                if (!text || text.trim() === '') {
                    return callback?.({ success: true, message: 'Empty transcript ignored' });
                }

                // ===== REAL-TIME CONSOLE LOG - VOICE TO TEXT =====
                console.log('\n' + '='.repeat(60));
                console.log(`🎤➡️📝 REAL-TIME VOICE INPUT ${is_final ? '(FINAL)' : '(INTERIM)'}`);
                console.log('='.repeat(60));
                console.log(`👤 User ID: ${userId}`);
                console.log(`🔗 Session: ${session_id || 'N/A'}`);
                console.log(`💬 Text: "${text}"`);
                if (confidence !== undefined) {
                    console.log(`🎯 Confidence: ${(confidence * 100).toFixed(1)}%`);
                }
                console.log(`📅 Time: ${new Date().toLocaleString()}`);
                console.log('='.repeat(60));

                // Store transcript if session exists
                const session = activeVoiceSessions.get(session_id);
                if (session && is_final) {
                    // You can process final transcripts here
                    // For example, send to planner or store in database
                }

                callback?.({ success: true, received: true, is_final });

                // Emit acknowledgment back to client
                socket.emit('input:voice:transcript-received', {
                    session_id,
                    text,
                    is_final,
                    timestamp: new Date().toISOString(),
                });

            } catch (error) {
                console.error('Error processing real-time transcript:', error);
                callback?.({ success: false, error: 'Failed to process transcript' });
            }
        });

        /**
         * Receive speech recognition status updates
         * Client sends: { status: 'started' | 'stopped' | 'error', error?: string }
         */
        socket.on('input:voice:recognition-status', (data) => {
            const { status, error } = data;

            console.log('\n' + '='.repeat(60));
            console.log(`🎙️ SPEECH RECOGNITION STATUS: ${status.toUpperCase()}`);
            console.log('='.repeat(60));
            console.log(`👤 User ID: ${userId}`);
            if (error) {
                console.log(`❌ Error: ${error}`);
            }
            console.log(`📅 Time: ${new Date().toLocaleString()}`);
            console.log('='.repeat(60));
        });

        // ==================== TEXT INPUT EVENTS ====================

        /**
         * Process text input in real-time
         * Client sends: { session_id, text, asset_context?, send_to_planner? }
         */
        socket.on('input:text:send', async (data, callback) => {
            try {
                const { session_id, text, asset_context, send_to_planner } = data;

                if (!session_id || !text) {
                    return callback?.({
                        success: false,
                        error: { code: 'VALIDATION_ERROR', message: 'session_id and text are required' },
                    });
                }

                const result = await textInputHandlerService.processTextInput({
                    user_id: userId,
                    session_id,
                    text,
                    asset_context,
                });

                if (result.success && result.envelope) {
                    // Send to planner if requested
                    if (send_to_planner) {
                        const plannerResult = await plannerAgentService.sendToPlanner(result.envelope);

                        callback?.({
                            success: true,
                            envelope: result.envelope,
                            planner_response: plannerResult.response,
                            planner_error: plannerResult.error,
                        });

                        // Emit planner response event
                        if (plannerResult.response) {
                            // ===== REAL-TIME CONSOLE LOG - AGENT RESPONSE =====
                            console.log('\n' + '='.repeat(60));
                            console.log('🤖 AGENT RESPONSE (Text Input)');
                            console.log('='.repeat(60));
                            console.log(`📦 Envelope ID: ${result.envelope.envelope_id}`);
                            console.log(`💬 Response: ${JSON.stringify(plannerResult.response, null, 2)}`);
                            console.log(`📅 Time: ${new Date().toLocaleString()}`);
                            console.log('='.repeat(60));

                            socket.emit('input:planner:response', {
                                envelope_id: result.envelope.envelope_id,
                                response: plannerResult.response,
                            });
                        }
                    } else {
                        callback?.({
                            success: true,
                            envelope: result.envelope,
                        });
                    }

                    // Emit text processed event
                    socket.emit('input:text:processed', {
                        envelope_id: result.envelope.envelope_id,
                        session_id,
                    });
                } else {
                    callback?.({
                        success: false,
                        error: result.error,
                    });
                }
            } catch (error) {
                console.error('Error processing text input:', error);
                callback?.({
                    success: false,
                    error: { code: 'PROCESSING_TIMEOUT', message: 'Failed to process text' },
                });
            }
        });

        // ==================== MULTIMODAL INPUT EVENTS ====================

        /**
         * Process multimodal input (text + transcript + asset context)
         * Note: Files are handled via HTTP API due to size constraints
         */
        socket.on('input:multimodal:send', async (data, callback) => {
            try {
                const { session_id, text, voice_transcript, asset_ids, send_to_planner } = data;

                if (!session_id) {
                    return callback?.({
                        success: false,
                        error: { code: 'VALIDATION_ERROR', message: 'session_id is required' },
                    });
                }

                if (!text && !voice_transcript) {
                    return callback?.({
                        success: false,
                        error: { code: 'VALIDATION_ERROR', message: 'At least text or voice_transcript is required' },
                    });
                }

                const result = await contextAggregatorService.processMultimodalInput({
                    user_id: userId,
                    session_id,
                    input: {
                        text,
                        voice_transcript,
                        asset_ids,
                    },
                });

                if (result.success && result.envelope) {
                    if (send_to_planner) {
                        const plannerResult = await plannerAgentService.sendToPlanner(result.envelope);

                        callback?.({
                            success: true,
                            envelope: result.envelope,
                            planner_response: plannerResult.response,
                            planner_error: plannerResult.error,
                        });

                        if (plannerResult.response) {
                            // ===== REAL-TIME CONSOLE LOG - AGENT RESPONSE =====
                            console.log('\n' + '='.repeat(60));
                            console.log('🤖 AGENT RESPONSE (Multimodal Input)');
                            console.log('='.repeat(60));
                            console.log(`📦 Envelope ID: ${result.envelope.envelope_id}`);
                            console.log(`💬 Response: ${JSON.stringify(plannerResult.response, null, 2)}`);
                            console.log(`📅 Time: ${new Date().toLocaleString()}`);
                            console.log('='.repeat(60));

                            socket.emit('input:planner:response', {
                                envelope_id: result.envelope.envelope_id,
                                response: plannerResult.response,
                            });
                        }
                    } else {
                        callback?.({
                            success: true,
                            envelope: result.envelope,
                        });
                    }

                    socket.emit('input:multimodal:processed', {
                        envelope_id: result.envelope.envelope_id,
                        session_id,
                    });
                } else {
                    callback?.({
                        success: false,
                        error: result.error,
                    });
                }
            } catch (error) {
                console.error('Error processing multimodal input:', error);
                callback?.({
                    success: false,
                    error: { code: 'PROCESSING_TIMEOUT', message: 'Failed to process input' },
                });
            }
        });

        // ==================== SESSION MANAGEMENT ====================

        /**
         * Get active voice session status
         */
        socket.on('input:voice:status', (data, callback) => {
            const { session_id } = data;
            const session = activeVoiceSessions.get(session_id);

            if (session && session.user_id === userId) {
                callback?.({
                    success: true,
                    session: {
                        session_id: session.session_id,
                        started_at: session.started_at,
                        chunk_count: session.chunk_count,
                        is_active: session.is_active,
                        duration_ms: Date.now() - session.started_at.getTime(),
                    },
                });
            } else {
                callback?.({
                    success: false,
                    error: { code: 'AUDIO_STREAM_ERROR', message: 'Session not found' },
                });
            }
        });

        // ==================== CLEANUP ON DISCONNECT ====================

        socket.on('disconnect', async () => {
            console.log(`Input Agent: User ${userId} disconnected`);

            // Clean up any active voice sessions for this user
            const sessions = Array.from(activeVoiceSessions.entries());
            for (const [session_id, session] of sessions) {
                if (session.user_id === userId) {
                    activeVoiceSessions.delete(session_id);

                    // Log disconnection
                    await auditLoggerService.logVoiceEvent({
                        user_id: userId,
                        session_id,
                        action: 'voice_stream_ended',
                        metadata: { disconnected: true },
                    });
                }
            }
        });
    });

    return io;
}

/**
 * Get count of active voice sessions (for monitoring)
 */
export function getActiveVoiceSessionCount(): number {
    return activeVoiceSessions.size;
}

/**
 * Get all active voice sessions for a user
 */
export function getUserVoiceSessions(userId: string): VoiceSessionState[] {
    return Array.from(activeVoiceSessions.values())
        .filter(session => session.user_id === userId);
}

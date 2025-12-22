import { Server as SocketIOServer, Socket } from 'socket.io';
import { CallManager } from '../utils/callManager';
import User from '../models/User';
import {
    getWebRTCConfig,
    voiceOfferOptions,
    videoOfferOptions,
} from '../lib/webrtc-config';
import {
    VIDEO_QUALITY_PRESETS,
    getVideoConstraints,
    getRecommendedLayout,
    VideoLayoutConfig,
    VideoLayoutType,
} from '../lib/video-call-config';

interface AuthenticatedSocket extends Socket {
    userId?: string;
    userEmail?: string;
}

interface VideoState {
    isVideoEnabled: boolean;
    isAudioEnabled: boolean;
    isScreenSharing: boolean;
    quality: keyof typeof VIDEO_QUALITY_PRESETS;
}

// Track video states for participants
const participantVideoStates = new Map<string, Map<string, VideoState>>();

/**
 * Initialize video call specific socket handlers
 */
export function initializeVideoCallHandlers(
    io: SocketIOServer,
    callManager: CallManager
) {
    console.log('Video call handlers initialized');

    // Helper to get user sockets
    const getUserSockets = (userId: string): Set<string> | undefined => {
        const sockets = new Set<string>();
        const socketEntries = Array.from(io.sockets.sockets.entries());
        for (const [socketId, socket] of socketEntries) {
            const authSocket = socket as AuthenticatedSocket;
            if (authSocket.userId === userId) {
                sockets.add(socketId);
            }
        }
        return sockets.size > 0 ? sockets : undefined;
    };

    io.on('connection', (socket: AuthenticatedSocket) => {
        const userId = socket.userId!;

        // ==================== VIDEO CALL EVENTS ====================

        /**
         * Get WebRTC configuration
         */
        socket.on('webrtc:config:get', (callback) => {
            const config = getWebRTCConfig();
            callback({
                success: true,
                config,
                voiceOfferOptions,
                videoOfferOptions,
            });
        });

        /**
         * Initiate a video call
         */
        socket.on('video:call:initiate', async (data, callback) => {
            const { chatId, targetUserIds, quality = 'high' } = data;

            try {
                const result = await callManager.initiateCall(
                    userId,
                    chatId,
                    'video',
                    targetUserIds
                );

                if (result.error) {
                    return callback?.({ success: false, error: result.error });
                }

                const sessionId = result.sessionId;

                // Get caller info
                const caller = await User.findById(userId).select('fullName avatar');

                // Initialize video states for this session
                participantVideoStates.set(sessionId, new Map());
                participantVideoStates.get(sessionId)!.set(userId, {
                    isVideoEnabled: true,
                    isAudioEnabled: true,
                    isScreenSharing: false,
                    quality,
                });

                // Notify target users
                targetUserIds.forEach((targetUserId: string) => {
                    io.to(`user:${targetUserId}`).emit('video:call:incoming', {
                        sessionId,
                        chatId,
                        callType: 'video',
                        callerId: userId,
                        callerName: caller?.fullName,
                        callerAvatar: caller?.avatar,
                        quality,
                    });
                });

                // Notify caller that call is ringing
                socket.emit('video:call:ringing', {
                    sessionId,
                    chatId,
                    targetUserIds,
                });

                callback?.({
                    success: true,
                    sessionId,
                    config: getWebRTCConfig(),
                    offerOptions: videoOfferOptions,
                    constraints: getVideoConstraints(quality),
                });
            } catch (error) {
                console.error('Error initiating video call:', error);
                callback?.({ success: false, error: 'Failed to initiate video call' });
            }
        });

        /**
         * Accept a video call
         */
        socket.on('video:call:accept', async (data, callback) => {
            const { sessionId, chatId, quality = 'high' } = data;

            try {
                const success = await callManager.acceptCall(sessionId, userId, socket.id);

                if (!success) {
                    return callback?.({ success: false, error: 'Call not found or already ended' });
                }

                // Update video state
                if (participantVideoStates.has(sessionId)) {
                    participantVideoStates.get(sessionId)!.set(userId, {
                        isVideoEnabled: true,
                        isAudioEnabled: true,
                        isScreenSharing: false,
                        quality,
                    });
                }

                const activeCall = callManager.getActiveCall(sessionId);
                if (activeCall) {
                    // Notify caller that call was accepted
                    io.to(`user:${activeCall.callerId}`).emit('video:call:accepted', {
                        sessionId,
                        chatId,
                        acceptedBy: userId,
                    });

                    // Notify other participants
                    io.to(`chat:${chatId}`).emit('video:call:participant-joined', {
                        sessionId,
                        chatId,
                        userId,
                        videoState: participantVideoStates.get(sessionId)?.get(userId),
                    });
                }

                callback?.({
                    success: true,
                    config: getWebRTCConfig(),
                    offerOptions: videoOfferOptions,
                    constraints: getVideoConstraints(quality),
                });
            } catch (error) {
                console.error('Error accepting video call:', error);
                callback?.({ success: false, error: 'Failed to accept video call' });
            }
        });

        /**
         * Toggle video stream
         */
        socket.on('video:toggle', (data) => {
            const { sessionId, chatId, enabled } = data;

            // Update state
            if (participantVideoStates.has(sessionId)) {
                const state = participantVideoStates.get(sessionId)!.get(userId);
                if (state) {
                    state.isVideoEnabled = enabled;
                }
            }

            // Notify all participants
            io.to(`chat:${chatId}`).emit('video:participant-toggle', {
                sessionId,
                userId,
                type: 'video',
                enabled,
            });
        });

        /**
         * Toggle audio stream
         */
        socket.on('video:audio:toggle', (data) => {
            const { sessionId, chatId, muted } = data;

            // Update state
            if (participantVideoStates.has(sessionId)) {
                const state = participantVideoStates.get(sessionId)!.get(userId);
                if (state) {
                    state.isAudioEnabled = !muted;
                }
            }

            // Notify all participants
            io.to(`chat:${chatId}`).emit('video:participant-toggle', {
                sessionId,
                userId,
                type: 'audio',
                muted,
            });
        });

        /**
         * Start screen sharing
         */
        socket.on('video:screenshare:start', async (data, callback) => {
            const { sessionId, chatId } = data;

            // Check if someone else is already sharing
            const sessionStates = participantVideoStates.get(sessionId);
            if (sessionStates) {
                const stateEntries = Array.from(sessionStates.entries());
                for (const [participantId, state] of stateEntries) {
                    if (state.isScreenSharing && participantId !== userId) {
                        return callback?.({
                            success: false,
                            error: 'Another participant is already sharing screen',
                        });
                    }
                }

                const userState = sessionStates.get(userId);
                if (userState) {
                    userState.isScreenSharing = true;
                }
            }

            // Notify all participants
            io.to(`chat:${chatId}`).emit('video:screenshare:started', {
                sessionId,
                userId,
            });

            callback?.({ success: true });
        });

        /**
         * Stop screen sharing
         */
        socket.on('video:screenshare:stop', (data) => {
            const { sessionId, chatId } = data;

            // Update state
            if (participantVideoStates.has(sessionId)) {
                const state = participantVideoStates.get(sessionId)!.get(userId);
                if (state) {
                    state.isScreenSharing = false;
                }
            }

            // Notify all participants
            io.to(`chat:${chatId}`).emit('video:screenshare:stopped', {
                sessionId,
                userId,
            });
        });

        /**
         * Change video quality
         */
        socket.on('video:quality:change', (data, callback) => {
            const { sessionId, chatId, quality } = data;

            if (!VIDEO_QUALITY_PRESETS[quality]) {
                return callback?.({ success: false, error: 'Invalid quality preset' });
            }

            // Update state
            if (participantVideoStates.has(sessionId)) {
                const state = participantVideoStates.get(sessionId)!.get(userId);
                if (state) {
                    state.quality = quality;
                }
            }

            // Notify participant about new constraints
            socket.emit('video:quality:updated', {
                sessionId,
                quality,
                constraints: getVideoConstraints(quality),
            });

            // Notify others
            socket.to(`chat:${chatId}`).emit('video:participant-quality-change', {
                sessionId,
                userId,
                quality,
            });

            callback?.({ success: true, constraints: getVideoConstraints(quality) });
        });

        /**
         * Request video layout change
         */
        socket.on('video:layout:change', (data) => {
            const { sessionId, chatId, layout } = data as {
                sessionId: string;
                chatId: string;
                layout: VideoLayoutConfig;
            };

            // Broadcast layout change to all participants
            io.to(`chat:${chatId}`).emit('video:layout:updated', {
                sessionId,
                layout,
                changedBy: userId,
            });
        });

        /**
         * Get recommended layout based on participants
         */
        socket.on('video:layout:recommend', (data, callback) => {
            const { sessionId } = data;

            const activeCall = callManager.getActiveCall(sessionId);
            if (!activeCall) {
                return callback?.({ success: false, error: 'Call not found' });
            }

            const participantCount = activeCall.participants.size + 1; // +1 for caller
            const layout = getRecommendedLayout(participantCount);

            callback?.({ success: true, layout, participantCount });
        });

        /**
         * Get all video states for a session
         */
        socket.on('video:states:get', (data, callback) => {
            const { sessionId } = data;

            const states = participantVideoStates.get(sessionId);
            if (!states) {
                return callback?.({ success: false, error: 'Session not found' });
            }

            const statesObj: Record<string, VideoState> = {};
            states.forEach((state, participantId) => {
                statesObj[participantId] = state;
            });

            callback?.({ success: true, states: statesObj });
        });

        /**
         * End video call
         */
        socket.on('video:call:end', async (data, callback) => {
            const { sessionId, chatId, reason } = data;

            try {
                const success = await callManager.endCall(sessionId, userId, reason);

                if (success) {
                    // Clean up video states
                    participantVideoStates.delete(sessionId);

                    // Notify all participants
                    io.to(`chat:${chatId}`).emit('video:call:ended', {
                        sessionId,
                        chatId,
                        endedBy: userId,
                        reason: reason || 'completed',
                    });
                }

                callback?.({ success });
            } catch (error) {
                console.error('Error ending video call:', error);
                callback?.({ success: false, error: 'Failed to end call' });
            }
        });

        /**
         * Leave video call (without ending for others)
         */
        socket.on('video:call:leave', async (data, callback) => {
            const { sessionId, chatId } = data;

            try {
                await callManager.participantLeft(sessionId, userId);

                // Clean up user's video state
                if (participantVideoStates.has(sessionId)) {
                    participantVideoStates.get(sessionId)!.delete(userId);
                }

                // Notify other participants
                socket.to(`chat:${chatId}`).emit('video:call:participant-left', {
                    sessionId,
                    chatId,
                    userId,
                    reason: 'left',
                });

                callback?.({ success: true });
            } catch (error) {
                console.error('Error leaving video call:', error);
                callback?.({ success: false, error: 'Failed to leave call' });
            }
        });

        /**
         * Handle connection quality report
         */
        socket.on('video:quality:report', async (data) => {
            const { sessionId, quality } = data;

            await callManager.updateCallQuality(sessionId, quality);

            // Could broadcast poor quality warnings
            if (quality.packetLoss > 5 || quality.jitter > 100) {
                socket.emit('video:quality:warning', {
                    sessionId,
                    message: 'Poor connection quality detected',
                    suggestion: 'Consider lowering video quality',
                });
            }
        });

        /**
         * Pin/spotlight a participant
         */
        socket.on('video:spotlight', (data) => {
            const { sessionId, chatId, targetUserId } = data;

            io.to(`chat:${chatId}`).emit('video:spotlight:changed', {
                sessionId,
                spotlightUserId: targetUserId,
                changedBy: userId,
            });
        });

        /**
         * Handle disconnect - clean up video states
         */
        socket.on('disconnect', () => {
            // Clean up any video states for this user
            participantVideoStates.forEach((states, sessionId) => {
                if (states.has(userId)) {
                    states.delete(userId);

                    // Notify others about disconnect
                    const activeCall = callManager.getActiveCall(sessionId);
                    if (activeCall) {
                        io.to(`chat:${activeCall.chatId}`).emit('video:call:participant-left', {
                            sessionId,
                            chatId: activeCall.chatId,
                            userId,
                            reason: 'disconnected',
                        });
                    }
                }
            });
        });
    });
}

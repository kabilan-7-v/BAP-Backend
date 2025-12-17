import { Server as SocketIOServer } from 'socket.io';
import CallSession from '../models/CallSession';
import User from '../models/User';
import Chat from '../models/Chat';
import mongoose from 'mongoose';
import { CALL_TIMEOUTS } from '../lib/webrtc-config';

interface ActiveCall {
  sessionId: string;
  chatId: string;
  callerId: string;
  callType: 'voice' | 'video';
  participants: Map<string, { socketId: string; status: string }>;
  initiatedAt: Date;
  startedAt?: Date;
  ringTimeout?: NodeJS.Timeout;
}

export class CallManager {
  private activeCalls: Map<string, ActiveCall> = new Map();
  private io: SocketIOServer;

  constructor(io: SocketIOServer) {
    this.io = io;
  }

  /**
   * Initiate a new call
   */
  async initiateCall(
    callerId: string,
    chatId: string,
    callType: 'voice' | 'video',
    targetUserIds: string[]
  ): Promise<{ sessionId: string; error?: string }> {
    try {
      // Check if there's already an active call in this chat
      const existingCall = Array.from(this.activeCalls.values()).find(
        call => call.chatId === chatId && call.participants.size > 0
      );

      if (existingCall) {
        return { sessionId: '', error: 'Call already in progress in this chat' };
      }

      // Verify chat exists and caller is participant
      const chat = await Chat.findOne({
        _id: chatId,
        participants: callerId,
      });

      if (!chat) {
        return { sessionId: '', error: 'Chat not found or access denied' };
      }

      // Create call session in database
      const participants = targetUserIds.map(userId => ({
        userId: new mongoose.Types.ObjectId(userId),
        status: 'ringing' as const,
      }));

      const callSession = new CallSession({
        chatId: new mongoose.Types.ObjectId(chatId),
        callType,
        callerId: new mongoose.Types.ObjectId(callerId),
        participants,
        status: 'initiated',
        initiatedAt: new Date(),
      });

      await callSession.save();

      // Track active call
      const activeCall: ActiveCall = {
        sessionId: callSession._id.toString(),
        chatId,
        callerId,
        callType,
        participants: new Map(),
        initiatedAt: new Date(),
      };

      this.activeCalls.set(callSession._id.toString(), activeCall);

      // Set ring timeout
      activeCall.ringTimeout = setTimeout(() => {
        this.handleMissedCall(callSession._id.toString());
      }, CALL_TIMEOUTS.RING_TIMEOUT);

      return { sessionId: callSession._id.toString() };
    } catch (error) {
      console.error('Error initiating call:', error);
      return { sessionId: '', error: 'Failed to initiate call' };
    }
  }

  /**
   * User accepts the call
   */
  async acceptCall(sessionId: string, userId: string, socketId: string): Promise<boolean> {
    const activeCall = this.activeCalls.get(sessionId);
    if (!activeCall) {
      return false;
    }

    // Add participant to active call
    activeCall.participants.set(userId, { socketId, status: 'joined' });

    // Update database
    const callSession = await CallSession.findById(sessionId);
    if (callSession) {
      const participant = callSession.participants.find(
        p => p.userId.toString() === userId
      );

      if (participant) {
        participant.status = 'joined';
        participant.joinedAt = new Date();
      }

      // If this is the first participant to join, mark call as started
      if (!callSession.startedAt) {
        callSession.status = 'ongoing';
        callSession.startedAt = new Date();
        activeCall.startedAt = new Date();

        // Clear ring timeout
        if (activeCall.ringTimeout) {
          clearTimeout(activeCall.ringTimeout);
          activeCall.ringTimeout = undefined;
        }
      }

      await callSession.save();
    }

    return true;
  }

  /**
   * User rejects the call
   */
  async rejectCall(sessionId: string, userId: string, reason?: string): Promise<boolean> {
    const activeCall = this.activeCalls.get(sessionId);
    if (!activeCall) {
      return false;
    }

    // Update database
    const callSession = await CallSession.findById(sessionId);
    if (callSession) {
      const participant = callSession.participants.find(
        p => p.userId.toString() === userId
      );

      if (participant) {
        participant.status = 'rejected';
        participant.leftAt = new Date();
      }

      // If all participants rejected, end the call
      const allRejected = callSession.participants.every(
        p => p.userId.toString() === callSession.callerId.toString() ||
            p.status === 'rejected' ||
            p.status === 'missed'
      );

      if (allRejected) {
        callSession.status = 'rejected';
        callSession.endedAt = new Date();
        callSession.endReason = 'rejected';
        await callSession.save();

        // Clean up active call
        this.endCall(sessionId, userId, 'rejected');
      } else {
        await callSession.save();
      }
    }

    return true;
  }

  /**
   * End the call
   */
  async endCall(sessionId: string, userId: string, reason?: string): Promise<boolean> {
    const activeCall = this.activeCalls.get(sessionId);
    if (!activeCall) {
      return false;
    }

    // Clear ring timeout if exists
    if (activeCall.ringTimeout) {
      clearTimeout(activeCall.ringTimeout);
    }

    // Update database
    const callSession = await CallSession.findById(sessionId);
    if (callSession) {
      callSession.status = 'ended';
      callSession.endedAt = new Date();
      callSession.endReason = (reason as any) || 'completed';

      // Mark participants as left
      callSession.participants.forEach(participant => {
        if (participant.status === 'joined' && !participant.leftAt) {
          participant.status = 'left';
          participant.leftAt = new Date();
        }
      });

      await callSession.save();
    }

    // Remove from active calls
    this.activeCalls.delete(sessionId);

    return true;
  }

  /**
   * Handle missed call
   */
  private async handleMissedCall(sessionId: string): Promise<void> {
    const activeCall = this.activeCalls.get(sessionId);
    if (!activeCall) {
      return;
    }

    const callSession = await CallSession.findById(sessionId);
    if (callSession && callSession.status === 'initiated') {
      // Mark as missed if no one joined
      callSession.status = 'missed';
      callSession.endedAt = new Date();
      callSession.endReason = 'missed';

      // Mark all participants as missed
      callSession.participants.forEach(participant => {
        if (participant.status === 'ringing') {
          participant.status = 'missed';
        }
      });

      await callSession.save();

      // Notify participants that call was missed
      this.io.to(`chat:${activeCall.chatId}`).emit('call:missed', {
        sessionId,
        chatId: activeCall.chatId,
        callerId: activeCall.callerId,
      });

      // Clean up
      this.activeCalls.delete(sessionId);
    }
  }

  /**
   * Participant leaves the call
   */
  async participantLeft(sessionId: string, userId: string): Promise<void> {
    const activeCall = this.activeCalls.get(sessionId);
    if (!activeCall) {
      return;
    }

    // Remove participant from active call
    activeCall.participants.delete(userId);

    // Update database
    const callSession = await CallSession.findById(sessionId);
    if (callSession) {
      const participant = callSession.participants.find(
        p => p.userId.toString() === userId
      );

      if (participant) {
        participant.status = 'left';
        participant.leftAt = new Date();
      }

      await callSession.save();

      // If no participants left (only caller), end the call
      if (activeCall.participants.size === 0) {
        await this.endCall(sessionId, userId, 'completed');
      }
    }
  }

  /**
   * Update call quality metrics
   */
  async updateCallQuality(
    sessionId: string,
    quality: {
      avgBitrate?: number;
      packetLoss?: number;
      jitter?: number;
    }
  ): Promise<void> {
    try {
      await CallSession.findByIdAndUpdate(sessionId, {
        $set: { quality },
      });
    } catch (error) {
      console.error('Error updating call quality:', error);
    }
  }

  /**
   * Get active call by chat ID
   */
  getActiveCallByChat(chatId: string): ActiveCall | undefined {
    return Array.from(this.activeCalls.values()).find(
      call => call.chatId === chatId
    );
  }

  /**
   * Get active call by session ID
   */
  getActiveCall(sessionId: string): ActiveCall | undefined {
    return this.activeCalls.get(sessionId);
  }

  /**
   * Check if user is in a call
   */
  isUserInCall(userId: string): boolean {
    return Array.from(this.activeCalls.values()).some(
      call => call.participants.has(userId) || call.callerId === userId
    );
  }

  /**
   * Get user's current call
   */
  getUserActiveCall(userId: string): ActiveCall | undefined {
    return Array.from(this.activeCalls.values()).find(
      call => call.participants.has(userId) || call.callerId === userId
    );
  }
}

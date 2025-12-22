import { Server as SocketIOServer, Socket } from 'socket.io';
import { verifyToken } from '../lib/jwt';
import connectDB from '../lib/mongodb';
import User from '../models/User';
import Chat from '../models/Chat';
import Message from '../models/Message';
import mongoose from 'mongoose';
import { initializeInputAgentSocketHandlers } from './input-agent-handlers';
import { initializeVideoCallHandlers } from './video-call-handlers';
import { CallManager } from '../utils/callManager';
import { getWebRTCConfig, voiceOfferOptions, videoOfferOptions } from '../lib/webrtc-config';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  userEmail?: string;
}

// Track online users: socketId -> userId
const onlineUsers = new Map<string, string>();
// Track user sockets: userId -> Set of socketIds (for multi-device support)
const userSockets = new Map<string, Set<string>>();

export function initializeSocketHandlers(io: SocketIOServer) {
  console.log('Socket.IO handlers initialized');

  // Create CallManager instance for managing call sessions
  const callManager = new CallManager(io);

  // Authentication middleware
  io.use(async (socket: AuthenticatedSocket, next) => {
    try {
      console.log('Socket auth attempt from:', socket.id);
      const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');

      if (!token) {
        console.log('No token provided for socket:', socket.id);
        return next(new Error('Authentication required'));
      }

      console.log('Token received, length:', token.length);
      const payload = await verifyToken(token);

      if (!payload) {
        console.log('Token verification failed for socket:', socket.id);
        return next(new Error('Invalid token'));
      }

      console.log('Token verified for user:', payload.userId);
      socket.userId = payload.userId;
      socket.userEmail = payload.email;
      next();
    } catch (error) {
      console.error('Socket auth error:', error);
      next(new Error('Authentication failed'));
    }
  });

  io.on('connection', async (socket: AuthenticatedSocket) => {
    const userId = socket.userId!;
    console.log(`User connected: ${userId} (socket: ${socket.id})`);

    // Connect to database
    await connectDB();

    // Track online user
    onlineUsers.set(socket.id, userId);
    if (!userSockets.has(userId)) {
      userSockets.set(userId, new Set());
    }
    userSockets.get(userId)!.add(socket.id);

    // Update user status to online
    await User.findByIdAndUpdate(userId, { status: 'online', lastSeen: new Date() });

    // Join user to their own room for direct messages
    socket.join(`user:${userId}`);

    // Join all chat rooms the user is part of
    const userChats = await Chat.find({ participants: userId }).select('_id');
    userChats.forEach(chat => {
      socket.join(`chat:${chat._id}`);
    });

    // Broadcast online status to all users
    io.emit('user:online', { userId, status: 'online' });

    // Get online users list
    socket.on('users:online:get', async (callback) => {
      const uniqueUserIds = Array.from(new Set(Array.from(onlineUsers.values())));
      callback({ onlineUsers: uniqueUserIds });
    });

    // ==================== CHAT EVENTS ====================

    // Join a specific chat room
    socket.on('chat:join', async ({ chatId }) => {
      try {
        const chat = await Chat.findOne({
          _id: chatId,
          participants: userId,
        });

        if (chat) {
          socket.join(`chat:${chatId}`);
          socket.emit('chat:joined', { chatId });
        } else {
          socket.emit('error', { message: 'Chat not found or access denied' });
        }
      } catch (error) {
        socket.emit('error', { message: 'Failed to join chat' });
      }
    });

    // Leave a chat room
    socket.on('chat:leave', ({ chatId }) => {
      socket.leave(`chat:${chatId}`);
      socket.emit('chat:left', { chatId });
    });

    // ==================== MESSAGE EVENTS ====================

    // Send a new message
    socket.on('message:send', async ({ chatId, content, attachments, replyTo }, callback) => {
      try {
        // Verify user is part of the chat
        const chat = await Chat.findOne({
          _id: chatId,
          participants: userId,
        });

        if (!chat) {
          return callback?.({ error: 'Chat not found or access denied' });
        }

        // Create message
        const message = new Message({
          chatId,
          senderId: userId,
          content: content || '',
          attachments: attachments || [],
          replyTo: replyTo || undefined,
          status: 'sent',
          readBy: new Map([[userId, new Date()]]),
          deliveredTo: new Map([[userId, new Date()]]),
        });

        await message.save();

        // Update chat's last message
        chat.lastMessage = message._id;
        chat.lastMessageAt = message.createdAt;

        // Increment unread count for other participants
        chat.participants.forEach(participantId => {
          const participantIdStr = participantId.toString();
          if (participantIdStr !== userId) {
            const currentCount = chat.unreadCount.get(participantIdStr) || 0;
            chat.unreadCount.set(participantIdStr, currentCount + 1);
          }
        });

        await chat.save();

        // Populate sender info
        const populatedMessage = await Message.findById(message._id)
          .populate('senderId', 'fullName email avatar status')
          .populate('replyTo');

        // Emit to all users in the chat
        io.to(`chat:${chatId}`).emit('message:new', {
          message: populatedMessage,
          chatId,
        });

        // Also emit to individual user rooms for users not in the chat room
        chat.participants.forEach(participantId => {
          const participantIdStr = participantId.toString();
          if (participantIdStr !== userId) {
            io.to(`user:${participantIdStr}`).emit('message:notification', {
              message: populatedMessage,
              chatId,
              chat: {
                id: chat._id,
                name: chat.name,
                type: chat.type,
              },
            });
          }
        });

        callback?.({ success: true, message: populatedMessage });
      } catch (error) {
        console.error('Error sending message:', error);
        callback?.({ error: 'Failed to send message' });
      }
    });

    // Mark message as delivered
    socket.on('message:delivered', async ({ messageId, chatId }) => {
      try {
        const message = await Message.findById(messageId);
        if (message && message.senderId.toString() !== userId) {
          message.deliveredTo.set(userId, new Date());

          // Update status to delivered if not already read
          if (message.status === 'sent') {
            message.status = 'delivered';
          }

          await message.save();

          // Notify sender
          io.to(`user:${message.senderId}`).emit('message:status', {
            messageId,
            chatId,
            status: 'delivered',
            userId,
          });
        }
      } catch (error) {
        console.error('Error marking message as delivered:', error);
      }
    });

    // Mark message as read
    socket.on('message:read', async ({ messageId, chatId }) => {
      try {
        const message = await Message.findById(messageId);
        if (message && message.senderId.toString() !== userId) {
          message.readBy.set(userId, new Date());
          message.status = 'read';
          await message.save();

          // Update unread count in chat
          await Chat.findByIdAndUpdate(chatId, {
            $set: { [`unreadCount.${userId}`]: 0 },
          });

          // Notify sender
          io.to(`user:${message.senderId}`).emit('message:status', {
            messageId,
            chatId,
            status: 'read',
            userId,
          });
        }
      } catch (error) {
        console.error('Error marking message as read:', error);
      }
    });

    // Mark all messages in chat as read
    socket.on('chat:read', async ({ chatId }) => {
      try {
        const chat = await Chat.findOne({
          _id: chatId,
          participants: userId,
        });

        if (!chat) return;

        // Mark all unread messages as read
        const unreadMessages = await Message.find({
          chatId,
          senderId: { $ne: userId },
          [`readBy.${userId}`]: { $exists: false },
        });

        const now = new Date();
        for (const message of unreadMessages) {
          message.readBy.set(userId, now);
          message.status = 'read';
          await message.save();

          // Notify sender
          io.to(`user:${message.senderId}`).emit('message:status', {
            messageId: message._id,
            chatId,
            status: 'read',
            userId,
          });
        }

        // Reset unread count
        chat.unreadCount.set(userId, 0);
        await chat.save();

        socket.emit('chat:read:done', { chatId });
      } catch (error) {
        console.error('Error marking chat as read:', error);
      }
    });

    // ==================== TYPING INDICATORS ====================

    socket.on('typing:start', ({ chatId }) => {
      socket.to(`chat:${chatId}`).emit('typing:start', { chatId, userId });
    });

    socket.on('typing:stop', ({ chatId }) => {
      socket.to(`chat:${chatId}`).emit('typing:stop', { chatId, userId });
    });

    // ==================== WEBRTC SIGNALING ====================

    // Initiate a call
    socket.on('call:initiate', async ({ chatId, callType, targetUserId }) => {
      try {
        const user = await User.findById(userId).select('fullName avatar');

        io.to(`user:${targetUserId}`).emit('call:incoming', {
          chatId,
          callType, // 'video' or 'voice'
          callerId: userId,
          callerName: user?.fullName,
          callerAvatar: user?.avatar,
        });

        socket.emit('call:ringing', { chatId, targetUserId });
      } catch (error) {
        socket.emit('call:error', { message: 'Failed to initiate call' });
      }
    });

    // Accept a call
    socket.on('call:accept', ({ chatId, callerId }) => {
      io.to(`user:${callerId}`).emit('call:accepted', {
        chatId,
        acceptedBy: userId,
      });
    });

    // Reject/decline a call
    socket.on('call:reject', ({ chatId, callerId, reason }) => {
      io.to(`user:${callerId}`).emit('call:rejected', {
        chatId,
        rejectedBy: userId,
        reason: reason || 'declined',
      });
    });

    // WebRTC offer
    socket.on('webrtc:offer', ({ targetUserId, offer, chatId }) => {
      io.to(`user:${targetUserId}`).emit('webrtc:offer', {
        offer,
        chatId,
        fromUserId: userId,
      });
    });

    // WebRTC answer
    socket.on('webrtc:answer', ({ targetUserId, answer, chatId }) => {
      io.to(`user:${targetUserId}`).emit('webrtc:answer', {
        answer,
        chatId,
        fromUserId: userId,
      });
    });

    // ICE candidate
    socket.on('webrtc:ice-candidate', ({ targetUserId, candidate, chatId }) => {
      io.to(`user:${targetUserId}`).emit('webrtc:ice-candidate', {
        candidate,
        chatId,
        fromUserId: userId,
      });
    });

    // End call
    socket.on('call:end', ({ chatId, targetUserId }) => {
      io.to(`user:${targetUserId}`).emit('call:ended', {
        chatId,
        endedBy: userId,
      });
    });

    // ==================== DISCONNECT ====================

    socket.on('disconnect', async () => {
      console.log(`User disconnected: ${userId} (socket: ${socket.id})`);

      // Remove from tracking
      onlineUsers.delete(socket.id);
      const userSocketSet = userSockets.get(userId);
      if (userSocketSet) {
        userSocketSet.delete(socket.id);

        // Only mark offline if no more connections
        if (userSocketSet.size === 0) {
          userSockets.delete(userId);

          // Update user status to offline
          await User.findByIdAndUpdate(userId, {
            status: 'offline',
            lastSeen: new Date()
          });

          // Broadcast offline status
          io.emit('user:offline', { userId, status: 'offline', lastSeen: new Date() });
        }
      }
    });
  });

  // Initialize Input Agent socket handlers for voice/text streaming
  initializeInputAgentSocketHandlers(io);

  // Initialize Video Call socket handlers
  initializeVideoCallHandlers(io, callManager);

  return io;
}

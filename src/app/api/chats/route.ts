import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Chat from '@/models/Chat';
import User from '@/models/User';
import { withAuthAndUser } from '@/middleware/auth';
import mongoose from 'mongoose';

// GET /api/chats - Get all chats for the authenticated user
export async function GET(request: NextRequest) {
  return withAuthAndUser(request, async (_req, user) => {
    try {
      await connectDB();

      const chats = await Chat.find({
        participants: user._id,
      })
        .populate('participants', 'fullName email avatar status lastSeen')
        .populate('lastMessage')
        .populate('createdBy', 'fullName email avatar')
        .sort({ lastMessageAt: -1, createdAt: -1 });

      // Transform chats to include user-specific data
      const transformedChats = chats.map(chat => {
        const chatObj = chat.toObject();
        return {
          ...chatObj,
          id: chatObj._id,
          isPinned: chat.isPinned.get(user._id.toString()) || false,
          isMuted: chat.isMuted.get(user._id.toString()) || false,
          unreadCount: chat.unreadCount.get(user._id.toString()) || 0,
        };
      });

      return NextResponse.json({
        success: true,
        data: { chats: transformedChats },
      });
    } catch (error) {
      console.error('Error fetching chats:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch chats' },
        { status: 500 }
      );
    }
  });
}

// POST /api/chats - Create a new chat
export async function POST(request: NextRequest) {
  return withAuthAndUser(request, async (req, user) => {
    try {
      await connectDB();

      const body = await req.json();
      const { type, name, participantIds, avatar } = body;

      if (!participantIds || !Array.isArray(participantIds) || participantIds.length === 0) {
        return NextResponse.json(
          { success: false, error: 'Participant IDs are required' },
          { status: 400 }
        );
      }

      // Ensure current user is in participants
      const allParticipants = Array.from(new Set([user._id.toString(), ...participantIds]));

      // For individual chats, check if chat already exists
      if (type === 'individual' && allParticipants.length === 2) {
        const existingChat = await Chat.findOne({
          type: 'individual',
          participants: { $all: allParticipants, $size: 2 },
        })
          .populate('participants', 'fullName email avatar status lastSeen')
          .populate('lastMessage');

        if (existingChat) {
          return NextResponse.json({
            success: true,
            data: { chat: existingChat, existing: true },
          });
        }
      }

      // Validate participants exist
      const validParticipants = await User.find({
        _id: { $in: allParticipants.map(id => mongoose.Types.ObjectId.createFromHexString(id)) },
      }).select('_id');

      if (validParticipants.length !== allParticipants.length) {
        return NextResponse.json(
          { success: false, error: 'One or more participants not found' },
          { status: 400 }
          
        );
      }

      // Create chat
      const chat = new Chat({
        type: type || (allParticipants.length > 2 ? 'group' : 'individual'),
        name: type === 'group' ? name : undefined,
        participants: allParticipants,
        admins: type === 'group' ? [user._id] : undefined,
        avatar: type === 'group' ? avatar : undefined,
        createdBy: user._id,
        historyEnabled: true,
      });

      // Initialize unread counts
      allParticipants.forEach(participantId => {
        chat.unreadCount.set(participantId, 0);
        chat.isPinned.set(participantId, false);
        chat.isMuted.set(participantId, false);
      });

      await chat.save();

      // Populate and return
      const populatedChat = await Chat.findById(chat._id)
        .populate('participants', 'fullName email avatar status lastSeen')
        .populate('createdBy', 'fullName email avatar');

      return NextResponse.json({
        success: true,
        data: { chat: populatedChat },
      }, { status: 201 });
    } catch (error) {
      console.error('Error creating chat:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to create chat' },
        { status: 500 }
      );
    }
  });
}

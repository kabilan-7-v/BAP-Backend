import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Chat from '@/models/Chat';
import Message from '@/models/Message';
import { withAuthAndUser } from '@/middleware/auth';

interface RouteParams {
  params: { chatId: string };
}

// GET /api/chats/[chatId] - Get a specific chat
export async function GET(request: NextRequest, { params }: RouteParams) {
  return withAuthAndUser(request, async (req, user) => {
    try {
      await connectDB();

      const chat = await Chat.findOne({
        _id: params.chatId,
        participants: user._id,
      })
        .populate('participants', 'fullName email avatar status lastSeen')
        .populate('lastMessage')
        .populate('createdBy', 'fullName email avatar');

      if (!chat) {
        return NextResponse.json(
          { success: false, error: 'Chat not found' },
          { status: 404 }
        );
      }

      const chatObj = chat.toObject();
      const transformedChat = {
        ...chatObj,
        id: chatObj._id,
        isPinned: chat.isPinned.get(user._id.toString()) || false,
        isMuted: chat.isMuted.get(user._id.toString()) || false,
        unreadCount: chat.unreadCount.get(user._id.toString()) || 0,
      };

      return NextResponse.json({
        success: true,
        data: { chat: transformedChat },
      });
    } catch (error) {
      console.error('Error fetching chat:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch chat' },
        { status: 500 }
      );
    }
  });
}

// PUT /api/chats/[chatId] - Update a chat
export async function PUT(request: NextRequest, { params }: RouteParams) {
  return withAuthAndUser(request, async (req, user) => {
    try {
      await connectDB();

      const body = await req.json();
      const { name, avatar, isPinned, isMuted, historyEnabled } = body;

      const chat = await Chat.findOne({
        _id: params.chatId,
        participants: user._id,
      });

      if (!chat) {
        return NextResponse.json(
          { success: false, error: 'Chat not found' },
          { status: 404 }
        );
      }

      // Update group-specific fields (only for group chats and admins)
      if (chat.type === 'group' && chat.admins?.includes(user._id)) {
        if (name !== undefined) chat.name = name;
        if (avatar !== undefined) chat.avatar = avatar;
        if (historyEnabled !== undefined) chat.historyEnabled = historyEnabled;
      }

      // Update user-specific settings
      if (isPinned !== undefined) {
        chat.isPinned.set(user._id.toString(), isPinned);
      }
      if (isMuted !== undefined) {
        chat.isMuted.set(user._id.toString(), isMuted);
      }

      await chat.save();

      const populatedChat = await Chat.findById(chat._id)
        .populate('participants', 'fullName email avatar status lastSeen')
        .populate('lastMessage')
        .populate('createdBy', 'fullName email avatar');

      const chatObj = populatedChat!.toObject();
      const transformedChat = {
        ...chatObj,
        id: chatObj._id,
        isPinned: populatedChat!.isPinned.get(user._id.toString()) || false,
        isMuted: populatedChat!.isMuted.get(user._id.toString()) || false,
        unreadCount: populatedChat!.unreadCount.get(user._id.toString()) || 0,
      };

      return NextResponse.json({
        success: true,
        data: { chat: transformedChat },
      });
    } catch (error) {
      console.error('Error updating chat:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to update chat' },
        { status: 500 }
      );
    }
  });
}

// DELETE /api/chats/[chatId] - Delete/leave a chat
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  return withAuthAndUser(request, async (req, user) => {
    try {
      await connectDB();

      const chat = await Chat.findOne({
        _id: params.chatId,
        participants: user._id,
      });

      if (!chat) {
        return NextResponse.json(
          { success: false, error: 'Chat not found' },
          { status: 404 }
        );
      }

      if (chat.type === 'individual') {
        // For individual chats, delete all messages and the chat
        await Message.deleteMany({ chatId: chat._id });
        await Chat.deleteOne({ _id: chat._id });
      } else {
        // For group chats, remove user from participants
        chat.participants = chat.participants.filter(
          p => p.toString() !== user._id.toString()
        );

        // Also remove from admins if applicable
        if (chat.admins) {
          chat.admins = chat.admins.filter(
            a => a.toString() !== user._id.toString()
          );
        }

        // Delete chat if no participants left
        if (chat.participants.length === 0) {
          await Message.deleteMany({ chatId: chat._id });
          await Chat.deleteOne({ _id: chat._id });
        } else {
          // Clean up user-specific data
          chat.isPinned.delete(user._id.toString());
          chat.isMuted.delete(user._id.toString());
          chat.unreadCount.delete(user._id.toString());
          await chat.save();
        }
      }

      return NextResponse.json({
        success: true,
        message: 'Chat deleted successfully',
      });
    } catch (error) {
      console.error('Error deleting chat:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to delete chat' },
        { status: 500 }
      );
    }
  });
}

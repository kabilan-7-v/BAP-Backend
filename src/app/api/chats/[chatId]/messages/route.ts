import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Chat from '@/models/Chat';
import Message from '@/models/Message';
import { withAuthAndUser } from '@/middleware/auth';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: { chatId: string };
}

// GET /api/chats/[chatId]/messages - Get messages for a chat
export async function GET(request: NextRequest, { params }: RouteParams) {
  return withAuthAndUser(request, async (req, user) => {
    try {
      await connectDB();

      // Verify user is part of the chat
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

      // Parse query params
      const { searchParams } = new URL(req.url);
      const limit = parseInt(searchParams.get('limit') || '50', 10);
      const before = searchParams.get('before'); // cursor for pagination
      const after = searchParams.get('after');

      // Build query
      const query: any = {
        chatId: params.chatId,
        isDeleted: false,
      };

      if (before) {
        query.createdAt = { $lt: new Date(before) };
      } else if (after) {
        query.createdAt = { $gt: new Date(after) };
      }

      // Fetch messages
      const messages = await Message.find(query)
        .populate('senderId', 'fullName email avatar status')
        .populate('replyTo')
        .sort({ createdAt: after ? 1 : -1 })
        .limit(limit);

      // If fetching newer messages (after), reverse to maintain chronological order
      if (after) {
        messages.reverse();
      }

      // Transform messages
      const transformedMessages = messages.map(msg => {
        const msgObj = msg.toObject();
        return {
          ...msgObj,
          id: msgObj._id,
          isReadByMe: msg.readBy.has(user._id.toString()),
          readAt: msg.readBy.get(user._id.toString()),
        };
      });

      // Pagination info
      const hasMore = messages.length === limit;
      const oldestMessage = messages[messages.length - 1];
      const newestMessage = messages[0];

      return NextResponse.json({
        success: true,
        data: {
          messages: transformedMessages,
          pagination: {
            hasMore,
            oldestTimestamp: oldestMessage?.createdAt,
            newestTimestamp: newestMessage?.createdAt,
          },
        },
      });
    } catch (error) {
      console.error('Error fetching messages:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch messages' },
        { status: 500 }
      );
    }
  });
}

// POST /api/chats/[chatId]/messages - Send a message (REST alternative to socket)
export async function POST(request: NextRequest, { params }: RouteParams) {
  return withAuthAndUser(request, async (req, user) => {
    try {
      await connectDB();

      // Verify user is part of the chat
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

      const body = await req.json();
      const { content, attachments, replyTo } = body;

      if (!content && (!attachments || attachments.length === 0)) {
        return NextResponse.json(
          { success: false, error: 'Message content or attachments required' },
          { status: 400 }
        );
      }

      // Create message
      const message = new Message({
        chatId: params.chatId,
        senderId: user._id,
        content: content || '',
        attachments: attachments || [],
        replyTo: replyTo || undefined,
        status: 'sent',
        readBy: new Map([[user._id.toString(), new Date()]]),
        deliveredTo: new Map([[user._id.toString(), new Date()]]),
      });

      await message.save();

      // Update chat's last message
      chat.lastMessage = message._id;
      chat.lastMessageAt = message.createdAt;

      // Increment unread count for other participants
      chat.participants.forEach(participantId => {
        const participantIdStr = participantId.toString();
        if (participantIdStr !== user._id.toString()) {
          const currentCount = chat.unreadCount.get(participantIdStr) || 0;
          chat.unreadCount.set(participantIdStr, currentCount + 1);
        }
      });

      await chat.save();

      // Populate and return
      const populatedMessage = await Message.findById(message._id)
        .populate('senderId', 'fullName email avatar status')
        .populate('replyTo');

      return NextResponse.json({
        success: true,
        data: { message: populatedMessage },
      }, { status: 201 });
    } catch (error) {
      console.error('Error sending message:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to send message' },
        { status: 500 }
      );
    }
  });
}

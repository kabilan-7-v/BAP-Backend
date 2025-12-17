import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Chat from '@/models/Chat';
import Message from '@/models/Message';
import { withAuthAndUser } from '@/middleware/auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET /api/messages/search - Search messages across all user's chats
export async function GET(request: NextRequest) {
  return withAuthAndUser(request, async (req, user) => {
    try {
      await connectDB();

      const { searchParams } = new URL(req.url);
      const query = searchParams.get('q');
      const chatId = searchParams.get('chatId');
      const limit = parseInt(searchParams.get('limit') || '50', 10);

      if (!query || query.length < 2) {
        return NextResponse.json(
          { success: false, error: 'Search query must be at least 2 characters' },
          { status: 400 }
        );
      }

      // Get all chats the user is part of
      const userChatIds = await Chat.find({ participants: user._id }).select('_id');
      const chatIdsList = userChatIds.map(c => c._id);

      // Build message search query
      const searchQuery: any = {
        chatId: chatId ? chatId : { $in: chatIdsList },
        isDeleted: false,
        content: { $regex: query, $options: 'i' },
      };

      // Search messages
      const messages = await Message.find(searchQuery)
        .populate('senderId', 'fullName email avatar')
        .populate({
          path: 'chatId',
          select: 'name type participants',
          populate: {
            path: 'participants',
            select: 'fullName email avatar',
          },
        })
        .sort({ createdAt: -1 })
        .limit(limit);

      // Transform results
      const results = messages.map(msg => {
        const msgObj = msg.toObject();
        return {
          id: msgObj._id,
          content: msgObj.content,
          timestamp: msgObj.createdAt,
          sender: msgObj.senderId,
          chat: msgObj.chatId,
          attachments: msgObj.attachments,
        };
      });

      return NextResponse.json({
        success: true,
        data: {
          results,
          query,
          totalResults: results.length,
        },
      });
    } catch (error) {
      console.error('Error searching messages:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to search messages' },
        { status: 500 }
      );
    }
  });
}

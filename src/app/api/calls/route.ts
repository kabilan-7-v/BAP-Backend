import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import CallSession from '@/models/CallSession';
import Chat from '@/models/Chat';
import { withAuthAndUser } from '@/middleware/auth';

// GET /api/calls - Get call history
export async function GET(request: NextRequest) {
  return withAuthAndUser(request, async (req, user) => {
    try {
      await connectDB();

      const { searchParams } = new URL(req.url);
      const chatId = searchParams.get('chatId');
      const callType = searchParams.get('type'); // 'voice' or 'video'
      const status = searchParams.get('status'); // 'ended', 'missed', etc.
      const limit = parseInt(searchParams.get('limit') || '50', 10);
      const offset = parseInt(searchParams.get('offset') || '0', 10);

      // Build query - find calls where user is caller or participant
      const query: any = {
        $or: [
          { callerId: user._id },
          { 'participants.userId': user._id },
        ],
      };

      // Filter by chat if provided
      if (chatId) {
        // Verify user has access to this chat
        const chat = await Chat.findOne({
          _id: chatId,
          participants: user._id,
        });

        if (!chat) {
          return NextResponse.json(
            { success: false, error: 'Chat not found or access denied' },
            { status: 404 }
          );
        }

        query.chatId = chatId;
      }

      // Filter by call type
      if (callType && (callType === 'voice' || callType === 'video')) {
        query.callType = callType;
      }

      // Filter by status
      if (status) {
        query.status = status;
      }

      // Get total count
      const totalCount = await CallSession.countDocuments(query);

      // Get calls with pagination
      const calls = await CallSession.find(query)
        .populate('callerId', 'fullName email avatar')
        .populate('chatId', 'name type participants')
        .populate('participants.userId', 'fullName email avatar')
        .sort({ createdAt: -1 })
        .skip(offset)
        .limit(limit);

      // Transform results to include user-specific information
      const results = calls.map(call => {
        const callObj = call.toObject();
        const isCallerId = callObj.callerId._id.toString() === user._id.toString();

        // Find user's participant record
        const userParticipant = callObj.participants.find(
          (p: any) => p.userId._id.toString() === user._id.toString()
        );

        return {
          id: callObj._id,
          chatId: callObj.chatId,
          callType: callObj.callType,
          status: callObj.status,
          isIncoming: !isCallerId,
          isOutgoing: isCallerId,
          caller: callObj.callerId,
          participants: callObj.participants,
          userStatus: userParticipant?.status,
          initiatedAt: callObj.initiatedAt,
          startedAt: callObj.startedAt,
          endedAt: callObj.endedAt,
          duration: callObj.duration,
          endReason: callObj.endReason,
          quality: callObj.quality,
        };
      });

      return NextResponse.json({
        success: true,
        data: {
          calls: results,
          pagination: {
            total: totalCount,
            limit,
            offset,
            hasMore: offset + limit < totalCount,
          },
        },
      });
    } catch (error) {
      console.error('Error fetching call history:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch call history' },
        { status: 500 }
      );
    }
  });
}

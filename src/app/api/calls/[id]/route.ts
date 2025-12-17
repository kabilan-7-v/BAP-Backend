import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import CallSession from '@/models/CallSession';
import { withAuthAndUser } from '@/middleware/auth';

// GET /api/calls/[id] - Get specific call details
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  return withAuthAndUser(request, async (req, user) => {
    try {
      await connectDB();

      const callId = params.id;

      // Find call and verify user has access
      const call = await CallSession.findOne({
        _id: callId,
        $or: [
          { callerId: user._id },
          { 'participants.userId': user._id },
        ],
      })
        .populate('callerId', 'fullName email avatar status')
        .populate('chatId', 'name type participants avatar')
        .populate('participants.userId', 'fullName email avatar status');

      if (!call) {
        return NextResponse.json(
          { success: false, error: 'Call not found or access denied' },
          { status: 404 }
        );
      }

      const callObj = call.toObject();
      const isCallerId = callObj.callerId._id.toString() === user._id.toString();

      // Find user's participant record
      const userParticipant = callObj.participants.find(
        (p: any) => p.userId._id.toString() === user._id.toString()
      );

      return NextResponse.json({
        success: true,
        data: {
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
        },
      });
    } catch (error) {
      console.error('Error fetching call details:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch call details' },
        { status: 500 }
      );
    }
  });
}

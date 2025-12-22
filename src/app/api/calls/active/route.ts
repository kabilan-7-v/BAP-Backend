import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import CallSession from '@/models/CallSession';
import Chat from '@/models/Chat';
import { withAuthAndUser } from '@/middleware/auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET /api/calls/active - Get active calls for user
export async function GET(request: NextRequest) {
    return withAuthAndUser(request, async (req, user) => {
        try {
            await connectDB();

            const { searchParams } = new URL(req.url);
            const chatId = searchParams.get('chatId');

            // Build query for active calls (initiated, ringing, or ongoing)
            const query: any = {
                status: { $in: ['initiated', 'ringing', 'ongoing'] },
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

            // Get active calls
            const activeCalls = await CallSession.find(query)
                .populate('callerId', 'fullName email avatar status')
                .populate('chatId', 'name type participants avatar')
                .populate('participants.userId', 'fullName email avatar status')
                .sort({ createdAt: -1 });

            // Transform results
            const results = activeCalls.map(call => {
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
                };
            });

            return NextResponse.json({
                success: true,
                data: {
                    activeCalls: results,
                    hasActiveCall: results.length > 0,
                },
            });
        } catch (error) {
            console.error('Error fetching active calls:', error);
            return NextResponse.json(
                { success: false, error: 'Failed to fetch active calls' },
                { status: 500 }
            );
        }
    });
}

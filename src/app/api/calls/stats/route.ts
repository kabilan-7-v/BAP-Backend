import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
import connectDB from '@/lib/mongodb';
import CallSession from '@/models/CallSession';
import { withAuthAndUser } from '@/middleware/auth';

// GET /api/calls/stats - Get call statistics
export async function GET(request: NextRequest) {
  return withAuthAndUser(request, async (req, user) => {
    try {
      await connectDB();

      const { searchParams } = new URL(req.url);
      const chatId = searchParams.get('chatId');
      const timeframe = searchParams.get('timeframe') || '30d'; // '7d', '30d', '90d', 'all'

      // Calculate date range based on timeframe
      let startDate: Date | undefined;
      if (timeframe !== 'all') {
        const days = parseInt(timeframe.replace('d', ''), 10);
        startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
      }

      // Build base query
      const baseQuery: any = {
        $or: [
          { callerId: user._id },
          { 'participants.userId': user._id },
        ],
      };

      if (startDate) {
        baseQuery.createdAt = { $gte: startDate };
      }

      if (chatId) {
        baseQuery.chatId = chatId;
      }

      // Get all calls for statistics
      const calls = await CallSession.find(baseQuery);

      // Calculate statistics
      const stats = {
        total: calls.length,
        byType: {
          voice: calls.filter(c => c.callType === 'voice').length,
          video: calls.filter(c => c.callType === 'video').length,
        },
        byStatus: {
          ended: calls.filter(c => c.status === 'ended').length,
          missed: calls.filter(c => c.status === 'missed').length,
          rejected: calls.filter(c => c.status === 'rejected').length,
        },
        byDirection: {
          incoming: calls.filter(c => c.callerId.toString() !== user._id.toString()).length,
          outgoing: calls.filter(c => c.callerId.toString() === user._id.toString()).length,
        },
        totalDuration: calls.reduce((sum, call) => sum + (call.duration || 0), 0),
        averageDuration: 0,
        longestCall: 0,
        shortestCall: 0,
        recentCalls: [] as any[],
      };

      // Calculate average duration (only for completed calls)
      const completedCalls = calls.filter(c => c.duration && c.duration > 0);
      if (completedCalls.length > 0) {
        stats.averageDuration = Math.floor(
          completedCalls.reduce((sum, call) => sum + (call.duration || 0), 0) / completedCalls.length
        );

        const durations = completedCalls.map(c => c.duration || 0);
        stats.longestCall = Math.max(...durations);
        stats.shortestCall = Math.min(...durations);
      }

      // Get 5 most recent calls
      const recentCalls = calls
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .slice(0, 5)
        .map(call => ({
          id: call._id,
          callType: call.callType,
          status: call.status,
          duration: call.duration,
          initiatedAt: call.initiatedAt,
          isIncoming: call.callerId.toString() !== user._id.toString(),
        }));

      stats.recentCalls = recentCalls;

      // Calculate call frequency (calls per day)
      const callsByDay: Record<string, number> = {};
      calls.forEach(call => {
        const dateKey = call.createdAt.toISOString().split('T')[0];
        callsByDay[dateKey] = (callsByDay[dateKey] || 0) + 1;
      });

      // Get quality stats
      const callsWithQuality = calls.filter(c => c.quality);
      const qualityStats = callsWithQuality.length > 0 ? {
        avgPacketLoss: callsWithQuality.reduce((sum, c) => sum + (c.quality?.packetLoss || 0), 0) / callsWithQuality.length,
        avgJitter: callsWithQuality.reduce((sum, c) => sum + (c.quality?.jitter || 0), 0) / callsWithQuality.length,
        avgBitrate: callsWithQuality.reduce((sum, c) => sum + (c.quality?.avgBitrate || 0), 0) / callsWithQuality.length,
      } : null;

      return NextResponse.json({
        success: true,
        data: {
          timeframe,
          stats,
          callFrequency: callsByDay,
          quality: qualityStats,
        },
      });
    } catch (error) {
      console.error('Error fetching call statistics:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch call statistics' },
        { status: 500 }
      );
    }
  });
}

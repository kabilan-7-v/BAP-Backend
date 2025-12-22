import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { verifyToken } from '@/lib/jwt';
import { voiceInputHandlerService } from '@/services/voice-input-handler.service';
import { plannerAgentService } from '@/services/planner-agent.service';

export const dynamic = 'force-dynamic';

/**
 * POST /api/input-agent/voice/start
 * Start a voice session
 */
export async function POST(request: NextRequest) {
    try {
        await connectDB();

        // Verify authentication
        const token = request.cookies.get('auth-token')?.value;
        if (!token) {
            return NextResponse.json(
                { success: false, error: 'Unauthorized' },
                { status: 401 }
            );
        }

        const decoded = await verifyToken(token);
        if (!decoded) {
            return NextResponse.json(
                { success: false, error: 'Invalid token' },
                { status: 401 }
            );
        }

        const body = await request.json();

        // Validate required fields
        if (!body.session_id) {
            return NextResponse.json(
                { success: false, error: 'session_id is required' },
                { status: 400 }
            );
        }

        // Start voice session
        const result = await voiceInputHandlerService.startVoiceSession({
            user_id: decoded.userId,
            session_id: body.session_id,
            config: body.config,
            conversation_id: body.conversation_id,
        });

        if (!result.success) {
            return NextResponse.json(
                { success: false, error: result.error },
                { status: 400 }
            );
        }

        return NextResponse.json({
            success: true,
            voice_session_id: result.session_id,
            message: 'Voice session started',
        });
    } catch (error) {
        console.error('Error starting voice session:', error);
        return NextResponse.json(
            { success: false, error: 'Internal server error' },
            { status: 500 }
        );
    }
}

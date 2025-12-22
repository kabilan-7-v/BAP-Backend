import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { verifyToken } from '@/lib/jwt';
import { voiceInputHandlerService } from '@/services/voice-input-handler.service';
import { plannerAgentService } from '@/services/planner-agent.service';

export const dynamic = 'force-dynamic';

/**
 * POST /api/input-agent/voice/end
 * End a voice session and get final transcript
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

        // Get client info
        const client_info = {
            user_agent: request.headers.get('user-agent') || undefined,
            ip_address: request.headers.get('x-forwarded-for') ||
                request.headers.get('x-real-ip') ||
                undefined,
        };

        // End voice session and generate envelope (if session exists)
        const result = await voiceInputHandlerService.endVoiceSession({
            session_id: body.voice_session_id || body.session_id,
            asset_context: body.asset_context,
            client_info,
        });

        // If session not found, return success anyway (transcript already sent via /whisper endpoint)
        if (!result.success && result.error?.message === 'Voice session not found') {
            console.log('⚠️ Voice session not found in memory, but transcription was handled via Whisper endpoint');
            return NextResponse.json({
                success: true,
                message: 'Voice session ended (transcription handled separately)',
            });
        }

        if (!result.success) {
            return NextResponse.json(
                { success: false, error: result.error },
                { status: 400 }
            );
        }

        // Optionally send to planner if requested
        if (body.send_to_planner && result.envelope) {
            const plannerResult = await plannerAgentService.sendToPlanner(result.envelope);

            return NextResponse.json({
                success: true,
                transcript: result.transcript,
                envelope: result.envelope,
                planner_response: plannerResult.response,
                planner_error: plannerResult.error,
            });
        }

        return NextResponse.json({
            success: true,
            transcript: result.transcript,
            envelope: result.envelope,
        });
    } catch (error) {
        console.error('Error ending voice session:', error);
        return NextResponse.json(
            { success: false, error: 'Internal server error' },
            { status: 500 }
        );
    }
}

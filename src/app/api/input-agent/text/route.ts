import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { verifyToken } from '@/lib/jwt';
import { textInputHandlerService } from '@/services/text-input-handler.service';
import { plannerAgentService } from '@/services/planner-agent.service';

export const dynamic = 'force-dynamic';

/**
 * POST /api/input-agent/text
 * Process text input and generate envelope
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
        if (!body.text || !body.session_id) {
            return NextResponse.json(
                { success: false, error: 'text and session_id are required' },
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

        // Process text input
        const result = await textInputHandlerService.processTextInput({
            user_id: decoded.userId,
            session_id: body.session_id,
            text: body.text,
            asset_context: body.asset_context,
            client_info,
        });

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
                envelope: result.envelope,
                planner_response: plannerResult.response,
                planner_error: plannerResult.error,
            });
        }

        return NextResponse.json({
            success: true,
            envelope: result.envelope,
        });
    } catch (error) {
        console.error('Error in text input API:', error);
        return NextResponse.json(
            { success: false, error: 'Internal server error' },
            { status: 500 }
        );
    }
}

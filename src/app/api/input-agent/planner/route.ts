import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { verifyToken } from '@/lib/jwt';
import { plannerAgentService } from '@/services/planner-agent.service';
import { envelopeGeneratorService } from '@/services/envelope-generator.service';

export const dynamic = 'force-dynamic';

/**
 * POST /api/input-agent/planner/send
 * Send envelope to Planner Agent
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
        if (!body.envelope_id) {
            return NextResponse.json(
                { success: false, error: 'envelope_id is required' },
                { status: 400 }
            );
        }

        // Get envelope
        const envelope = await envelopeGeneratorService.getEnvelopeById(body.envelope_id);

        if (!envelope) {
            return NextResponse.json(
                { success: false, error: 'Envelope not found' },
                { status: 404 }
            );
        }

        // Verify ownership
        if (envelope.user_id.toString() !== decoded.userId) {
            return NextResponse.json(
                { success: false, error: 'Not authorized to send this envelope' },
                { status: 403 }
            );
        }

        // Check if already sent
        if (envelope.sent_to_planner) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'Envelope already sent to planner',
                    planner_response_id: envelope.planner_response_id,
                },
                { status: 400 }
            );
        }

        // Convert to interface type and send to planner
        // Use type assertion as the content structure is compatible (Date vs string for last_updated)
        const result = await plannerAgentService.sendToPlanner({
            envelope_id: envelope.envelope_id,
            timestamp: envelope.timestamp.toISOString(),
            user_id: envelope.user_id.toString(),
            session_id: envelope.session_id,
            input_type: envelope.input_type,
            content: envelope.content as any, // Type cast needed due to Date vs string for last_updated
            metadata: envelope.metadata,
            status: envelope.status,
        });

        if (!result.success) {
            // Queue for later if planner is unavailable
            if (result.error?.code === 'ASSET_CONNECTION_FAILURE') {
                await plannerAgentService.queueForProcessing({
                    envelope_id: envelope.envelope_id,
                    timestamp: envelope.timestamp.toISOString(),
                    user_id: envelope.user_id.toString(),
                    session_id: envelope.session_id,
                    input_type: envelope.input_type,
                    content: envelope.content as any, // Type cast needed due to Date vs string for last_updated
                    metadata: envelope.metadata,
                    status: envelope.status,
                });

                return NextResponse.json({
                    success: false,
                    error: result.error,
                    queued: true,
                    message: 'Request queued for later processing',
                });
            }

            return NextResponse.json(
                { success: false, error: result.error },
                { status: 400 }
            );
        }

        return NextResponse.json({
            success: true,
            response: result.response,
        });
    } catch (error) {
        console.error('Error sending to planner:', error);
        return NextResponse.json(
            { success: false, error: 'Internal server error' },
            { status: 500 }
        );
    }
}

/**
 * GET /api/input-agent/planner/status
 * Get Planner Agent status
 */
export async function GET() {
    try {
        const status = await plannerAgentService.getPlannerStatus();

        return NextResponse.json({
            success: true,
            planner_status: status,
        });
    } catch (error) {
        console.error('Error getting planner status:', error);
        return NextResponse.json(
            { success: false, error: 'Internal server error' },
            { status: 500 }
        );
    }
}

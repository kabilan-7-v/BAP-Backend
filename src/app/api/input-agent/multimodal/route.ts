import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { verifyToken } from '@/lib/jwt';
import { contextAggregatorService } from '@/services/context-aggregator.service';
import { plannerAgentService } from '@/services/planner-agent.service';

export const dynamic = 'force-dynamic';

/**
 * POST /api/input-agent/multimodal
 * Process multimodal input (text + voice + files + assets)
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

        // Parse multipart form data or JSON
        const contentType = request.headers.get('content-type') || '';

        let text: string | undefined;
        let voice_transcript: string | undefined;
        let session_id: string;
        let asset_ids: string[] | undefined;
        let send_to_planner = false;
        let files: {
            buffer: Buffer;
            originalname: string;
            mimetype: string;
            size: number;
        }[] = [];

        if (contentType.includes('multipart/form-data')) {
            const formData = await request.formData();

            session_id = formData.get('session_id') as string;
            text = formData.get('text') as string || undefined;
            voice_transcript = formData.get('voice_transcript') as string || undefined;
            send_to_planner = formData.get('send_to_planner') === 'true';

            const asset_ids_str = formData.get('asset_ids') as string;
            if (asset_ids_str) {
                try {
                    asset_ids = JSON.parse(asset_ids_str);
                } catch (e) {
                    // Ignore parse errors
                }
            }

            // Get files from form data
            const entries = Array.from(formData.entries());
            for (const [key, value] of entries) {
                if (value instanceof File) {
                    const arrayBuffer = await value.arrayBuffer();
                    files.push({
                        buffer: Buffer.from(arrayBuffer),
                        originalname: value.name,
                        mimetype: value.type,
                        size: value.size,
                    });
                }
            }
        } else {
            // JSON request
            const body = await request.json();
            session_id = body.session_id;
            text = body.text;
            voice_transcript = body.voice_transcript;
            asset_ids = body.asset_ids;
            send_to_planner = body.send_to_planner || false;
        }

        // Validate required fields
        if (!session_id) {
            return NextResponse.json(
                { success: false, error: 'session_id is required' },
                { status: 400 }
            );
        }

        // Check if at least one input type is provided
        if (!text && !voice_transcript && files.length === 0) {
            return NextResponse.json(
                { success: false, error: 'At least one input (text, voice_transcript, or files) is required' },
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

        // Process multimodal input
        const result = await contextAggregatorService.processMultimodalInput({
            user_id: decoded.userId,
            session_id,
            input: {
                text,
                voice_transcript,
                files: files.length > 0 ? files : undefined,
                asset_ids,
            },
            client_info,
        });

        if (!result.success) {
            return NextResponse.json(
                { success: false, error: result.error },
                { status: 400 }
            );
        }

        // Optionally send to planner if requested
        if (send_to_planner && result.envelope) {
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
        console.error('Error in multimodal input API:', error);
        return NextResponse.json(
            { success: false, error: 'Internal server error' },
            { status: 500 }
        );
    }
}

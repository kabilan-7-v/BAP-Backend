import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { verifyToken } from '@/lib/jwt';
import { fileInputHandlerService } from '@/services/file-input-handler.service';
import { plannerAgentService } from '@/services/planner-agent.service';

export const dynamic = 'force-dynamic';

// Configure maximum body size for file uploads (100MB)
export const config = {
    api: {
        bodyParser: false,
    },
};

/**
 * POST /api/input-agent/file
 * Process file upload
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

        // Parse multipart form data
        const formData = await request.formData();
        const session_id = formData.get('session_id') as string;
        const send_to_planner = formData.get('send_to_planner') === 'true';
        const asset_context_str = formData.get('asset_context') as string;

        if (!session_id) {
            return NextResponse.json(
                { success: false, error: 'session_id is required' },
                { status: 400 }
            );
        }

        // Get files from form data
        const files: {
            buffer: Buffer;
            originalname: string;
            mimetype: string;
            size: number;
        }[] = [];

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

        if (files.length === 0) {
            return NextResponse.json(
                { success: false, error: 'At least one file is required' },
                { status: 400 }
            );
        }

        // Parse asset context if provided
        let asset_context;
        if (asset_context_str) {
            try {
                asset_context = JSON.parse(asset_context_str);
            } catch (e) {
                // Ignore parse errors
            }
        }

        // Get client info
        const client_info = {
            user_agent: request.headers.get('user-agent') || undefined,
            ip_address: request.headers.get('x-forwarded-for') ||
                request.headers.get('x-real-ip') ||
                undefined,
        };

        // Process file upload
        const result = await fileInputHandlerService.processFileUpload({
            user_id: decoded.userId,
            session_id,
            files,
            asset_context,
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
        console.error('Error in file upload API:', error);
        return NextResponse.json(
            { success: false, error: 'Internal server error' },
            { status: 500 }
        );
    }
}

/**
 * GET /api/input-agent/file
 * Get supported file types and limits
 */
export async function GET() {
    return NextResponse.json({
        success: true,
        supported_types: fileInputHandlerService.getSupportedFileTypes(),
        max_file_size_bytes: fileInputHandlerService.getMaxFileSize(),
        max_file_size_mb: fileInputHandlerService.getMaxFileSize() / (1024 * 1024),
    });
}

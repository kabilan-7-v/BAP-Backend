import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { verifyToken } from '@/lib/jwt';
import { envelopeGeneratorService } from '@/services/envelope-generator.service';

export const dynamic = 'force-dynamic';

/**
 * GET /api/input-agent/envelope
 * Get envelopes by session
 */
export async function GET(request: NextRequest) {
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

        const { searchParams } = new URL(request.url);
        const session_id = searchParams.get('session_id');
        const envelope_id = searchParams.get('envelope_id');
        const limit = parseInt(searchParams.get('limit') || '50', 10);

        // Get specific envelope by ID
        if (envelope_id) {
            const envelope = await envelopeGeneratorService.getEnvelopeById(envelope_id);

            if (!envelope) {
                return NextResponse.json(
                    { success: false, error: 'Envelope not found' },
                    { status: 404 }
                );
            }

            // Verify ownership
            if (envelope.user_id.toString() !== decoded.userId) {
                return NextResponse.json(
                    { success: false, error: 'Not authorized to access this envelope' },
                    { status: 403 }
                );
            }

            return NextResponse.json({
                success: true,
                envelope,
            });
        }

        // Get envelopes by session
        if (session_id) {
            const envelopes = await envelopeGeneratorService.getEnvelopesBySession(session_id, limit);

            // Filter to only user's envelopes
            const userEnvelopes = envelopes.filter(
                e => e.user_id.toString() === decoded.userId
            );

            return NextResponse.json({
                success: true,
                envelopes: userEnvelopes,
                count: userEnvelopes.length,
            });
        }

        return NextResponse.json(
            { success: false, error: 'session_id or envelope_id is required' },
            { status: 400 }
        );
    } catch (error) {
        console.error('Error getting envelopes:', error);
        return NextResponse.json(
            { success: false, error: 'Internal server error' },
            { status: 500 }
        );
    }
}

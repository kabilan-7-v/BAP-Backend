import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { verifyToken } from '@/lib/jwt';
import { auditLoggerService } from '@/services/audit-logger.service';

export const dynamic = 'force-dynamic';

/**
 * GET /api/input-agent/audit
 * Get audit logs
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
        const type = searchParams.get('type'); // 'errors', 'all', 'analytics'
        const limit = parseInt(searchParams.get('limit') || '100', 10);

        // Get analytics summary
        if (type === 'analytics') {
            const start_date_str = searchParams.get('start_date');
            const end_date_str = searchParams.get('end_date');

            const end_date = end_date_str ? new Date(end_date_str) : new Date();
            const start_date = start_date_str
                ? new Date(start_date_str)
                : new Date(end_date.getTime() - 7 * 24 * 60 * 60 * 1000); // Default 7 days

            const analytics = await auditLoggerService.getAnalyticsSummary({
                user_id: decoded.userId,
                start_date,
                end_date,
            });

            return NextResponse.json({
                success: true,
                analytics,
                period: { start_date, end_date },
            });
        }

        // Get error logs
        if (type === 'errors') {
            const logs = await auditLoggerService.getErrorLogs({
                user_id: decoded.userId,
                session_id: session_id || undefined,
                limit,
            });

            return NextResponse.json({
                success: true,
                logs,
                count: logs.length,
            });
        }

        // Get logs by envelope
        if (envelope_id) {
            const logs = await auditLoggerService.getLogsByEnvelope(envelope_id);

            return NextResponse.json({
                success: true,
                logs,
                count: logs.length,
            });
        }

        // Get logs by session
        if (session_id) {
            const logs = await auditLoggerService.getLogsBySession(session_id, limit);

            return NextResponse.json({
                success: true,
                logs,
                count: logs.length,
            });
        }

        // Get user's logs
        const logs = await auditLoggerService.getLogsByUser(decoded.userId, limit);

        return NextResponse.json({
            success: true,
            logs,
            count: logs.length,
        });
    } catch (error) {
        console.error('Error getting audit logs:', error);
        return NextResponse.json(
            { success: false, error: 'Internal server error' },
            { status: 500 }
        );
    }
}

import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { verifyToken } from '@/lib/jwt';

export const dynamic = 'force-dynamic';

/**
 * POST /api/input-agent/voice/transcript
 * Receive Whisper v3 transcript from frontend and log it to console
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
        const { session_id, text, is_final, confidence, transcription_method } = body;

        // Validate required fields
        if (!text || text.trim() === '') {
            return NextResponse.json(
                { success: false, error: 'No transcript text provided' },
                { status: 400 }
            );
        }

        // ===== REAL-TIME CONSOLE LOG - WHISPER TRANSCRIPT =====
        console.log('\n' + '='.repeat(60));
        console.log(`🎤➡️📝 WHISPER v3 TRANSCRIPT ${is_final ? '(FINAL)' : '(INTERIM)'}`);
        console.log('='.repeat(60));
        console.log(`👤 User ID: ${decoded.userId}`);
        console.log(`🔗 Session: ${session_id || 'N/A'}`);
        console.log(`💬 Text: "${text}"`);
        if (confidence !== undefined) {
            console.log(`🎯 Confidence: ${(confidence * 100).toFixed(1)}%`);
        }
        console.log(`🔧 Method: ${transcription_method || 'whisper-v3'}`);
        console.log(`📅 Time: ${new Date().toLocaleString()}`);
        console.log('='.repeat(60) + '\n');

        return NextResponse.json({
            success: true,
            message: 'Transcript received and logged',
            session_id,
            text_length: text.length,
        });
    } catch (error) {
        console.error('Error processing transcript:', error);
        return NextResponse.json(
            { success: false, error: 'Internal server error' },
            { status: 500 }
        );
    }
}

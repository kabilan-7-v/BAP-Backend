import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { verifyToken } from '@/lib/jwt';

export const dynamic = 'force-dynamic';

// HuggingFace Inference API - Using the router endpoint
const HF_INFERENCE_URL = 'https://router.huggingface.co/hf-inference/models/openai/whisper-large-v3';

/**
 * POST /api/input-agent/voice/whisper
 * Proxy Whisper transcription through backend
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

        // Get API token from environment
        const hfToken = process.env.HUGGINGFACE_API_KEY;
        const groqToken = process.env.GROQ_API_KEY;

        console.log(`🔑 API Keys: HuggingFace=${hfToken ? 'SET' : 'NOT SET'}, Groq=${groqToken ? 'SET' : 'NOT SET'}`);

        if (!hfToken && !groqToken) {
            return NextResponse.json(
                { success: false, error: 'No API key configured. Set HUGGINGFACE_API_KEY in .env.local' },
                { status: 500 }
            );
        }

        // Get audio data from request
        const contentType = request.headers.get('content-type') || '';
        let audioBlob: Blob;

        if (contentType.includes('multipart/form-data')) {
            const formData = await request.formData();
            const audioFile = formData.get('audio') as File;
            if (!audioFile) {
                return NextResponse.json(
                    { success: false, error: 'No audio file provided' },
                    { status: 400 }
                );
            }
            audioBlob = audioFile;
        } else {
            // Raw audio data - get content type from header
            const audioContentType = contentType || 'audio/wav';
            const audioBuffer = await request.arrayBuffer();
            audioBlob = new Blob([audioBuffer], { type: audioContentType });
        }

        // Log audio info
        console.log('🎤 Whisper Proxy: Received audio');
        console.log(`   - Size: ${audioBlob.size} bytes`);
        console.log(`   - Type: ${audioBlob.type}`);

        // Validate minimum audio size - reduced threshold for continuous mode
        // Allow smaller chunks (100 bytes minimum) for better real-time transcription
        if (audioBlob.size < 100) {
            console.log(`⚠️ Audio too small (${audioBlob.size} bytes), skipping transcription`);
            return NextResponse.json(
                { success: true, text: '', warning: 'Audio chunk too small, skipped' },
                { status: 200 }
            );
        }

        // Warn about potentially problematic audio sizes
        if (audioBlob.size < 5000) {
            console.log(`⚠️ Small audio chunk (${audioBlob.size} bytes) - transcription may be less accurate`);
        }

        const startTime = Date.now();
        let transcribedText = '';
        let usedService = '';

        // Convert blob to Buffer
        const audioBuffer = Buffer.from(await audioBlob.arrayBuffer());

        // Determine the actual audio format from the blob type
        const audioType = audioBlob.type || 'audio/webm';

        // ===== TRY GROQ FIRST (supports webm/mp3/wav natively) =====
        if (!transcribedText && groqToken) {
            try {
                console.log('🔄 Trying Groq Whisper...');

                // Groq requires multipart/form-data with file
                const formData = new FormData();

                // Determine file extension based on audio type
                let fileExtension = 'webm';
                if (audioType.includes('wav')) fileExtension = 'wav';
                else if (audioType.includes('mp3') || audioType.includes('mpeg')) fileExtension = 'mp3';
                else if (audioType.includes('ogg')) fileExtension = 'ogg';
                else if (audioType.includes('m4a') || audioType.includes('mp4')) fileExtension = 'm4a';

                const audioFile = new Blob([audioBuffer], { type: audioType });
                formData.append('file', audioFile, `audio.${fileExtension}`);
                formData.append('model', 'whisper-large-v3');
                formData.append('language', 'en'); // Auto-detect language
                formData.append('response_format', 'json');

                const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${groqToken}`,
                    },
                    body: formData,
                });

                if (response.ok) {
                    const result = await response.json();
                    if (result.text) {
                        transcribedText = result.text.trim();
                        usedService = 'Groq Whisper v3';
                        console.log('✅ Groq transcription successful');
                    }
                } else {
                    const errorText = await response.text();
                    console.log(`⚠️ Groq error ${response.status}: ${errorText.substring(0, 200)}`);
                }
            } catch (error) {
                console.log('⚠️ Groq transcription failed:', error);
            }
        }

        // ===== FALLBACK TO HUGGINGFACE (only if Groq failed) =====
        if (!transcribedText && hfToken) {
            try {
                console.log('🔄 Trying HuggingFace Whisper...');

                // HuggingFace works better with raw binary data
                // For webm, we need to try sending with correct content type
                const contentTypeForHF = audioType.includes('webm') ? 'audio/webm' :
                    audioType.includes('wav') ? 'audio/wav' :
                        audioType.includes('mp3') ? 'audio/mpeg' :
                            'audio/wav';

                const response = await fetch(HF_INFERENCE_URL, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${hfToken}`,
                        'Content-Type': contentTypeForHF,
                    },
                    body: audioBuffer,
                });

                if (response.ok) {
                    const result = await response.json();

                    // Extract text from response
                    if (typeof result === 'string') {
                        transcribedText = result;
                    } else if (result.text) {
                        transcribedText = result.text;
                    } else if (Array.isArray(result) && result.length > 0) {
                        transcribedText = result.map((r: any) => r.text || r).join(' ');
                    }

                    transcribedText = transcribedText.trim();
                    usedService = 'HuggingFace Whisper v3';
                    console.log('✅ HuggingFace transcription successful');
                } else {
                    // Log error for debugging
                    const errorText = await response.text();
                    console.log(`⚠️ HuggingFace error ${response.status}: ${errorText.substring(0, 200)}`);

                    if (response.status === 503) {
                        // Model loading - wait and retry once
                        console.log('⏳ Model loading, retrying...');
                        await new Promise(r => setTimeout(r, 3000));

                        const retryResponse = await fetch(HF_INFERENCE_URL, {
                            method: 'POST',
                            headers: {
                                'Authorization': `Bearer ${hfToken}`,
                                'Content-Type': contentTypeForHF,
                            },
                            body: audioBuffer,
                        });

                        if (retryResponse.ok) {
                            const retryResult = await retryResponse.json();
                            if (typeof retryResult === 'string') {
                                transcribedText = retryResult;
                            } else if (retryResult.text) {
                                transcribedText = retryResult.text;
                            }
                            transcribedText = transcribedText.trim();
                            usedService = 'HuggingFace Whisper v3';
                        }
                    }
                }
            } catch (error) {
                console.log('⚠️ HuggingFace transcription failed:', error);
            }
        }

        const processingTime = Date.now() - startTime;

        // Check if we got a transcription
        if (!transcribedText) {
            console.error('❌ All transcription attempts failed - returning empty result');
            // Return success with empty text instead of error to prevent breaking the continuous flow
            return NextResponse.json({
                success: true,
                text: '',
                warning: 'Transcription failed - audio may be too short or unclear',
                processingTime: Date.now() - startTime,
                service: 'none',
            }, { status: 200 });
        }

        // ===== REAL-TIME CONSOLE LOG =====
        console.log('\n' + '='.repeat(60));
        console.log('🎤➡️📝 WHISPER TRANSCRIPTION COMPLETE');
        console.log('='.repeat(60));
        console.log(`👤 User ID: ${decoded.userId}`);
        console.log(`💬 Text: "${transcribedText}"`);
        console.log(`🔧 Service: ${usedService}`);
        console.log(`⏱️ Processing Time: ${processingTime}ms`);
        console.log(`📦 Audio Size: ${audioBlob.size} bytes`);
        console.log(`📅 Time: ${new Date().toLocaleString()}`);
        console.log('='.repeat(60) + '\n');

        return NextResponse.json({
            success: true,
            text: transcribedText,
            processingTime,
            service: usedService,
        });

    } catch (error) {
        console.error('Whisper proxy error:', error);
        return NextResponse.json(
            { success: false, error: 'Internal server error' },
            { status: 500 }
        );
    }
}

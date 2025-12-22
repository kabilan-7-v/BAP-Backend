/**
 * Video Call Configuration
 * Contains all video-specific settings for WebRTC video calls
 */

export interface VideoQualitySettings {
    width: number;
    height: number;
    frameRate: number;
    bitrate: number;
}

/**
 * Video quality presets
 */
export const VIDEO_QUALITY_PRESETS: Record<string, VideoQualitySettings> = {
    low: {
        width: 640,
        height: 360,
        frameRate: 15,
        bitrate: 500000, // 500 kbps
    },
    medium: {
        width: 854,
        height: 480,
        frameRate: 24,
        bitrate: 1000000, // 1 Mbps
    },
    high: {
        width: 1280,
        height: 720,
        frameRate: 30,
        bitrate: 2500000, // 2.5 Mbps
    },
    hd: {
        width: 1920,
        height: 1080,
        frameRate: 30,
        bitrate: 4000000, // 4 Mbps
    },
};

/**
 * Get video constraints based on quality preset
 */
export const getVideoConstraints = (quality: keyof typeof VIDEO_QUALITY_PRESETS = 'high'): MediaTrackConstraints => {
    const preset = VIDEO_QUALITY_PRESETS[quality];
    return {
        width: { ideal: preset.width },
        height: { ideal: preset.height },
        frameRate: { ideal: preset.frameRate, max: 30 },
        facingMode: 'user',
    };
};

/**
 * Screen sharing constraints
 */
export const screenShareConstraints: MediaStreamConstraints = {
    audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
    },
    video: {
        // @ts-ignore - These are valid for getDisplayMedia
        cursor: 'always',
        displaySurface: 'monitor',
        width: { ideal: 1920, max: 1920 },
        height: { ideal: 1080, max: 1080 },
        frameRate: { ideal: 30, max: 30 },
    },
};

/**
 * Video call media constraints
 */
export const getVideoCallConstraints = (quality: keyof typeof VIDEO_QUALITY_PRESETS = 'high'): MediaStreamConstraints => ({
    audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        sampleRate: 48000,
        channelCount: 1,
    },
    video: getVideoConstraints(quality),
});

/**
 * Video codec preferences (ordered by priority)
 */
export const VIDEO_CODEC_PREFERENCES = [
    'VP9',  // Best quality/compression ratio
    'VP8',  // Good compatibility
    'H264', // Hardware acceleration support
];

/**
 * Video quality thresholds for call monitoring
 */
export const VIDEO_QUALITY_THRESHOLDS = {
    FRAME_RATE: {
        GOOD: 24,
        FAIR: 15,
        POOR: 10,
    },
    RESOLUTION: {
        GOOD: 720,
        FAIR: 480,
        POOR: 360,
    },
    BITRATE: {
        MIN: 300000,    // 300 kbps minimum for acceptable video
        GOOD: 1000000,  // 1 Mbps for good quality
        OPTIMAL: 2500000, // 2.5 Mbps for HD
    },
};

/**
 * Video call specific timeouts
 */
export const VIDEO_CALL_TIMEOUTS = {
    CAMERA_INIT: 10000,     // 10 seconds to initialize camera
    SCREEN_SHARE_INIT: 5000, // 5 seconds to start screen share
    VIDEO_RECONNECT: 15000,  // 15 seconds to reconnect video
};

/**
 * Maximum video participants based on quality
 */
export const MAX_VIDEO_PARTICIPANTS = {
    hd: 4,
    high: 6,
    medium: 9,
    low: 16,
};

/**
 * Bandwidth estimation for video calls
 */
export const estimateRequiredBandwidth = (
    participantCount: number,
    quality: keyof typeof VIDEO_QUALITY_PRESETS
): number => {
    const preset = VIDEO_QUALITY_PRESETS[quality];
    // Sending + receiving from all participants
    return preset.bitrate * participantCount;
};

/**
 * Video layout types for multi-participant calls
 */
export type VideoLayoutType = 'grid' | 'spotlight' | 'sidebar';

export interface VideoLayoutConfig {
    type: VideoLayoutType;
    spotlightUserId?: string;
    participantsPerRow?: number;
}

/**
 * Get recommended layout based on participant count
 */
export const getRecommendedLayout = (participantCount: number): VideoLayoutConfig => {
    if (participantCount <= 1) {
        return { type: 'spotlight' };
    } else if (participantCount <= 4) {
        return { type: 'grid', participantsPerRow: 2 };
    } else if (participantCount <= 9) {
        return { type: 'grid', participantsPerRow: 3 };
    } else {
        return { type: 'sidebar', participantsPerRow: 4 };
    }
};

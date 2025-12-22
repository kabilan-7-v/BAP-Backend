export interface RTCConfiguration {
  iceServers: Array<{
    urls: string | string[];
    username?: string;
    credential?: string;
  }>;
  iceCandidatePoolSize?: number;
  bundlePolicy?: RTCBundlePolicy;
  rtcpMuxPolicy?: RTCRtcpMuxPolicy;
  iceTransportPolicy?: RTCIceTransportPolicy;
}

/**
 * WebRTC configuration with STUN/TURN servers
 *
 * STUN servers help devices discover their public IP address and port
 * TURN servers relay traffic when direct peer-to-peer connection fails
 */
export const getWebRTCConfig = (): RTCConfiguration => {
  // Get TURN server credentials from environment variables
  const turnUsername = process.env.TURN_USERNAME;
  const turnCredential = process.env.TURN_CREDENTIAL;
  const turnServer = process.env.TURN_SERVER;

  const iceServers: RTCConfiguration['iceServers'] = [
    // Public STUN servers (free, for NAT traversal)
    {
      urls: [
        'stun:stun.l.google.com:19302',
        'stun:stun1.l.google.com:19302',
        'stun:stun2.l.google.com:19302',
        'stun:stun3.l.google.com:19302',
        'stun:stun4.l.google.com:19302',
      ],
    },
  ];

  // Add TURN server if credentials are provided
  if (turnServer && turnUsername && turnCredential) {
    iceServers.push({
      urls: turnServer,
      username: turnUsername,
      credential: turnCredential,
    });
  }

  return {
    iceServers,
    iceCandidatePoolSize: 10,
    bundlePolicy: 'max-bundle',
    rtcpMuxPolicy: 'require',
    iceTransportPolicy: 'all',
  };
};

/**
 * Voice call specific constraints
 */
export const voiceCallConstraints: MediaStreamConstraints = {
  audio: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
    sampleRate: 48000,
    channelCount: 1,
  },
  video: false,
};

/**
 * Video call specific constraints
 */
export const videoCallConstraints: MediaStreamConstraints = {
  audio: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
  },
  video: {
    width: { ideal: 1280 },
    height: { ideal: 720 },
    frameRate: { ideal: 30 },
    facingMode: 'user',
  },
};

/**
 * Peer connection configuration for optimal voice quality
 */
export const peerConnectionConfig = {
  optional: [
    { DtlsSrtpKeyAgreement: true },
    { RtpDataChannels: true },
  ],
};

/**
 * SDP constraints for offer/answer - Voice calls
 */
export const voiceOfferOptions: RTCOfferOptions = {
  offerToReceiveAudio: true,
  offerToReceiveVideo: false,
};

/**
 * SDP constraints for offer/answer - Video calls
 */
export const videoOfferOptions: RTCOfferOptions = {
  offerToReceiveAudio: true,
  offerToReceiveVideo: true,
};

/**
 * Legacy offerOptions (for backward compatibility)
 */
export const offerOptions: RTCOfferOptions = voiceOfferOptions;

/**
 * Call timeouts (in milliseconds)
 */
export const CALL_TIMEOUTS = {
  RING_TIMEOUT: 45000, // 45 seconds
  CONNECTION_TIMEOUT: 30000, // 30 seconds
  RECONNECTION_TIMEOUT: 10000, // 10 seconds
  MISSED_CALL_THRESHOLD: 5000, // 5 seconds
};

/**
 * Maximum participants for group calls
 */
export const MAX_CALL_PARTICIPANTS = {
  VOICE: 10,
  VIDEO: 4,
};

/**
 * Audio codec preferences (ordered by priority)
 */
export const AUDIO_CODEC_PREFERENCES = [
  'opus', // Best quality for voice
  'PCMU',
  'PCMA',
];

/**
 * Quality thresholds for call monitoring
 */
export const QUALITY_THRESHOLDS = {
  PACKET_LOSS: {
    GOOD: 1,
    FAIR: 3,
    POOR: 5,
  },
  JITTER: {
    GOOD: 30,
    FAIR: 50,
    POOR: 100,
  },
  BITRATE: {
    MIN: 32000, // 32 kbps
    GOOD: 64000, // 64 kbps
    OPTIMAL: 128000, // 128 kbps
  },
};

/**
 * Shared WebRTC types for frontend and backend
 */

// Call types
export type CallType = 'voice' | 'video';

export type CallStatus = 'initiated' | 'ringing' | 'ongoing' | 'ended' | 'missed' | 'rejected';

export type ParticipantStatus = 'ringing' | 'joined' | 'rejected' | 'missed' | 'left';

export type CallEndReason = 'completed' | 'rejected' | 'missed' | 'failed' | 'cancelled';

// Socket event payloads

// Client to Server
export interface CallInitiatePayload {
  chatId: string;
  callType: CallType;
  targetUserIds?: string[];
}

export interface CallInitiateResponse {
  success?: boolean;
  sessionId?: string;
  error?: string;
}

export interface CallAcceptPayload {
  sessionId: string;
  chatId: string;
}

export interface CallAcceptResponse {
  success?: boolean;
  sessionId?: string;
  error?: string;
}

export interface CallRejectPayload {
  sessionId: string;
  chatId: string;
  reason?: string;
}

export interface CallRejectResponse {
  success?: boolean;
  error?: string;
}

export interface WebRTCOfferPayload {
  sessionId: string;
  targetUserId: string;
  offer: RTCSessionDescriptionInit;
  chatId: string;
}

export interface WebRTCAnswerPayload {
  sessionId: string;
  targetUserId: string;
  answer: RTCSessionDescriptionInit;
  chatId: string;
}

export interface WebRTCIceCandidatePayload {
  sessionId: string;
  targetUserId: string;
  candidate: RTCIceCandidateInit;
  chatId: string;
}

export interface CallQualityPayload {
  sessionId: string;
  quality: {
    avgBitrate?: number;
    packetLoss?: number;
    jitter?: number;
  };
}

export interface CallToggleAudioPayload {
  sessionId: string;
  chatId: string;
  muted: boolean;
}

export interface CallToggleVideoPayload {
  sessionId: string;
  chatId: string;
  enabled: boolean;
}

export interface CallEndPayload {
  sessionId: string;
  chatId: string;
  reason?: string;
}

export interface CallEndResponse {
  success?: boolean;
  error?: string;
}

export interface CallLeavePayload {
  sessionId: string;
  chatId: string;
}

export interface CallLeaveResponse {
  success?: boolean;
  error?: string;
}

// Server to Client
export interface CallIncomingEvent {
  sessionId: string;
  chatId: string;
  callType: CallType;
  callerId: string;
  callerName: string;
  callerAvatar?: string;
}

export interface CallRingingEvent {
  sessionId: string;
  chatId: string;
  targetUserIds: string[];
}

export interface CallAcceptedEvent {
  sessionId: string;
  chatId: string;
  acceptedBy: string;
}

export interface CallRejectedEvent {
  sessionId: string;
  chatId: string;
  rejectedBy: string;
  reason?: string;
}

export interface CallMissedEvent {
  sessionId: string;
  chatId: string;
  callerId: string;
}

export interface CallEndedEvent {
  sessionId: string;
  chatId: string;
  endedBy: string;
  reason?: string;
}

export interface CallParticipantJoinedEvent {
  sessionId: string;
  chatId: string;
  userId: string;
}

export interface CallParticipantLeftEvent {
  sessionId: string;
  chatId: string;
  userId: string;
  reason?: string;
}

export interface WebRTCOfferEvent {
  sessionId: string;
  offer: RTCSessionDescriptionInit;
  chatId: string;
  fromUserId: string;
}

export interface WebRTCAnswerEvent {
  sessionId: string;
  answer: RTCSessionDescriptionInit;
  chatId: string;
  fromUserId: string;
}

export interface WebRTCIceCandidateEvent {
  sessionId: string;
  candidate: RTCIceCandidateInit;
  chatId: string;
  fromUserId: string;
}

export interface CallParticipantAudioToggleEvent {
  sessionId: string;
  userId: string;
  muted: boolean;
}

export interface CallParticipantVideoToggleEvent {
  sessionId: string;
  userId: string;
  enabled: boolean;
}

export interface WebRTCConfigResponse {
  config: RTCConfiguration;
}

// API Response types
export interface CallParticipant {
  userId: {
    _id: string;
    fullName: string;
    email: string;
    avatar?: string;
    status?: string;
  };
  joinedAt?: Date;
  leftAt?: Date;
  status: ParticipantStatus;
}

export interface CallData {
  id: string;
  chatId: any;
  callType: CallType;
  status: CallStatus;
  isIncoming: boolean;
  isOutgoing: boolean;
  caller: any;
  participants: CallParticipant[];
  userStatus?: ParticipantStatus;
  initiatedAt: Date;
  startedAt?: Date;
  endedAt?: Date;
  duration?: number;
  endReason?: CallEndReason;
  quality?: {
    avgBitrate?: number;
    packetLoss?: number;
    jitter?: number;
  };
}

export interface CallHistoryResponse {
  success: boolean;
  data?: {
    calls: CallData[];
    pagination: {
      total: number;
      limit: number;
      offset: number;
      hasMore: boolean;
    };
  };
  error?: string;
}

export interface CallDetailsResponse {
  success: boolean;
  data?: CallData;
  error?: string;
}

export interface CallStats {
  total: number;
  byType: {
    voice: number;
    video: number;
  };
  byStatus: {
    ended: number;
    missed: number;
    rejected: number;
  };
  byDirection: {
    incoming: number;
    outgoing: number;
  };
  totalDuration: number;
  averageDuration: number;
  longestCall: number;
  shortestCall: number;
  recentCalls: Array<{
    id: string;
    callType: CallType;
    status: CallStatus;
    duration?: number;
    initiatedAt: Date;
    isIncoming: boolean;
  }>;
}

export interface CallStatsResponse {
  success: boolean;
  data?: {
    timeframe: string;
    stats: CallStats;
    callFrequency: Record<string, number>;
    quality: {
      avgPacketLoss: number;
      avgJitter: number;
      avgBitrate: number;
    } | null;
  };
  error?: string;
}

// Socket event map for type-safe socket usage
export interface ServerToClientEvents {
  'call:incoming': (data: CallIncomingEvent) => void;
  'call:ringing': (data: CallRingingEvent) => void;
  'call:accepted': (data: CallAcceptedEvent) => void;
  'call:rejected': (data: CallRejectedEvent) => void;
  'call:missed': (data: CallMissedEvent) => void;
  'call:ended': (data: CallEndedEvent) => void;
  'call:participant-joined': (data: CallParticipantJoinedEvent) => void;
  'call:participant-left': (data: CallParticipantLeftEvent) => void;
  'call:participant-audio-toggle': (data: CallParticipantAudioToggleEvent) => void;
  'call:participant-video-toggle': (data: CallParticipantVideoToggleEvent) => void;
  'webrtc:offer': (data: WebRTCOfferEvent) => void;
  'webrtc:answer': (data: WebRTCAnswerEvent) => void;
  'webrtc:ice-candidate': (data: WebRTCIceCandidateEvent) => void;
}

export interface ClientToServerEvents {
  'webrtc:config:get': (callback: (response: WebRTCConfigResponse) => void) => void;
  'call:initiate': (payload: CallInitiatePayload, callback?: (response: CallInitiateResponse) => void) => void;
  'call:accept': (payload: CallAcceptPayload, callback?: (response: CallAcceptResponse) => void) => void;
  'call:reject': (payload: CallRejectPayload, callback?: (response: CallRejectResponse) => void) => void;
  'call:end': (payload: CallEndPayload, callback?: (response: CallEndResponse) => void) => void;
  'call:leave': (payload: CallLeavePayload, callback?: (response: CallLeaveResponse) => void) => void;
  'call:quality': (payload: CallQualityPayload) => void;
  'call:toggle-audio': (payload: CallToggleAudioPayload) => void;
  'call:toggle-video': (payload: CallToggleVideoPayload) => void;
  'webrtc:offer': (payload: WebRTCOfferPayload) => void;
  'webrtc:answer': (payload: WebRTCAnswerPayload) => void;
  'webrtc:ice-candidate': (payload: WebRTCIceCandidatePayload) => void;
}

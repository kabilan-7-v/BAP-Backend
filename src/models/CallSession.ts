import mongoose, { Document, Model, Schema } from 'mongoose';

export interface ICallSession extends Document {
  _id: mongoose.Types.ObjectId;
  chatId: mongoose.Types.ObjectId;
  callType: 'voice' | 'video';
  callerId: mongoose.Types.ObjectId;
  participants: Array<{
    userId: mongoose.Types.ObjectId;
    joinedAt?: Date;
    leftAt?: Date;
    status: 'ringing' | 'joined' | 'rejected' | 'missed' | 'left';
  }>;
  status: 'initiated' | 'ringing' | 'ongoing' | 'ended' | 'missed' | 'rejected';
  initiatedAt: Date;
  startedAt?: Date;
  endedAt?: Date;
  duration?: number; // in seconds
  endReason?: 'completed' | 'rejected' | 'missed' | 'failed' | 'cancelled';
  quality?: {
    avgBitrate?: number;
    packetLoss?: number;
    jitter?: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

type CallSessionModel = Model<ICallSession>;

const participantSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    joinedAt: {
      type: Date,
    },
    leftAt: {
      type: Date,
    },
    status: {
      type: String,
      enum: ['ringing', 'joined', 'rejected', 'missed', 'left'],
      default: 'ringing',
    },
  },
  { _id: false }
);

const callSessionSchema = new Schema<ICallSession, CallSessionModel>(
  {
    chatId: {
      type: Schema.Types.ObjectId,
      ref: 'Chat',
      required: true,
      index: true,
    },
    callType: {
      type: String,
      enum: ['voice', 'video'],
      required: true,
    },
    callerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    participants: [participantSchema],
    status: {
      type: String,
      enum: ['initiated', 'ringing', 'ongoing', 'ended', 'missed', 'rejected'],
      default: 'initiated',
      index: true,
    },
    initiatedAt: {
      type: Date,
      default: Date.now,
      required: true,
    },
    startedAt: {
      type: Date,
    },
    endedAt: {
      type: Date,
    },
    duration: {
      type: Number, // in seconds
    },
    endReason: {
      type: String,
      enum: ['completed', 'rejected', 'missed', 'failed', 'cancelled'],
    },
    quality: {
      avgBitrate: Number,
      packetLoss: Number,
      jitter: Number,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for faster lookups
callSessionSchema.index({ chatId: 1, createdAt: -1 });
callSessionSchema.index({ callerId: 1, createdAt: -1 });
callSessionSchema.index({ 'participants.userId': 1, createdAt: -1 });
callSessionSchema.index({ status: 1, createdAt: -1 });

// Calculate duration before saving
callSessionSchema.pre('save', function (next) {
  if (this.startedAt && this.endedAt && !this.duration) {
    this.duration = Math.floor((this.endedAt.getTime() - this.startedAt.getTime()) / 1000);
  }
  next();
});

// Prevent model recompilation in development
const CallSession: CallSessionModel =
  mongoose.models.CallSession ||
  mongoose.model<ICallSession, CallSessionModel>('CallSession', callSessionSchema);

export default CallSession;

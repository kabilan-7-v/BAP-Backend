import mongoose, { Document, Model, Schema } from 'mongoose';

export interface IChat extends Document {
  _id: mongoose.Types.ObjectId;
  type: 'individual' | 'group';
  name?: string; // For group chats
  participants: mongoose.Types.ObjectId[];
  admins?: mongoose.Types.ObjectId[]; // For group chats
  lastMessage?: mongoose.Types.ObjectId;
  lastMessageAt?: Date;
  isPinned: Map<string, boolean>; // Per-user pinned status
  isMuted: Map<string, boolean>; // Per-user muted status
  unreadCount: Map<string, number>; // Per-user unread count
  historyEnabled: boolean;
  avatar?: string; // Group avatar
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

type ChatModel = Model<IChat>;

const chatSchema = new Schema<IChat, ChatModel>(
  {
    type: {
      type: String,
      enum: ['individual', 'group'],
      required: true,
      default: 'individual',
    },
    name: {
      type: String,
      trim: true,
      maxlength: [100, 'Chat name cannot exceed 100 characters'],
    },
    participants: [{
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    }],
    admins: [{
      type: Schema.Types.ObjectId,
      ref: 'User',
    }],
    lastMessage: {
      type: Schema.Types.ObjectId,
      ref: 'Message',
    },
    lastMessageAt: {
      type: Date,
    },
    isPinned: {
      type: Map,
      of: Boolean,
      default: new Map(),
    },
    isMuted: {
      type: Map,
      of: Boolean,
      default: new Map(),
    },
    unreadCount: {
      type: Map,
      of: Number,
      default: new Map(),
    },
    historyEnabled: {
      type: Boolean,
      default: true,
    },
    avatar: {
      type: String,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for faster lookups
chatSchema.index({ participants: 1 });
chatSchema.index({ type: 1 });
chatSchema.index({ lastMessageAt: -1 });
chatSchema.index({ createdBy: 1 });

// Compound index for finding existing individual chat between two users
chatSchema.index({ type: 1, participants: 1 });

// Prevent model recompilation in development
const Chat: ChatModel =
  mongoose.models.Chat || mongoose.model<IChat, ChatModel>('Chat', chatSchema);

export default Chat;

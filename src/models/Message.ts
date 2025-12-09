import mongoose, { Document, Model, Schema } from 'mongoose';

export interface IAttachment {
  id: string;
  type: 'image' | 'video' | 'document' | 'audio';
  name: string;
  url: string;
  size: number;
  mimeType: string;
}

export interface IMessage extends Document {
  _id: mongoose.Types.ObjectId;
  chatId: mongoose.Types.ObjectId;
  senderId: mongoose.Types.ObjectId;
  content: string;
  attachments?: IAttachment[];
  replyTo?: mongoose.Types.ObjectId;
  status: 'sent' | 'delivered' | 'read';
  readBy: Map<string, Date>; // userId -> readAt timestamp
  deliveredTo: Map<string, Date>; // userId -> deliveredAt timestamp
  isDeleted: boolean;
  deletedAt?: Date;
  editedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

type MessageModel = Model<IMessage>;

const attachmentSchema = new Schema<IAttachment>(
  {
    id: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: ['image', 'video', 'document', 'audio'],
      required: true,
    },
    name: {
      type: String,
      required: true,
    },
    url: {
      type: String,
      required: true,
    },
    size: {
      type: Number,
      required: true,
    },
    mimeType: {
      type: String,
      required: true,
    },
  },
  { _id: false }
);

const messageSchema = new Schema<IMessage, MessageModel>(
  {
    chatId: {
      type: Schema.Types.ObjectId,
      ref: 'Chat',
      required: true,
      index: true,
    },
    senderId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    content: {
      type: String,
      default: '',
      maxlength: [10000, 'Message content cannot exceed 10000 characters'],
    },
    attachments: [attachmentSchema],
    replyTo: {
      type: Schema.Types.ObjectId,
      ref: 'Message',
    },
    status: {
      type: String,
      enum: ['sent', 'delivered', 'read'],
      default: 'sent',
    },
    readBy: {
      type: Map,
      of: Date,
      default: new Map(),
    },
    deliveredTo: {
      type: Map,
      of: Date,
      default: new Map(),
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    deletedAt: {
      type: Date,
    },
    editedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for faster lookups
messageSchema.index({ chatId: 1, createdAt: -1 });
messageSchema.index({ senderId: 1 });
messageSchema.index({ chatId: 1, senderId: 1 });

// Text index for message search
messageSchema.index({ content: 'text' });

// Prevent model recompilation in development
const Message: MessageModel =
  mongoose.models.Message || mongoose.model<IMessage, MessageModel>('Message', messageSchema);

export default Message;

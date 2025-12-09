import mongoose, { Document, Model, Schema } from 'mongoose';

export interface ILabel extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  color: string;
  userId: mongoose.Types.ObjectId; // Owner of the label
  chatIds: mongoose.Types.ObjectId[]; // Chats tagged with this label
  createdAt: Date;
  updatedAt: Date;
}

type LabelModel = Model<ILabel>;

const labelSchema = new Schema<ILabel, LabelModel>(
  {
    name: {
      type: String,
      required: [true, 'Label name is required'],
      trim: true,
      maxlength: [50, 'Label name cannot exceed 50 characters'],
    },
    color: {
      type: String,
      required: [true, 'Label color is required'],
      match: [/^#[0-9A-Fa-f]{6}$/, 'Please enter a valid hex color'],
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    chatIds: [{
      type: Schema.Types.ObjectId,
      ref: 'Chat',
    }],
  },
  {
    timestamps: true,
  }
);

// Index for faster lookups
labelSchema.index({ userId: 1 });
labelSchema.index({ userId: 1, name: 1 }, { unique: true });

// Prevent model recompilation in development
const Label: LabelModel =
  mongoose.models.Label || mongoose.model<ILabel, LabelModel>('Label', labelSchema);

export default Label;

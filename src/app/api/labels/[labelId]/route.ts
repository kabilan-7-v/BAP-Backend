import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Label from '@/models/Label';
import Chat from '@/models/Chat';
import { withAuthAndUser } from '@/middleware/auth';
import mongoose from 'mongoose';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface RouteParams {
  params: { labelId: string };
}

// GET /api/labels/[labelId] - Get a specific label
export async function GET(request: NextRequest, { params }: RouteParams) {
  return withAuthAndUser(request, async (req, user) => {
    try {
      await connectDB();

      const label = await Label.findOne({
        _id: params.labelId,
        userId: user._id,
      });

      if (!label) {
        return NextResponse.json(
          { success: false, error: 'Label not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        data: {
          label: {
            id: label._id,
            name: label.name,
            color: label.color,
            chatIds: label.chatIds.map(id => id.toString()),
          },
        },
      });
    } catch (error) {
      console.error('Error fetching label:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch label' },
        { status: 500 }
      );
    }
  });
}

// PUT /api/labels/[labelId] - Update a label
export async function PUT(request: NextRequest, { params }: RouteParams) {
  return withAuthAndUser(request, async (req, user) => {
    try {
      await connectDB();

      const body = await req.json();
      const { name, color, addChatId, removeChatId } = body;

      const label = await Label.findOne({
        _id: params.labelId,
        userId: user._id,
      });

      if (!label) {
        return NextResponse.json(
          { success: false, error: 'Label not found' },
          { status: 404 }
        );
      }

      // Update name if provided
      if (name !== undefined) {
        // Check for duplicate name
        const existingLabel = await Label.findOne({
          userId: user._id,
          name: { $regex: new RegExp(`^${name}$`, 'i') },
          _id: { $ne: params.labelId },
        });

        if (existingLabel) {
          return NextResponse.json(
            { success: false, error: 'Label with this name already exists' },
            { status: 409 }
          );
        }

        label.name = name;
      }

      // Update color if provided
      if (color !== undefined) {
        label.color = color;
      }

      // Add chat to label
      if (addChatId) {
        // Verify user has access to the chat
        const chat = await Chat.findOne({
          _id: addChatId,
          participants: user._id,
        });

        if (!chat) {
          return NextResponse.json(
            { success: false, error: 'Chat not found or access denied' },
            { status: 404 }
          );
        }

        const chatObjectId = new mongoose.Types.ObjectId(addChatId);
        if (!label.chatIds.some(id => id.equals(chatObjectId))) {
          label.chatIds.push(chatObjectId);
        }
      }

      // Remove chat from label
      if (removeChatId) {
        label.chatIds = label.chatIds.filter(
          id => id.toString() !== removeChatId
        );
      }

      await label.save();

      return NextResponse.json({
        success: true,
        data: {
          label: {
            id: label._id,
            name: label.name,
            color: label.color,
            chatIds: label.chatIds.map(id => id.toString()),
          },
        },
      });
    } catch (error) {
      console.error('Error updating label:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to update label' },
        { status: 500 }
      );
    }
  });
}

// DELETE /api/labels/[labelId] - Delete a label
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  return withAuthAndUser(request, async (req, user) => {
    try {
      await connectDB();

      const label = await Label.findOneAndDelete({
        _id: params.labelId,
        userId: user._id,
      });

      if (!label) {
        return NextResponse.json(
          { success: false, error: 'Label not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        message: 'Label deleted successfully',
      });
    } catch (error) {
      console.error('Error deleting label:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to delete label' },
        { status: 500 }
      );
    }
  });
}

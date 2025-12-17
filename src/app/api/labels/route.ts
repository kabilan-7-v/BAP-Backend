import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Label from '@/models/Label';
import { withAuthAndUser } from '@/middleware/auth';

export const dynamic = 'force-dynamic';

// GET /api/labels - Get all labels for the authenticated user
export async function GET(request: NextRequest) {
  return withAuthAndUser(request, async (req, user) => {
    try {
      await connectDB();

      const labels = await Label.find({ userId: user._id }).sort({ name: 1 });

      // Transform to match frontend Label type
      const transformedLabels = labels.map(label => ({
        id: label._id,
        name: label.name,
        color: label.color,
        chatIds: label.chatIds.map(id => id.toString()),
      }));

      return NextResponse.json({
        success: true,
        data: { labels: transformedLabels },
      });
    } catch (error) {
      console.error('Error fetching labels:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch labels' },
        { status: 500 }
      );
    }
  });
}

// POST /api/labels - Create a new label
export async function POST(request: NextRequest) {
  return withAuthAndUser(request, async (req, user) => {
    try {
      await connectDB();

      const body = await req.json();
      const { name, color } = body;

      if (!name || !color) {
        return NextResponse.json(
          { success: false, error: 'Name and color are required' },
          { status: 400 }
        );
      }

      // Check if label with same name exists
      const existingLabel = await Label.findOne({
        userId: user._id,
        name: { $regex: new RegExp(`^${name}$`, 'i') },
      });

      if (existingLabel) {
        return NextResponse.json(
          { success: false, error: 'Label with this name already exists' },
          { status: 409 }
        );
      }

      const label = new Label({
        name,
        color,
        userId: user._id,
        chatIds: [],
      });

      await label.save();

      return NextResponse.json({
        success: true,
        data: {
          label: {
            id: label._id,
            name: label.name,
            color: label.color,
            chatIds: [],
          },
        },
      }, { status: 201 });
    } catch (error) {
      console.error('Error creating label:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to create label' },
        { status: 500 }
      );
    }
  });
}

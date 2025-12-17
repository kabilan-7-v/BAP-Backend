import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import User from '@/models/User';
import { withAuthAndUser } from '@/middleware/auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET /api/users - Get all users (for chat creation)
export async function GET(request: NextRequest) {
  return withAuthAndUser(request, async (req, user) => {
    try {
      await connectDB();

      const { searchParams } = new URL(req.url);
      const search = searchParams.get('search');
      const limit = parseInt(searchParams.get('limit') || '50', 10);
      const excludeSelf = searchParams.get('excludeSelf') !== 'false';

      // Build query
      const query: any = {};

      // Exclude current user by default
      if (excludeSelf) {
        query._id = { $ne: user._id };
      }

      // Search by name or email
      if (search) {
        query.$or = [
          { fullName: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } },
        ];
      }

      const users = await User.find(query)
        .select('fullName email avatar status lastSeen')
        .sort({ fullName: 1 })
        .limit(limit);

      // Transform to match frontend User type
      const transformedUsers = users.map(u => ({
        id: u._id,
        name: u.fullName,
        email: u.email,
        avatar: u.avatar,
        status: u.status,
        lastSeen: u.lastSeen,
      }));

      return NextResponse.json({
        success: true,
        data: { users: transformedUsers },
      });
    } catch (error) {
      console.error('Error fetching users:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch users' },
        { status: 500 }
      );
    }
  });
}

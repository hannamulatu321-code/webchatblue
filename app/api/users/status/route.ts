import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getUserById, updateUser, getUsers } from '@/lib/data-storage';

// Update current user's online status
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Update last seen timestamp
    updateUser(session.user.id, {
      lastSeen: new Date().toISOString(),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Update status error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Get online status for multiple users
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const userIds = searchParams.get('userIds')?.split(',') || [];

    const users = getUsers();
    const statusMap: Record<string, { isOnline: boolean; lastSeen?: string }> = {};

    const now = new Date().getTime();
    const OFFLINE_THRESHOLD = 5 * 60 * 1000; // 5 minutes

    userIds.forEach(userId => {
      const user = users.find(u => u.id === userId);
      if (user) {
        const lastSeen = user.lastSeen ? new Date(user.lastSeen).getTime() : 0;
        const isOnline = (now - lastSeen) < OFFLINE_THRESHOLD;
        statusMap[userId] = {
          isOnline,
          lastSeen: user.lastSeen,
        };
      }
    });

    return NextResponse.json(statusMap);
  } catch (error) {
    console.error('Get status error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}


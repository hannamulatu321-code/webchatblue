import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getUserById, updateUser } from '@/lib/data-storage';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = getUserById(session.user.id);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Return user without password
    const { password: _, ...userWithoutPassword } = user;
    return NextResponse.json(userWithoutPassword);
  } catch (error) {
    console.error('Get profile error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { name, status, profilePicture } = await request.json();

    const updates: any = {};
    if (name !== undefined) updates.name = name;
    if (status !== undefined) updates.status = status;
    // Always update profilePicture if provided (even if empty string to allow clearing)
    if (profilePicture !== undefined) {
      updates.profilePicture = profilePicture;
      console.log('Updating profile picture:', profilePicture?.substring(0, 50) + '...');
    }

    const updatedUser = updateUser(session.user.id, updates);
    if (!updatedUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Return user without password
    const { password: _, ...userWithoutPassword } = updatedUser;
    console.log('Profile updated successfully. Profile picture:', updatedUser.profilePicture?.substring(0, 50) + '...');
    return NextResponse.json(userWithoutPassword);
  } catch (error) {
    console.error('Update profile error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}











import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getUsers, getUserContacts } from '@/lib/data-storage';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q') || '';

    const allUsers = getUsers();
    const userContacts = getUserContacts(session.user.id);
    const contactIds = new Set(userContacts.map(c => c.contactId));

    // Filter users: exclude current user and existing contacts, filter by query
    const filteredUsers = allUsers
      .filter(user => 
        user.id !== session.user.id &&
        !contactIds.has(user.id) &&
        (user.name.toLowerCase().includes(query.toLowerCase()) ||
         user.phone.includes(query.replace(/\s+/g, '')))
      )
      .map(user => ({
        id: user.id,
        name: user.name,
        phone: user.phone,
      }));

    return NextResponse.json(filteredUsers);
  } catch (error) {
    console.error('Search users error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}


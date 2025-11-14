import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getUserContacts, getUserById, addContact, getUserByPhone, createUser } from '@/lib/data-storage';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const contacts = getUserContacts(session.user.id);
    
    // Get full user data for each contact
    const now = new Date().getTime();
    const OFFLINE_THRESHOLD = 5 * 60 * 1000; // 5 minutes
    
    const contactsWithUserData = contacts.map(contact => {
      const user = getUserById(contact.contactId);
      if (!user) return null;
      
      // Calculate online status
      const lastSeen = user.lastSeen ? new Date(user.lastSeen).getTime() : 0;
      const isOnline = (now - lastSeen) < OFFLINE_THRESHOLD;
      
      return {
        id: user.id,
        name: user.name,
        phone: user.phone,
        status: user.status || '',
        profilePicture: user.profilePicture || '',
        addedAt: contact.addedAt,
        isOnline,
        lastSeen: user.lastSeen,
      };
    }).filter(Boolean);

    return NextResponse.json(contactsWithUserData);
  } catch (error) {
    console.error('Get contacts error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { contactId, phone, name } = body;

    let contactUser;

    // Handle adding by contactId (existing functionality)
    if (contactId) {
      contactUser = getUserById(contactId);
      if (!contactUser) {
        return NextResponse.json(
          { error: 'User not found' },
          { status: 404 }
        );
      }

      // Check if trying to add self
      if (contactId === session.user.id) {
        return NextResponse.json(
          { error: 'Cannot add yourself as a contact' },
          { status: 400 }
        );
      }

      addContact(session.user.id, contactId);
      return NextResponse.json({ success: true, contact: contactUser }, { status: 201 });
    }

    // Handle adding by phone and name (new functionality)
    if (phone && name) {
      // Validate phone number format (basic validation - digits only, 10-15 digits)
      const phoneRegex = /^\d{10,15}$/;
      const normalizedPhone = phone.replace(/\s+/g, '');
      
      if (!phoneRegex.test(normalizedPhone)) {
        return NextResponse.json(
          { error: 'Invalid phone number format. Please enter 10-15 digits.' },
          { status: 400 }
        );
      }

      // Check if user already exists by phone
      contactUser = getUserByPhone(normalizedPhone);

      // If user doesn't exist, create a new user
      if (!contactUser) {
        // Create user without password (they can set it later if they register)
        contactUser = createUser({
          phone: normalizedPhone,
          password: '', // Empty password - user can set it when they register
          name: name.trim(),
        });
      }

      // Check if trying to add self
      if (contactUser.id === session.user.id) {
        return NextResponse.json(
          { error: 'Cannot add yourself as a contact' },
          { status: 400 }
        );
      }

      // Check if contact already exists
      const existingContacts = getUserContacts(session.user.id);
      const alreadyAdded = existingContacts.some(c => c.contactId === contactUser.id);
      
      if (alreadyAdded) {
        return NextResponse.json(
          { error: 'This contact is already in your contact list' },
          { status: 400 }
        );
      }

      // Add contact
      addContact(session.user.id, contactUser.id);

      // Return contact info without password
      const { password: _, ...contactWithoutPassword } = contactUser;
      return NextResponse.json({ 
        success: true, 
        contact: contactWithoutPassword 
      }, { status: 201 });
    }

    // Neither contactId nor phone/name provided
    return NextResponse.json(
      { error: 'Either contactId or phone and name are required' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Add contact error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}


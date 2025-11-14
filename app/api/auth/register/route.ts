import { NextRequest, NextResponse } from 'next/server';
import { createUser, getUserByPhone } from '@/lib/data-storage';
import bcrypt from 'bcryptjs';

export async function POST(request: NextRequest) {
  try {
    const { phone, password, name } = await request.json();

    if (!phone || !password || !name) {
      return NextResponse.json(
        { error: 'Phone number, password, and name are required' },
        { status: 400 }
      );
    }

    // Validate phone number format (basic validation - digits only, 10-15 digits)
    const phoneRegex = /^\d{10,15}$/;
    if (!phoneRegex.test(phone.replace(/\s+/g, ''))) {
      return NextResponse.json(
        { error: 'Invalid phone number format. Please enter 10-15 digits.' },
        { status: 400 }
      );
    }

    // Normalize phone number (remove spaces)
    const normalizedPhone = phone.replace(/\s+/g, '');

    // Check if user already exists
    const existingUser = getUserByPhone(normalizedPhone);
    if (existingUser) {
      return NextResponse.json(
        { error: 'User with this phone number already exists' },
        { status: 400 }
      );
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = createUser({
      phone: normalizedPhone,
      password: hashedPassword,
      name,
    });

    // Return user without password
    const { password: _, ...userWithoutPassword } = user;
    return NextResponse.json(userWithoutPassword, { status: 201 });
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}


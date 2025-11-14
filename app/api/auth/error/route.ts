import { NextRequest, NextResponse } from 'next/server';

// NextAuth error route handler
// This handles error redirects from NextAuth v5
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const error = searchParams.get('error');
  
  // Redirect to signin page with error message
  const signInUrl = new URL('/auth/signin', request.url);
  if (error) {
    signInUrl.searchParams.set('error', error);
  }
  
  return NextResponse.redirect(signInUrl);
}

export async function POST(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const error = searchParams.get('error');
  
  // Redirect to signin page with error message
  const signInUrl = new URL('/auth/signin', request.url);
  if (error) {
    signInUrl.searchParams.set('error', error);
  }
  
  return NextResponse.redirect(signInUrl);
}

// Handle other methods that NextAuth might use
export async function PUT(request: NextRequest) {
  return GET(request);
}

export async function DELETE(request: NextRequest) {
  return GET(request);
}


import { handler } from '@/lib/auth';

// NextAuth v5 beta handler structure
// The handler has a 'handlers' property that contains GET and POST route handlers
// @ts-ignore - NextAuth v5 beta type definitions
export const GET = handler.handlers.GET;

// @ts-ignore
export const POST = handler.handlers.POST;


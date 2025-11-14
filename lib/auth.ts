import NextAuth from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { getUserByPhone } from '@/lib/data-storage';
import bcrypt from 'bcryptjs';

export const authOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        phone: { label: 'Phone Number', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        try {
          if (!credentials?.phone || !credentials?.password) {
            return null;
          }

          const phone = typeof credentials.phone === 'string' ? credentials.phone : '';
          const password = typeof credentials.password === 'string' ? credentials.password : '';
          
          if (!phone || !password) {
            return null;
          }

          // Normalize phone number (remove spaces)
          const normalizedPhone = phone.replace(/\s+/g, '');

          const user = getUserByPhone(normalizedPhone);
          if (!user) {
            return null;
          }

          const isValid = await bcrypt.compare(password, user.password);
          if (!isValid) {
            return null;
          }

          return {
            id: user.id,
            phone: user.phone,
            name: user.name,
          };
        } catch (error) {
          console.error('Auth error:', error);
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }: any) {
      try {
        if (user) {
          token.id = user.id;
          token.phone = user.phone;
          token.name = user.name;
        }
        return token;
      } catch (error) {
        console.error('JWT callback error:', error);
        return token;
      }
    },
    async session({ session, token }: any) {
      try {
        if (session?.user && token) {
          session.user.id = token.id as string;
          session.user.phone = token.phone as string;
          session.user.name = token.name as string;
        }
        return session;
      } catch (error) {
        console.error('Session callback error:', error);
        return session;
      }
    },
  },
  pages: {
    signIn: '/auth/signin',
    error: '/auth/signin', // Redirect errors to signin page
  },
  session: {
    strategy: 'jwt' as const,
  },
  secret: process.env.NEXTAUTH_SECRET || 'fallback-secret-key-change-in-production',
  debug: process.env.NODE_ENV === 'development',
};

const handler = NextAuth(authOptions);

export const auth = handler.auth;

// For NextAuth v5 beta, we need to export the handler properly
// The handler should have GET and POST methods
export { handler };


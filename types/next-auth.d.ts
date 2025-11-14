import 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      phone: string;
      name: string;
    };
  }

  interface User {
    id: string;
    phone: string;
    name: string;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    phone: string;
    name: string;
  }
}


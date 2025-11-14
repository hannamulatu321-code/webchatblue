import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import dynamic from 'next/dynamic';

// Dynamically import ChatInterface with SSR disabled to prevent hydration mismatches
const ChatInterface = dynamic(() => import('@/components/ChatInterface'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-screen bg-gray-100">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-700 mx-auto mb-4"></div>
        <p className="text-gray-600">Loading...</p>
      </div>
    </div>
  ),
});

export default async function Home() {
  const session = await auth();

  if (!session) {
    redirect('/auth/signin');
  }

  return <ChatInterface />;
}

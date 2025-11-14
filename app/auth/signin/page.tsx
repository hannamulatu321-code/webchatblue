'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';

export default function SignInPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Normalize phone number (remove spaces)
      const normalizedPhone = phone.replace(/\s+/g, '');

      if (isLogin) {
        const result = await signIn('credentials', {
          phone: normalizedPhone,
          password,
          redirect: false,
          callbackUrl: '/',
        });

        if (result?.error) {
          setError('Invalid phone number or password');
          console.error('Sign in error:', result.error);
        } else if (result?.ok) {
          router.push('/');
          router.refresh();
        } else {
          setError('Sign in failed. Please try again.');
        }
      } else {
        // Register
        const response = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: normalizedPhone, password, name }),
        });

        const data = await response.json();

        if (!response.ok) {
          setError(data.error || 'Registration failed');
        } else {
          // Auto login after registration
          const result = await signIn('credentials', {
            phone: normalizedPhone,
            password,
            redirect: false,
          });

          if (result?.error) {
            setError('Registration successful but sign in failed');
          } else {
            router.push('/');
            router.refresh();
          }
        }
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100 px-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-lg shadow-xl p-8">
          {/* Logo */}
          <div className="flex items-center justify-center gap-2 mb-6">
            <div className="w-12 h-12 bg-green-700 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-xl">B</span>
            </div>
            <span className="text-black font-semibold text-2xl">Blue+Me</span>
          </div>
          
          <h1 className="text-3xl font-bold text-center mb-8 text-gray-900">
            {isLogin ? 'Welcome to Blue+Me' : 'Create Account'}
          </h1>

          <form onSubmit={handleSubmit} className="space-y-6">
            {!isLogin && (
              <div>
                <label
                  htmlFor="name"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Name
                </label>
                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-700 focus:border-green-700 bg-white text-gray-900"
                  placeholder="Your name"
                />
              </div>
            )}

            <div>
              <label
                htmlFor="phone"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Phone Number
              </label>
              <input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-700 focus:border-green-700 bg-white text-gray-900"
                placeholder="1234567890"
                pattern="[0-9\s]{10,15}"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-700 focus:border-green-700 bg-white text-gray-900"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-green-700 hover:bg-green-800 text-white font-medium py-3 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl"
            >
              {loading ? 'Please wait...' : isLogin ? 'Sign In to Blue+Me' : 'Create Account'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={() => {
                setIsLogin(!isLogin);
                setError('');
              }}
              className="text-green-700 hover:text-green-800 text-sm font-medium transition-colors"
            >
              {isLogin
                ? "Don't have an account? Sign up"
                : 'Already have an account? Sign in to Blue+Me'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}


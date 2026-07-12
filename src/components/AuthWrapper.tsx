import { useState, useEffect } from 'react';
import { Crown } from 'lucide-react';

export default function AuthWrapper({ children }: { children: React.ReactNode }) {
  const [needsAuth, setNeedsAuth] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('app_token');
    if (token) {
      setNeedsAuth(false);
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);
    setAuthError(null);
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      const data = await res.json();
      if (res.ok) {
        localStorage.setItem('app_token', data.token);
        setNeedsAuth(false);
      } else {
        setAuthError(data.error || 'Invalid password');
      }
    } catch (error: any) {
      console.error('Login Failed:', error);
      setAuthError('An error occurred during sign in.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  if (needsAuth) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <form onSubmit={handleLogin} className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 max-w-sm w-full mx-4 text-center">
          <div className="w-16 h-16 bg-blue-500 rounded-xl flex items-center justify-center text-white shadow-sm mx-auto mb-6">
            <Crown size={32} />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Crown CRM</h1>
          <p className="text-slate-500 mb-8 text-sm">Enter the master password to access your CRM database.</p>
          
          <div className="mb-4 text-left">
            <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-slate-300 rounded-lg p-2 outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter password"
              required
            />
          </div>
          
          <button
            type="submit"
            disabled={isLoggingIn}
            className="w-full flex items-center justify-center bg-blue-600 text-white rounded-lg p-2 font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {isLoggingIn ? 'Signing in...' : 'Sign In'}
          </button>
          
          {authError && (
            <div className="mt-4 p-3 bg-red-50 text-red-700 text-sm rounded-lg text-left">
              <p>{authError}</p>
            </div>
          )}
        </form>
      </div>
    );
  }

  return <>{children}</>;}

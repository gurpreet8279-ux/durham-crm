import { useState, useEffect } from 'react';
import { Crown, RefreshCcw, Info } from 'lucide-react';
import { initAuth, googleSignIn } from '../lib/firebase';
import type { User } from 'firebase/auth';

export default function AuthWrapper({ children }: { children: React.ReactNode }) {
  const [needsAuth, setNeedsAuth] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [, setUser] = useState<User | null>(null);

  useEffect(() => {
    const unsubscribe = initAuth(
      (user) => {
        setUser(user);
        setNeedsAuth(false);
        setIsLoading(false);
      },
      () => {
        setUser(null);
        setNeedsAuth(true);
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    console.log("Connect button clicked");
    setIsLoggingIn(true);

    try {
      const result = await googleSignIn();
      if (result) {
        setUser(result.user);
        setNeedsAuth(false);
      }
    } catch (err: any) {
      console.error('Connection failed:', err);
    } finally {
      setIsLoggingIn(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <Crown size={48} className="text-blue-600 animate-pulse" />
          <p className="text-slate-500 font-medium">Loading Crown CRM...</p>
        </div>
      </div>
    );
  }

  if (needsAuth) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50 p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-100 flex flex-col max-h-[90vh]">
          <div className="p-8 flex flex-col items-center text-center overflow-y-auto">
            <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-200 mb-6 shrink-0">
              <Crown size={32} />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 mb-2">Crown CRM</h1>
            <p className="text-slate-500 mb-8">Connect Google Workspace to manage your detailing business</p>
            
            <button 
              onClick={handleLogin}
              disabled={isLoggingIn}
              className="w-full flex items-center justify-center gap-3 bg-white border border-slate-300 text-slate-700 px-6 py-3 rounded-xl font-medium hover:bg-slate-50 transition-colors disabled:opacity-50 mt-auto"
            >
              {isLoggingIn ? (
                <>
                  <RefreshCcw className="w-5 h-5 animate-spin text-blue-600" />
                  Connecting...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                    <path d="M1 1h22v22H1z" fill="none"/>
                  </svg>
                  Connect Google Workspace
                </>
              )}
            </button>
          </div>
          <div className="bg-slate-50 p-4 text-center border-t border-slate-100 flex items-center justify-center gap-2">
            <Info size={14} className="text-slate-400" />
            <p className="text-xs text-slate-500">Secure access via Google OAuth</p>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

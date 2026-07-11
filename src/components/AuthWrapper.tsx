import { useState, useEffect } from 'react';
import { Crown } from 'lucide-react';
import { initAuth, googleSignIn } from '../lib/firebaseAuth';

export default function AuthWrapper({ children }: { children: React.ReactNode }) {
  const [needsAuth, setNeedsAuth] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    // Check local storage as a quick initial check, then wait for Firebase
    const token = localStorage.getItem('google_access_token');
    if (token) {
      setNeedsAuth(false);
    }
    
    const unsubscribe = initAuth(
      (_user, token) => {
        setNeedsAuth(false);
        setIsInitialized(true);
      },
      () => {
        if (!localStorage.getItem('google_access_token')) {
          setNeedsAuth(true);
        }
        setIsInitialized(true);
      }
    );
    
    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    setIsLoggingIn(true);
    try {
      const result = await googleSignIn();
      if (result) {
        setNeedsAuth(false);
      }
    } catch (error) {
      console.error('Login Failed:', error);
    } finally {
      setIsLoggingIn(false);
    }
  };

  if (!isInitialized) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <Crown size={48} className="text-blue-500" />
          <p className="text-slate-500 font-medium">Loading Crown CRM...</p>
        </div>
      </div>
    );
  }

  if (needsAuth) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 max-w-sm w-full mx-4 text-center">
          <div className="w-16 h-16 bg-blue-500 rounded-xl flex items-center justify-center text-white shadow-sm mx-auto mb-6">
            <Crown size={32} />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Crown CRM</h1>
          <p className="text-slate-500 mb-8 text-sm">Sign in with Google to access your CRM database.</p>
          
          <button
            onClick={handleLogin}
            disabled={isLoggingIn}
            className="gsi-material-button w-full flex items-center justify-center border border-slate-300 rounded-lg p-2 hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            <div className="gsi-material-button-state"></div>
            <div className="gsi-material-button-content-wrapper flex items-center gap-3">
              <div className="gsi-material-button-icon">
                <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="w-5 h-5">
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                  <path fill="none" d="M0 0h48v48H0z"></path>
                </svg>
              </div>
              <span className="gsi-material-button-contents font-medium text-slate-700">
                {isLoggingIn ? 'Signing in...' : 'Sign in with Google'}
              </span>
            </div>
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

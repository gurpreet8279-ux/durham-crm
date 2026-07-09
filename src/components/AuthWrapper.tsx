import { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { initAuth, googleSignIn, logout } from '../lib/firebase';
import { Crown, AlertCircle, Info, RefreshCcw } from 'lucide-react';

export default function AuthWrapper({ children }: { children: React.ReactNode }) {
  const [needsAuth, setNeedsAuth] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [helpSteps, setHelpSteps] = useState<string[]>([]);

  useEffect(() => {
    const unsubscribe = initAuth(
      (user, token) => {
        setUser(user);
        setNeedsAuth(false);
        setIsLoading(false);
      },
      (error) => {
        setUser(null);
        setNeedsAuth(true);
        setIsLoading(false);
        if (error) {
          handleAuthError(error);
        }
      }
    );
    return () => unsubscribe();
  }, []);

  const handleAuthError = (err: any) => {
    console.error('Auth Error Full:', err);
    let msg = err.message || 'An error occurred during sign in';
    let steps: string[] = [];
    
    if (err.code === 'auth/unauthorized-domain') {
      msg = `Domain not authorized for Firebase Auth.`;
      steps = [
        `1. Go to Firebase Console -> Authentication -> Settings -> Authorized Domains`,
        `2. Click "Add Domain"`,
        `3. Add this exact domain: ${window.location.hostname}`,
        `4. If on Netlify, add your Netlify app domain.`
      ];
    } else if (err.code === 'auth/operation-not-allowed') {
      msg = `Google Sign-In is not enabled.`;
      steps = [
        `1. Go to Firebase Console -> Authentication -> Sign-in method`,
        `2. Click "Add new provider" -> Google`,
        `3. Enable it and save.`
      ];
    } else if (err.code === 'auth/popup-blocked') {
      msg = `Sign-in popup was blocked by your browser.`;
      steps = [
        `Please allow popups for this site. We will try to fall back to a full-page redirect.`
      ];
    } else if (err.message && err.message.includes('Cross-Origin')) {
       msg = `Cross-Origin policy blocked the sign in.`;
       steps = [
         `This usually happens in preview iframes. Please deploy to Netlify or open the app in a new tab (outside of the AI Studio iframe).`
       ];
    } else if (err.code === 'auth/network-request-failed') {
       msg = `Network error. Could not reach Firebase.`;
       steps = [
         `Please check your internet connection or any adblockers/firewalls that might block Firebase.`
       ];
    }
    
    setErrorMsg(msg);
    setHelpSteps(steps);
  };

  const handleLogin = async () => {
    console.log("Login button clicked");
    setIsLoggingIn(true);
    setErrorMsg(null);
    setHelpSteps([]);
    
    // Fallback timeout in case the promise never resolves/rejects (e.g., silent block)
    const timeoutId = setTimeout(() => {
      if (isLoggingIn) {
        setIsLoggingIn(false);
        setErrorMsg("Login attempt timed out. The popup might have been silently blocked by your browser.");
        setHelpSteps([
          "Please check your browser's popup blocker.",
          "Try opening the application in a completely new tab.",
          "If on mobile, try Safari/Chrome directly instead of an in-app browser."
        ]);
      }
    }, 15000); // 15 seconds timeout

    try {
      const result = await googleSignIn();
      clearTimeout(timeoutId);
      if (result) {
        setUser(result.user);
        setNeedsAuth(false);
      }
    } catch (err: any) {
      clearTimeout(timeoutId);
      console.error('Login failed catch block:', err);
      handleAuthError(err);
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
            <p className="text-slate-500 mb-8">Sign in to manage your mobile detailing business</p>
            
            {errorMsg && (
              <div className="w-full mb-6 p-4 bg-red-50 text-red-800 rounded-xl text-sm flex flex-col gap-3 text-left border border-red-100 shadow-sm">
                <div className="flex items-start gap-2 font-bold">
                  <AlertCircle className="shrink-0 mt-0.5 text-red-600" size={18} />
                  <span>{errorMsg}</span>
                </div>
                {helpSteps.length > 0 && (
                  <div className="bg-white/50 rounded-lg p-3 space-y-2 mt-1">
                    <p className="font-bold text-xs uppercase tracking-wider text-red-600">How to fix this:</p>
                    <ul className="space-y-1.5 text-red-700">
                      {helpSteps.map((step, i) => (
                        <li key={i} className="flex gap-2">
                          <span className="opacity-50">•</span> 
                          <span>{step}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
            
            <button 
              onClick={handleLogin}
              disabled={isLoggingIn}
              className="w-full flex items-center justify-center gap-3 bg-white border border-slate-300 text-slate-700 px-6 py-3 rounded-xl font-medium hover:bg-slate-50 transition-colors disabled:opacity-50 mt-auto"
            >
              {isLoggingIn ? (
                <>
                  <RefreshCcw className="w-5 h-5 animate-spin text-blue-600" />
                  Attempting Login...
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
                  Sign in with Google
                </>
              )}
            </button>
          </div>
          <div className="bg-slate-50 p-4 text-center border-t border-slate-100 flex items-center justify-center gap-2">
            <Info size={14} className="text-slate-400" />
            <p className="text-xs text-slate-500">Secure access via Firebase Auth</p>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

import React, { useState } from 'react';
import { useCRM } from '../store/useCRM';
import { Crown, Mail, Lock, User as UserIcon, Shield, Sparkles, LogIn, UserPlus } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface AuthWrapperProps {
  children: React.ReactNode;
}

export default function AuthWrapper({ children }: AuthWrapperProps) {
  const { 
    user, 
    loading, 
    loginWithEmail, 
    registerWithEmail, 
    loginWithGoogle, 
    authError 
  } = useCRM();

  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<'admin' | 'technician'>('admin');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSubmitting(true);

    try {
      if (isSignUp) {
        if (!name.trim()) {
          throw new Error("Full Name is required for registration.");
        }
        await registerWithEmail(email, password, name.trim(), role);
      } else {
        await loginWithEmail(email, password);
      }
    } catch (err: any) {
      setErrorMsg(err.message || "An error occurred. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setErrorMsg(null);
    setSubmitting(true);
    try {
      await loginWithGoogle();
    } catch (err: any) {
      setErrorMsg(err.message || "Google sign-in failed.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-900 text-white">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
          className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full mb-4"
        />
        <p className="text-sm font-medium tracking-wide text-slate-400">Loading Crown CRM...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 relative overflow-hidden select-none">
        {/* Decorative Ambient Background Glows */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="w-full max-w-md z-10">
          {/* Logo Brand Header */}
          <div className="text-center mb-8">
            <motion.div 
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center justify-center w-14 h-14 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-2xl text-white shadow-lg shadow-blue-500/20 mb-3"
            >
              <Crown size={28} />
            </motion.div>
            <motion.h1 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.5 }}
              className="text-2xl font-bold tracking-tight text-white"
            >
              Crown Detailer CRM
            </motion.h1>
            <motion.p 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.5 }}
              className="text-sm text-slate-400 mt-1"
            >
              Streamlined client detailing & manifest workflow
            </motion.p>
          </div>

          {/* Login/Signup Tab controls */}
          <div className="bg-slate-900/80 backdrop-blur-md border border-slate-800 rounded-2xl p-6 shadow-2xl relative">
            <div className="flex border-b border-slate-800 pb-4 mb-6">
              <button
                type="button"
                onClick={() => { setIsSignUp(false); setErrorMsg(null); }}
                className={`flex-1 text-center pb-2 text-sm font-semibold transition-all relative ${!isSignUp ? 'text-blue-400' : 'text-slate-400 hover:text-slate-300'}`}
              >
                <span className="flex items-center justify-center gap-2">
                  <LogIn size={16} /> Sign In
                </span>
                {!isSignUp && (
                  <motion.div 
                    layoutId="activeTabUnderline" 
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500"
                  />
                )}
              </button>
              <button
                type="button"
                onClick={() => { setIsSignUp(true); setErrorMsg(null); }}
                className={`flex-1 text-center pb-2 text-sm font-semibold transition-all relative ${isSignUp ? 'text-blue-400' : 'text-slate-400 hover:text-slate-300'}`}
              >
                <span className="flex items-center justify-center gap-2">
                  <UserPlus size={16} /> Register
                </span>
                {isSignUp && (
                  <motion.div 
                    layoutId="activeTabUnderline" 
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500"
                  />
                )}
              </button>
            </div>

            {/* Error Message Box */}
            <AnimatePresence mode="wait">
              {(errorMsg || authError) && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-xl p-3 mb-5 overflow-hidden font-medium"
                >
                  {errorMsg || authError}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Email Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <AnimatePresence mode="popLayout">
                {isSignUp && (
                  <motion.div
                    key="name-input"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ duration: 0.2 }}
                  >
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Full Name</label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                        <UserIcon size={18} />
                      </span>
                      <input
                        type="text"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="John Doe"
                        className="w-full bg-slate-950/80 border border-slate-800 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Email Address</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                    <Mail size={18} />
                  </span>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full bg-slate-950/80 border border-slate-800 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Password</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                    <Lock size={18} />
                  </span>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-slate-950/80 border border-slate-800 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  />
                </div>
              </div>

              <AnimatePresence mode="popLayout">
                {isSignUp && (
                  <motion.div
                    key="role-input"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ duration: 0.2 }}
                  >
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Employee Role</label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setRole('admin')}
                        className={`py-2.5 px-4 rounded-xl border text-sm font-medium transition-all flex items-center justify-center gap-2 ${role === 'admin' ? 'bg-blue-600/10 border-blue-500 text-blue-400' : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:text-slate-300 hover:bg-slate-950/80'}`}
                      >
                        <Shield size={16} /> Admin
                      </button>
                      <button
                        type="button"
                        onClick={() => setRole('technician')}
                        className={`py-2.5 px-4 rounded-xl border text-sm font-medium transition-all flex items-center justify-center gap-2 ${role === 'technician' ? 'bg-blue-600/10 border-blue-500 text-blue-400' : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:text-slate-300 hover:bg-slate-950/80'}`}
                      >
                        <Sparkles size={16} /> Technician
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 mt-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-sm font-bold shadow-lg shadow-blue-500/15 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {submitting ? 'Processing...' : isSignUp ? 'Register Account' : 'Sign In'}
              </button>
            </form>

            {/* Divider */}
            <div className="flex items-center gap-3 my-6">
              <div className="flex-1 h-px bg-slate-800" />
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Or Continue With</span>
              <div className="flex-1 h-px bg-slate-800" />
            </div>

            {/* Google Sign In */}
            <button
              onClick={handleGoogleSignIn}
              disabled={submitting}
              className="w-full py-2.5 bg-slate-950 border border-slate-800 hover:bg-slate-900 text-slate-300 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-3 hover:text-white"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  fill="#EA4335"
                />
              </svg>
              Google Account
            </button>

            <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl text-center">
              <p className="text-[11px] text-blue-300 font-medium leading-relaxed">
                <strong>Deployment Tip:</strong> For Netlify, please register and sign in with your <strong>Email & Password</strong> above. Google Account sign-in is restricted to the sandbox environment.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // User is authenticated, proceed
  return <>{children}</>;
}

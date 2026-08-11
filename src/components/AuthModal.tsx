import React, { useState } from 'react';
import { ShieldCheck, User, Lock, Mail, Building, ArrowRight, Sparkles, AlertCircle } from 'lucide-react';
import { UserProfile } from '../types';
import { authFetch, setStoredSessionId } from '../utils/api';

interface AuthModalProps {
  onLoginSuccess: (user: UserProfile) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ onLoginSuccess }) => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [fullName, setFullName] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);

    const endpoint = isSignUp ? '/api/auth/register' : '/api/auth/login';
    const body = isSignUp
      ? { email, password, name: fullName, businessName }
      : { email, password };

    try {
      const res = await authFetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setErrorMsg(data.message || 'Authentication failed. Please check your credentials.');
        setLoading(false);
        return;
      }

      if (data.sessionId) {
        setStoredSessionId(data.sessionId);
      }

      onLoginSuccess(data.user);
    } catch (err: any) {
      setErrorMsg(err.message || 'Network error occurred during authentication.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickDemo = async () => {
    setErrorMsg(null);
    setLoading(true);

    const demoEmail = 'seller@meesho-gst.in';
    const demoPassword = 'Password123!';

    try {
      // First try login
      let res = await authFetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: demoEmail, password: demoPassword }),
      });

      let data = await res.json();

      // If account doesn't exist, register demo account
      if (!res.ok || !data.success) {
        res = await authFetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: demoEmail,
            password: demoPassword,
            name: 'Meesho Demo Seller',
            businessName: 'Zenith E-Commerce Traders'
          }),
        });
        data = await res.json();
      }

      if (data.success && data.user) {
        if (data.sessionId) {
          setStoredSessionId(data.sessionId);
        }
        onLoginSuccess(data.user);
      } else {
        setErrorMsg(data.message || 'Failed to authenticate demo account.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Network error connecting to demo account.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full border border-slate-100 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-6 relative">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shadow-md">
              <ShieldCheck className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">GST Online Seller</h1>
              <p className="text-xs text-slate-300">GST Filing & TCS Tool for Meesho & Marketplaces</p>
            </div>
          </div>
        </div>

        {/* Form Body */}
        <div className="p-6">
          <div className="flex bg-slate-100 p-1 rounded-xl mb-6">
            <button
              type="button"
              onClick={() => { setIsSignUp(false); setErrorMsg(null); }}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
                !isSignUp ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => { setIsSignUp(true); setErrorMsg(null); }}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
                isSignUp ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Create Account
            </button>
          </div>

          {errorMsg && (
            <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start space-x-2 text-rose-700 text-xs">
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignUp && (
              <>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Full Name</label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="e.g. Pravesh Pal"
                      className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Business / Trade Name</label>
                  <div className="relative">
                    <Building className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="text"
                      required
                      value={businessName}
                      onChange={(e) => setBusinessName(e.target.value)}
                      placeholder="e.g. Zenith E-Commerce"
                      className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Email Address</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seller@example.com"
                  className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm rounded-xl shadow-md transition-all flex items-center justify-center space-x-2 disabled:opacity-50"
            >
              <span>{loading ? 'Authenticating...' : isSignUp ? 'Create Account' : 'Sign In to Dashboard'}</span>
              {!loading && <ArrowRight className="w-4 h-4" />}
            </button>
          </form>

          <div className="relative my-6 text-center">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200"></div>
            </div>
            <span className="relative px-3 bg-white text-xs text-slate-500">OR</span>
          </div>

          <button
            type="button"
            onClick={handleQuickDemo}
            disabled={loading}
            className="w-full py-2.5 px-4 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-medium text-xs rounded-xl border border-emerald-200 transition-all flex items-center justify-center space-x-2 disabled:opacity-50"
          >
            <Sparkles className="w-4 h-4 text-emerald-600" />
            <span>{loading ? 'Loading Demo...' : 'Continue as Guest / Try Demo Mode'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

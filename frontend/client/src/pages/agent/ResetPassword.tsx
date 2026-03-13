import { useState, useEffect } from 'react';
import { useLocation, useRoute } from 'wouter';
import { supabase } from '../../lib/supabase';
import { KeyRound, CheckCircle2, AlertCircle } from 'lucide-react';

export default function ResetPassword() {
  const [, setLocation] = useLocation();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  // Handle fragments since Supabase redirects with a fragment link (#access_token=...)
  useEffect(() => {
    supabase.auth.onAuthStateChange((event, session) => {
      // Password recovery event handled - user will be prompted for new password
    });
  }, []);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      setStatus('error');
      setMessage("Passwords don't match");
      return;
    }

    if (password.length < 6) {
      setStatus('error');
      setMessage("Password must be at least 6 characters");
      return;
    }

    setIsLoading(true);
    setStatus('idle');
    try {
      const { error } = await supabase.auth.updateUser({ password });

      if (error) {
        throw error;
      }

      setStatus('success');
      setMessage('Password updated successfully. Redirecting to login...');
      setTimeout(() => {
        setLocation('/agent/login');
      }, 2000);
    } catch (error: any) {
      setStatus('error');
      setMessage(error.message || 'Failed to update password');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 bg-[#0D9488]/10 rounded-2xl flex items-center justify-center transform rotate-3 transition-transform hover:rotate-6">
            <KeyRound size={28} className="text-[#0D9488]" />
          </div>
        </div>
        <h2 className="mt-2 text-center text-3xl font-extrabold text-[#0F172A] font-serif tracking-tight">
          Reset Password
        </h2>
        <p className="mt-2 text-center text-sm text-[#64748B]">
          Enter your new password below.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow-[0_4px_24px_rgba(0,0,0,0.04)] sm:rounded-2xl sm:px-10 border border-slate-100">
          
          {status === 'success' && (
            <div className="mb-6 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl flex items-start gap-3">
              <CheckCircle2 className="shrink-0 mt-0.5" size={18} />
              <p className="text-sm font-medium">{message}</p>
            </div>
          )}

          {status === 'error' && (
            <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-start gap-3">
              <AlertCircle className="shrink-0 mt-0.5" size={18} />
              <p className="text-sm font-medium">{message}</p>
            </div>
          )}

          <form className="space-y-6" onSubmit={handleReset}>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                New Password
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="appearance-none block w-full px-4 py-3 border border-slate-200 rounded-xl shadow-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0D9488]/20 focus:border-[#0D9488] sm:text-sm transition-all bg-slate-50 focus:bg-white"
                placeholder="••••••••"
                disabled={isLoading || status === 'success'}
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                Confirm Password
              </label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="appearance-none block w-full px-4 py-3 border border-slate-200 rounded-xl shadow-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0D9488]/20 focus:border-[#0D9488] sm:text-sm transition-all bg-slate-50 focus:bg-white"
                placeholder="••••••••"
                disabled={isLoading || status === 'success'}
              />
            </div>

            <button
              type="submit"
              disabled={isLoading || status === 'success'}
              className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-[0_4px_14px_0_rgba(13,148,136,0.39)] text-sm font-bold text-white bg-[#0D9488] hover:bg-[#0F766E] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#0D9488] disabled:opacity-50 transition-all hover:-translate-y-0.5 hover:shadow-[0_6px_20px_rgba(13,148,136,0.4)]"
            >
              {isLoading ? 'Updating...' : 'Update Password'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

import { useState } from 'react';
import { Link } from 'wouter';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function handleSubmit() {
    if (!email) {
      setError('Provide your registered email to initiate credential reset.');
      return;
    }
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/agent/reset-password`,
    });
    setLoading(false);
    if (error) {
      setError(error.message);
    } else {
      // Always show success regardless of whether the email exists (avoids account enumeration).
      setSent(true);
    }
  }

  return (
    <div className="flex flex-col lg:flex-row min-h-screen bg-white">
      {/* LEFT PANEL: BRAND EXPERIENCE */}
      <div className="hidden lg:flex w-[45%] bg-[#0D9488] text-white p-16 flex-col justify-between relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full -mr-20 -mt-20 blur-3xl" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-black/10 rounded-full -ml-16 -mb-16 blur-2xl" />

        <div className="relative z-10 flex flex-col">
          <div className="flex items-center gap-3 font-black text-[24px] tracking-tighter uppercase font-['Playfair_Display']">
            <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center shadow-lg shadow-black/10 border border-white/30">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2L20 6V12C20 16.4 16.4 20.4 12 22C7.6 20.4 4 16.4 4 12V6L12 2Z" stroke="white" strokeWidth="2.5" fill="none" />
              </svg>
            </div>
            IndSure
          </div>

          <div className="mt-20">
            <h2 className="text-5xl font-bold leading-[1.1] font-['Playfair_Display']">
              Lost your <br />
              <span className="text-white/90 drop-shadow-lg">Vault Key?</span> <br />
              Let's restore it.
            </h2>
            <p className="mt-8 text-white/80 text-lg font-medium max-w-sm leading-relaxed">
              We'll dispatch a secured, single-use link to your registered email to re-establish access.
            </p>
          </div>
        </div>

        <div className="relative z-10 text-white/60 text-[10px] font-black tracking-[0.2em] uppercase">
          Standardized by Leading Insurers · v4.1.0-VITE
        </div>
      </div>

      {/* RIGHT PANEL: RESET REQUEST */}
      <div className="flex-1 flex flex-col justify-center items-center py-20 px-8">
        <div className="w-full max-w-md space-y-12">
          <div className="text-center">
            <h1 className="text-4xl font-bold text-slate-900 font-['Playfair_Display']">Reset Access</h1>
            <p className="mt-3 text-slate-400 font-semibold uppercase text-[11px] tracking-widest">Credential Recovery</p>
          </div>

          {sent ? (
            <div className="space-y-8">
              <div className="bg-emerald-50 text-emerald-700 p-5 rounded-xl border border-emerald-100 text-sm font-semibold leading-relaxed">
                If an account exists for <span className="font-black">{email}</span>, a secured reset link has been
                dispatched. Check your inbox (and spam) and follow the link to set a new Vault Key.
              </div>
              <Link href="/agent/login">
                <Button className="w-full h-12 bg-[#0D9488] hover:bg-[#0f766e] text-white rounded-xl text-xs font-black uppercase tracking-[0.2em] shadow-xl shadow-[#0D9488]/20 transition-all">
                  Back to Portal
                </Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Credential Email</label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                  className="h-12 bg-slate-50 border-slate-100 focus:border-[#0D9488] focus:bg-white transition-all font-semibold px-4 rounded-xl"
                  placeholder="advisor@indsure.ai"
                />
              </div>

              {error && (
                <div className="bg-red-50 text-red-600 p-4 rounded-xl border border-red-100 text-[11px] font-bold uppercase tracking-tight flex items-center gap-3">
                  <span className="shrink-0 w-2 h-2 rounded-full bg-red-600 animate-pulse" />
                  {error}
                </div>
              )}

              <Button
                onClick={handleSubmit}
                disabled={loading}
                className="w-full h-12 bg-[#0D9488] hover:bg-[#0f766e] text-white rounded-xl text-xs font-black uppercase tracking-[0.2em] shadow-xl shadow-[#0D9488]/20 transition-all disabled:opacity-50"
              >
                {loading ? 'Dispatching...' : 'Send Reset Link'}
              </Button>

              <div className="text-center">
                <Link href="/agent/login" className="text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-[#0D9488]">
                  ← Back to Portal
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

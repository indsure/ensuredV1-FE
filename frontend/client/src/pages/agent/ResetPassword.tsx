import { useEffect, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Eye, EyeOff, CheckCircle2 } from 'lucide-react';

export default function ResetPassword() {
  const [, setLocation] = useLocation();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  // null = checking, true = valid recovery session present, false = no/expired link
  const [ready, setReady] = useState<boolean | null>(null);

  // Supabase parses the recovery token from the URL on load and emits a
  // PASSWORD_RECOVERY event / establishes a session. Verify one exists.
  useEffect(() => {
    let active = true;

    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (!active) return;
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') {
        setReady(true);
      }
    });

    (async () => {
      // Reset emails link straight here with the token hash instead of bouncing
      // through Supabase's /auth/v1/verify, whose redirect only honours
      // allowlisted URLs and was silently dropping people on the Site URL.
      const params = new URLSearchParams(window.location.search);
      const tokenHash = params.get('token_hash');
      if (tokenHash && params.get('type') === 'recovery') {
        const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: 'recovery' });
        if (!active) return;
        if (error) {
          setReady(false);
          return;
        }
        // Strip the token from the address bar — a shared or refreshed URL must
        // not carry a live credential.
        window.history.replaceState({}, '', window.location.pathname);
        setReady(true);
        return;
      }

      const { data } = await supabase.auth.getSession();
      if (!active) return;
      if (data.session) setReady(true);
      else setReady((prev) => (prev === null ? false : prev));
    })();

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const checks = {
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    number: /[0-9]/.test(password),
  };
  const passwordValid = checks.length && checks.uppercase && checks.number;

  async function handleSubmit() {
    if (!passwordValid) {
      setError('Password must be at least 8 characters with an uppercase letter and a number.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      setError(error.message);
    } else {
      setDone(true);
      // Send the agent to the portal after a short beat.
      setTimeout(() => setLocation('/agent/dashboard'), 1800);
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
              Forge a new <br />
              <span className="text-white/90 drop-shadow-lg">Vault Key.</span>
            </h2>
            <p className="mt-8 text-white/80 text-lg font-medium max-w-sm leading-relaxed">
              Choose a strong, unique password. This link can only be used once.
            </p>
          </div>
        </div>

        <div className="relative z-10 text-white/60 text-[10px] font-black tracking-[0.2em] uppercase">
          Standardized by Leading Insurers · v4.1.0-VITE
        </div>
      </div>

      {/* RIGHT PANEL: SET NEW PASSWORD */}
      <div className="flex-1 flex flex-col justify-center items-center py-20 px-8">
        <div className="w-full max-w-md space-y-12">
          <div className="text-center">
            <h1 className="text-4xl font-bold text-slate-900 font-['Playfair_Display']">New Vault Key</h1>
            <p className="mt-3 text-slate-400 font-semibold uppercase text-[11px] tracking-widest">Set Your New Password</p>
          </div>

          {ready === null && (
            <div className="text-center text-slate-400 text-sm font-semibold">Verifying reset link...</div>
          )}

          {ready === false && (
            <div className="space-y-8">
              <div className="bg-red-50 text-red-600 p-5 rounded-xl border border-red-100 text-sm font-semibold leading-relaxed">
                This reset link is invalid or has expired. Please request a new one.
              </div>
              <Link href="/agent/forgot-password">
                <Button className="w-full h-12 bg-[#0D9488] hover:bg-[#0f766e] text-white rounded-xl text-xs font-black uppercase tracking-[0.2em] shadow-xl shadow-[#0D9488]/20 transition-all">
                  Request New Link
                </Button>
              </Link>
            </div>
          )}

          {ready === true && done && (
            <div className="space-y-8">
              <div className="bg-emerald-50 text-emerald-700 p-5 rounded-xl border border-emerald-100 text-sm font-semibold leading-relaxed flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 shrink-0" />
                Password updated. Redirecting you to the portal...
              </div>
            </div>
          )}

          {ready === true && !done && (
            <div className="space-y-6">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">New Vault Key</label>
                <div className="relative">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-12 bg-slate-50 border-slate-100 focus:border-[#0D9488] focus:bg-white transition-all font-semibold px-4 pr-11 rounded-xl"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Confirm Vault Key</label>
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                  className="h-12 bg-slate-50 border-slate-100 focus:border-[#0D9488] focus:bg-white transition-all font-semibold px-4 rounded-xl"
                  placeholder="••••••••"
                />
              </div>

              {password && (
                <div className="space-y-2">
                  <div className={`text-xs flex items-center gap-2 ${checks.length ? 'text-emerald-600' : 'text-slate-400'}`}>
                    <CheckCircle2 className="w-3.5 h-3.5" /> At least 8 characters
                  </div>
                  <div className={`text-xs flex items-center gap-2 ${checks.uppercase ? 'text-emerald-600' : 'text-slate-400'}`}>
                    <CheckCircle2 className="w-3.5 h-3.5" /> One uppercase letter
                  </div>
                  <div className={`text-xs flex items-center gap-2 ${checks.number ? 'text-emerald-600' : 'text-slate-400'}`}>
                    <CheckCircle2 className="w-3.5 h-3.5" /> One number
                  </div>
                </div>
              )}

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
                {loading ? 'Updating...' : 'Update Password'}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

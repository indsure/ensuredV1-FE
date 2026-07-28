import { useState } from 'react';
import { useLocation, Link } from 'wouter';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useLanguage, LanguageToggle } from '@/i18n/LanguageContext';
import { ShieldCheck, Eye, EyeOff, FolderKanban, MessageCircle, Scale } from 'lucide-react';

export default function LoginNew() {
  const [, setLocation] = useLocation();
  const { t } = useLanguage();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSignIn() {
    if (!email || !password) {
      setError(t('agent_login.error_empty'));
      return;
    }
    setLoading(true);
    setError(null);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    // Gate the advisor portal to advisor accounts only. Consumer/retail
    // accounts share the same Supabase auth pool, so a valid client login
    // would otherwise land here. Require a matching row in `agents`.
    const userId = data.user?.id;
    const { data: agentProfile } = await supabase
      .from('agents')
      .select('id')
      .eq('id', userId)
      .maybeSingle();

    if (!agentProfile) {
      await supabase.auth.signOut();
      setError('This is a client account, not an advisor account. Please sign in at the client portal.');
      setLoading(false);
      return;
    }

    setLocation('/agent/dashboard');
  }

  const benefits = [
    { icon: FolderKanban, t: t('agent_login.benefit_1_t'), d: t('agent_login.benefit_1_d') },
    { icon: MessageCircle, t: t('agent_login.benefit_2_t'), d: t('agent_login.benefit_2_d') },
    { icon: Scale, t: t('agent_login.benefit_3_t'), d: t('agent_login.benefit_3_d') },
  ];

  return (
    <div className="flex flex-col lg:flex-row min-h-screen bg-white">
      {/* LEFT PANEL: BRAND / ADVISOR VALUE (desktop only) */}
      <div className="hidden lg:flex w-[45%] bg-[#0D9488] text-white p-16 flex-col justify-between relative overflow-hidden">
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full -mr-20 -mt-20 blur-3xl" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-black/10 rounded-full -ml-16 -mb-16 blur-2xl" />

        <div className="relative z-10 flex flex-col">
          <Link href="/agent" className="w-fit">
            <img src="/logo-white.png" alt="IndSure" className="h-12 w-auto object-contain cursor-pointer" />
          </Link>

          <div className="mt-14">
            <h2 className="text-4xl xl:text-5xl font-bold leading-[1.15] font-['Playfair_Display'] max-w-md">
              {t('agent_login.left_title')}
            </h2>
            <p className="mt-6 text-white/80 text-lg font-medium max-w-sm leading-relaxed">
              {t('agent_login.left_subtitle')}
            </p>
          </div>

          <div className="mt-12 space-y-6">
            {benefits.map((item, i) => {
              const Icon = item.icon;
              return (
                <div key={i} className="flex gap-4">
                  <div className="shrink-0 h-10 w-10 rounded-xl bg-white/15 border border-white/20 flex items-center justify-center">
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-white">{item.t}</h4>
                    <p className="text-sm text-white/70 font-medium mt-0.5 max-w-xs leading-relaxed">{item.d}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="relative z-10 mt-10 flex items-center gap-2 text-white/70 text-xs font-semibold">
          <ShieldCheck className="w-4 h-4 shrink-0" />
          {t('agent_login.footer')}
        </div>
      </div>

      {/* RIGHT PANEL: LOGIN FORM */}
      <div className="flex-1 flex flex-col justify-center items-center py-16 px-6 sm:px-8 relative">
        {/* Language toggle, top-right */}
        <div className="absolute top-6 right-6">
          <LanguageToggle />
        </div>

        <div className="w-full max-w-md space-y-10">
          {/* Logo — visible on mobile where the left panel is hidden */}
          <Link href="/agent">
            <img src="/logo.png" alt="IndSure" className="lg:hidden h-9 w-auto mx-auto cursor-pointer" />
          </Link>

          <div className="text-center">
            <h1 className="text-4xl font-bold text-slate-900 font-['Playfair_Display']">{t('agent_login.welcome_title')}</h1>
            <p className="mt-3 text-slate-500 font-medium">{t('agent_login.welcome_subtitle')}</p>
          </div>

          <div className="space-y-6">
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="login-email" className="text-sm font-semibold text-slate-700 ml-1">
                  {t('agent_login.email_label')}
                </label>
                <Input
                  id="login-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-12 bg-slate-50 border-slate-200 focus:border-[#0D9488] focus:bg-white transition-all font-medium px-4 rounded-xl"
                  placeholder={t('agent_login.email_placeholder')}
                />
              </div>
              <div className="space-y-1.5">
                <div className="flex justify-between items-center px-1">
                  <label htmlFor="login-password" className="text-sm font-semibold text-slate-700">
                    {t('agent_login.password_label')}
                  </label>
                  <button
                    type="button"
                    onClick={() => setLocation('/agent/forgot-password')}
                    className="text-sm font-semibold text-[#0D9488] hover:underline"
                  >
                    {t('agent_login.forgot')}
                  </button>
                </div>
                <div className="relative">
                  <Input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSignIn()}
                    className="h-12 bg-slate-50 border-slate-200 focus:border-[#0D9488] focus:bg-white transition-all font-medium px-4 pr-16 rounded-xl"
                    placeholder={t('agent_login.password_placeholder')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 text-xs font-semibold text-slate-400 hover:text-slate-700 transition-colors"
                    aria-label={showPassword ? t('agent_login.hide') : t('agent_login.show')}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    <span className="hidden sm:inline">{showPassword ? t('agent_login.hide') : t('agent_login.show')}</span>
                  </button>
                </div>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 text-red-600 p-4 rounded-xl border border-red-100 text-sm font-medium flex items-center gap-3">
                <span className="shrink-0 w-2 h-2 rounded-full bg-red-600" />
                {error}
              </div>
            )}

            <Button
              onClick={handleSignIn}
              disabled={loading}
              className="w-full h-12 bg-[#0D9488] hover:bg-[#0f766e] text-white rounded-xl text-base font-bold shadow-lg shadow-[#0D9488]/20 transition-all disabled:opacity-50"
            >
              {loading ? t('agent_login.logging_in') : t('agent_login.login_btn')}
            </Button>

            <p className="text-center text-sm text-slate-500">
              {t('agent_login.no_account')}{' '}
              <Link href="/agent/signup/step1">
                <span className="font-semibold text-[#0D9488] hover:underline cursor-pointer">
                  {t('agent_login.create_account')}
                </span>
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

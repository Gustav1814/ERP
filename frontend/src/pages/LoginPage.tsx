import { FormEvent, useMemo, useState } from 'react';
import { Eye, EyeOff, Lock, Mail, ShieldCheck, Sparkles } from 'lucide-react';
import { DEFAULT_ACCENT_ID, getTheme, normalizeAccentId, themeToCssVars } from '../theme';

type LoginPageProps = {
  darkMode: boolean;
  accentId?: string;
  onLogin: (email: string, password: string) => Promise<string | null>;
};

export default function LoginPage({ darkMode, accentId, onLogin }: LoginPageProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const resolvedAccent = normalizeAccentId(accentId ?? DEFAULT_ACCENT_ID);
  const t = useMemo(() => getTheme(darkMode, resolvedAccent), [darkMode, resolvedAccent]);
  const cssVars = useMemo(() => themeToCssVars(t, darkMode), [t, darkMode]);
  const accentGrad = useMemo(
    () => `linear-gradient(135deg, ${t.accent}, ${t.chartB})`,
    [t.accent, t.chartB],
  );
  const nebula = useMemo(
    () =>
      [
        `radial-gradient(920px 640px at 10% 6%, ${t.meshAccent}, transparent 58%)`,
        `radial-gradient(720px 520px at 90% 94%, ${t.meshSecondary}, transparent 58%)`,
      ].join(', '),
    [t.meshAccent, t.meshSecondary],
  );

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    const loginError = await onLogin(email.trim().toLowerCase() || 'admin@hb-erp.local', password);
    if (loginError) {
      setError(loginError);
    }
    setSubmitting(false);
  };

  return (
    <div
      className="relative flex min-h-screen items-center justify-center overflow-hidden p-6"
      data-erp-theme={darkMode ? 'dark' : 'light'}
      style={{
        ...cssVars,
        backgroundColor: t.bg,
        color: t.text,
      }}
    >
      <div className="pointer-events-none absolute inset-0" style={{ background: nebula }} />

      <div
        className="relative grid w-full max-w-5xl overflow-hidden rounded-3xl border shadow-2xl lg:grid-cols-[1.05fr_1fr]"
        style={{
          borderColor: t.glassBorder,
          boxShadow: `0 28px 56px ${t.cardShadow}, 0 0 48px ${t.glow}, inset 0 1px 0 ${t.cardShine}`,
          backdropFilter: 'blur(20px)',
        }}
      >
        <section
          className="relative overflow-hidden p-8 md:p-12"
          style={{
            background: t.bgCardSoft,
            borderRight: `1px solid ${darkMode ? t.border : 'transparent'}`,
          }}
        >
          <div
            className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full opacity-35 blur-3xl"
            style={{ background: accentGrad }}
          />

          <div
            className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-widest"
            style={{
              borderColor: t.border,
              color: t.textSecondary,
              backgroundColor: t.inputBg,
              backdropFilter: 'blur(10px)',
            }}
          >
            <ShieldCheck size={14} style={{ color: t.accent }} />
            Direct CRM to ERP
          </div>
          <h1 className="mt-5 font-display text-4xl font-bold leading-tight" style={{ color: t.text }}>
            ERP Operations Console
          </h1>
          <p className="mt-3 max-w-md text-sm leading-relaxed" style={{ color: t.textSecondary }}>
            Securely manage companies, orders, and intake processing from direct CRM pushes. No SSO bridge. No intermediary hops.
          </p>

          <div className="mt-8 space-y-3">
            {['Realtime intake visibility', 'Idempotent order commits', 'Role-based internal access'].map((item) => (
              <div key={item} className="flex items-center gap-2 text-sm" style={{ color: t.text }}>
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: t.accent, boxShadow: `0 0 12px ${t.accent}` }}
                />
                {item}
              </div>
            ))}
          </div>

          <div
            className="glass-card mt-10 inline-flex items-center gap-2 rounded-2xl px-4 py-3 animate-order-float"
            style={{ borderColor: t.border }}
          >
            <Sparkles size={16} style={{ color: t.accent }} />
            <span className="text-xs font-medium" style={{ color: t.textSecondary }}>
              Premium Operations Suite
            </span>
          </div>
        </section>

        <section
          className="relative p-8 md:p-12"
          style={{
            background: t.bgCard,
            backdropFilter: 'blur(22px)',
            WebkitBackdropFilter: 'blur(22px)',
          }}
        >
          <h2 className="font-display text-2xl font-semibold" style={{ color: t.text }}>
            Welcome back
          </h2>
          <p className="mt-1 text-sm" style={{ color: t.textSecondary }}>
            Sign in to continue to your ERP workspace.
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            <label className="block">
              <span className="mb-1 block text-[11px] font-semibold uppercase tracking-widest" style={{ color: t.textSecondary }}>
                Work Email
              </span>
              <div
                className="input-surface flex items-center gap-2 !py-0 pl-3 pr-3"
                style={{ borderColor: t.border, backgroundColor: t.inputBg }}
              >
                <Mail size={15} style={{ color: t.textSecondary }} />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full border-0 bg-transparent py-3 text-sm outline-none"
                  style={{ color: t.text }}
                  placeholder="you@company.com"
                />
              </div>
            </label>

            <label className="block">
              <span className="mb-1 block text-[11px] font-semibold uppercase tracking-widest" style={{ color: t.textSecondary }}>
                Password
              </span>
              <div
                className="input-surface flex items-center gap-2 !py-0 pl-3 pr-3"
                style={{ borderColor: t.border, backgroundColor: t.inputBg }}
              >
                <Lock size={15} style={{ color: t.textSecondary }} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full border-0 bg-transparent py-3 text-sm outline-none"
                  style={{ color: t.text }}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="text-muted"
                  style={{ color: t.textSecondary }}
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </label>

            <button
              type="submit"
              disabled={submitting}
              className="btn-primary mt-2 w-full rounded-xl py-3 text-sm transition-transform duration-300 hover:scale-[1.01]"
              style={{
                background: accentGrad,
                opacity: submitting ? 0.72 : 1,
                boxShadow: `0 10px 28px ${t.accentMuted}, 0 0 24px ${t.glow}`,
              }}
            >
              {submitting ? 'Signing In...' : 'Sign In'}
            </button>
            {error ? (
              <p className="text-xs font-medium" style={{ color: t.red }}>
                {error}
              </p>
            ) : null}
          </form>
        </section>
      </div>
    </div>
  );
}

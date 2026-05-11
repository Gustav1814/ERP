import { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { Menu, X } from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Building2,
  CheckCircle2,
  ChevronRight,
  Clock,
  FileCheck,
  RefreshCw,
  Shield,
  Zap,
} from 'lucide-react';

import Sidebar from './components/Sidebar';
import TopBar from './components/TopBar';
import {
  getTheme,
  themeToCssVars,
  THEME_ACCENT_KEY,
  DEFAULT_ACCENT_ID,
  normalizeAccentId,
} from './theme';
import { navItems } from './data/chartData';
import CompaniesPage from './pages/CompaniesPage';
import OrdersPage from './pages/OrdersPage';
import HandoffTokensPage from './pages/HandoffTokensPage';
import IdempotencyPage from './pages/IdempotencyPage';
import PushStatusPage from './pages/PushStatusPage';
import FieldMappingPage from './pages/FieldMappingPage';
import SettingsPage from './pages/SettingsPage';
import LoginPage from './pages/LoginPage';
import UserManagementPage from './pages/UserManagementPage';
import ActivityLogsPage from './pages/ActivityLogsPage';
import ChangePasswordPage from './pages/ChangePasswordPage';
import { fetchJson, fetchWithFallback } from './lib/api';
import { CompaniesSyncProvider, useCompaniesSync } from './context/CompaniesSyncContext';
import { CrmSharedDataProvider } from './context/CrmSharedDataContext';

const AUTH_FLAG_KEY = 'erp_auth_flag';
const AUTH_EMAIL_KEY = 'erp_auth_email';
const AUTH_TOKEN_KEY = 'erp_auth_token';
const AUTH_ME_KEY = 'erp_auth_me';
const THEME_KEY = 'erp_theme_mode';
const DEFAULT_NAV = 'dashboard';
const LOGIN_ROUTE = 'login';
const CHANGE_PASSWORD_ROUTE = 'change-password';
const CRM_OPTIONAL_MODE = String(import.meta.env.VITE_ERP_CRM_OPTIONAL ?? 'true').toLowerCase() === 'true';

/** Session backup when `window.location.hash` is empty after reload (some hosts strip it briefly). */
const ERP_LAST_HASH_KEY = 'erp_last_app_hash';

function normalizeStoredHash(raw) {
  if (raw == null || raw === '' || raw === '#' || raw === '#/') return null;
  const s = String(raw).trim();
  if (s.startsWith('#')) return s;
  return `#/${s.replace(/^\//, '')}`;
}

function getHashRoute() {
  if (typeof window === 'undefined') return '';
  const normalized = window.location.hash.replace(/^#\/?/, '').trim().toLowerCase();
  return normalized;
}

function getActiveNavFromHash() {
  const route = getHashRoute();
  if (!route || route === LOGIN_ROUTE || route === CHANGE_PASSWORD_ROUTE) return DEFAULT_NAV;
  const section = route.split('/')[0];
  const validRoutes = new Set([
    'dashboard',
    'companies',
    'orders',
    'users',
    'activity',
    'tokens',
    'idempotency',
    'push',
    'mapping',
    'settings',
  ]);
  return validRoutes.has(section) ? section : DEFAULT_NAV;
}

function navigateToRoute(route) {
  if (typeof window === 'undefined') return;
  const next = route.startsWith('#') ? route : `#/${route}`;
  if (window.location.hash !== next) {
    window.location.hash = next;
  }
}

function ChartTooltip({ active, payload, label, t }) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div
      className="rounded-xl border px-3 py-2 shadow-lg"
      style={{ backgroundColor: t.bgCard, borderColor: t.border, backdropFilter: 'blur(12px)' }}
    >
      {label && (
        <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider" style={{ color: t.textSecondary }}>
          {label}
        </div>
      )}
      {payload.map((entry) => (
        <div key={entry.dataKey} className="flex items-center gap-2 text-xs">
          <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="capitalize" style={{ color: t.textSecondary }}>{entry.dataKey}:</span>
          <span className="font-semibold" style={{ color: t.text }}>{entry.value}</span>
        </div>
      ))}
    </div>
  );
}

function GlassPanel({ children, className = '', style = {}, animate = false, delay = 0 }) {
  return (
    <div
      className={`glass-card rounded-2xl p-6 ${animate ? 'glass-panel-animated' : ''} ${className}`}
      style={{
        ...(animate ? { animation: `float-gentle ${6.5 + delay}s ease-in-out infinite`, animationDelay: `${-delay * 1.5}s` } : {}),
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function KpiCard({ card, t, darkMode, index }) {
  const positive = card.delta >= 0;
  const gradientId = `kpi-gradient-${index}`;
  return (
    <div
      className="glass-card kpi-float-animated group relative overflow-hidden rounded-2xl p-5 transition-all duration-300 ease-out motion-safe:hover:scale-[1.02] motion-safe:hover:-translate-y-0.5"
      style={{
        animation: `float-gentle ${6 + index * 0.7}s ease-in-out infinite`,
        animationDelay: `${index * -1.2}s`,
      }}
    >
      <div
        className="absolute -right-10 -top-10 h-28 w-28 rounded-full opacity-[0.07] blur-2xl transition-opacity duration-500 group-hover:opacity-[0.14]"
        style={{ backgroundColor: card.color || t.accent }}
      />
      <div className="relative">
        <div className="flex items-center gap-2">
          {card.icon && (
            <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ backgroundColor: `${card.color || t.accent}15` }}>
              <card.icon size={16} style={{ color: card.color || t.accent }} />
            </div>
          )}
          <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: t.textSecondary }}>
            {card.label}
          </span>
        </div>
        <div className="mt-3 flex items-end justify-between">
          <span className="hero-number" style={{ color: t.text }}>
            {typeof card.value === 'number' ? card.value.toLocaleString() : card.value}
          </span>
          {card.delta !== undefined && card.delta !== 0 && (
            <div
              className="flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[10px] font-bold"
              style={{
                backgroundColor: positive ? `${t.green}15` : `${t.red}15`,
                color: positive ? t.green : t.red,
              }}
            >
              {positive ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
              {Math.abs(card.delta).toFixed(1)}%
            </div>
          )}
        </div>
        <div className="mt-3 h-10">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={card.points}>
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={card.color || t.accent} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={card.color || t.accent} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <Area dataKey="y" type="monotone" stroke={card.color || t.accent} strokeWidth={1.5} fill={`url(#${gradientId})`} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

function IndustryTypesCard({ t, items }) {
  const safeItems = Array.isArray(items) && items.length ? items : [{ name: 'Unassigned', value: 0, color: t.border }];
  const total = safeItems.reduce((sum, d) => sum + (Number(d.value) || 0), 0);

  return (
    <div className="glass-card animate-order-float rounded-2xl p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="mb-1 text-sm font-semibold" style={{ color: t.text }}>Industry types</h3>
          <p className="text-xs" style={{ color: t.textSecondary }}>Companies by industry</p>
        </div>
        <div className="text-xs font-semibold tabular-nums" style={{ color: t.textSecondary }}>
          Total {total}
        </div>
      </div>
      <div className="flex items-center justify-center">
        <div className="relative h-44 w-44">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={safeItems}
                cx="50%"
                cy="50%"
                innerRadius={52}
                outerRadius={76}
                paddingAngle={2}
                startAngle={90}
                endAngle={-270}
                dataKey="value"
                stroke={t.bgCard}
                strokeWidth={3}
              >
                {safeItems.map((entry) => (
                  <Cell key={entry.name} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0].payload;
                  return (
                    <div
                      className="rounded-xl border px-3 py-2 shadow-lg"
                      style={{ backgroundColor: t.bgCard, borderColor: t.border }}
                    >
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: d.color }} />
                        <span className="text-xs font-medium" style={{ color: t.text }}>
                          {d.name}: {d.value}
                        </span>
                      </div>
                    </div>
                  );
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-3xl font-extrabold" style={{ color: t.text }}>{total}</span>
            <span className="text-[10px] uppercase tracking-wider" style={{ color: t.textSecondary }}>Companies</span>
          </div>
        </div>
      </div>
      <div className="mt-4 space-y-3">
        {safeItems.map((item) => (
          <div key={item.name} className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
                <span style={{ color: t.text }}>{item.name}</span>
              </div>
              <span className="font-semibold tabular-nums" style={{ color: t.textSecondary }}>
                {item.value}{total > 0 ? ` (${Math.round((item.value / total) * 100)}%)` : ''}
              </span>
            </div>
            <div className="h-1.5 rounded-full" style={{ backgroundColor: `${t.border}` }}>
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${(item.value / total) * 100}%`, backgroundColor: item.color }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatusBadge({ status, t }) {
  const styles = {
    committed: { bg: `${t.green}20`, color: t.green, label: 'Committed' },
    validating: { bg: `${t.accent}20`, color: t.accent, label: 'Validating' },
    pending: { bg: `${t.amber}20`, color: t.amber, label: 'Pending' },
    healthy: { bg: `${t.green}20`, color: t.green, label: 'Healthy' },
  };
  const s = styles[status] || styles.pending;
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider"
      style={{ backgroundColor: s.bg, color: s.color, boxShadow: `0 2px 6px ${s.color}25` }}
    >
      <span
        className="inline-block h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: s.color, boxShadow: `0 0 4px ${s.color}` }}
      />
      {s.label}
    </span>
  );
}

export default function App() {
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem(THEME_KEY) === 'dark';
  });
  const [activeNav, setActiveNav] = useState(() => getActiveNavFromHash());
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem(AUTH_FLAG_KEY) === '1' && !!window.localStorage.getItem(AUTH_TOKEN_KEY);
  });
  const [userEmail, setUserEmail] = useState(() => {
    if (typeof window === 'undefined') return '';
    return window.localStorage.getItem(AUTH_EMAIL_KEY) ?? '';
  });
  const [authMe, setAuthMe] = useState(() => {
    if (typeof window === 'undefined') return null;
    try {
      const raw = window.localStorage.getItem(AUTH_ME_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });
  const [accentId, setAccentIdState] = useState(() => {
    if (typeof window === 'undefined') return DEFAULT_ACCENT_ID;
    return normalizeAccentId(window.localStorage.getItem(THEME_ACCENT_KEY));
  });
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const setAccentId = (next) => {
    const id = normalizeAccentId(next);
    setAccentIdState(id);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(THEME_ACCENT_KEY, id);
    }
  };
  const t = useMemo(() => getTheme(darkMode, accentId), [darkMode, accentId]);
  const cssVars = themeToCssVars(t, darkMode);

  useEffect(() => {
    const onHashChange = () => {
      const route = getHashRoute();
      if (route === LOGIN_ROUTE) {
        setActiveNav(DEFAULT_NAV);
        return;
      }
      setActiveNav(getActiveNavFromHash());
    };

    window.addEventListener('hashchange', onHashChange);
    onHashChange();
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return undefined;
    const persistHash = () => {
      const route = getHashRoute();
      if (!route || route === LOGIN_ROUTE) return;
      const h = window.location.hash;
      if (h && h.length > 1) {
        sessionStorage.setItem(ERP_LAST_HASH_KEY, h);
      }
    };
    persistHash();
    window.addEventListener('hashchange', persistHash);
    return () => window.removeEventListener('hashchange', persistHash);
  }, [isAuthenticated]);

  // Listen for mobile sidebar close event
  useEffect(() => {
    const handleCloseSidebar = () => setMobileSidebarOpen(false);
    window.addEventListener('closeMobileSidebar', handleCloseSidebar);
    return () => window.removeEventListener('closeMobileSidebar', handleCloseSidebar);
  }, []);

  useLayoutEffect(() => {
    if (!isAuthenticated) {
      navigateToRoute(LOGIN_ROUTE);
      return;
    }
    const route = getHashRoute();
    if (!route) {
      const restored = normalizeStoredHash(sessionStorage.getItem(ERP_LAST_HASH_KEY));
      if (restored) {
        window.location.hash = restored;
        return;
      }
      navigateToRoute(DEFAULT_NAV);
      return;
    }
    if (route === LOGIN_ROUTE) {
      navigateToRoute(DEFAULT_NAV);
      return;
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;
    const hydrate = async () => {
      try {
        const json = await fetchJson('/api/v1/auth/me');
        const data = json?.data ?? null;
        setAuthMe(data);
        if (typeof window !== 'undefined') window.localStorage.setItem(AUTH_ME_KEY, JSON.stringify(data ?? null));
        if (data?.must_change_password) {
          navigateToRoute(CHANGE_PASSWORD_ROUTE);
        }
      } catch {
        // Token invalid or expired.
        if (typeof window !== 'undefined') {
          window.localStorage.removeItem(AUTH_FLAG_KEY);
          window.localStorage.removeItem(AUTH_EMAIL_KEY);
          window.localStorage.removeItem(AUTH_TOKEN_KEY);
          window.localStorage.removeItem(AUTH_ME_KEY);
        }
        setIsAuthenticated(false);
        setUserEmail('');
        setAuthMe(null);
      }
    };
    void hydrate();
  }, [isAuthenticated]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(THEME_KEY, darkMode ? 'dark' : 'light');
    
    // Apply theme variables globally so that portals (like modals) receive them
    document.documentElement.setAttribute('data-erp-theme', darkMode ? 'dark' : 'light');
    Object.entries(cssVars).forEach(([key, value]) => {
      document.documentElement.style.setProperty(key, value);
    });
    document.body.style.backgroundColor = t.bg;
  }, [darkMode, cssVars, t.bg]);

  const handleNavChange = (nextNav) => {
    setActiveNav(nextNav);
    navigateToRoute(nextNav);
  };

  const handleLogin = async (email, password) => {
    const response = await fetchWithFallback('/api/v1/auth/admin/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      return payload?.message || 'Invalid admin credentials.';
    }

    const token = String(payload?.token ?? '').trim();
    const accountEmail = String(payload?.email ?? email).trim().toLowerCase();
    if (!token) {
      return 'Login failed. Missing auth token.';
    }

    if (typeof window !== 'undefined') {
      window.localStorage.setItem(AUTH_FLAG_KEY, '1');
      window.localStorage.setItem(AUTH_EMAIL_KEY, accountEmail);
      window.localStorage.setItem(AUTH_TOKEN_KEY, token);
    }
    setUserEmail(accountEmail);
    setIsAuthenticated(true);
    const meData = {
      id: typeof payload?.id === 'number' ? payload.id : undefined,
      name: String(payload?.name ?? ''),
      email: accountEmail,
      roles: Array.isArray(payload?.roles) ? payload.roles : [],
      permissions: Array.isArray(payload?.permissions) ? payload.permissions : [],
      must_change_password: !!payload?.must_change_password,
    };
    setAuthMe(meData);
    if (typeof window !== 'undefined') window.localStorage.setItem(AUTH_ME_KEY, JSON.stringify(meData));
    const nextNav = getActiveNavFromHash();
    setActiveNav(nextNav);
    navigateToRoute(meData.must_change_password ? CHANGE_PASSWORD_ROUTE : nextNav);
    return null;
  };

  const handleLogout = () => {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(AUTH_FLAG_KEY);
      window.localStorage.removeItem(AUTH_EMAIL_KEY);
      window.localStorage.removeItem(AUTH_TOKEN_KEY);
      window.localStorage.removeItem(AUTH_ME_KEY);
      sessionStorage.removeItem(ERP_LAST_HASH_KEY);
    }
    setIsAuthenticated(false);
    setUserEmail('');
    setAuthMe(null);
    navigateToRoute(LOGIN_ROUTE);
  };

  const visibleNavItems = useMemo(
    () =>
      navItems.filter((i) => {
        if (Array.isArray(i.requireAnyPermission) && i.requireAnyPermission.length > 0) {
          const perms = authMe?.permissions ?? [];
          return i.requireAnyPermission.some((p) => perms.includes(p));
        }
        return true;
      }),
    [authMe?.permissions],
  );

  useEffect(() => {
    const handler = () => {
      try {
        const raw = window.localStorage.getItem(AUTH_ME_KEY);
        setAuthMe(raw ? JSON.parse(raw) : null);
      } catch {
        setAuthMe(null);
      }
    };
    window.addEventListener('erp-auth-refresh', handler);
    return () => window.removeEventListener('erp-auth-refresh', handler);
  }, []);

  const renderPage = () => {
    switch (activeNav) {
      case 'companies':
        return <CompaniesPage />;
      case 'orders':
        return <OrdersPage />;
      case 'users':
        return <UserManagementPage />;
      case 'activity':
        return <ActivityLogsPage />;
      case 'tokens':
        return <HandoffTokensPage />;
      case 'idempotency':
        return <IdempotencyPage />;
      case 'push':
        return <PushStatusPage />;
      case 'mapping':
        return <FieldMappingPage />;
      case 'settings':
        return <SettingsPage accentId={accentId} onAccentChange={setAccentId} />;
      default:
        return <DashboardPage t={t} darkMode={darkMode} />;
    }
  };

  return (
    !isAuthenticated ? (
      <LoginPage darkMode={darkMode} accentId={accentId} onLogin={handleLogin} />
    ) : (
    <CompaniesSyncProvider enabled>
    <CrmSharedDataProvider enabled>
    <div
      className="relative flex h-screen w-screen overflow-hidden"
      data-erp-theme={darkMode ? 'dark' : 'light'}
      style={{ ...cssVars, backgroundColor: t.bg }}
    >
      {/* Ambient depth gradient overlay */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: darkMode
            ? [
                `radial-gradient(ellipse 1200px 900px at 18% 8%, ${t.meshAccent}, transparent 58%)`,
                `radial-gradient(ellipse 880px 640px at 82% 78%, ${t.meshSecondary}, transparent 56%)`,
                `radial-gradient(ellipse 560px 440px at 48% 40%, color-mix(in srgb, ${t.chartA} 5%, transparent), transparent 52%)`,
              ].join(', ')
            : [
                `radial-gradient(ellipse 1100px 820px at 62% -8%, color-mix(in srgb, ${t.accent} 18%, transparent), transparent 52%)`,
                `radial-gradient(ellipse 900px 640px at 10% 90%, color-mix(in srgb, ${t.accent} 10%, transparent), transparent 56%)`,
                `radial-gradient(ellipse 720px 520px at 92% 18%, color-mix(in srgb, ${t.accent} 7%, transparent), transparent 50%)`,
              ].join(', '),
        }}
      />
      {/* Desktop Sidebar - hidden on mobile */}
      <div className="hidden lg:block">
        <Sidebar navItems={visibleNavItems} activeNav={activeNav} setActiveNav={handleNavChange} t={t} />
      </div>

      {/* Mobile Sidebar Overlay */}
      {mobileSidebarOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
            onClick={() => setMobileSidebarOpen(false)}
          />
          <div className="fixed left-0 top-0 z-50 h-full lg:hidden">
            <Sidebar
              navItems={visibleNavItems}
              activeNav={activeNav}
              setActiveNav={(id) => {
                handleNavChange(id);
                setMobileSidebarOpen(false);
              }}
              t={t}
            />
          </div>
        </>
      )}

      <main className="relative z-10 flex flex-1 flex-col overflow-auto min-w-0">
        {/* Mobile Header with menu toggle */}
        <div className="flex items-center justify-between gap-4 px-4 py-3 lg:px-6 lg:hidden">
          <button
            type="button"
            onClick={() => setMobileSidebarOpen(true)}
            className="flex h-9 w-9 items-center justify-center rounded-xl border transition-all"
            style={{
              borderColor: t.glassBorder,
              color: t.textSecondary,
              background: t.inputBg,
            }}
          >
            <Menu size={18} />
          </button>
          <div className="flex items-center gap-2">
            <div
              className="flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold"
              style={{
                background: `linear-gradient(135deg, ${t.avatarGradientA}, ${t.avatarGradientB})`,
                color: '#fff',
              }}
            >
              {userEmail?.split('@')[0]?.slice(0, 2).toUpperCase() || 'HB'}
            </div>
          </div>
        </div>

        {/* Desktop TopBar */}
        <div className="hidden lg:block px-6">
          <TopBar darkMode={darkMode} setDarkMode={setDarkMode} t={t} userEmail={userEmail} onLogout={handleLogout} />
        </div>

        <div className="flex-1 overflow-auto px-4 pb-4 lg:px-6 lg:pb-6">
          {getHashRoute() === CHANGE_PASSWORD_ROUTE && authMe?.must_change_password ? (
            <ChangePasswordPage
              onDone={async () => {
                try {
                  const json = await fetchJson('/api/v1/auth/me');
                  const data = json?.data ?? null;
                  setAuthMe(data);
                  if (typeof window !== 'undefined') window.localStorage.setItem(AUTH_ME_KEY, JSON.stringify(data ?? null));
                } finally {
                  navigateToRoute(DEFAULT_NAV);
                }
              }}
            />
          ) : (
            renderPage()
          )}
        </div>
      </main>
    </div>
    </CrmSharedDataProvider>
    </CompaniesSyncProvider>
    )
  );
}

function DashboardPage({ t, darkMode }) {
  const { companies, companiesLoaded, refreshCompanies } = useCompaniesSync();
  const [pendingIntakes, setPendingIntakes] = useState([]);
  const [intakeLoading, setIntakeLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const loadIntake = async () => {
    try {
      const intakeRes = CRM_OPTIONAL_MODE
        ? await fetchJson('/api/v1/crm/intake/pending').catch(() => ({ data: [] }))
        : await fetchJson('/api/v1/crm/intake/pending');
      const pendingData = Array.isArray(intakeRes?.data)
        ? intakeRes.data
        : Array.isArray(intakeRes?.items)
          ? intakeRes.items
          : [];
      setPendingIntakes(pendingData);
      setLoadError('');
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Unable to load intake queue.');
      setPendingIntakes([]);
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setIntakeLoading(true);
      try {
        await loadIntake();
      } finally {
        if (!cancelled) setIntakeLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const loading = !companiesLoaded || intakeLoading;

  const loadDashboard = async () => {
    setLoadError('');
    setIntakeLoading(true);
    try {
      await refreshCompanies({ silent: false });
      await loadIntake();
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Unable to load dashboard.');
      setPendingIntakes([]);
    } finally {
      setIntakeLoading(false);
    }
  };

  const dashboardData = useMemo(() => {
    const orders = companies.flatMap((company) =>
      (Array.isArray(company?.orders) ? company.orders : []).map((order) => ({
        ...order,
        company_id: order?.company_id ?? company?.id ?? null,
        company_name: company?.name ?? 'Unknown company',
        company_customer_type: company?.customer_type ?? '',
      })),
    );

    const inProgress = orders.filter((order) => String(order?.status ?? '') === 'in_progress').length;
    const completed = orders.filter((order) => String(order?.status ?? '') === 'completed').length;
    const newCompanies = companies.filter((company) => company?.is_new === true || company?.is_new === 1).length;
    const now = Date.now();
    const newFromCrm24h = orders.filter((order) => {
      const source = String(order?.source_system ?? '').toLowerCase();
      if (!source.includes('crm')) return false;
      const createdMs = new Date(String(order?.created_at ?? '')).getTime();
      if (!Number.isFinite(createdMs)) return false;
      return now - createdMs <= 24 * 60 * 60 * 1000;
    }).length;

    const last7Days = Array.from({ length: 7 }, (_, idx) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - idx));
      const key = d.toISOString().slice(0, 10);
      const day = d.toLocaleDateString('en-US', { weekday: 'short' });
      return { key, day, crm: 0, validated: 0, committed: 0 };
    });

    const dayIndex = new Map(last7Days.map((item, idx) => [item.key, idx]));
    orders.forEach((order) => {
      const createdAt = String(order?.created_at ?? '');
      const key = createdAt.slice(0, 10);
      const idx = dayIndex.get(key);
      if (idx == null) return;
      last7Days[idx].crm += 1;
      last7Days[idx].validated += 1;
      last7Days[idx].committed += 1;
    });

    const recentOrders = [...orders]
      .sort((a, b) => new Date(String(b?.created_at ?? '')).getTime() - new Date(String(a?.created_at ?? '')).getTime())
      .slice(0, 5)
      .map((order) => ({
        id: order?.source_order_id || `ERP-${order?.id ?? ''}`,
        orderId: order?.id ?? null,
        companyId: order?.company_id ?? null,
        company: order?.company_name ?? 'Unknown company',
        industryType: String((order?.company_customer_type ?? order?.customer_type ?? '') || ''),
        time: relativeTimeFromIso(String(order?.created_at ?? '')),
      }));

    const industryCounts = new Map();
    for (const c of companies) {
      const raw = String(c?.customer_type ?? '').trim();
      const label = raw ? raw : 'Unassigned';
      industryCounts.set(label, (industryCounts.get(label) ?? 0) + 1);
    }
    const palette = [t.chartA, t.chartB, t.chartC, t.chartD, t.accent, t.green, t.amber];
    const sortedIndustries = [...industryCounts.entries()].sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value }));
    const top = sortedIndustries.slice(0, 6);
    const rest = sortedIndustries.slice(6);
    const otherValue = rest.reduce((sum, i) => sum + i.value, 0);
    const industryData = [...top, ...(otherValue > 0 ? [{ name: 'Other', value: otherValue }] : [])].map((i, idx) => ({
      ...i,
      color: palette[idx % palette.length],
    }));

    const kpiCardsLive = [
      {
        label: 'Companies',
        value: companies.length,
        delta: 0,
        icon: Building2,
        color: t.chartA,
        points: last7Days.map((d) => ({ y: d.committed })),
      },
      {
        label: 'Orders',
        value: orders.length,
        delta: 0,
        icon: FileCheck,
        color: t.chartB,
        points: last7Days.map((d) => ({ y: d.committed })),
      },
      {
        label: 'Completed',
        value: completed,
        delta: 0,
        icon: CheckCircle2,
        color: t.green,
        points: last7Days.map((d) => ({ y: d.committed })),
      },
      {
        label: 'New (24h)',
        value: newFromCrm24h,
        delta: 0,
        icon: Clock,
        color: t.amber,
        points: last7Days.map((d) => ({ y: d.crm })),
      },
    ];

    return {
      orders,
      inProgress,
      completed,
      newCompanies,
      newFromCrm24h,
      importFlowData: last7Days.map(({ day, crm, validated, committed }) => ({ day, crm, validated, committed })),
      recentOrders,
      industryData,
      kpiCardsLive,
    };
  }, [companies, pendingIntakes, t.amber, t.green, t.chartA, t.chartB, t.chartC, t.chartD]);

  const latestImport = dashboardData.importFlowData[dashboardData.importFlowData.length - 1] ?? { committed: 0 };
  const previousImport = dashboardData.importFlowData[dashboardData.importFlowData.length - 2] ?? { committed: 0 };
  const importDelta = latestImport.committed - previousImport.committed;

  return (
    <>
      {/* ── Page Header ── */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-extrabold tracking-tight" style={{ color: t.text }}>
            Dashboard
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-medium" style={{ color: t.textSecondary }}>
            {loading ? 'Loading…' : `Updated ${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`}
          </span>
          <button type="button" onClick={() => void loadDashboard()} className="btn-secondary flex items-center gap-1.5 px-3 py-2 text-xs">
            <RefreshCw size={13} /> Refresh
          </button>
        </div>
      </div>

      {loadError && (
        <div className="mb-4 rounded-xl border px-4 py-3 text-sm" style={{ borderColor: `${t.red}30`, color: t.red, backgroundColor: `${t.red}08` }}>
          {loadError}
        </div>
      )}

      {/* ── KPI Cards ── */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {dashboardData.kpiCardsLive.map((card, i) => (
          <KpiCard key={card.label} card={card} t={t} darkMode={darkMode} index={i} />
        ))}
      </div>

      {/* ── Charts Row ── */}
      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Bar Chart */}
        <GlassPanel className="lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-[13px] font-bold" style={{ color: t.text }}>Order Pipeline</h3>
              <p className="text-[11px]" style={{ color: t.textSecondary }}>Weekly intake flow</p>
            </div>
            <div className="flex items-center gap-3">
              {[
                { label: 'Received', color: t.chartA },
                { label: 'Validated', color: t.chartB },
                { label: 'Committed', color: t.chartC },
              ].map((l) => (
                <div key={l.label} className="flex items-center gap-1">
                  <span className="inline-block h-2 w-2 rounded-sm" style={{ backgroundColor: l.color }} />
                  <span className="text-[10px] font-medium" style={{ color: t.textSecondary }}>{l.label}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dashboardData.importFlowData} barGap={3}>
                <defs>
                  <linearGradient id="crmGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={t.chartA} stopOpacity={0.9} />
                    <stop offset="100%" stopColor={t.chartA} stopOpacity={0.45} />
                  </linearGradient>
                  <linearGradient id="valGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={t.chartB} stopOpacity={0.9} />
                    <stop offset="100%" stopColor={t.chartB} stopOpacity={0.45} />
                  </linearGradient>
                  <linearGradient id="comGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={t.chartC} stopOpacity={0.9} />
                    <stop offset="100%" stopColor={t.chartC} stopOpacity={0.45} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} strokeDasharray="3 3" stroke={t.border} opacity={0.4} />
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: t.textSecondary }} />
                <YAxis hide />
                <Tooltip content={(props) => <ChartTooltip {...props} t={t} />} />
                <Bar dataKey="crm" fill="url(#crmGrad)" radius={[5, 5, 0, 0]} />
                <Bar dataKey="validated" fill="url(#valGrad)" radius={[5, 5, 0, 0]} />
                <Bar dataKey="committed" fill="url(#comGrad)" radius={[5, 5, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </GlassPanel>

        {/* Industry */}
        <IndustryTypesCard t={t} items={dashboardData.industryData} />
      </div>

      {/* ── Recent Orders ── */}
      <GlassPanel>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-[13px] font-bold" style={{ color: t.text }}>Recent Orders</h3>
          <button
            type="button"
            onClick={() => navigateToRoute('orders')}
            className="flex items-center gap-1 text-xs font-semibold hover:opacity-80"
            style={{ color: t.accent }}
          >
            View all <ArrowRight size={13} />
          </button>
        </div>
        <div className="table-elevated overflow-hidden rounded-xl">
          <table className="w-full text-xs">
            <thead>
              <tr className="table-head-row">
                <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider" style={{ color: t.textSecondary }}>Company</th>
                <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider" style={{ color: t.textSecondary }}>Order</th>
                <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider" style={{ color: t.textSecondary }}>Industry</th>
                <th className="px-4 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wider" style={{ color: t.textSecondary }}>Time</th>
              </tr>
            </thead>
            <tbody>
              {dashboardData.recentOrders.map((item) => (
                <tr key={item.id}>
                  <td className="px-4 py-2.5">
                    <button
                      type="button"
                      className="flex items-center gap-2 text-left hover:opacity-90"
                      onClick={() => item.companyId && navigateToRoute(`companies/${item.companyId}`)}
                    >
                      <div className="flex h-6 w-6 items-center justify-center rounded-md" style={{ backgroundColor: `${t.accent}10` }}>
                        <Building2 size={12} style={{ color: t.accent }} />
                      </div>
                      <span className="font-semibold" style={{ color: t.text }}>{item.company}</span>
                    </button>
                  </td>
                  <td className="px-4 py-2.5">
                    <button
                      type="button"
                      className="font-mono hover:underline"
                      style={{ color: t.textSecondary }}
                      onClick={() =>
                        item.companyId && item.orderId && navigateToRoute(`companies/${item.companyId}/order/${item.orderId}`)
                      }
                    >
                      {item.id}
                    </button>
                  </td>
                  <td className="px-4 py-2.5" style={{ color: t.textSecondary }}>
                    {item.industryType ? item.industryType : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-right" style={{ color: t.textSecondary }}>{item.time}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </GlassPanel>
    </>
  );
}

function formatMoneyCompact(value) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
    notation: 'compact',
  }).format(Number(value || 0));
}

function relativeTimeFromIso(iso) {
  const ts = new Date(iso).getTime();
  if (!Number.isFinite(ts)) return 'now';
  const diffMs = Date.now() - ts;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

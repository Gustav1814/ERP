import { LogOut, Moon, Sun } from 'lucide-react';

export default function TopBar({ darkMode, setDarkMode, t, userEmail, onLogout }) {
  return (
    <header className="flex items-center justify-between gap-4 py-4">
      {/* Spacer (search bar hidden — not in use) */}
      <div className="flex-1" />

      <div className="flex items-center gap-2">
        {/* Theme Toggle */}
        <button
          type="button"
          onClick={() => setDarkMode((v) => !v)}
          className="flex h-9 w-9 items-center justify-center rounded-xl border transition-all duration-200 hover:scale-105"
          style={{
            borderColor: t.glassBorder,
            color: t.textSecondary,
            background: t.inputBg,
            boxShadow: `inset 0 1px 0 ${t.cardShine}`,
            backdropFilter: 'blur(10px)',
          }}
          title={darkMode ? 'Light mode' : 'Dark mode'}
        >
          {darkMode ? <Sun size={16} /> : <Moon size={16} />}
        </button>


        {/* Profile */}
        <div
          className="flex items-center gap-2.5 rounded-xl border py-1.5 pl-1.5 pr-3 transition-shadow duration-300"
          style={{
            borderColor: t.glassBorder,
            background: `linear-gradient(120deg, color-mix(in srgb, ${t.inputBg} 75%, transparent), ${t.inputBg})`,
            boxShadow: `0 4px 16px ${t.cardShadow}, inset 0 1px 0 ${t.cardShine}`,
            backdropFilter: 'blur(12px)',
          }}
        >
          <div
            className="flex h-7 w-7 items-center justify-center rounded-lg text-[11px] font-bold"
            style={{
              background: `linear-gradient(135deg, ${t.avatarGradientA}, ${t.avatarGradientB})`,
              color: '#fff',
            }}
          >
            RA
          </div>
          <div className="hidden sm:block">
            <div className="text-[12px] font-semibold leading-tight" style={{ color: t.text }}>
              {userEmail?.split('@')[0] || 'Admin'}
            </div>
          </div>
          <button
            type="button"
            onClick={onLogout}
            className="ml-1 flex h-6 w-6 items-center justify-center rounded transition-colors"
            style={{ color: t.textSecondary }}
            title="Sign out"
          >
            <LogOut size={13} />
          </button>
        </div>
      </div>
    </header>
  );
}

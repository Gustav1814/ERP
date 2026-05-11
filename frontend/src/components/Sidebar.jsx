import { useState, useEffect } from 'react';
import {
  BarChart3, Building2, ChevronLeft, ChevronRight, GitMerge, Key,
  LayoutDashboard, ListOrdered, ScrollText, Settings, Shield, Users, Workflow, X,
} from 'lucide-react';

const iconMap = {
  dashboard: LayoutDashboard, companies: Building2, orders: ListOrdered,
  tokens: Key, idempotency: Shield, push: Workflow, mapping: GitMerge, settings: Settings,
  users: Users, activity: ScrollText,
};

export default function Sidebar({ navItems, activeNav, setActiveNav, t }) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className="relative flex h-full shrink-0 flex-col transition-all duration-300 ease-in-out"
      style={{
        width: collapsed ? '72px' : '240px',
        minWidth: collapsed ? '72px' : '240px',
        background: `linear-gradient(180deg, ${t.bgSidebar} 0%, color-mix(in srgb, ${t.bgSidebar} 96%, ${t.accent} 4%) 100%)`,
        borderRight: `1px solid ${t.glassBorder}`,
        boxShadow: `4px 0 24px ${t.cardShadow}`,
      }}
    >
      {/* Brand */}
      <div className={`px-4 py-6 ${collapsed ? 'flex justify-center' : 'flex items-center justify-between'}`}>
        <div className={`flex items-center ${collapsed ? 'justify-center' : 'gap-3'}`}>
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-extrabold"
            style={{
              background: `linear-gradient(135deg, ${t.avatarGradientA}, ${t.avatarGradientB})`,
              color: '#fff',
              boxShadow: `0 4px 12px ${t.glow}`,
            }}
          >
            HB
          </div>
          {!collapsed && (
            <div className="overflow-hidden transition-all duration-300">
              <div className="text-[14px] font-bold tracking-tight whitespace-nowrap" style={{ color: t.sidebarText }}>
                HB Group
              </div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.12em] whitespace-nowrap" style={{ color: t.sidebarMuted }}>
                Enterprise
              </div>
            </div>
          )}
        </div>
        {/* Mobile Close Button */}
        {!collapsed && (
          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent('closeMobileSidebar'))}
            className="flex h-8 w-8 items-center justify-center rounded-lg lg:hidden"
            style={{ color: t.sidebarMuted }}
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* Nav */}
      <div className="flex-1 overflow-auto px-2 pb-4">
        {!collapsed && (
          <div className="mb-2 px-3 text-[9px] font-bold uppercase tracking-[0.15em]" style={{ color: t.sidebarMuted }}>
            Menu
          </div>
        )}
        <nav className="space-y-0.5">
          {navItems.map((item) => {
            const Icon = iconMap[item.id] || BarChart3;
            const active = activeNav === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveNav(item.id)}
                title={collapsed ? item.label : undefined}
                className={`group flex w-full items-center rounded-xl text-left text-[13px] font-medium transition-all duration-200 ${
                  collapsed ? 'justify-center px-0 py-2.5' : 'gap-2.5 px-3 py-2'
                }`}
                style={{
                  color: active ? t.sidebarText : t.sidebarMuted,
                  backgroundColor: active ? t.bgSidebarActive : 'transparent',
                  boxShadow: active ? `inset 0 0 0 1px color-mix(in srgb, ${t.accent} 22%, transparent)` : undefined,
                }}
              >
                <div
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-all duration-200"
                  style={{ backgroundColor: active ? `${t.accent}20` : 'transparent' }}
                >
                  <Icon size={16} strokeWidth={active ? 2.2 : 1.75} />
                </div>
                {!collapsed && (
                  <>
                    <span className="flex-1 truncate">{item.label}</span>
                    {active && (
                      <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: t.accent }} />
                    )}
                  </>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Collapse toggle */}
      <button
        type="button"
        onClick={() => setCollapsed((v) => !v)}
        className="absolute -right-3 top-20 z-20 flex h-6 w-6 items-center justify-center rounded-full border transition-all duration-200 hover:scale-110"
        style={{
          backgroundColor: t.bgSidebar,
          borderColor: t.border,
          color: t.sidebarMuted,
          boxShadow: `0 2px 8px ${t.cardShadow}`,
        }}
        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
      </button>
    </aside>
  );
}

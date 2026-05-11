import { useEffect, useMemo, useState } from 'react';
import { Card, Empty, ModalFrame, PageHeader } from '../components/ui';
import { fetchJson, fetchWithFallback } from '../lib/api';

type AdminUser = {
  id: number;
  name: string;
  email: string;
  roles: string[];
  must_change_password: boolean;
  created_at: string | null;
};

type RolesIndex = {
  roles: { id: number; name: string; permissions: string[] }[];
  permissions: string[];
};

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ');
}

/** Never surface this role name in the UI (table, dropdowns, profile)—even for your own account. */
const HIDDEN_ROLE_LABEL = 'Super Admin';

function isHiddenUiRole(role: string | undefined): boolean {
  return role === HIDDEN_ROLE_LABEL;
}

/** Display label for a user's role in lists and modals (hidden roles show as em dash). */
function formatRoleForUi(role: string | undefined): string {
  if (!role || isHiddenUiRole(role)) return '—';
  return role;
}

const AUTH_ME_STORAGE_KEY = 'erp_auth_me';

async function refreshAuthMeInStorage() {
  const json = await fetchJson('/api/v1/auth/me');
  const d = (json as { data?: Record<string, unknown> })?.data;
  if (!d || typeof window === 'undefined') return;
  const merged = {
    id: d.id,
    name: d.name,
    email: d.email,
    roles: Array.isArray(d.roles) ? d.roles : [],
    permissions: Array.isArray(d.permissions) ? d.permissions : [],
    must_change_password: !!d.must_change_password,
  };
  window.localStorage.setItem(AUTH_ME_STORAGE_KEY, JSON.stringify(merged));
  window.dispatchEvent(new Event('erp-auth-refresh'));
}

function PremiumModalShell({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <ModalFrame onBackdropClick={onClose} panelClassName="max-w-xl p-0">
      <div className="border-b border-divider px-6 py-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="font-display text-xl font-semibold text-fg">{title}</h3>
            {subtitle ? <p className="mt-1 text-sm text-muted">{subtitle}</p> : null}
          </div>
          <button type="button" className="btn-secondary px-3 py-1.5 text-xs" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
      <div className="px-6 py-5">{children}</div>
    </ModalFrame>
  );
}

export default function UserManagementPage() {
  const [tab, setTab] = useState<'users' | 'roles'>('users');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [rolesIndex, setRolesIndex] = useState<RolesIndex>({ roles: [], permissions: [] });

  const [query, setQuery] = useState('');
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formRole, setFormRole] = useState('');
  const [formTempPassword, setFormTempPassword] = useState('');
  const [formResetPassword, setFormResetPassword] = useState(false);

  const [roleModalOpen, setRoleModalOpen] = useState(false);
  const [editingRoleId, setEditingRoleId] = useState<number | null>(null);
  const [roleName, setRoleName] = useState('');
  const [rolePermissions, setRolePermissions] = useState<string[]>([]);
  const [permSearch, setPermSearch] = useState('');

  const [sessionAccess, setSessionAccess] = useState<{
    id: number | null;
    permissions: string[];
    roles: string[];
  } | null>(null);

  const canManageUsers =
    sessionAccess != null &&
    (sessionAccess.roles.includes('Super Admin') || sessionAccess.permissions.includes('users.manage'));
  const canManageRoles =
    sessionAccess != null &&
    (sessionAccess.roles.includes('Super Admin') || sessionAccess.permissions.includes('roles.manage'));

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const meJson = await fetchJson('/api/v1/auth/me');
      const me = (meJson as { data?: { id?: number; permissions?: string[]; roles?: string[] } })?.data;
      const perms = Array.isArray(me?.permissions) ? me.permissions : [];
      const roles = Array.isArray(me?.roles) ? me.roles : [];
      const canU = roles.includes('Super Admin') || perms.includes('users.manage');
      const canR = roles.includes('Super Admin') || perms.includes('roles.manage');

      setSessionAccess({
        id: typeof me?.id === 'number' ? me.id : null,
        permissions: perms,
        roles,
      });

      if (!canU && canR) setTab('roles');
      else if (canU && !canR) setTab('users');

      const usersPromise = canU
        ? fetchJson(`/api/v1/admin/users?q=${encodeURIComponent(query.trim())}`)
        : Promise.resolve({ data: [] });
      const rolesPromise =
        canU || canR ? fetchJson('/api/v1/admin/roles') : Promise.resolve({ data: { roles: [], permissions: [] } });

      const [usersJson, rolesJson] = await Promise.all([usersPromise, rolesPromise]);
      setUsers(Array.isArray(usersJson?.data) ? usersJson.data : []);
      setRolesIndex(
        rolesJson?.data && Array.isArray(rolesJson.data.roles) && Array.isArray(rolesJson.data.permissions)
          ? rolesJson.data
          : { roles: [], permissions: [] },
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load user management.');
      setUsers([]);
      setRolesIndex({ roles: [], permissions: [] });
      setSessionAccess({ id: null, permissions: [], roles: [] });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const roleOptions = useMemo(() => rolesIndex.roles.map((r) => r.name), [rolesIndex.roles]);

  /** Super Admin is never assignable or listed in the UI (API/seed still manage it). */
  const assignableRoleOptions = useMemo(
    () => roleOptions.filter((r) => r !== HIDDEN_ROLE_LABEL),
    [roleOptions],
  );

  const visibleRolesForGrid = useMemo(
    () => rolesIndex.roles.filter((r) => r.name !== HIDDEN_ROLE_LABEL),
    [rolesIndex.roles],
  );

  const editingSelf =
    editingUser != null &&
    sessionAccess != null &&
    sessionAccess.id != null &&
    editingUser.id === sessionAccess.id;

  const openCreateUser = () => {
    setEditingUser(null);
    setFormName('');
    setFormEmail('');
    setFormRole(assignableRoleOptions[0] ?? roleOptions[0] ?? 'Staff');
    setFormTempPassword('');
    setFormResetPassword(false);
    setUserModalOpen(true);
  };

  const openEditUser = (u: AdminUser) => {
    setEditingUser(u);
    setFormName(u.name);
    setFormEmail(u.email);
    setFormRole(u.roles?.[0] ?? assignableRoleOptions[0] ?? roleOptions[0] ?? 'Staff');
    setFormTempPassword('');
    setFormResetPassword(false);
    setUserModalOpen(true);
  };

  const closeUserModal = () => {
    setUserModalOpen(false);
    setEditingUser(null);
    setFormName('');
    setFormEmail('');
    setFormRole('');
    setFormTempPassword('');
    setFormResetPassword(false);
  };

  const saveUser = async () => {
    setError('');
    const name = formName.trim();
    const email = formEmail.trim();
    const role = formRole.trim();
    const creating = !editingUser;

    if (!name || !email) return;
    if (creating) {
      if (!role || !formTempPassword.trim()) return;
    } else if (!editingSelf && !role) return;

    const patchBody = editingSelf
      ? {
          name,
          email,
          ...(formResetPassword ? { reset_password: true as const, password: formTempPassword } : {}),
        }
      : {
          name,
          email,
          role,
          reset_password: formResetPassword,
          password: formResetPassword ? formTempPassword : null,
        };

    const init: RequestInit = {
      method: creating ? 'POST' : 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(
        creating ? { name, email, password: formTempPassword, role } : patchBody,
      ),
    };

    const url = creating ? '/api/v1/admin/users' : `/api/v1/admin/users/${editingUser?.id}`;
    const res = await fetchWithFallback(url, init);
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(json?.message || 'Unable to save user.');
      return;
    }
    const editedId = editingUser?.id;
    const wasSelf =
      editedId != null && sessionAccess != null && sessionAccess.id != null && editedId === sessionAccess.id;
    closeUserModal();
    await load();
    if (wasSelf) {
      await refreshAuthMeInStorage();
    }
  };

  const openCreateRole = () => {
    setEditingRoleId(null);
    setRoleName('');
    setRolePermissions([]);
    setRoleModalOpen(true);
  };

  const openEditRole = (id: number) => {
    const r = rolesIndex.roles.find((x) => x.id === id);
    if (!r) return;
    if (sessionAccess?.roles?.includes(r.name)) return;
    setEditingRoleId(id);
    setRoleName(r.name ?? '');
    setRolePermissions(Array.isArray(r.permissions) ? r.permissions : []);
    setRoleModalOpen(true);
  };

  const closeRoleModal = () => {
    setRoleModalOpen(false);
    setEditingRoleId(null);
    setRoleName('');
    setRolePermissions([]);
    setPermSearch('');
  };

  const togglePerm = (p: string) => {
    setRolePermissions((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));
  };

  const saveRole = async () => {
    setError('');
    const name = roleName.trim();
    if (!name) return;
    const creating = editingRoleId == null;
    const res = await fetchWithFallback(creating ? '/api/v1/admin/roles' : `/api/v1/admin/roles/${editingRoleId}`, {
      method: creating ? 'POST' : 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, permissions: rolePermissions }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(json?.message || 'Unable to save role.');
      return;
    }
    closeRoleModal();
    await load();
    await refreshAuthMeInStorage();
  };

  if (!loading && sessionAccess != null && !canManageUsers && !canManageRoles) {
    return (
      <div className="space-y-6">
        <PageHeader title="User Management" description="Create users, assign roles, and control access across ERP." />
        <div className="rounded-xl border border-amber/30 bg-amber/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
          You do not have permission to manage users or roles. Ask an administrator to grant{' '}
          <span className="font-mono">users.manage</span> and/or <span className="font-mono">roles.manage</span>.
        </div>
      </div>
    );
  }

  const showUserTab = canManageUsers;
  const showRolesTab = canManageRoles;
  const showTabSwitch = showUserTab && showRolesTab;

  return (
    <div className="space-y-6">
      <PageHeader title="User Management" description="Create users, assign roles, and control access across ERP." />

      {error ? (
        <div className="rounded-xl border border-rose/30 bg-rose/10 px-4 py-3 text-sm text-rose">{error}</div>
      ) : null}

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-divider pb-3">
          <div className="inline-flex gap-1 rounded-full bg-subtle p-1">
            {showTabSwitch ? (
              <>
                <button
                  type="button"
                  onClick={() => setTab('users')}
                  disabled={!showUserTab}
                  className={cn(
                    'rounded-full px-3 py-1 text-xs font-semibold',
                    tab === 'users' ? 'bg-accent text-white shadow-sm' : 'text-muted hover:text-fg',
                  )}
                >
                  Users
                </button>
                <button
                  type="button"
                  onClick={() => setTab('roles')}
                  disabled={!showRolesTab}
                  className={cn(
                    'rounded-full px-3 py-1 text-xs font-semibold',
                    tab === 'roles' ? 'bg-accent text-white shadow-sm' : 'text-muted hover:text-fg',
                  )}
                >
                  Roles
                </button>
              </>
            ) : (
              <span className="rounded-full px-3 py-1 text-xs font-semibold text-fg">
                {showUserTab ? 'Users' : 'Roles'}
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={tab === 'users' ? 'Search users…' : 'Search…'}
              className="input-surface h-9 w-56 px-3 text-sm"
              disabled={tab === 'users' ? !canManageUsers : false}
            />
            <button type="button" className="btn-secondary h-9 px-3 text-xs" onClick={() => void load()} disabled={loading}>
              Refresh
            </button>
            {tab === 'users' && canManageUsers ? (
              <button type="button" className="btn-primary h-9 px-3 text-xs" onClick={openCreateUser}>
                New user
              </button>
            ) : null}
            {tab === 'roles' && canManageRoles ? (
              <button type="button" className="btn-primary h-9 px-3 text-xs" onClick={openCreateRole}>
                New role
              </button>
            ) : null}
          </div>
        </div>

        <div className="mt-4 space-y-2">
          {loading ? (
            <div className="text-sm text-muted">Loading…</div>
          ) : tab === 'users' && canManageUsers ? (
            users.filter((u) => !u.roles?.some((r) => isHiddenUiRole(r))).length ? (
              <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 sm:overflow-visible">
                <div className="min-w-[680px] sm:min-w-0 overflow-hidden rounded-2xl bg-white/80 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_8px_30px_rgba(0,0,0,0.04)] ring-1 ring-black/[0.04] backdrop-blur sm:w-full">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-black/[0.06]">
                        <th className="px-4 sm:px-5 py-3.5 text-left text-[10px] font-bold uppercase tracking-[0.18em] text-muted/70">Name</th>
                        <th className="px-4 sm:px-5 py-3.5 text-left text-[10px] font-bold uppercase tracking-[0.18em] text-muted/70">Email</th>
                        <th className="px-4 sm:px-5 py-3.5 text-left text-[10px] font-bold uppercase tracking-[0.18em] text-muted/70">Role</th>
                        <th className="px-4 sm:px-5 py-3.5 text-left text-[10px] font-bold uppercase tracking-[0.18em] text-muted/70">Status</th>
                        <th className="px-4 sm:px-5 py-3.5 text-right text-[10px] font-bold uppercase tracking-[0.18em] text-muted/70">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.filter((u) => !u.roles?.some((r) => isHiddenUiRole(r))).map((u, i) => (
                        <tr key={u.id} className={cn('group transition-colors duration-150 hover:bg-accent/[0.03]', i > 0 && 'border-t border-black/[0.04]')}>
                          <td className="px-4 sm:px-5 py-4">
                            <div className="flex items-center gap-3">
                              <div className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-full bg-gradient-to-br from-accent/20 to-accent/5 text-xs sm:text-sm font-bold text-accent shrink-0">
                                {u.name.trim().charAt(0).toUpperCase() || 'U'}
                              </div>
                              <div className="min-w-0">
                                <div className="font-semibold text-fg leading-snug truncate">{u.name}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 sm:px-5 py-4">
                            <span className="text-muted transition-colors group-hover:text-fg text-xs sm:text-sm truncate block max-w-[140px] sm:max-w-none">{u.email}</span>
                          </td>
                          <td className="px-4 sm:px-5 py-4">
                            <span className="inline-flex items-center gap-2 text-xs sm:text-sm font-medium text-fg">
                              <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                              {formatRoleForUi(u.roles?.[0])}
                            </span>
                          </td>
                          <td className="px-4 sm:px-5 py-4">
                            {u.must_change_password ? (
                              <span className="inline-flex items-center gap-2 text-xs sm:text-sm font-medium text-amber">
                                <span className="h-1.5 w-1.5 rounded-full bg-amber" />
                                <span className="hidden sm:inline">Pending Reset</span>
                                <span className="sm:hidden">Reset</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-2 text-xs sm:text-sm font-medium text-emerald">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald" />
                                Active
                              </span>
                            )}
                          </td>
                          <td className="px-4 sm:px-5 py-4 text-right">
                            {isHiddenUiRole(u.roles?.[0]) && sessionAccess && !sessionAccess.roles.includes(HIDDEN_ROLE_LABEL) ? (
                              <span className="text-xs text-muted" title="You cannot modify this account">
                                Locked
                              </span>
                            ) : (
                              <button type="button" className="rounded-lg px-3 py-1.5 text-xs font-semibold text-accent transition-all hover:bg-accent/[0.06]" onClick={() => openEditUser(u)}>
                                Edit
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <Empty label="No users found." />
            )
          ) : tab === 'roles' && canManageRoles ? (
            visibleRolesForGrid.length ? (
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              {visibleRolesForGrid.map((r) => (
                <div key={r.id} className="rounded-2xl border border-divider bg-subtle/30 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-display text-base font-semibold text-fg">{r.name}</div>
                      <div className="mt-1 text-xs text-muted">
                        {r.permissions.length} permission{r.permissions.length === 1 ? '' : 's'}
                      </div>
                    </div>
                    {sessionAccess?.roles?.includes(r.name) ? (
                      <span className="text-xs text-muted" title="You cannot edit permissions for a role assigned to your account">
                        Locked
                      </span>
                    ) : (
                      <button type="button" className="btn-secondary h-8 px-3 text-xs" onClick={() => openEditRole(r.id)}>
                        Edit
                      </button>
                    )}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {r.permissions.slice(0, 10).map((p) => (
                      <span key={p} className="rounded-full border border-divider bg-subtle px-2 py-1 text-[11px] font-semibold text-muted">
                        {p}
                      </span>
                    ))}
                    {r.permissions.length > 10 ? (
                      <span className="rounded-full border border-divider bg-subtle px-2 py-1 text-[11px] font-semibold text-muted">
                        +{r.permissions.length - 10} more
                      </span>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
            ) : (
              <Empty label="No roles found." />
            )
          ) : (
            <Empty label="Nothing to show." />
          )}
        </div>
      </Card>

      {userModalOpen ? (
        <PremiumModalShell
          title={editingUser ? 'Edit user' : 'Create user'}
          subtitle={
            editingUser
              ? editingSelf
                ? 'Update your profile. Role changes must be done by another administrator.'
                : 'Update details and access.'
              : 'Create an internal ERP user with a temporary password.'
          }
          onClose={closeUserModal}
        >
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="label-mono">Name</label>
                <input value={formName} onChange={(e) => setFormName(e.target.value)} className="input-surface mt-1 w-full" />
              </div>
              <div>
                <label className="label-mono">Role</label>
                {editingSelf ? (
                  <>
                    <div className="input-surface mt-1 flex min-h-10 items-center px-3 py-2 text-sm text-fg">
                      {formatRoleForUi(formRole)}
                    </div>
                    <p className="mt-2 text-xs text-muted">
                      You cannot change your own role. Ask another administrator.
                    </p>
                  </>
                ) : editingUser && isHiddenUiRole(editingUser.roles?.[0]) ? (
                  <>
                    <div className="input-surface mt-1 flex min-h-10 items-center px-3 py-2 text-sm text-muted">
                      {formatRoleForUi(formRole)}
                    </div>
                    <p className="mt-2 text-xs text-muted">This role is not displayed or assigned from this screen.</p>
                  </>
                ) : (
                  <select value={formRole} onChange={(e) => setFormRole(e.target.value)} className="input-surface mt-1 w-full">
                    {assignableRoleOptions.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>
            <div>
              <label className="label-mono">Email</label>
              {editingSelf ? (
                <>
                  <div className="input-surface mt-1 flex min-h-10 items-center px-3 py-2 text-sm text-fg">
                    {formEmail}
                  </div>
                  <p className="mt-2 text-xs text-muted">
                    You cannot change your own email. Ask another administrator.
                  </p>
                </>
              ) : (
                <input value={formEmail} onChange={(e) => setFormEmail(e.target.value)} className="input-surface mt-1 w-full" />
              )}
            </div>

            {editingUser ? (
              <div className="rounded-2xl border border-divider bg-subtle/30 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-fg">Reset password</div>
                    <div className="mt-1 text-xs text-muted">Set a temporary password and force a change on next login.</div>
                  </div>
                  <button
                    type="button"
                    className={cn(
                      'inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold transition-colors',
                      formResetPassword
                        ? 'border-accent/40 bg-accent/10 text-fg'
                        : 'border-divider bg-subtle text-muted hover:text-fg',
                    )}
                    onClick={() => setFormResetPassword((v) => !v)}
                  >
                    {formResetPassword ? 'Enabled' : 'Disabled'}
                  </button>
                </div>
                {formResetPassword ? (
                  <div className="mt-3">
                    <label className="label-mono">Temporary password</label>
                    <input
                      value={formTempPassword}
                      onChange={(e) => setFormTempPassword(e.target.value)}
                      placeholder="Minimum 8 characters"
                      className="input-surface mt-1 w-full"
                    />
                  </div>
                ) : null}
              </div>
            ) : (
              <div>
                <label className="label-mono">Temporary password</label>
                <input
                  value={formTempPassword}
                  onChange={(e) => setFormTempPassword(e.target.value)}
                  placeholder="Minimum 8 characters"
                  className="input-surface mt-1 w-full"
                />
                <p className="mt-2 text-xs text-muted">User will be required to change it on first login.</p>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <button type="button" className="btn-secondary px-4 py-2 text-sm" onClick={closeUserModal}>
                Cancel
              </button>
              <button type="button" className="btn-primary px-4 py-2 text-sm" onClick={() => void saveUser()}>
                {editingUser ? 'Save changes' : 'Create user'}
              </button>
            </div>
          </div>
        </PremiumModalShell>
      ) : null}

      {roleModalOpen ? (
        <PremiumModalShell
          title={editingRoleId == null ? 'Create role' : 'Edit role'}
          subtitle="Choose permissions for what this role can access in the ERP."
          onClose={closeRoleModal}
        >
          <div className="space-y-4">
            <div>
              <label className="label-mono">Role name</label>
              <input value={roleName} onChange={(e) => setRoleName(e.target.value)} className="input-surface mt-1 w-full" />
            </div>

            <div className="rounded-2xl border border-divider bg-subtle/30 p-4">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wider text-muted">Permissions</div>
                  <div className="mt-1 text-xs text-muted">
                    {rolePermissions.length} selected
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    value={permSearch}
                    onChange={(e) => setPermSearch(e.target.value)}
                    placeholder="Search permissions…"
                    className="input-surface h-9 w-56 px-3 text-sm"
                  />
                  <button
                    type="button"
                    className="btn-secondary h-9 px-3 text-xs"
                    onClick={() => setRolePermissions([])}
                  >
                    Clear
                  </button>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {rolesIndex.permissions
                  .filter((p) => p.toLowerCase().includes(permSearch.trim().toLowerCase()))
                  .map((p) => {
                    const checked = rolePermissions.includes(p);
                    return (
                      <label
                        key={p}
                        className={cn(
                          'flex cursor-pointer items-center justify-between gap-3 rounded-xl border px-3 py-2 transition-colors',
                          checked ? 'border-accent/35 bg-accent/10' : 'border-divider bg-subtle hover:bg-subtle/70',
                        )}
                      >
                        <div className="min-w-0">
                          <div className={cn('truncate text-sm font-semibold', checked ? 'text-fg' : 'text-fg')}>
                            {p}
                          </div>
                          <div className="truncate text-xs text-muted">Allow access to {p.replace('.', ' → ')}</div>
                        </div>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => togglePerm(p)}
                          className="h-4 w-4 accent-[var(--accent)]"
                        />
                      </label>
                    );
                  })}
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button type="button" className="btn-secondary px-4 py-2 text-sm" onClick={closeRoleModal}>
                Cancel
              </button>
              <button type="button" className="btn-primary px-4 py-2 text-sm" onClick={() => void saveRole()}>
                {editingRoleId == null ? 'Create role' : 'Save role'}
              </button>
            </div>
          </div>
        </PremiumModalShell>
      ) : null}
    </div>
  );
}


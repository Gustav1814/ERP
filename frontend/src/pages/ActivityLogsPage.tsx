import React, { useEffect, useMemo, useState } from 'react';
import { Card, Empty, ModalFrame, PageHeader } from '../components/ui';
import { fetchJson } from '../lib/api';
import { Eye, ChevronDown, ChevronUp } from 'lucide-react';

type Actor = { id: number; name: string; email: string };
type AdminUser = { id: number; name: string; email: string };

type ChangeSet = {
  field: string;
  old_value: string | null;
  new_value: string | null;
};

type RelatedActivity = {
  type: string;
  count: number;
  items: Array<{
    action: string;
    description: string;
    timestamp: string;
  }>;
};

type LogItem = {
  id: number;
  action: string;
  entity_type: string | null;
  entity_id: number | null;
  metadata: {
    changes?: ChangeSet[];
    description?: string;
    related_activities?: RelatedActivity[];
    [key: string]: any;
  };
  ip: string | null;
  user_agent: string | null;
  actor: Actor | null;
  created_at: string | null;
};

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ');
}

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' });
}

function fmtTime(iso: string | null) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return '—';
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function fmtDateTime(iso: string | null) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return '—';
  return d.toLocaleString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', second: '2-digit' });
}

function getActionTone(action: string): 'emerald' | 'cyan' | 'rose' | 'amber' | 'neutral' {
  const a = action.toLowerCase();
  if (a.includes('create') || a.includes('add')) return 'emerald';
  if (a.includes('update') || a.includes('edit') || a.includes('modify')) return 'cyan';
  if (a.includes('delete') || a.includes('remove')) return 'rose';
  if (a.includes('login') || a.includes('logout')) return 'amber';
  return 'neutral';
}

function getHumanReadableAction(action: string): string {
  const actionMap: Record<string, string> = {
    'users.create': 'User Created',
    'users.update': 'User Updated',
    'users.delete': 'User Deleted',
    'users.login': 'User Login',
    'users.logout': 'User Logout',
    'roles.create': 'Role Created',
    'roles.update': 'Role Updated',
    'roles.delete': 'Role Deleted',
    'companies.create': 'Company Created',
    'companies.update': 'Company Updated',
    'companies.delete': 'Company Deleted',
    'items.create': 'Item Created',
    'items.update': 'Item Updated',
    'items.delete': 'Item Deleted',
    'folders.create': 'Folder Created',
    'folders.update': 'Folder Updated',
    'folders.delete': 'Folder Deleted',
    'tags.create': 'Tag Created',
    'tags.update': 'Tag Updated',
    'tags.delete': 'Tag Deleted',
  };
  
  // Check exact match first
  if (actionMap[action]) return actionMap[action];
  
  // Try to parse action like "companies.update"
  const parts = action.split('.');
  if (parts.length === 2) {
    const [model, operation] = parts;
    const readableModel = model.charAt(0).toUpperCase() + model.slice(1);
    const readableOp = operation.charAt(0).toUpperCase() + operation.slice(1);
    return `${readableModel} ${readableOp}`;
  }
  
  // Fallback: just capitalize the action
  return action
    .split(/[._]/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function getHumanReadableModelName(entityType: string | null): string {
  if (!entityType) return '';
  
  // Map common Laravel model names to human-readable names
  const modelMap: Record<string, string> = {
    'App\\Models\\User': 'user',
    'App\\Models\\Company': 'company',
    'App\\Models\\Item': 'item',
    'App\\Models\\Folder': 'folder',
    'App\\Models\\Tag': 'tag',
    'App\\Models\\CustomField': 'custom field',
    'Spatie\\Permission\\Models\\Role': 'role',
    'Spatie\\Permission\\Models\\Permission': 'permission',
  };
  
  // Check exact match first
  if (modelMap[entityType]) return modelMap[entityType];
  
  // Try to extract class name from full namespace
  const parts = entityType.split('\\');
  const className = parts[parts.length - 1];
  
  // Convert PascalCase to readable format
  return className
    .replace(/([A-Z])/g, ' $1')
    .trim()
    .toLowerCase();
}

function getHumanReadableDescription(it: LogItem): string {
  // Use explicit description from metadata if available
  if (it.metadata?.description) return it.metadata.description;
  
  const actorName = it.actor?.name || 'System';
  const action = it.action.toLowerCase();
  const modelName = getHumanReadableModelName(it.entity_type);
  
  // Try to get entity name from various metadata locations
  let entityName = it.metadata?.name;
  if (!entityName && it.metadata?.after?.name) {
    entityName = it.metadata.after.name;
  }
  if (!entityName && it.metadata?.before?.name) {
    entityName = it.metadata.before.name;
  }
  // For users, also check email as fallback
  if (!entityName && it.entity_type?.includes('User')) {
    entityName = it.metadata?.email || it.metadata?.after?.email || it.metadata?.before?.email;
  }
  // Fallback to ID if no name found
  if (!entityName && it.entity_id) {
    entityName = `#${it.entity_id}`;
  }
  
  // User-specific activities
  if (it.entity_type?.includes('User')) {
    if (action.includes('create')) return `${actorName} created a new user account${entityName ? ` (${entityName})` : ''}`;
    if (action.includes('update') || action.includes('edit')) return `${actorName} updated user information for ${entityName || 'a user'}`;
    if (action.includes('delete')) return `${actorName} deleted a user account${entityName ? ` (${entityName})` : ''}`;
    if (action.includes('login')) return `${actorName} logged in`;
    if (action.includes('logout')) return `${actorName} logged out`;
    return `${actorName} performed action "${it.action}" on a user`;
  }
  
  // Role-specific activities
  if (it.entity_type?.includes('Role')) {
    if (action.includes('create')) return `${actorName} created a new role${entityName ? ` "${entityName}"` : ''}`;
    if (action.includes('update') || action.includes('edit')) return `${actorName} updated role "${entityName || 'Unknown'}"`;
    if (action.includes('delete')) return `${actorName} deleted role${entityName ? ` "${entityName}"` : ''}`;
    return `${actorName} ${action} role "${entityName || 'Unknown'}"`;
  }
  
  // Company-specific activities
  if (it.entity_type?.includes('Company')) {
    if (action.includes('create')) return `${actorName} created a new company${entityName ? ` "${entityName}"` : ''}`;
    if (action.includes('update') || action.includes('edit')) return `${actorName} updated company "${entityName || 'Unknown'}"`;
    if (action.includes('delete')) return `${actorName} deleted company${entityName ? ` "${entityName}"` : ''}`;
    return `${actorName} ${action} company "${entityName || 'Unknown'}"`;
  }
  
  // Generic description for other entities
  if (modelName && entityName) {
    return `${actorName} ${action} ${modelName} "${entityName}"`;
  }
  
  if (modelName) {
    return `${actorName} ${action} ${modelName}`;
  }
  
  return `${actorName} performed ${it.action}`;
}

export default function ActivityLogsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [items, setItems] = useState<LogItem[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);

  const [q, setQ] = useState('');
  const [action, setAction] = useState('');
  const [userId, setUserId] = useState<string>('');
  const [entityType, setEntityType] = useState('');
  const [entityId, setEntityId] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedLog, setSelectedLog] = useState<LogItem | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  const loadUsers = async () => {
    try {
      const json = await fetchJson('/api/v1/admin/users');
      const list = Array.isArray(json?.data) ? json.data : [];
      setUsers(
        list
          .map((u: any) => ({ id: Number(u?.id ?? 0), name: String(u?.name ?? ''), email: String(u?.email ?? '') }))
          .filter((u: AdminUser) => u.id > 0),
      );
    } catch {
      setUsers([]);
    }
  };

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set('q', q.trim());
      if (action.trim()) params.set('action', action.trim());
      if (userId) params.set('user_id', userId);
      if (entityType.trim()) params.set('entity_type', entityType.trim());
      if (entityId.trim()) params.set('entity_id', entityId.trim());
      if (dateFrom.trim()) params.set('date_from', dateFrom.trim());
      if (dateTo.trim()) params.set('date_to', dateTo.trim());
      const json = await fetchJson(`/api/v1/admin/activity-logs?${params.toString()}`);
      setItems(Array.isArray(json?.data) ? json.data : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load activity logs.');
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadUsers();
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const actionOptions = useMemo(() => {
    const set = new Set<string>();
    for (const it of items) {
      if (it?.action) set.add(String(it.action));
    }
    return [...set].sort();
  }, [items]);

  return (
    <div className="space-y-6">
      <PageHeader title="Activity Logs" description="Audit trail of user actions across ERP." />

      {error ? (
        <div className="rounded-xl border border-rose/30 bg-rose/10 px-4 py-3 text-sm text-rose">{error}</div>
      ) : null}

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-divider pb-3">
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search action/entity…"
              className="input-surface h-9 w-56 px-3 text-sm"
            />
            <select value={action} onChange={(e) => setAction(e.target.value)} className="input-surface h-9 w-56 px-3 text-sm">
              <option value="">All actions</option>
              {actionOptions.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
            <select value={userId} onChange={(e) => setUserId(e.target.value)} className="input-surface h-9 w-56 px-3 text-sm">
              <option value="">All users</option>
              {users.map((u) => (
                <option key={u.id} value={String(u.id)}>
                  {u.name} ({u.email})
                </option>
              ))}
            </select>
            <input
              value={entityType}
              onChange={(e) => setEntityType(e.target.value)}
              placeholder="Entity type (optional)"
              className="input-surface h-9 w-56 px-3 text-sm"
            />
            <input
              value={entityId}
              onChange={(e) => setEntityId(e.target.value)}
              placeholder="Entity ID (optional)"
              className="input-surface h-9 w-40 px-3 text-sm"
            />
            <input value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} type="date" className="input-surface h-9 px-3 text-sm" />
            <input value={dateTo} onChange={(e) => setDateTo(e.target.value)} type="date" className="input-surface h-9 px-3 text-sm" />
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              className="btn-secondary h-9 px-3 text-xs"
              onClick={() => {
                setQ('');
                setAction('');
                setUserId('');
                setEntityType('');
                setEntityId('');
                setDateFrom('');
                setDateTo('');
              }}
              disabled={loading}
            >
              Reset
            </button>
            <button type="button" className="btn-primary h-9 px-3 text-xs" onClick={() => void load()} disabled={loading}>
              Apply
            </button>
          </div>
        </div>

        <div className="mt-4 space-y-2">
          {loading ? (
            <div className="text-sm text-muted">Loading…</div>
          ) : items.length ? (
            <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 sm:overflow-visible">
              <div className="min-w-[900px] sm:min-w-0 overflow-hidden rounded-xl border border-divider bg-white sm:w-full">
                <table className="w-full text-sm">
                  <thead className="bg-subtle/40">
                    <tr>
                      <th className="px-3 sm:px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-muted">User</th>
                      <th className="px-3 sm:px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-muted">Action</th>
                      <th className="px-3 sm:px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-muted">Description</th>
                      <th className="px-3 sm:px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-muted">Date & Time</th>
                      <th className="px-3 sm:px-4 py-3 text-right text-[10px] font-semibold uppercase tracking-wider text-muted">Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((it) => {
                      const description = getHumanReadableDescription(it);
                      return (
                        <tr key={it.id} className="border-t border-divider/60 hover:bg-subtle/20 transition-colors">
                          <td className="px-3 sm:px-4 py-3">
                            <div className="font-semibold text-fg">{it.actor?.name ?? 'System'}</div>
                          </td>
                          <td className="px-3 sm:px-4 py-3">
                            <span className={cn(
                              'inline-flex items-center gap-1.5 rounded-full px-2.5 sm:px-3 py-1 sm:py-1.5 text-[11px] sm:text-xs font-semibold border',
                              getActionTone(it.action) === 'emerald' && 'bg-emerald/10 text-emerald border-emerald/20',
                              getActionTone(it.action) === 'cyan' && 'bg-cyan/10 text-cyan border-cyan/20',
                              getActionTone(it.action) === 'rose' && 'bg-rose/10 text-rose border-rose/20',
                              getActionTone(it.action) === 'amber' && 'bg-amber/10 text-amber border-amber/20',
                              getActionTone(it.action) === 'neutral' && 'bg-subtle text-muted border-divider'
                            )}>
                              <span className={cn(
                                'h-1.5 w-1.5 rounded-full',
                                getActionTone(it.action) === 'emerald' && 'bg-emerald',
                                getActionTone(it.action) === 'cyan' && 'bg-cyan',
                                getActionTone(it.action) === 'rose' && 'bg-rose',
                                getActionTone(it.action) === 'amber' && 'bg-amber',
                                getActionTone(it.action) === 'neutral' && 'bg-muted'
                              )} />
                              {getHumanReadableAction(it.action)}
                            </span>
                          </td>
                          <td className="px-3 sm:px-4 py-3 text-fg max-w-[200px] sm:max-w-md">
                            <div className="line-clamp-2 text-xs sm:text-sm">{description}</div>
                          </td>
                          <td className="px-3 sm:px-4 py-3">
                            <div className="font-medium text-fg text-xs sm:text-sm">{fmtDate(it.created_at)}</div>
                            <div className="text-[11px] sm:text-xs text-muted">{fmtTime(it.created_at)}</div>
                          </td>
                          <td className="px-3 sm:px-4 py-3 text-right">
                            <button
                              type="button"
                              className="inline-flex items-center gap-1 rounded-lg bg-accent px-2.5 sm:px-3 py-1 sm:py-1.5 text-[11px] sm:text-xs font-semibold text-white hover:bg-accent/90 transition-colors"
                              onClick={() => setSelectedLog(it)}
                            >
                              <Eye className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                              <span className="hidden sm:inline">View</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <Empty label="No activity yet." />
          )}
        </div>
      </Card>

      {selectedLog && (
        <ActivityDetailModal
          log={selectedLog}
          onClose={() => setSelectedLog(null)}
          expandedSections={expandedSections}
          setExpandedSections={setExpandedSections}
        />
      )}
    </div>
  );
}

function ActivityDetailModal({
  log,
  onClose,
  expandedSections,
  setExpandedSections,
}: {
  log: LogItem;
  onClose: () => void;
  expandedSections: Set<string>;
  setExpandedSections: React.Dispatch<React.SetStateAction<Set<string>>>;
}) {
  const toggleSection = (section: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };

  // Convert before/after format to changes array
  const getChangesFromMetadata = (): ChangeSet[] => {
    if (log.metadata?.changes?.length > 0) {
      return log.metadata.changes;
    }
    
    const before = log.metadata?.before;
    const after = log.metadata?.after;
    
    if (!before && !after) return [];
    
    const allKeys = new Set([
      ...Object.keys(before || {}),
      ...Object.keys(after || {}),
    ]);
    
    return Array.from(allKeys)
      .filter(key => key !== 'password' && !key.includes('password')) // Hide sensitive fields
      .map(key => ({
        field: key,
        old_value: before?.[key] ?? null,
        new_value: after?.[key] ?? null,
      }))
      .filter(change => {
        // Properly compare values handling different types
        const oldVal = change.old_value;
        const newVal = change.new_value;
        
        // Both null/undefined/empty are considered equal
        if (!oldVal && !newVal) return false;
        
        // String comparison
        if (typeof oldVal === 'string' && typeof newVal === 'string') {
          return oldVal !== newVal;
        }
        
        // Number comparison (handle 0 vs empty)
        if (typeof oldVal === 'number' && typeof newVal === 'number') {
          return oldVal !== newVal;
        }
        
        // Mixed types - convert to string for comparison
        const oldStr = String(oldVal ?? '');
        const newStr = String(newVal ?? '');
        return oldStr !== newStr;
      });
  };
  
  const changes = getChangesFromMetadata();
  const relatedActivities = log.metadata?.related_activities || [];
  
  // Format field names for display
  const formatFieldName = (field: string): string => {
    return field
      .replace(/_/g, ' ')
      .replace(/([A-Z])/g, ' $1')
      .trim()
      .replace(/^\w/, c => c.toUpperCase());
  };
  
  // Format values for display
  const formatValue = (value: any): string => {
    if (value === null || value === undefined) return '';
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (Array.isArray(value)) return value.join(', ') || '—';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  };

  return (
    <ModalFrame onBackdropClick={onClose} panelClassName="max-w-3xl p-0 max-h-[90vh] overflow-y-auto">
      <div className="border-b border-divider px-6 py-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="font-display text-xl font-semibold text-fg">Activity Details</h3>
            <p className="mt-1 text-sm text-muted">
              {getHumanReadableDescription(log)}
            </p>
          </div>
          <button type="button" className="btn-secondary px-3 py-1.5 text-xs" onClick={onClose}>
            Close
          </button>
        </div>
      </div>

      <div className="px-6 py-5 space-y-5">
        {/* Summary Info */}
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-muted">By:</span>
            <span className="font-medium text-fg">{log.actor?.name || 'System'}</span>
            {log.actor?.email && (
              <span className="text-muted">({log.actor.email})</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted">When:</span>
            <span className="font-medium text-fg">{fmtDateTime(log.created_at)}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted">Action:</span>
            <span className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold border',
              getActionTone(log.action) === 'emerald' && 'bg-emerald/10 text-emerald border-emerald/20',
              getActionTone(log.action) === 'cyan' && 'bg-cyan/10 text-cyan border-cyan/20',
              getActionTone(log.action) === 'rose' && 'bg-rose/10 text-rose border-rose/20',
              getActionTone(log.action) === 'amber' && 'bg-amber/10 text-amber border-amber/20',
              getActionTone(log.action) === 'neutral' && 'bg-subtle text-muted border-divider'
            )}>
              <span className={cn(
                'h-1.5 w-1.5 rounded-full',
                getActionTone(log.action) === 'emerald' && 'bg-emerald',
                getActionTone(log.action) === 'cyan' && 'bg-cyan',
                getActionTone(log.action) === 'rose' && 'bg-rose',
                getActionTone(log.action) === 'amber' && 'bg-amber',
                getActionTone(log.action) === 'neutral' && 'bg-muted'
              )} />
              {getHumanReadableAction(log.action)}
            </span>
          </div>
        </div>

        {/* Entity Information - Context-aware display */}
        {log.entity_type && (
          <div className="rounded-2xl border border-divider bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <span className="h-2 w-2 rounded-full bg-accent" />
              <h4 className="font-display text-base font-semibold text-fg">
                {(() => {
                  const entityName = log.metadata?.name || log.metadata?.after?.name || log.metadata?.before?.name;
                  const modelType = getHumanReadableModelName(log.entity_type);
                  if (log.entity_type?.includes('Company')) {
                    return entityName || 'Company Details';
                  }
                  if (log.entity_type?.includes('Order')) {
                    return entityName ? `Order: ${entityName}` : `Order #${log.entity_id || 'Unknown'}`;
                  }
                  return entityName || `${modelType.charAt(0).toUpperCase() + modelType.slice(1)} Details`;
                })()}
              </h4>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
              {/* Primary Name/Identifier */}
              <div className="sm:col-span-2 lg:col-span-1">
                <span className="text-muted text-xs">Name</span>
                <div className="font-semibold text-fg text-base">
                  {log.metadata?.name || log.metadata?.after?.name || log.metadata?.before?.name || '—'}
                </div>
              </div>
              
              {/* Context-specific secondary info */}
              {log.metadata?.email && (
                <div>
                  <span className="text-muted text-xs">Email</span>
                  <div className="font-medium text-fg">{log.metadata.email}</div>
                </div>
              )}
              
              {/* Company-specific info */}
              {(log.metadata?.primary_email || log.metadata?.after?.primary_email) && (
                <div>
                  <span className="text-muted text-xs">Primary Email</span>
                  <div className="font-medium text-fg">
                    {log.metadata?.primary_email || log.metadata?.after?.primary_email}
                  </div>
                </div>
              )}
              
              {(log.metadata?.primary_phone || log.metadata?.after?.primary_phone) && (
                <div>
                  <span className="text-muted text-xs">Primary Phone</span>
                  <div className="font-medium text-fg">
                    {log.metadata?.primary_phone || log.metadata?.after?.primary_phone}
                  </div>
                </div>
              )}
              
              {(log.metadata?.primary_contact_name || log.metadata?.after?.primary_contact_name) && (
                <div>
                  <span className="text-muted text-xs">Contact Person</span>
                  <div className="font-medium text-fg">
                    {log.metadata?.primary_contact_name || log.metadata?.after?.primary_contact_name}
                  </div>
                </div>
              )}
              
              {/* Role info */}
              {(log.metadata?.role || log.metadata?.after?.roles?.[0]) && (
                <div>
                  <span className="text-muted text-xs">Role</span>
                  <div className="font-medium text-fg">
                    {log.metadata?.role || log.metadata?.after?.roles?.[0] || log.metadata?.after?.roles}
                  </div>
                </div>
              )}
              
              {/* Entity reference ID (small, secondary) */}
              {log.entity_id && (
                <div>
                  <span className="text-muted text-xs">Reference ID</span>
                  <div className="font-medium text-fg text-muted">#{log.entity_id}</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Main Changes */}
        {changes.length > 0 && (
          <div className="space-y-4">
            <h4 className="font-display text-base font-semibold text-fg flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-accent" />
              Changes Made ({changes.length})
            </h4>
            {changes.map((change, idx) => (
              <div key={idx} className="rounded-2xl border border-divider bg-white p-5 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <h5 className="font-display text-base font-semibold text-fg">{formatFieldName(change.field)}</h5>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="rounded-xl border border-rose/25 bg-rose/[0.03] p-4">
                    <div className="flex items-center gap-1.5 mb-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-rose" />
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-rose">Before</span>
                    </div>
                    <div className="text-sm text-fg break-words font-medium">
                      {formatValue(change.old_value) || <span className="text-muted italic">— Empty —</span>}
                    </div>
                  </div>
                  <div className="rounded-xl border border-emerald/25 bg-emerald/[0.03] p-4">
                    <div className="flex items-center gap-1.5 mb-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald" />
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald">After</span>
                    </div>
                    <div className="text-sm text-fg break-words font-medium">
                      {formatValue(change.new_value) || <span className="text-muted italic">— Empty —</span>}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Related Activities */}
        {relatedActivities.length > 0 && (
          <div className="space-y-3">
            <h4 className="font-display text-lg font-semibold text-fg">Related Activities</h4>
            {relatedActivities.map((section, idx) => {
              const isExpanded = expandedSections.has(section.type);
              return (
                <div key={idx} className="rounded-2xl border border-divider bg-subtle/20 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => toggleSection(section.type)}
                    className="w-full flex items-center justify-between gap-3 px-5 py-4 hover:bg-subtle/40 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="h-2 w-2 rounded-full bg-accent" />
                      <span className="font-display text-base font-semibold text-fg">{section.type}</span>
                      <span className="inline-flex items-center justify-center h-6 min-w-6 rounded-full bg-accent px-2 text-xs font-semibold text-white">
                        {section.count}
                      </span>
                    </div>
                    {isExpanded ? (
                      <ChevronUp className="h-5 w-5 text-muted" />
                    ) : (
                      <ChevronDown className="h-5 w-5 text-muted" />
                    )}
                  </button>
                  {isExpanded && (
                    <div className="px-5 pb-4 space-y-3 border-t border-divider/60 pt-3">
                      {section.items.map((item, itemIdx) => (
                        <div key={itemIdx} className="rounded-xl border border-divider bg-white p-4">
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <span className="font-medium text-fg">{item.action}</span>
                            <span className="text-xs text-accent bg-accent/10 px-2 py-1 rounded-md">
                              {fmtDateTime(item.timestamp)}
                            </span>
                          </div>
                          <p className="text-sm text-muted">{item.description}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Metadata */}
        {(log.ip || log.user_agent) && (
          <div className="rounded-2xl border border-divider bg-subtle/20 p-4">
            <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted mb-3">Request Information</h4>
            <div className="space-y-2 text-xs">
              {log.ip && (
                <div className="flex items-center justify-between gap-4">
                  <span className="text-muted">IP Address</span>
                  <span className="font-semibold text-fg">{log.ip}</span>
                </div>
              )}
              {log.user_agent && (
                <div className="space-y-1">
                  <span className="text-muted">User Agent</span>
                  <div className="rounded-lg border border-divider bg-subtle px-3 py-2 text-fg text-[11px] break-all">
                    {log.user_agent}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </ModalFrame>
  );
}


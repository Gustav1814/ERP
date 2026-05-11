import { useEffect, useMemo, useState } from 'react';
import { ChevronRight, Download, Filter, Plus, Search, X, Building2, User, Mail, Phone, MapPin } from 'lucide-react';
import { type Company, type ErpOrder } from '../data/companies';
import { Card, KpiTile, PageHeader, Pill, TableCellPopover, TableShell, Td, Th, ModalFrame } from '../components/ui';
import { useCompaniesSync } from '@/src/context/CompaniesSyncContext';
import { useCrmSharedData } from '@/src/context/CrmSharedDataContext';
import { OrderInventoryDetailPanel } from '@/src/components/order/OrderInventoryDetailPanel';
import { fetchWithFallback } from '@/src/lib/api';
import {
  normalizeManualServices,
  sortServiceLabelsByCatalogOrder,
  stripEquipmentOnlyServiceLabel,
} from '@/src/lib/crmManualServices';
import { applyAccountManagerToCompany, accountManagerFromOrderPayload } from '@/src/lib/companyAccountManager';
import {
  computeVolumeLbsFromOrderPayload,
} from '@/src/lib/orderInventoryVolume';

type OrderRow = ErpOrder & {
  company_name: string;
  project_manager?: string;
  panelCompany: Company;
  crm_payload_json?: Record<string, unknown> | null;
};

function toPanelCompany(raw: any): Company {
  const addresses = Array.isArray(raw?.addresses) ? raw.addresses : [];
  return {
    id: Number(raw?.id ?? 0),
    name: String(raw?.name ?? ''),
    primary_contact_name: String(raw?.primary_contact_name ?? ''),
    primary_contact_user_id: raw?.primary_contact_user_id ?? null,
    project_manager: String(raw?.project_manager ?? ''),
    primary_email: String(raw?.primary_email ?? ''),
    primary_phone: String(raw?.primary_phone ?? ''),
    customer_type: raw?.customer_type ?? 'commercial',
    lead_channel: raw?.lead_channel ?? 'web',
    hear_about_us: String(raw?.hear_about_us ?? ''),
    created_at: String(raw?.created_at ?? new Date().toISOString()),
    addresses,
    users: Array.isArray(raw?.users) ? raw.users : [],
    orders: [],
  };
}

const statusTone = (s: ErpOrder['status']) => {
  if (s === 'completed') return 'emerald' as const;
  if (s === 'in_progress') return 'sky' as const;
  if (s === 'new') return 'accent' as const;
  return 'rose' as const;
};

const qualifyTone = (q: ErpOrder['qualify_status']) => {
  if (q === 'qualified') return 'emerald' as const;
  if (q === 'pending') return 'amber' as const;
  return 'rose' as const;
};

const pickupTone = (s: ErpOrder['pickup_cost_status']) => {
  if (s === 'approved') return 'emerald' as const;
  if (s === 'pending') return 'amber' as const;
  return 'rose' as const;
};

function money(n: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(n);
}

function fmtDate(d: string) {
  if (!d) return '—';
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
}

/** Completed date is stored as `inventory_detail.delivered_date` on `crm_payload_json` (same as order detail "Completed date"). */
function completedDateFromPayload(crm: Record<string, unknown> | null | undefined): string {
  const inv = (crm?.inventory_detail ?? {}) as Record<string, unknown>;
  const raw = inv?.delivered_date;
  if (raw == null || raw === '') return '';
  return String(raw).trim();
}

function normalizeCrmOrderStatus(rawStatus: unknown, rawQualifyStatus: unknown): ErpOrder['status'] {
  const status = String(rawStatus ?? '').trim().toLowerCase();
  const qualify = String(rawQualifyStatus ?? '').trim().toLowerCase();

  // CRM sometimes surfaces "Scheduled / Completed" in different fields.
  // Sometimes the CRM may provide combined strings like "scheduled · completed".
  const hasCompleted = status.includes('completed') || qualify.includes('completed');
  const hasScheduled = status.includes('scheduled') || qualify.includes('scheduled');

  // Completed should win over scheduled.
  if (hasCompleted) return 'completed';
  if (hasScheduled) return 'in_progress';

  if (status === 'in_progress' || status === 'new' || status === 'cancelled') return status;
  return 'new';
}

const STATUS_FILTERS: Array<{ key: 'all'; label: string }> = [{ key: 'all', label: 'All' }];

/** `#/orders/123` → detail id; plain `#/orders` → list. Keeps order detail across full page reload. */
function parseOrdersDetailIdFromHash(): number | null {
  if (typeof window === 'undefined') return null;
  const normalized = window.location.hash.replace(/^#\/?/, '').trim().toLowerCase();
  const m = /^orders\/(\d+)$/.exec(normalized);
  if (!m) return null;
  const id = Number.parseInt(m[1], 10);
  return Number.isFinite(id) && id > 0 ? id : null;
}

function navigateOrdersHash(orderId: number | null) {
  if (typeof window === 'undefined') return;
  const next = orderId != null ? `#/orders/${orderId}` : '#/orders';
  if (window.location.hash !== next) {
    window.location.hash = next;
  }
}

export default function OrdersPage() {
  const { companies, setCompanies, refreshCompanies } = useCompaniesSync();
  const { inventoryWeightByType, serviceNames: serviceCatalogOrder } = useCrmSharedData();
  const rows = useMemo(() => {
    return companies.flatMap((company: any) => {
      const panelCompany = toPanelCompany(company);
      return (company.orders ?? []).map((order: any) => ({
        ...order,
        panelCompany,
        crm_payload_json: order?.crm_payload_json ?? null,
        company_name: String(company?.name ?? ''),
        project_manager: company.project_manager ?? 'Unassigned',
        title: String(order?.title ?? ''),
        source_order_id: String(order?.source_order_id ?? ''),
        type_of_equipment: String(order?.type_of_equipment ?? ''),
        quantity: String(order?.quantity ?? ''),
        estimate_value: Number(order?.estimate_value ?? 0),
        pickup_cost: Number(order?.pickup_cost ?? 0),
        pickup_cost_status: String(order?.pickup_cost_status ?? 'pending'),
        status: normalizeCrmOrderStatus(order?.status, order?.qualify_status),
        qualify_status: String(order?.qualify_status ?? 'pending'),
        start_date: String(order?.start_date ?? ''),
        pickup_date: String(order?.pickup_date ?? ''),
        services: stripEquipmentOnlyServiceLabel(
          normalizeManualServices(order?.crm_payload_json ?? null),
          String(order?.type_of_equipment ?? ''),
        ),
        attachments: order?.attachments_json ?? [],
        detail_rows: order?.detail_rows ?? [],
      }));
    });
  }, [companies]);

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<(typeof STATUS_FILTERS)[number]['key']>('all');
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(() => parseOrdersDetailIdFromHash());
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [companyMode, setCompanyMode] = useState<'existing' | 'new'>('existing');
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | ''>('');
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [newCompany, setNewCompany] = useState({
    name: '',
    primary_contact_name: '',
    primary_email: '',
    primary_phone: '',
  });
  const [orderForm, setOrderForm] = useState({
    title: '',
    type_of_equipment: '',
    quantity: '',
    pickup_date: '',
    source_order_id: '',
  });

  useEffect(() => {
    const syncFromHash = () => setSelectedOrderId(parseOrdersDetailIdFromHash());
    window.addEventListener('hashchange', syncFromHash);
    return () => window.removeEventListener('hashchange', syncFromHash);
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (status !== 'all' && r.status !== status) return false;
      if (!q) return true;
      const companyName = String(r.company_name ?? '').toLowerCase();
      const sourceOrderId = String(r.source_order_id ?? '').toLowerCase();
      return companyName.includes(q) || sourceOrderId.includes(q);
    });
  }, [search, status, rows]);

  const selectedOrder = useMemo(
    () => (selectedOrderId == null ? null : rows.find((r) => r.id === selectedOrderId) ?? null),
    [selectedOrderId, rows],
  );

  const totals = useMemo(() => {
    const now = Date.now();
    const total = rows.length;
    const completed = rows.filter((r) => r.status === 'completed').length;
    const newFromCrm24h = rows.filter((r) => {
      const source = String((r as any)?.source_system ?? '').toLowerCase();
      const isCrm = source.includes('crm');
      if (!isCrm) return false;
      const createdMs = new Date(String((r as any)?.created_at ?? '')).getTime();
      if (!Number.isFinite(createdMs)) return false;
      return now - createdMs <= 24 * 60 * 60 * 1000;
    }).length;
    return { total, completed, newFromCrm24h };
  }, [rows]);

  const resetCreateForm = () => {
    setCompanyMode('existing');
    setSelectedCompanyId('');
    setNewCompany({ name: '', primary_contact_name: '', primary_email: '', primary_phone: '' });
    setOrderForm({ title: '', type_of_equipment: '', quantity: '', pickup_date: '', source_order_id: '' });
    setCreateError('');
  };

  const handleCreateOrder = async () => {
    setCreateError('');

    if (!orderForm.source_order_id.trim()) {
      setCreateError('Order ID is required');
      return;
    }
    if (companyMode === 'existing' && !selectedCompanyId) {
      setCreateError('Please select an existing company');
      return;
    }
    if (companyMode === 'new' && !newCompany.name.trim()) {
      setCreateError('Company name is required');
      return;
    }

    setIsCreating(true);

    try {
      const payload: any = {
        source: {
          system: 'erp',
          lead_id: Date.now(),
          order_id: orderForm.source_order_id.trim(),
        },
        company_binding: {
          mode: companyMode,
          existing_company_id: companyMode === 'existing' ? selectedCompanyId : null,
        },
        company: {
          name: companyMode === 'new' ? newCompany.name.trim() : '',
          primary_contact_name: newCompany.primary_contact_name?.trim() || null,
          primary_email: newCompany.primary_email?.trim() || null,
          primary_phone: newCompany.primary_phone?.trim() || null,
        },
        order: {
          title: orderForm.title?.trim() || null,
          type_of_equipment: orderForm.type_of_equipment?.trim() || null,
          quantity: orderForm.quantity?.trim() || null,
          pickup_date: orderForm.pickup_date || null,
        },
      };

      const res = await fetchWithFallback('/api/v1/crm/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || `Failed to create order (${res.status})`);
      }

      const result = await res.json();

      await refreshCompanies();

      setIsCreateModalOpen(false);
      resetCreateForm();

      const newOrderId = result?.erp_order_id ?? result?.data?.order?.id;
      if (newOrderId) {
        const parsedOrderId = Number(newOrderId);
        if (Number.isFinite(parsedOrderId) && parsedOrderId > 0) {
          setSelectedOrderId(parsedOrderId);
        }
        navigateOrdersHash(parsedOrderId);
      }
    } catch (err: any) {
      setCreateError(err.message || 'Failed to create order');
    } finally {
      setIsCreating(false);
    }
  };

  if (selectedOrder) {
    return (
      <OrderInventoryDetailPanel
        company={selectedOrder.panelCompany}
        order={selectedOrder}
        onBack={() => {
          setSelectedOrderId(null);
          navigateOrdersHash(null);
        }}
        crossLinks={
          <a
            href={`#/companies/${selectedOrder.company_id}`}
            className="btn-secondary px-3 py-1.5 text-xs"
          >
            Company record
          </a>
        }
        onInventoryDetailSaved={(orderId, patch) => {
          const manager = accountManagerFromOrderPayload(patch.crm_payload_json ?? null);
          setCompanies((prev) =>
            prev.map((company) => {
              if (!company.orders.some((order) => order.id === orderId)) return company;
              const withSavedOrder = {
                ...company,
                orders: company.orders.map((o) =>
                  o.id === orderId
                    ? {
                        ...o,
                        ...(patch.pickup_address_id !== undefined && { pickup_address_id: patch.pickup_address_id }),
                        ...(patch.pickup_date !== undefined && {
                          pickup_date: patch.pickup_date != null ? patch.pickup_date : '',
                        }),
                        ...(patch.crm_payload_json !== undefined && {
                          crm_payload_json: patch.crm_payload_json,
                          services: stripEquipmentOnlyServiceLabel(
                            normalizeManualServices(patch.crm_payload_json),
                            String(o.type_of_equipment ?? ''),
                          ),
                        }),
                      }
                    : o,
                ),
              };
              return manager ? applyAccountManagerToCompany(withSavedOrder, manager) : withSavedOrder;
            }),
          );
        }}
        onCompanyUpdated={(updated) => {
          const manager = String(updated.project_manager ?? '').trim();
          const nextCompany = manager ? applyAccountManagerToCompany(updated, manager) : updated;
          setCompanies((prev) => prev.map((c) => (c.id === nextCompany.id ? nextCompany : c)));
        }}
      />
    );
  }
  if (selectedOrderId != null && !selectedOrder) {
    return (
      <Card className="space-y-3">
        <p className="text-sm text-muted">Unable to load order detail.</p>
        <button
          type="button"
          onClick={() => {
            setSelectedOrderId(null);
            navigateOrdersHash(null);
          }}
          className="btn-secondary text-sm"
        >
          Back to orders
        </button>
      </Card>
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Orders"
        description="View, search, and manage orders."
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <KpiTile label="Total orders" value={String(totals.total)} tone="accent" />
        <KpiTile label="Completed" value={String(totals.completed)} tone="emerald" />
        <KpiTile label="New (24h)" value={String(totals.newFromCrm24h)} tone="amber" />
      </div>

      {/* Create Order Modal */}
      {isCreateModalOpen && (
        <ModalFrame
          onBackdropClick={() => { setIsCreateModalOpen(false); resetCreateForm(); }}
          panelClassName="max-w-3xl"
        >
          <div className="modal-panel p-6">
            {/* Header */}
            <div className="mb-6 flex items-center justify-between border-b border-divider pb-4">
              <h2 className="font-display text-xl font-semibold text-fg">Create New Order</h2>
              <button
                type="button"
                onClick={() => { setIsCreateModalOpen(false); resetCreateForm(); }}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-subtle hover:text-fg"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-6">
            {/* Company Selection */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 border-b border-divider pb-2">
                <Building2 size={18} className="text-accent" />
                <span className="font-semibold text-fg">Company</span>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setCompanyMode('existing')}
                  className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
                    companyMode === 'existing'
                      ? 'bg-accent text-white'
                      : 'bg-subtle text-muted hover:text-fg'
                  }`}
                >
                  Existing Company
                </button>
                <button
                  type="button"
                  onClick={() => setCompanyMode('new')}
                  className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
                    companyMode === 'new'
                      ? 'bg-accent text-white'
                      : 'bg-subtle text-muted hover:text-fg'
                  }`}
                >
                  New Company
                </button>
              </div>

              {companyMode === 'existing' ? (
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-fg">
                    Select Company <span className="text-rose">*</span>
                  </label>
                  <select
                    value={selectedCompanyId}
                    onChange={(e) => setSelectedCompanyId(e.target.value ? Number(e.target.value) : '')}
                    className="input-surface w-full"
                  >
                    <option value="">— Choose a company —</option>
                    {companies.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-fg">
                      Company Name <span className="text-rose">*</span>
                    </label>
                    <input
                      type="text"
                      value={newCompany.name}
                      onChange={(e) => setNewCompany({ ...newCompany, name: e.target.value })}
                      placeholder="Enter company name"
                      className="input-surface w-full"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-fg">Contact Name</label>
                    <input
                      type="text"
                      value={newCompany.primary_contact_name}
                      onChange={(e) => setNewCompany({ ...newCompany, primary_contact_name: e.target.value })}
                      placeholder="Primary contact"
                      className="input-surface w-full"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-fg">Email</label>
                    <input
                      type="email"
                      value={newCompany.primary_email}
                      onChange={(e) => setNewCompany({ ...newCompany, primary_email: e.target.value })}
                      placeholder="email@company.com"
                      className="input-surface w-full"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-fg">Phone</label>
                    <input
                      type="tel"
                      value={newCompany.primary_phone}
                      onChange={(e) => setNewCompany({ ...newCompany, primary_phone: e.target.value })}
                      placeholder="(555) 123-4567"
                      className="input-surface w-full"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Order Details */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 border-b border-divider pb-2">
                <MapPin size={18} className="text-accent" />
                <span className="font-semibold text-fg">Order Details</span>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-fg">
                    Order ID <span className="text-rose">*</span>
                  </label>
                  <input
                    type="text"
                    value={orderForm.source_order_id}
                    onChange={(e) => setOrderForm({ ...orderForm, source_order_id: e.target.value })}
                    placeholder="Enter order ID"
                    className="input-surface w-full"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-fg">Title</label>
                  <input
                    type="text"
                    value={orderForm.title}
                    onChange={(e) => setOrderForm({ ...orderForm, title: e.target.value })}
                    placeholder="Order title"
                    className="input-surface w-full"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-fg">Equipment Type</label>
                  <input
                    type="text"
                    value={orderForm.type_of_equipment}
                    onChange={(e) => setOrderForm({ ...orderForm, type_of_equipment: e.target.value })}
                    placeholder="e.g. Laptops, Servers"
                    className="input-surface w-full"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-fg">Quantity</label>
                  <input
                    type="text"
                    value={orderForm.quantity}
                    onChange={(e) => setOrderForm({ ...orderForm, quantity: e.target.value })}
                    placeholder="e.g. 10 units"
                    className="input-surface w-full"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-fg">Pickup Date</label>
                  <input
                    type="date"
                    value={orderForm.pickup_date}
                    onChange={(e) => setOrderForm({ ...orderForm, pickup_date: e.target.value })}
                    className="input-surface w-full"
                  />
                </div>
              </div>
            </div>

            {createError && (
              <div className="rounded-lg bg-rose/10 px-4 py-3 text-sm text-rose">
                {createError}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => { setIsCreateModalOpen(false); resetCreateForm(); }}
                className="btn-secondary px-4 py-2"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateOrder}
                disabled={isCreating}
                className="btn-primary px-4 py-2"
              >
                {isCreating ? 'Creating...' : 'Create Order'}
              </button>
            </div>
          </div>
          </div>
        </ModalFrame>
      )}

      <Card padded={false}>
        <div className="flex flex-col gap-3 border-b border-divider p-5 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-1 items-center gap-2 rounded-xl border border-divider bg-subtle px-3">
            <Search size={14} className="text-muted" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by order ID or company…"
              className="w-full bg-transparent py-2.5 text-sm text-fg outline-none placeholder:text-muted"
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white shadow-lg shadow-accent/30 transition-colors hover:bg-accent/90"
            >
              <Plus size={14} />
              New Order
            </button>
            <div className="flex flex-wrap gap-1 rounded-xl border border-divider bg-subtle p-1">
              {STATUS_FILTERS.map((s) => (
                <button
                  key={s.key}
                  onClick={() => setStatus(s.key)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    status === s.key
                      ? 'bg-accent text-white shadow-lg shadow-accent/30'
                      : 'text-muted hover:text-fg'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <TableShell tableClassName="text-[13px] table-fixed font-medium">
          <thead>
            <tr>
              <Th className="w-[160px]">Order</Th>
              <Th className="w-[240px]">Company</Th>
              <Th className="w-[260px]">Services</Th>
              <Th className="w-[90px]" align="right">Volume</Th>
              <Th className="w-[170px]">Dates</Th>
              <Th className="w-10" align="right">{' '}</Th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => {
              const serviceLabels = stripEquipmentOnlyServiceLabel(
                sortServiceLabelsByCatalogOrder(normalizeManualServices(r.crm_payload_json), serviceCatalogOrder),
                r.type_of_equipment,
              );
              const serviceText = serviceLabels.join(' · ');
              const servicePreview =
                serviceLabels.length > 2
                  ? `${serviceLabels.slice(0, 2).join(' · ')} + ${serviceLabels.length - 2} more`
                  : serviceText;

              const fromInv = computeVolumeLbsFromOrderPayload(r.crm_payload_json ?? null, inventoryWeightByType);
              const q = Number(r.quantity);
              const volumeDisplay =
                fromInv > 0 ? String(Math.round(fromInv)) : Number.isFinite(q) && q > 0 ? String(Math.round(q)) : '—';
              return (
              <tr
                key={r.id}
                className="align-middle transition-colors hover:bg-subtle/60 cursor-pointer"
                onClick={() => {
                  setSelectedOrderId(r.id);
                  navigateOrdersHash(r.id);
                }}
              >
                <Td className="w-[160px] align-middle">
                  <div className="truncate text-[13px] font-medium text-fg">
                    {r.source_order_id || '—'}
                  </div>
                </Td>
                <Td className="w-[240px] align-middle">
                  <TableCellPopover
                    value={r.company_name || ''}
                    emptyLabel="—"
                    popoverTitle="Company"
                    textClassName="font-display font-semibold"
                    minCharsForPopover={0}
                  />
                </Td>
                <Td className="w-[260px] align-middle">
                  <TableCellPopover
                    value={serviceText}
                    previewValue={servicePreview}
                    emptyLabel="none"
                    popoverTitle="Services"
                    hoverClassName=""
                    className="w-full hover:bg-transparent"
                    textClassName="text-[13px]"
                    minCharsForPopover={serviceLabels.length > 2 ? 0 : 44}
                  />
                </Td>
                <Td align="right" className="w-[90px] tabular-nums text-[13px] font-medium text-fg">
                  {volumeDisplay}
                </Td>
                <Td className="w-[170px] align-middle">
                  <div className="grid grid-cols-[72px_1fr] items-center gap-x-2 text-[12px] text-muted">
                    <span className="font-medium">Pickup:</span>
                    <span className="font-medium text-fg">{fmtDate(r.pickup_date)}</span>
                    <span className="font-medium">Completed:</span>
                    <span className="font-medium text-fg">
                      {fmtDate(completedDateFromPayload(r.crm_payload_json))}
                    </span>
                  </div>
                </Td>
                <Td align="right" className="pr-5">
                  <ChevronRight size={16} className="text-muted/60 transition-colors group-hover:text-accent" />
                </Td>
              </tr>
            );
            })}
            {!filtered.length ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-sm text-muted">
                  No orders match your current filters.
                </td>
              </tr>
            ) : null}
          </tbody>
        </TableShell>
      </Card>
    </div>
  );
}


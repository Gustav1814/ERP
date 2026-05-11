import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { PageHeader, Card, Pill, Empty, ModalFrame } from '../components/ui';
import { fetchJson, fetchWithFallback } from '../lib/api';
import { ACCENT_OPTIONS, normalizeAccentId } from '../theme';
import { useCrmSharedData } from '@/src/context/CrmSharedDataContext';

const CRM_OPTIONAL_MODE = String(import.meta.env.VITE_ERP_CRM_OPTIONAL ?? 'true').toLowerCase() === 'true';

type ServiceItem = {
  id: number;
  name: string;
  sort_order: number;
};

type InventoryTypeItem = {
  id: number;
  name: string;
  default_weight_lbs: number | null;
  default_length: number | null;
  default_width: number | null;
  default_height: number | null;
  sort_order: number;
};

type PickupByItem = {
  id: number;
  name: string;
  sort_order: number;
};

type IndustryTypeItem = {
  id: number;
  name: string;
  sort_order: number;
};

type AccountManagerItem = {
  id: number;
  name: string;
  sort_order: number;
};

type DeleteTarget =
  | { kind: 'service'; id: number; name: string }
  | { kind: 'inventory'; id: number; name: string }
  | { kind: 'pickupBy'; id: number; name: string }
  | { kind: 'industryType'; id: number; name: string }
  | { kind: 'accountManager'; id: number; name: string };

function ModalShell({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <ModalFrame onBackdropClick={onClose} panelClassName="max-w-lg p-6">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h3 className="font-display text-xl font-semibold text-fg">{title}</h3>
          {subtitle ? <p className="mt-1 text-sm text-muted">{subtitle}</p> : null}
        </div>
        <button type="button" className="btn-secondary px-3 py-1.5 text-xs" onClick={onClose}>
          Close
        </button>
      </div>
      {children}
    </ModalFrame>
  );
}

export default function SettingsPage({
  accentId,
  onAccentChange,
}: {
  accentId: string;
  onAccentChange: (id: string) => void;
}) {
  const { refresh: refreshSharedCrmData } = useCrmSharedData();
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [inventoryTypes, setInventoryTypes] = useState<InventoryTypeItem[]>([]);
  const [pickupByOptions, setPickupByOptions] = useState<PickupByItem[]>([]);
  const [industryTypes, setIndustryTypes] = useState<IndustryTypeItem[]>([]);
  const [accountManagers, setAccountManagers] = useState<AccountManagerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [crmUnavailable, setCrmUnavailable] = useState(false);
  const [serviceModalOpen, setServiceModalOpen] = useState(false);
  const [serviceEditing, setServiceEditing] = useState<ServiceItem | null>(null);
  const [serviceName, setServiceName] = useState('');
  const [inventoryModalOpen, setInventoryModalOpen] = useState(false);
  const [inventoryEditing, setInventoryEditing] = useState<InventoryTypeItem | null>(null);
  const [inventoryName, setInventoryName] = useState('');
  const [inventoryWeight, setInventoryWeight] = useState('');
  const [inventoryLength, setInventoryLength] = useState('');
  const [inventoryWidth, setInventoryWidth] = useState('');
  const [inventoryHeight, setInventoryHeight] = useState('');
  const [pickupByModalOpen, setPickupByModalOpen] = useState(false);
  const [pickupByEditing, setPickupByEditing] = useState<PickupByItem | null>(null);
  const [pickupByName, setPickupByName] = useState('');
  const [industryModalOpen, setIndustryModalOpen] = useState(false);
  const [industryEditing, setIndustryEditing] = useState<IndustryTypeItem | null>(null);
  const [industryName, setIndustryName] = useState('');
  const [accountManagerModalOpen, setAccountManagerModalOpen] = useState(false);
  const [accountManagerEditing, setAccountManagerEditing] = useState<AccountManagerItem | null>(null);
  const [accountManagerName, setAccountManagerName] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [saving, setSaving] = useState(false);
  const [activeSection, setActiveSection] = useState<
    'services' | 'inventory' | 'pickupBy' | 'industry' | 'accountManagers'
  >('services');

  const loadSettings = async () => {
    setLoading(true);
    setError('');
    setCrmUnavailable(false);
    try {
      const [servicesJson, inventoryJson, pickupByJson] = await Promise.all([
        fetchJson('/api/v1/crm/settings/services'),
        fetchJson('/api/v1/crm/settings/inventory-types'),
        fetchJson('/api/v1/crm/settings/pickup-by'),
      ]);
      setServices(Array.isArray(servicesJson?.data) ? servicesJson.data : []);
      setInventoryTypes(Array.isArray(inventoryJson?.data) ? inventoryJson.data : []);
      setPickupByOptions(Array.isArray(pickupByJson?.data) ? pickupByJson.data : []);
      try {
        const [industryJson, accountManagersJson] = await Promise.all([
          fetchJson('/api/v1/crm/settings/industry-types'),
          fetchJson('/api/v1/crm/settings/account-managers'),
        ]);
        setIndustryTypes(Array.isArray(industryJson?.data) ? industryJson.data : []);
        setAccountManagers(Array.isArray(accountManagersJson?.data) ? accountManagersJson.data : []);
      } catch {
        setIndustryTypes([]);
        setAccountManagers([]);
      }
    } catch (e) {
      if (CRM_OPTIONAL_MODE) {
        // Option B mode: keep ERP testable even when CRM APIs are not deployed yet.
        setCrmUnavailable(true);
        setServices([]);
        setInventoryTypes([]);
        setPickupByOptions([]);
        setIndustryTypes([]);
        setAccountManagers([]);
      } else {
        setError(e instanceof Error ? e.message : 'Unable to load settings.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadSettings();
  }, []);

  const saveIndustryType = async () => {
    const trimmed = industryName.trim();
    if (!trimmed) return;
    setSaving(true);
    setError('');
    try {
      const res = await fetchWithFallback(
        industryEditing
          ? `/api/v1/crm/settings/industry-types/${industryEditing.id}`
          : '/api/v1/crm/settings/industry-types',
        {
          method: industryEditing ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: trimmed, sort_order: industryEditing?.sort_order ?? 0 }),
        },
      );
      if (!res.ok) throw new Error('Unable to save industry type.');
      const json = await res.json().catch(() => ({}));
      const nextItem = json?.data ?? null;
      setIndustryTypes((prev) => {
        if (!nextItem) return prev;
        const exists = prev.some((p) => p.id === nextItem.id);
        const next = exists ? prev.map((p) => (p.id === nextItem.id ? nextItem : p)) : [nextItem, ...prev];
        return [...next].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.name.localeCompare(b.name));
      });
      setIndustryModalOpen(false);
      setIndustryEditing(null);
      setIndustryName('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to save industry type.');
    } finally {
      setSaving(false);
    }
  };

  const deleteIndustryType = async (target: { id: number; name: string }) => {
    setSaving(true);
    setError('');
    try {
      const res = await fetchWithFallback(`/api/v1/crm/settings/industry-types/${target.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Unable to delete industry type.');
      setIndustryTypes((prev) => prev.filter((p) => p.id !== target.id));
      setDeleteTarget(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to delete industry type.');
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (loading) return;
    if (sessionStorage.getItem('erp_settings_focus') !== 'inventory-types') return;
    sessionStorage.removeItem('erp_settings_focus');
    const el = document.getElementById('crm-settings-inventory-types');
    if (el) {
      requestAnimationFrame(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    }
  }, [loading]);

  const serviceModalTitle = useMemo(
    () => (serviceEditing ? 'Edit Service' : 'Add Service'),
    [serviceEditing],
  );
  const inventoryModalTitle = useMemo(
    () => (inventoryEditing ? 'Edit Inventory Type' : 'Add Inventory Type'),
    [inventoryEditing],
  );
  const pickupByModalTitle = useMemo(
    () => (pickupByEditing ? 'Edit Pickup By' : 'Add Pickup By'),
    [pickupByEditing],
  );

  const openServiceCreateModal = () => {
    setServiceEditing(null);
    setServiceName('');
    setServiceModalOpen(true);
  };

  const openServiceEditModal = (item: ServiceItem) => {
    setServiceEditing(item);
    setServiceName(item.name);
    setServiceModalOpen(true);
  };

  const closeServiceModal = () => {
    setServiceModalOpen(false);
    setServiceEditing(null);
    setServiceName('');
  };

  const submitService = async () => {
    const name = serviceName.trim();
    if (!name) return;
    setSaving(true);
    setError('');
    const res = await fetchWithFallback(
      serviceEditing
        ? `/api/v1/crm/settings/services/${serviceEditing.id}`
        : '/api/v1/crm/settings/services',
      {
        method: serviceEditing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          sort_order: serviceEditing?.sort_order ?? 0,
        }),
      },
    );
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setError(
        json?.message || (serviceEditing ? 'Unable to update service.' : 'Unable to create service.'),
      );
      setSaving(false);
      return;
    }
    closeServiceModal();
    await loadSettings();
    await refreshSharedCrmData();
    setSaving(false);
  };

  const openInventoryCreateModal = () => {
    setInventoryEditing(null);
    setInventoryName('');
    setInventoryWeight('');
    setInventoryLength('');
    setInventoryWidth('');
    setInventoryHeight('');
    setInventoryModalOpen(true);
  };

  const openInventoryEditModal = (item: InventoryTypeItem) => {
    setInventoryEditing(item);
    setInventoryName(item.name);
    setInventoryWeight(item.default_weight_lbs == null ? '' : String(item.default_weight_lbs));
    setInventoryLength(item.default_length == null ? '' : String(item.default_length));
    setInventoryWidth(item.default_width == null ? '' : String(item.default_width));
    setInventoryHeight(item.default_height == null ? '' : String(item.default_height));
    setInventoryModalOpen(true);
  };

  const closeInventoryModal = () => {
    setInventoryModalOpen(false);
    setInventoryEditing(null);
    setInventoryName('');
    setInventoryWeight('');
    setInventoryLength('');
    setInventoryWidth('');
    setInventoryHeight('');
  };

  const openPickupByCreateModal = () => {
    setPickupByEditing(null);
    setPickupByName('');
    setPickupByModalOpen(true);
  };

  const openPickupByEditModal = (item: PickupByItem) => {
    setPickupByEditing(item);
    setPickupByName(item.name);
    setPickupByModalOpen(true);
  };

  const closePickupByModal = () => {
    setPickupByModalOpen(false);
    setPickupByEditing(null);
    setPickupByName('');
  };

  const openIndustryCreateModal = () => {
    setIndustryEditing(null);
    setIndustryName('');
    setIndustryModalOpen(true);
  };

  const openIndustryEditModal = (item: IndustryTypeItem) => {
    setIndustryEditing(item);
    setIndustryName(item.name);
    setIndustryModalOpen(true);
  };

  const closeIndustryModal = () => {
    setIndustryModalOpen(false);
    setIndustryEditing(null);
    setIndustryName('');
  };

  const openAccountManagerCreateModal = () => {
    setAccountManagerEditing(null);
    setAccountManagerName('');
    setAccountManagerModalOpen(true);
  };

  const openAccountManagerEditModal = (item: AccountManagerItem) => {
    setAccountManagerEditing(item);
    setAccountManagerName(item.name);
    setAccountManagerModalOpen(true);
  };

  const closeAccountManagerModal = () => {
    setAccountManagerModalOpen(false);
    setAccountManagerEditing(null);
    setAccountManagerName('');
  };

  const submitPickupBy = async () => {
    const name = pickupByName.trim();
    if (!name) return;
    setSaving(true);
    setError('');
    const res = await fetchWithFallback(
      pickupByEditing
        ? `/api/v1/crm/settings/pickup-by/${pickupByEditing.id}`
        : '/api/v1/crm/settings/pickup-by',
      {
        method: pickupByEditing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          sort_order: pickupByEditing?.sort_order ?? 0,
        }),
      },
    );
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setError(
        json?.message ||
          (pickupByEditing ? 'Unable to update pickup by option.' : 'Unable to create pickup by option.'),
      );
      setSaving(false);
      return;
    }
    closePickupByModal();
    await loadSettings();
    await refreshSharedCrmData();
    setSaving(false);
  };

  const submitIndustryType = async () => {
    const name = industryName.trim();
    if (!name) return;
    setSaving(true);
    setError('');
    const res = await fetchWithFallback(
      industryEditing
        ? `/api/v1/crm/settings/industry-types/${industryEditing.id}`
        : '/api/v1/crm/settings/industry-types',
      {
        method: industryEditing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          sort_order: industryEditing?.sort_order ?? 0,
        }),
      },
    );
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setError(
        json?.message ||
          (industryEditing ? 'Unable to update industry type.' : 'Unable to create industry type.'),
      );
      setSaving(false);
      return;
    }
    closeIndustryModal();
    await loadSettings();
    await refreshSharedCrmData();
    setSaving(false);
  };

  const submitAccountManager = async () => {
    const name = accountManagerName.trim();
    if (!name) return;
    setSaving(true);
    setError('');
    const res = await fetchWithFallback(
      accountManagerEditing
        ? `/api/v1/crm/settings/account-managers/${accountManagerEditing.id}`
        : '/api/v1/crm/settings/account-managers',
      {
        method: accountManagerEditing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          sort_order: accountManagerEditing?.sort_order ?? 0,
        }),
      },
    );
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setError(
        json?.message ||
          (accountManagerEditing ? 'Unable to update account manager.' : 'Unable to create account manager.'),
      );
      setSaving(false);
      return;
    }
    closeAccountManagerModal();
    await loadSettings();
    await refreshSharedCrmData();
    setSaving(false);
  };

  const submitInventoryType = async () => {
    const name = inventoryName.trim();
    if (!name) return;
    const isDimensionsType = name.toLowerCase() === 'dimensions';
    const weight = inventoryWeight.trim();
    const length = inventoryLength.trim();
    const width = inventoryWidth.trim();
    const height = inventoryHeight.trim();
    setSaving(true);
    setError('');
    const res = await fetchWithFallback(
      inventoryEditing
        ? `/api/v1/crm/settings/inventory-types/${inventoryEditing.id}`
        : '/api/v1/crm/settings/inventory-types',
      {
        method: inventoryEditing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          default_weight_lbs: isDimensionsType ? null : weight === '' ? null : Number(weight),
          default_length: length === '' ? null : Number(length),
          default_width: width === '' ? null : Number(width),
          default_height: height === '' ? null : Number(height),
          sort_order: inventoryEditing?.sort_order ?? 0,
        }),
      },
    );
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setError(
        json?.message ||
          (inventoryEditing ? 'Unable to update inventory type.' : 'Unable to create inventory type.'),
      );
      setSaving(false);
      return;
    }
    closeInventoryModal();
    await loadSettings();
    await refreshSharedCrmData();
    setSaving(false);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setSaving(true);
    setError('');
    if (deleteTarget.kind === 'service') {
      const res = await fetchWithFallback(`/api/v1/crm/settings/services/${deleteTarget.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setError(json?.message || 'Unable to delete service.');
        setSaving(false);
        return;
      }
    } else if (deleteTarget.kind === 'inventory') {
      const res = await fetchWithFallback(`/api/v1/crm/settings/inventory-types/${deleteTarget.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setError(json?.message || 'Unable to delete inventory type.');
        setSaving(false);
        return;
      }
    } else if (deleteTarget.kind === 'pickupBy') {
      const res = await fetchWithFallback(`/api/v1/crm/settings/pickup-by/${deleteTarget.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setError(json?.message || 'Unable to delete pickup by option.');
        setSaving(false);
        return;
      }
    } else if (deleteTarget.kind === 'industryType') {
      const res = await fetchWithFallback(`/api/v1/crm/settings/industry-types/${deleteTarget.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setError(json?.message || 'Unable to delete industry type.');
        setSaving(false);
        return;
      }
    } else {
      const res = await fetchWithFallback(`/api/v1/crm/settings/account-managers/${deleteTarget.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setError(json?.message || 'Unable to delete account manager.');
        setSaving(false);
        return;
      }
    }
    setDeleteTarget(null);
    await loadSettings();
    await refreshSharedCrmData();
    setSaving(false);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
      />

      {error ? (
        <div className="rounded-xl border border-rose/30 bg-rose/10 px-4 py-3 text-sm text-rose">{error}</div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,2.8fr)]">
        {/* Left rail: appearance + quick summary */}
        <div className="space-y-3">
          <Card className="px-3 py-3">
            <div className="flex flex-wrap items-center gap-2">
              {ACCENT_OPTIONS.map((opt) => {
                const selected = normalizeAccentId(accentId) === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => onAccentChange(opt.id)}
                    className={`flex items-center justify-center rounded-full border p-[2px] transition-all duration-200 ${
                      selected
                        ? 'border-accent shadow-[0_6px_18px_var(--glow-accent)] ring-1 ring-accent/40'
                        : 'border-divider bg-subtle/60 hover:border-divider hover:bg-subtle/80'
                    } `}
                  >
                    <span
                      className="h-6 w-6 shrink-0 rounded-full shadow-[inset_0_1px_0_rgba(255,255,255,0.18)]"
                      style={{
                        background: `linear-gradient(135deg, ${opt.swatch[0]}, ${opt.swatch[1]})`,
                      }}
                    />
                  </button>
                );
              })}
            </div>
          </Card>

          <Card className="hidden md:block px-4 py-3">
            <h3 className="label-mono mb-2">CRM Settings Summary</h3>
            <div className="space-y-1 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted">Services</span>
                <span className="font-semibold text-fg">{services.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted">Inventory types</span>
                <span className="font-semibold text-fg">{inventoryTypes.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted">Pickup by options</span>
                <span className="font-semibold text-fg">{pickupByOptions.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted">Account managers</span>
                <span className="font-semibold text-fg">{accountManagers.length}</span>
              </div>
            </div>
          </Card>
        </div>

        {/* Right: single tabbed card for CRUD */}
        <div id="crm-settings-inventory-types" className="scroll-mt-24">
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-divider pb-3">
            <div>
              <h2 className="font-display text-xl font-semibold text-fg">Order & Company Options</h2>
              <p className="mt-1 text-xs text-muted">
                Manage the lists used across orders and company records.
              </p>
            </div>
            <div className="inline-flex items-center gap-1 rounded-full border border-divider bg-subtle px-2 py-1 text-[11px] text-muted">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald" />
              {crmUnavailable ? 'CRM APIs unavailable in this environment' : 'Live from CRM APIs'}
            </div>
          </div>

          {/* Tabs */}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
            <div className="inline-flex gap-1 rounded-full bg-subtle p-1">
              <button
                type="button"
                onClick={() => setActiveSection('services')}
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  activeSection === 'services'
                    ? 'bg-accent text-white shadow-sm'
                    : 'text-muted hover:text-fg'
                }`}
              >
                Services
              </button>
              <button
                type="button"
                onClick={() => setActiveSection('inventory')}
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  activeSection === 'inventory'
                    ? 'bg-accent text-white shadow-sm'
                    : 'text-muted hover:text-fg'
                }`}
              >
                Inventory types
              </button>
              <button
                type="button"
                onClick={() => setActiveSection('pickupBy')}
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  activeSection === 'pickupBy'
                    ? 'bg-accent text-white shadow-sm'
                    : 'text-muted hover:text-fg'
                }`}
              >
                Pickup by
              </button>
              <button
                type="button"
                onClick={() => setActiveSection('industry')}
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  activeSection === 'industry'
                    ? 'bg-accent text-white shadow-sm'
                    : 'text-muted hover:text-fg'
                }`}
              >
                Industry types
              </button>
              <button
                type="button"
                onClick={() => setActiveSection('accountManagers')}
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  activeSection === 'accountManagers'
                    ? 'bg-accent text-white shadow-sm'
                    : 'text-muted hover:text-fg'
                }`}
              >
                Account managers
              </button>
            </div>

            {activeSection === 'services' ? (
              <button
                type="button"
                className="btn-primary px-3 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-60"
                onClick={openServiceCreateModal}
                disabled={crmUnavailable}
              >
                Add Service
              </button>
            ) : activeSection === 'inventory' ? (
              <button
                type="button"
                className="btn-primary px-3 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-60"
                onClick={openInventoryCreateModal}
                disabled={crmUnavailable}
              >
                Add Inventory
              </button>
            ) : activeSection === 'pickupBy' ? (
              <button
                type="button"
                className="btn-primary px-3 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-60"
                onClick={openPickupByCreateModal}
                disabled={crmUnavailable}
              >
                Add Pickup By
              </button>
            ) : activeSection === 'industry' ? (
              <button
                type="button"
                className="btn-primary px-3 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-60"
                onClick={openIndustryCreateModal}
                disabled={crmUnavailable}
              >
                Add Industry Type
              </button>
            ) : (
              <button
                type="button"
                className="btn-primary px-3 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-60"
                onClick={openAccountManagerCreateModal}
                disabled={crmUnavailable}
              >
                Add Account Manager
              </button>
            )}
          </div>

          <div className="mt-4 space-y-2">
            {loading ? (
              <div className="text-sm text-muted">Loading settings…</div>
            ) : activeSection === 'services' ? (
              services.length ? (
                services.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between rounded-xl border border-divider px-3 py-2"
                  >
                    <span className="text-sm text-fg">{item.name}</span>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        className="text-xs text-accent hover:underline disabled:cursor-not-allowed disabled:opacity-60"
                        onClick={() => openServiceEditModal(item)}
                        disabled={crmUnavailable}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="text-xs text-rose hover:underline"
                        onClick={() =>
                          setDeleteTarget({ kind: 'service', id: item.id, name: item.name })
                        }
                        disabled={crmUnavailable}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <Empty label="No services found." />
              )
            ) : activeSection === 'inventory' ? (
              inventoryTypes.length ? (
                inventoryTypes.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between rounded-xl border border-divider px-3 py-2"
                  >
                    <div className="text-sm text-fg">
                      {item.name}
                      {item.name.toLowerCase() !== 'dimensions' && item.default_weight_lbs != null
                        ? ` · ${item.default_weight_lbs} lbs`
                        : ''}
                      {item.default_length != null &&
                      item.default_width != null &&
                      item.default_height != null
                        ? ` · ${item.default_length} x ${item.default_width} x ${item.default_height}`
                        : ''}
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        className="text-xs text-accent hover:underline disabled:cursor-not-allowed disabled:opacity-60"
                        onClick={() => openInventoryEditModal(item)}
                        disabled={crmUnavailable}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="text-xs text-rose hover:underline"
                        onClick={() =>
                          setDeleteTarget({ kind: 'inventory', id: item.id, name: item.name })
                        }
                        disabled={crmUnavailable}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <Empty label="No inventory types found." />
              )
            ) : activeSection === 'pickupBy' ? (
              pickupByOptions.length ? (
                <>
                  <div className="rounded-xl border border-divider bg-subtle/40 px-3 py-2 text-xs text-muted">
                    Used in <span className="font-semibold text-fg">Orders</span> → order details →{' '}
                    <span className="font-semibold text-fg">Pickup By</span>.
                    <a href="#/orders" className="ml-2 font-semibold text-accent hover:underline">
                      Go to Orders
                    </a>
                  </div>
                  {pickupByOptions.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between rounded-xl border border-divider px-3 py-2"
                    >
                      <span className="text-sm text-fg">{item.name}</span>
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          className="text-xs text-accent hover:underline disabled:cursor-not-allowed disabled:opacity-60"
                          onClick={() => openPickupByEditModal(item)}
                          disabled={crmUnavailable}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="text-xs text-rose hover:underline"
                          onClick={() =>
                            setDeleteTarget({ kind: 'pickupBy', id: item.id, name: item.name })
                          }
                          disabled={crmUnavailable}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </>
              ) : (
                <Empty label="No pickup by options found." />
              )
            ) : activeSection === 'industry' ? (
              industryTypes.length ? (
              industryTypes.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between rounded-xl border border-divider px-3 py-2"
                >
                  <span className="text-sm text-fg">{item.name}</span>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      className="text-xs text-accent hover:underline disabled:cursor-not-allowed disabled:opacity-60"
                      onClick={() => openIndustryEditModal(item)}
                      disabled={crmUnavailable}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="text-xs text-rose hover:underline"
                      onClick={() =>
                        setDeleteTarget({ kind: 'industryType', id: item.id, name: item.name })
                      }
                      disabled={crmUnavailable}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))
              ) : (
                <Empty label="No industry types found." />
              )
            ) : accountManagers.length ? (
              <>
                <div className="rounded-xl border border-divider bg-subtle/40 px-3 py-2 text-xs text-muted">
                  Used in <span className="font-semibold text-fg">Orders</span> → order details →{' '}
                  <span className="font-semibold text-fg">Account Manager</span>.
                  <a href="#/orders" className="ml-2 font-semibold text-accent hover:underline">
                    Go to Orders
                  </a>
                </div>
                {accountManagers.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between rounded-xl border border-divider px-3 py-2"
                  >
                    <span className="text-sm text-fg">{item.name}</span>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        className="text-xs text-accent hover:underline disabled:cursor-not-allowed disabled:opacity-60"
                        onClick={() => openAccountManagerEditModal(item)}
                        disabled={crmUnavailable}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="text-xs text-rose hover:underline"
                        onClick={() =>
                          setDeleteTarget({ kind: 'accountManager', id: item.id, name: item.name })
                        }
                        disabled={crmUnavailable}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </>
            ) : (
              <Empty label="No account managers found." />
            )}
          </div>
        </Card>
        </div>
      </div>

      {serviceModalOpen ? (
        <ModalShell
          title={serviceModalTitle}
          subtitle="Manage service options used in orders."
          onClose={closeServiceModal}
        >
          <div className="space-y-4">
            <div>
              <label className="label-mono">Service Name</label>
              <input
                value={serviceName}
                onChange={(e) => setServiceName(e.target.value)}
                placeholder="e.g. Recycle"
                className="input-surface mt-1 w-full"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-secondary px-4 py-2 text-sm" onClick={closeServiceModal}>
                Cancel
              </button>
              <button type="button" className="btn-primary px-4 py-2 text-sm" onClick={() => void submitService()} disabled={saving}>
                {saving ? 'Saving...' : serviceEditing ? 'Update Service' : 'Create Service'}
              </button>
            </div>
          </div>
        </ModalShell>
      ) : null}

      {inventoryModalOpen ? (
        <ModalShell
          title={inventoryModalTitle}
          subtitle="Manage inventory type options used in orders."
          onClose={closeInventoryModal}
        >
          <div className="space-y-4">
            <div>
              <label className="label-mono">Inventory Type</label>
              <input
                value={inventoryName}
                onChange={(e) => setInventoryName(e.target.value)}
                placeholder="e.g. Laptop"
                className="input-surface mt-1 w-full"
              />
            </div>
            {inventoryName.trim().toLowerCase() !== 'dimensions' ? (
              <div>
                <label className="label-mono">Default Weight (lbs)</label>
                <input
                  value={inventoryWeight}
                  onChange={(e) => setInventoryWeight(e.target.value)}
                  placeholder="Optional"
                  className="input-surface mt-1 w-full"
                />
              </div>
            ) : null}
            <div>
              <label className="label-mono">Dimensions (L x W x H)</label>
              <div className="mt-1 grid grid-cols-3 gap-2">
                <input
                  value={inventoryLength}
                  onChange={(e) => setInventoryLength(e.target.value)}
                  placeholder="Length"
                  className="input-surface w-full"
                />
                <input
                  value={inventoryWidth}
                  onChange={(e) => setInventoryWidth(e.target.value)}
                  placeholder="Width"
                  className="input-surface w-full"
                />
                <input
                  value={inventoryHeight}
                  onChange={(e) => setInventoryHeight(e.target.value)}
                  placeholder="Height"
                  className="input-surface w-full"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-secondary px-4 py-2 text-sm" onClick={closeInventoryModal}>
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary px-4 py-2 text-sm"
                onClick={() => void submitInventoryType()}
                disabled={saving}
              >
                {saving ? 'Saving...' : inventoryEditing ? 'Update Inventory Type' : 'Create Inventory Type'}
              </button>
            </div>
          </div>
        </ModalShell>
      ) : null}

      {pickupByModalOpen ? (
        <ModalShell
          title={pickupByModalTitle}
          subtitle="Manage pickup assignee options used in inventory detail."
          onClose={closePickupByModal}
        >
          <div className="space-y-4">
            <div>
              <label className="label-mono">Pickup By Name</label>
              <input
                value={pickupByName}
                onChange={(e) => setPickupByName(e.target.value)}
                placeholder="e.g. HB Team"
                className="input-surface mt-1 w-full"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-secondary px-4 py-2 text-sm" onClick={closePickupByModal}>
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary px-4 py-2 text-sm"
                onClick={() => void submitPickupBy()}
                disabled={saving}
              >
                {saving ? 'Saving...' : pickupByEditing ? 'Update Pickup By' : 'Create Pickup By'}
              </button>
            </div>
          </div>
        </ModalShell>
      ) : null}

      {accountManagerModalOpen ? (
        <ModalShell
          title={accountManagerEditing ? 'Edit account manager' : 'Add account manager'}
          subtitle="Manage account managers used on order details."
          onClose={closeAccountManagerModal}
        >
          <div className="space-y-4">
            <div>
              <label className="label-mono">Account Manager</label>
              <input
                value={accountManagerName}
                onChange={(e) => setAccountManagerName(e.target.value)}
                placeholder="e.g. Jane Smith"
                className="input-surface mt-1 w-full"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-secondary px-4 py-2 text-sm" onClick={closeAccountManagerModal}>
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary px-4 py-2 text-sm"
                onClick={() => void submitAccountManager()}
                disabled={saving}
              >
                {saving ? 'Saving...' : accountManagerEditing ? 'Update Account Manager' : 'Create Account Manager'}
              </button>
            </div>
          </div>
        </ModalShell>
      ) : null}

      {industryModalOpen ? (
        <ModalShell
          title={industryEditing ? 'Edit industry type' : 'Add industry type'}
          subtitle="Manage industry types used on company records."
          onClose={closeIndustryModal}
        >
          <div className="space-y-4">
            <div>
              <label className="label-mono">Industry Type</label>
              <input
                value={industryName}
                onChange={(e) => setIndustryName(e.target.value)}
                placeholder="e.g. Technology"
                className="input-surface mt-1 w-full"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-secondary px-4 py-2 text-sm" onClick={closeIndustryModal}>
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary px-4 py-2 text-sm"
                onClick={() => void submitIndustryType()}
                disabled={saving}
              >
                {saving ? 'Saving...' : industryEditing ? 'Update Industry Type' : 'Create Industry Type'}
              </button>
            </div>
          </div>
        </ModalShell>
      ) : null}

      {deleteTarget ? (
        <ModalShell
          title="Confirm Delete"
          subtitle="This will soft-delete the record and hide it from active lists."
          onClose={() => setDeleteTarget(null)}
        >
          <div className="space-y-4">
            <div className="rounded-xl border border-divider bg-subtle px-4 py-3 text-sm text-fg">
              Delete <span className="font-semibold">{deleteTarget.name}</span>?
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-secondary px-4 py-2 text-sm" onClick={() => setDeleteTarget(null)}>
                Cancel
              </button>
              <button type="button" className="btn-primary px-4 py-2 text-sm" onClick={() => void confirmDelete()} disabled={saving}>
                {saving ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </ModalShell>
      ) : null}

      {crmUnavailable ? (
        <div className="rounded-xl border border-amber/30 bg-amber/10 px-4 py-3 text-sm text-amber">
          CRM APIs are not deployed in this testing environment yet. Settings CRUD is temporarily disabled.
        </div>
      ) : null}
    </div>
  );
}

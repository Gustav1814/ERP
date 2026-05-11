import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { motion } from 'motion/react';
import {
  ArrowLeft,
  Building2,
  Calendar,
  ChevronRight,
  Mail,
  MapPin,
  Phone,
  Search,
  User2,
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { fetchJson, fetchWithFallback } from '@/src/lib/api';
import { applyAccountManagerToCompany, accountManagerFromOrderPayload } from '@/src/lib/companyAccountManager';
import { hydrateCompany } from '@/src/lib/hydrateCompany';
import { useCompaniesSync } from '@/src/context/CompaniesSyncContext';
import { useCrmSharedData } from '@/src/context/CrmSharedDataContext';
import { type Company, type CompanyAddress, type ErpOrder } from '@/src/data/companies';
import { ModalFrame, Pill, TableCellPopover } from '@/src/components/ui';
import { OrderInventoryDetailPanel } from '@/src/components/order/OrderInventoryDetailPanel';
import { normalizeManualServices, stripEquipmentOnlyServiceLabel } from '@/src/lib/crmManualServices';
import {
  computeVolumeLbsFromOrderPayload,
} from '@/src/lib/orderInventoryVolume';

/** Pickup row in forms; `id` must be sent on save so the API updates existing rows (orders reference those ids). */
type PickupAddressFormRow = {
  id?: number;
  line1: string;
  line2: string;
  city: string;
  state: string;
  zip: string;
  country: string;
};

const emptyAddress = (): PickupAddressFormRow => ({
  line1: '',
  line2: '',
  city: '',
  state: '',
  zip: '',
  country: 'US',
});

function addressToPickupFormRow(address: CompanyAddress): PickupAddressFormRow {
  return {
    id: address.id,
    line1: address.line1 ?? '',
    line2: address.line2 ?? '',
    city: address.city ?? '',
    state: address.state ?? '',
    zip: address.zip ?? '',
    country: address.country ?? 'US',
  };
}

function pickupRowToApiPayload(row: PickupAddressFormRow) {
  const base = {
    line1: row.line1,
    line2: row.line2,
    city: row.city,
    state: row.state,
    zip: row.zip,
    country: normalizeCountryCode(row.country),
  };
  if (typeof row.id === 'number' && row.id > 0) {
    return { id: row.id, ...base };
  }
  return base;
}

function getCompanyOverallVolumeLbs(company: Company, weights: Map<string, number>): number {
  return company.orders.reduce((total, order) => {
    const payload = (order as ErpOrder & { crm_payload_json?: Record<string, unknown> | null })
      .crm_payload_json;
    const fromInv =
      payload && typeof payload === 'object' ? computeVolumeLbsFromOrderPayload(payload, weights) : 0;
    if (fromInv > 0) return total + fromInv;
    const q = Number(order.quantity);
    return Number.isFinite(q) && q > 0 ? total + q : total;
  }, 0);
}

export default function CompaniesPage() {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const { companies: companiesData, companiesLoaded, setCompanies: setCompaniesData } = useCompaniesSync();
  const { inventoryWeightByType } = useCrmSharedData();
  useEffect(() => {
    const syncFromHash = () => {
      if (typeof window === 'undefined') return;
      const raw = window.location.hash.replace(/^#\/?/, '').trim();
      const parts = raw.split('/').filter(Boolean);
      if (parts[0] !== 'companies') return;
      const companyId = Number(parts[1] ?? 0);
      const orderId = parts[2] === 'order' ? Number(parts[3] ?? 0) : 0;
      setSelectedId(Number.isFinite(companyId) && companyId > 0 ? companyId : null);
      setSelectedOrderId(Number.isFinite(orderId) && orderId > 0 ? orderId : null);
    };
    window.addEventListener('hashchange', syncFromHash);
    syncFromHash();
    return () => window.removeEventListener('hashchange', syncFromHash);
  }, []);

  const navigateCompaniesRoute = (companyId: number | null, orderId: number | null = null) => {
    if (typeof window === 'undefined') return;
    const next = companyId
      ? orderId
        ? `#/companies/${companyId}/order/${orderId}`
        : `#/companies/${companyId}`
      : '#/companies';
    if (window.location.hash !== next) {
      window.location.hash = next;
      return;
    }
    setSelectedId(companyId);
    setSelectedOrderId(orderId);
  };

  const [query, setQuery] = useState('');
  const [addressPreview, setAddressPreview] = useState<{
    companyName: string;
    address: CompanyAddress | null;
  } | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return companiesData;
    return companiesData.filter((c) =>
      [
        c.name,
        c.primary_email,
        c.primary_phone,
        c.primary_contact_name,
        c.project_manager,
        c.customer_type,
        c.lead_channel,
      ]
        .join(' ')
        .toLowerCase()
        .includes(q),
    );
  }, [query, companiesData]);

  const selected = useMemo(
    () => (selectedId != null ? companiesData.find((c) => c.id === selectedId) ?? null : null),
    [selectedId, companiesData],
  );
  const selectedOrder = useMemo(
    () =>
      selected && selectedOrderId != null
        ? selected.orders.find((order) => order.id === selectedOrderId) ?? null
        : null,
    [selected, selectedOrderId],
  );

  const handleCompanyUpdated = (updatedCompany: Company) => {
    const manager = String(updatedCompany.project_manager ?? '').trim();
    const nextCompany = manager
      ? applyAccountManagerToCompany(updatedCompany, manager)
      : updatedCompany;
    setCompaniesData((prev) =>
      prev.map((company) => (company.id === nextCompany.id ? nextCompany : company)),
    );
  };

  useEffect(() => {
    if (!companiesLoaded) return;
    if (selectedId != null && !selected) {
      navigateCompaniesRoute(null, null);
      return;
    }
    if (selected && selectedOrderId != null && !selectedOrder) {
      navigateCompaniesRoute(selected.id, null);
    }
  }, [companiesLoaded, selectedId, selected, selectedOrderId, selectedOrder]);

  if (selected && selectedOrder) {
    return (
      <OrderInventoryDetailPanel
        company={selected}
        order={selectedOrder}
        onBack={() => navigateCompaniesRoute(selected.id, null)}
        crossLinks={
          <a href="#/orders" className="btn-secondary px-3 py-1.5 text-xs">
            Orders
          </a>
        }
        onInventoryDetailSaved={(orderId, patch) => {
          const manager = accountManagerFromOrderPayload(patch.crm_payload_json ?? null);
          setCompaniesData((prev) =>
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
          setCompaniesData((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
        }}
      />
    );
  }

  if (selected && selectedOrderId != null && !selectedOrder) {
    return (
      <div className="glass-card p-6">
        <p className="text-sm text-muted">Unable to load order detail.</p>
        <button
          type="button"
          onClick={() => navigateCompaniesRoute(selected.id, null)}
          className="btn-secondary mt-3 text-sm"
        >
          Back
        </button>
      </div>
    );
  }

  if (selected) {
    return (
      <CompanyDetail
        company={selected}
        onBack={() => navigateCompaniesRoute(null, null)}
        onCompanyUpdated={handleCompanyUpdated}
        onOpenOrder={(orderId) => navigateCompaniesRoute(selected.id, orderId)}
      />
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="label-mono">Account Management</p>
          <h1 className="font-display mt-2 text-4xl font-bold leading-tight tracking-tight text-fg">
            Companies
          </h1>
          <p className="mt-2 max-w-xl text-sm text-muted">
            Browse companies and open a record for details.
          </p>
        </div>

        <div className="flex items-center gap-2 rounded-2xl border border-divider bg-subtle px-3.5 py-2.5">
          <Search size={16} className="text-muted" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by name, email, phone, PM..."
            className="w-[280px] bg-transparent text-sm text-fg outline-none placeholder:text-muted"
          />
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1120px] border-collapse text-sm">
            <colgroup>
              <col style={{ width: '18%' }} />
              <col style={{ width: '20%' }} />
              <col style={{ width: '13%' }} />
              <col style={{ width: '10%' }} />
              <col style={{ width: '14%' }} />
              <col style={{ width: '12%' }} />
              <col style={{ width: '12%' }} />
              <col style={{ width: '1%' }} />
            </colgroup>
            <thead>
              <tr className="border-b border-divider bg-subtle/60">
                <Th>Company</Th>
                <Th>Primary Contact</Th>
                <Th>Industry Type</Th>
                <Th>Pickups</Th>
                <Th>Latest Pickup</Th>
                <Th>Volume (lbs)</Th>
                <Th>Created</Th>
                <Th className="w-10" align="right" />
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-14 text-center text-sm text-muted">
                    No companies match the current search.
                  </td>
                </tr>
              ) : (
                filtered.map((company, idx) => {
                  const listAddress = getCompanyListDisplayAddress(company);
                  const pickupCount = company.orders.length;
                  const latestPickup = getLatestPickupDate(company.orders);
                  const latestPickupOrder = getLatestOrder(company.orders);
                  const overallVolume = Math.round(getCompanyOverallVolumeLbs(company, inventoryWeightByType));
                  return (
                    <tr
                      key={company.id}
                      onClick={() => navigateCompaniesRoute(company.id, null)}
                      className={cn(
                        'group cursor-pointer transition-colors duration-150 hover:bg-accent/[0.04]',
                        idx !== 0 && 'border-t border-divider',
                      )}
                    >
                      <Td>
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent transition-colors group-hover:bg-accent/20">
                            <Building2 size={16} strokeWidth={2} />
                          </div>
                          <div className="min-w-0">
                            <TableCellPopover
                              value={company.name || ''}
                              emptyLabel="—"
                              popoverTitle="Company"
                              textClassName="text-[13px] font-semibold"
                              minCharsForPopover={0}
                            />
                            <button
                              type="button"
                              className="mt-0.5 block max-w-[180px] truncate text-left text-xs leading-snug text-muted underline-offset-2 transition hover:text-accent hover:underline"
                              onClick={(event) => {
                                event.stopPropagation();
                                setAddressPreview({
                                  companyName: company.name,
                                  address: listAddress,
                                });
                              }}
                            >
                              {formatAddressInline(listAddress)}
                            </button>
                          </div>
                        </div>
                      </Td>
                      <Td>
                        <div className="min-w-0 space-y-0.5">
                          <p className="truncate text-[13px] font-medium leading-snug text-fg">{company.primary_contact_name || '—'}</p>
                          <p className="truncate text-xs leading-snug text-muted">{company.primary_email || '—'}</p>
                          <p className="truncate text-xs leading-snug text-muted">{formatPhone(company.primary_phone || '—')}</p>
                        </div>
                      </Td>
                      <Td>
                        <IndustryTypeBadge value={company.customer_type} />
                      </Td>
                      <Td>
                        <span className="text-[13px] font-semibold tabular-nums text-fg">{pickupCount}</span>
                      </Td>
                      <Td>
                        <div className="space-y-0.5">
                          <p className="whitespace-nowrap text-[13px] leading-snug text-fg">{latestPickup}</p>
                          <p className="truncate text-xs leading-snug text-muted">
                            {latestPickupOrder?.source_order_id || `#${latestPickupOrder?.id ?? '—'}`}
                          </p>
                        </div>
                      </Td>
                      <Td>
                        <span className="text-[13px] font-semibold tabular-nums text-fg">{overallVolume}</span>
                      </Td>
                      <Td>
                        <span className="inline-flex items-center gap-2 whitespace-nowrap text-xs text-muted">
                          {formatDate(company.created_at)}
                        </span>
                      </Td>
                      <Td align="right" className="pr-5">
                        <ChevronRight size={16} className="text-muted/60 transition-colors group-hover:text-accent" />
                      </Td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {addressPreview ? (
        <ModalFrame panelClassName="max-w-lg p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="label-mono">Primary Address</p>
              <h3 className="mt-1 text-lg font-semibold text-fg">{addressPreview.companyName}</h3>
            </div>
            <button
              type="button"
              className="btn-secondary px-3 py-1.5 text-xs"
              onClick={() => setAddressPreview(null)}
            >
              Close
            </button>
          </div>

          <div className="mt-4 rounded-xl border border-divider bg-subtle p-4">
            {addressPreview.address ? (
              <div className="space-y-1 text-sm text-fg">
                <p>{addressPreview.address.line1}</p>
                {addressPreview.address.line2 ? <p>{addressPreview.address.line2}</p> : null}
                <p>
                  {addressPreview.address.city}, {addressPreview.address.state} {addressPreview.address.zip}
                </p>
                <p>{addressPreview.address.country}</p>
              </div>
            ) : (
              <p className="text-sm text-muted">No primary address recorded.</p>
            )}
          </div>
        </ModalFrame>
      ) : null}
    </motion.div>
  );
}

function CompanyDetail({
  company,
  onBack,
  onCompanyUpdated,
  onOpenOrder,
}: {
  company: Company;
  onBack: () => void;
  onCompanyUpdated: (company: Company) => void;
  onOpenOrder: (orderId: number) => void;
}) {
  const { inventoryWeightByType, industryTypeNames, accountManagerNames } = useCrmSharedData();
  const billingAddress = company.addresses.find((address) => address.kind === 'billing') ?? null;
  const billingAddresses = billingAddress ? [billingAddress] : [];
  const pickupAddresses = company.addresses.filter((address) => address.kind === 'pickup');
  const companyUsers = getCompanyUsersForSelection(company);
  const latestOrder = getLatestOrder(company.orders);
  const matchedPickupAddress = latestOrder
    ? company.addresses.find((address) => address.id === latestOrder.pickup_address_id) ?? null
    : null;
  const lastPickupAddress =
    matchedPickupAddress ?? (company.orders.length === 1 && billingAddress ? billingAddress : null);
  const lastPickupAddresses = lastPickupAddress ? [lastPickupAddress] : [];
  const allOrderPickupAddresses = getPickupAddressesFromOrders(company);
  const [isPickupAddressesModalOpen, setIsPickupAddressesModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isEditingAttributes, setIsEditingAttributes] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingAttributes, setIsSavingAttributes] = useState(false);
  const [isEditingBillingAddress, setIsEditingBillingAddress] = useState(false);
  const [isEditingPickupAddresses, setIsEditingPickupAddresses] = useState(false);
  const [isSavingBillingAddress, setIsSavingBillingAddress] = useState(false);
  const [isSavingPickupAddresses, setIsSavingPickupAddresses] = useState(false);
  const [editError, setEditError] = useState('');
  const [attributesEditError, setAttributesEditError] = useState('');
  const [billingEditError, setBillingEditError] = useState('');
  const [pickupEditError, setPickupEditError] = useState('');
  const [editForm, setEditForm] = useState({
    name: company.name ?? '',
    primary_contact_user_id: resolvePrimaryContactUserId(companyUsers, company),
    primary_contact_name: company.primary_contact_name ?? '',
    project_manager: company.project_manager ?? '',
    primary_email: company.primary_email ?? '',
    primary_phone: company.primary_phone ?? '',
    customer_type: company.customer_type ?? '',
    is_new: getCompanyType(company) === 'New',
    lead_channel: company.lead_channel ?? '',
    hear_about_us: company.hear_about_us ?? '',
    billing: {
      line1: billingAddress?.line1 ?? '',
      line2: billingAddress?.line2 ?? '',
      city: billingAddress?.city ?? '',
      state: billingAddress?.state ?? '',
      zip: billingAddress?.zip ?? '',
      country: billingAddress?.country ?? 'US',
    },
    pickups: pickupAddresses.length
      ? pickupAddresses.map(addressToPickupFormRow)
      : [emptyAddress()],
  });
  const [billingForm, setBillingForm] = useState({
    line1: billingAddress?.line1 ?? '',
    line2: billingAddress?.line2 ?? '',
    city: billingAddress?.city ?? '',
    state: billingAddress?.state ?? '',
    zip: billingAddress?.zip ?? '',
    country: billingAddress?.country ?? 'US',
  });
  const [pickupForm, setPickupForm] = useState<PickupAddressFormRow[]>(
    pickupAddresses.length ? pickupAddresses.map(addressToPickupFormRow) : [emptyAddress()],
  );
  const latestPickupDate = getLatestPickupDate(company.orders);
  const overallVolumeLbs = Math.round(getCompanyOverallVolumeLbs(company, inventoryWeightByType));
  const industryOptions = useMemo(() => {
    const base = industryTypeNames.length ? industryTypeNames : getIndustryOptions(company.customer_type);
    const current = String(editForm.customer_type ?? company.customer_type ?? '').trim();
    if (current && !base.some((opt) => opt.toLowerCase() === current.toLowerCase())) {
      return [current, ...base];
    }
    return base;
  }, [industryTypeNames, company.customer_type, editForm.customer_type]);
  const accountManagerOptions = useMemo(() => {
    const base = accountManagerNames.length ? accountManagerNames : [];
    const current = String(editForm.project_manager ?? company.project_manager ?? '').trim();
    if (current && !base.some((opt) => opt.toLowerCase() === current.toLowerCase())) {
      return [current, ...base];
    }
    return base;
  }, [accountManagerNames, editForm.project_manager, company.project_manager]);

  useEffect(() => {
    setEditForm({
      name: company.name ?? '',
      primary_contact_user_id: resolvePrimaryContactUserId(companyUsers, company),
      primary_contact_name: company.primary_contact_name ?? '',
      project_manager: company.project_manager ?? '',
      primary_email: company.primary_email ?? '',
      primary_phone: company.primary_phone ?? '',
      customer_type: company.customer_type ?? '',
      is_new: getCompanyType(company) === 'New',
      lead_channel: company.lead_channel ?? '',
      hear_about_us: company.hear_about_us ?? '',
      billing: {
        line1: billingAddress?.line1 ?? '',
        line2: billingAddress?.line2 ?? '',
        city: billingAddress?.city ?? '',
        state: billingAddress?.state ?? '',
        zip: billingAddress?.zip ?? '',
        country: billingAddress?.country ?? 'US',
      },
      pickups: pickupAddresses.length
        ? pickupAddresses.map(addressToPickupFormRow)
        : [emptyAddress()],
    });
    setBillingForm({
      line1: billingAddress?.line1 ?? '',
      line2: billingAddress?.line2 ?? '',
      city: billingAddress?.city ?? '',
      state: billingAddress?.state ?? '',
      zip: billingAddress?.zip ?? '',
      country: billingAddress?.country ?? 'US',
    });
    setPickupForm(
      pickupAddresses.length ? pickupAddresses.map(addressToPickupFormRow) : [emptyAddress()],
    );
  }, [company]);

  useEffect(() => {
    setIsPickupAddressesModalOpen(false);
  }, [company.id]);

  const handleEditSave = async () => {
    setIsSaving(true);
    setEditError('');
    try {
      const payload = {
        name: editForm.name,
        primary_contact_user_id: editForm.primary_contact_user_id
          ? Number(editForm.primary_contact_user_id)
          : null,
        primary_contact_name: toNullableString(editForm.primary_contact_name),
        project_manager: editForm.project_manager,
        primary_email: toNullableEmail(editForm.primary_email),
        primary_phone: toNullableString(editForm.primary_phone),
        customer_type: toNullableString(editForm.customer_type),
        is_new: editForm.is_new,
        lead_channel: toNullableString(editForm.lead_channel),
        hear_about_us: toNullableString(editForm.hear_about_us),
        addresses: {
          billing: {
            ...editForm.billing,
            country: normalizeCountryCode(editForm.billing.country),
          },
          pickups: editForm.pickups
            .filter((pickup) => pickup.line1.trim() !== '')
            .map(pickupRowToApiPayload),
        },
      };
      const body = JSON.stringify(payload);
      const res = await fetchWithFallback(`/api/v1/crm/companies/${company.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body,
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(extractApiErrorMessage(errorData, 'Unable to save company changes.'));
      }
      const json = await res.json();
      const updated = hydrateCompany(json?.data ?? json);
      onCompanyUpdated(updated);
      setIsEditing(false);
    } catch (error) {
      setEditError(error instanceof Error ? error.message : 'Unable to save company changes.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAttributesSave = async () => {
    setIsSavingAttributes(true);
    setAttributesEditError('');
    try {
      const payload = {
        name: toNullableString(company.name) ?? toNullableString(editForm.name) ?? 'Unknown Company',
        primary_contact_name: toNullableString(company.primary_contact_name),
        primary_email: toNullableEmail(company.primary_email),
        primary_phone: toNullableString(company.primary_phone),
        customer_type: toNullableString(editForm.customer_type),
        project_manager: toNullableString(editForm.project_manager),
        lead_channel: toNullableString(company.lead_channel),
        hear_about_us: toNullableString(company.hear_about_us),
      };
      const body = JSON.stringify(payload);
      const res = await fetchWithFallback(`/api/v1/crm/companies/${company.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body,
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(extractApiErrorMessage(errorData, 'Unable to save account attributes.'));
      }
      const json = await res.json();
      const updated = hydrateCompany(json?.data ?? json);
      onCompanyUpdated(updated);
      setIsEditingAttributes(false);
    } catch (error) {
      setAttributesEditError(error instanceof Error ? error.message : 'Unable to save account attributes.');
    } finally {
      setIsSavingAttributes(false);
    }
  };

  const handleBillingAddressSave = async () => {
    setIsSavingBillingAddress(true);
    setBillingEditError('');
    try {
      const payload = {
        name: toNullableString(company.name) ?? toNullableString(editForm.name) ?? 'Unknown Company',
        primary_contact_name: toNullableString(company.primary_contact_name),
        primary_email: toNullableEmail(company.primary_email),
        primary_phone: toNullableString(company.primary_phone),
        customer_type: toNullableString(company.customer_type) ?? 'commercial',
        lead_channel: toNullableString(company.lead_channel),
        hear_about_us: toNullableString(company.hear_about_us),
        addresses: {
          billing: {
            line1: billingForm.line1,
            line2: billingForm.line2,
            city: billingForm.city,
            state: billingForm.state,
            zip: billingForm.zip,
            country: normalizeCountryCode(billingForm.country),
          },
        },
      };

      const res = await fetchWithFallback(`/api/v1/crm/companies/${company.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(extractApiErrorMessage(errorData, 'Unable to save billing address.'));
      }

      const json = await res.json();
      const updated = hydrateCompany(json?.data ?? json);
      onCompanyUpdated(updated);
      setIsEditingBillingAddress(false);
    } catch (error) {
      setBillingEditError(error instanceof Error ? error.message : 'Unable to save billing address.');
    } finally {
      setIsSavingBillingAddress(false);
    }
  };

  const handlePickupAddressesSave = async () => {
    setIsSavingPickupAddresses(true);
    setPickupEditError('');
    try {
      const payload = {
        name: toNullableString(company.name) ?? toNullableString(editForm.name) ?? 'Unknown Company',
        primary_contact_name: toNullableString(company.primary_contact_name),
        primary_email: toNullableEmail(company.primary_email),
        primary_phone: toNullableString(company.primary_phone),
        customer_type: toNullableString(company.customer_type) ?? 'commercial',
        lead_channel: toNullableString(company.lead_channel),
        hear_about_us: toNullableString(company.hear_about_us),
        addresses: {
          pickups: pickupForm.filter((pickup) => pickup.line1.trim() !== '').map(pickupRowToApiPayload),
        },
      };

      const res = await fetchWithFallback(`/api/v1/crm/companies/${company.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(extractApiErrorMessage(errorData, 'Unable to save pickup addresses.'));
      }

      const json = await res.json();
      const updated = hydrateCompany(json?.data ?? json);
      onCompanyUpdated(updated);
      setIsEditingPickupAddresses(false);
    } catch (error) {
      setPickupEditError(error instanceof Error ? error.message : 'Unable to save pickup addresses.');
    } finally {
      setIsSavingPickupAddresses(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-start gap-4">
          <button
            type="button"
            onClick={onBack}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-divider bg-subtle text-muted hover:text-fg"
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <p className="label-mono">Company #{company.id}</p>
            <h1 className="font-display mt-1 text-3xl font-bold leading-tight tracking-tight text-fg uppercase">
              {company.name}
            </h1>
            <p className="mt-1 text-sm text-muted">
              {company.primary_email} · {company.primary_phone}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            className="btn-secondary px-4 py-2 text-sm"
            onClick={() => {
              setIsEditing((prev) => !prev);
              setEditError('');
            }}
          >
            {isEditing ? 'Close Company Edit' : 'Edit Company'}
          </button>
        </div>
      </div>

      {isEditing ? (
        <div className="glass-card p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="label-mono">Edit Company</p>
              <h3 className="font-display mt-1 text-xl font-bold tracking-tight text-fg">Update company details</h3>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="btn-secondary px-3 py-1.5 text-xs"
                onClick={() => setIsEditing(false)}
                disabled={isSaving}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary px-3 py-1.5 text-xs"
                onClick={() => void handleEditSave()}
                disabled={isSaving}
              >
                {isSaving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
          {editError ? <p className="mt-3 text-xs text-rose">{editError}</p> : null}
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            <EditableField label="Company Name" value={editForm.name} onChange={(value) => setEditForm((prev) => ({ ...prev, name: value }))} />
            {companyUsers.length > 0 ? (
              <EditableSelectField
                label="Primary Contact User"
                value={editForm.primary_contact_user_id}
                options={companyUsers.map((user) => String(user.id))}
                getOptionLabel={(value) => {
                  const user = companyUsers.find((item) => String(item.id) === value);
                  if (!user) return value;
                  return user.name;
                }}
                onChange={(value) =>
                  setEditForm((prev) => applyPrimaryContactUser(prev, companyUsers, Number(value)))
                }
              />
            ) : null}
            <EditableField
              label="Primary Contact"
              value={editForm.primary_contact_name}
              disabled={companyUsers.length > 0}
              onChange={(value) => setEditForm((prev) => ({ ...prev, primary_contact_name: value }))}
            />
            <EditableField
              label="Email"
              value={editForm.primary_email}
              disabled={companyUsers.length > 0}
              onChange={(value) => setEditForm((prev) => ({ ...prev, primary_email: value }))}
            />
            <EditableField
              label="Phone"
              value={editForm.primary_phone}
              disabled={companyUsers.length > 0}
              onChange={(value) => setEditForm((prev) => ({ ...prev, primary_phone: value }))}
            />
            <EditableSelectField
              label="Industry Type"
              value={editForm.customer_type}
              options={industryOptions}
              placeholder="Select industry type"
              onChange={(value) => setEditForm((prev) => ({ ...prev, customer_type: value }))}
            />
            {accountManagerOptions.length > 0 ? (
              <EditableSelectField
                label="Account Manager"
                value={editForm.project_manager}
                options={accountManagerOptions}
                placeholder="Select account manager"
                onChange={(value) => setEditForm((prev) => ({ ...prev, project_manager: value }))}
              />
            ) : (
              <EditableField
                label="Account Manager"
                value={editForm.project_manager}
                onChange={(value) => setEditForm((prev) => ({ ...prev, project_manager: value }))}
              />
            )}
            <EditableField label="Hear About Us" value={editForm.hear_about_us} onChange={(value) => setEditForm((prev) => ({ ...prev, hear_about_us: value }))} />
          </div>
          <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
            <div>
              <p className="label-mono">Billing Address</p>
              <div className="mt-3 grid grid-cols-1 gap-3">
                <EditableField label="Line 1" value={editForm.billing.line1} onChange={(value) => setEditForm((prev) => ({ ...prev, billing: { ...prev.billing, line1: value } }))} />
                <EditableField label="Line 2" value={editForm.billing.line2 || ''} onChange={(value) => setEditForm((prev) => ({ ...prev, billing: { ...prev.billing, line2: value } }))} />
                <EditableField label="City" value={editForm.billing.city} onChange={(value) => setEditForm((prev) => ({ ...prev, billing: { ...prev.billing, city: value } }))} />
                <EditableField label="State" value={editForm.billing.state} onChange={(value) => setEditForm((prev) => ({ ...prev, billing: { ...prev.billing, state: value } }))} />
                <EditableField label="ZIP" value={editForm.billing.zip} onChange={(value) => setEditForm((prev) => ({ ...prev, billing: { ...prev.billing, zip: value } }))} />
                <EditableField label="Country" value={editForm.billing.country} onChange={(value) => setEditForm((prev) => ({ ...prev, billing: { ...prev.billing, country: value } }))} />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between gap-3">
                <p className="label-mono">Pickup Addresses</p>
                <button
                  type="button"
                  className="btn-secondary px-3 py-1.5 text-xs"
                  onClick={() =>
                    setEditForm((prev) => ({
                      ...prev,
                      pickups: [...prev.pickups, emptyAddress()],
                    }))
                  }
                >
                  Add pickup
                </button>
              </div>
              <div className="mt-3 space-y-4">
                {editForm.pickups.map((pickup, index) => (
                  <div key={`pickup-${index}`} className="rounded-xl border border-divider p-3">
                    <div className="mb-3 flex items-center justify-between">
                      <p className="label-mono">Pickup #{index + 1}</p>
                      {editForm.pickups.length > 1 ? (
                        <button
                          type="button"
                          className="text-xs text-rose hover:underline"
                          onClick={() =>
                            setEditForm((prev) => ({
                              ...prev,
                              pickups: prev.pickups.filter((_, i) => i !== index),
                            }))
                          }
                        >
                          Remove
                        </button>
                      ) : null}
                    </div>
                    <div className="grid grid-cols-1 gap-3">
                      <EditableField label="Line 1" value={pickup.line1} onChange={(value) => setEditForm((prev) => ({ ...prev, pickups: prev.pickups.map((item, i) => (i === index ? { ...item, line1: value } : item)) }))} />
                      <EditableField label="Line 2" value={pickup.line2 || ''} onChange={(value) => setEditForm((prev) => ({ ...prev, pickups: prev.pickups.map((item, i) => (i === index ? { ...item, line2: value } : item)) }))} />
                      <EditableField label="City" value={pickup.city} onChange={(value) => setEditForm((prev) => ({ ...prev, pickups: prev.pickups.map((item, i) => (i === index ? { ...item, city: value } : item)) }))} />
                      <EditableField label="State" value={pickup.state} onChange={(value) => setEditForm((prev) => ({ ...prev, pickups: prev.pickups.map((item, i) => (i === index ? { ...item, state: value } : item)) }))} />
                      <EditableField label="ZIP" value={pickup.zip} onChange={(value) => setEditForm((prev) => ({ ...prev, pickups: prev.pickups.map((item, i) => (i === index ? { ...item, zip: value } : item)) }))} />
                      <EditableField label="Country" value={pickup.country} onChange={(value) => setEditForm((prev) => ({ ...prev, pickups: prev.pickups.map((item, i) => (i === index ? { ...item, country: value } : item)) }))} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <div className="glass-card p-6 xl:col-span-5">
          <div className="flex items-center gap-2">
            <User2 size={14} className="text-accent" />
            <p className="label-mono">Primary Contact</p>
          </div>
          <h3 className="font-display mt-3 text-2xl font-bold tracking-tight text-fg">
            {company.primary_contact_name}
          </h3>

          <div className="mt-5 grid grid-cols-1 gap-3">
            <InfoRow icon={Mail} label="Email" value={company.primary_email} />
            <InfoRow icon={Phone} label="Phone" value={formatPhone(company.primary_phone)} />
            <InfoRow icon={Calendar} label="Created" value={formatDate(company.created_at)} />
          </div>
        </div>

        <div className="glass-card p-6 xl:col-span-7">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Building2 size={14} className="text-accent" />
              <p className="label-mono">Account Attributes</p>
            </div>
            <button
              type="button"
              className="btn-secondary px-3 py-1.5 text-xs"
              onClick={() => {
                setIsEditingAttributes(true);
                setAttributesEditError('');
              }}
            >
              Edit Account Attributes
            </button>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <AttrTile label="Industry Type" value={company.customer_type || '—'} />
            <AttrTile label="Account Manager" value={company.project_manager || '—'} />
            <AttrTile label="Number of Pickups" value={String(company.orders.length)} />
            <AttrTile label="Latest Pickup" value={latestPickupDate} />
            <AttrTile label="Overall Volume" value={`${overallVolumeLbs} lbs`} />
            <AttrTile label="Total Orders" value={String(company.orders.length)} />
          </div>
        </div>
      </div>

      {isEditingAttributes ? (
        <ModalFrame panelClassName="max-w-2xl p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="label-mono">Edit Account Attributes</p>
              <h3 className="font-display mt-1 text-xl font-bold tracking-tight text-fg">
                Update company account attributes
              </h3>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="btn-secondary px-3 py-1.5 text-xs"
                onClick={() => setIsEditingAttributes(false)}
                disabled={isSavingAttributes}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary px-3 py-1.5 text-xs"
                onClick={() => void handleAttributesSave()}
                disabled={isSavingAttributes}
              >
                {isSavingAttributes ? 'Saving...' : 'Save Attributes'}
              </button>
            </div>
          </div>
          {attributesEditError ? <p className="mt-3 text-xs text-rose">{attributesEditError}</p> : null}
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            <EditableSelectField
              label="Industry Type"
              value={editForm.customer_type}
              options={industryOptions}
              placeholder="Select industry type"
              onChange={(value) => setEditForm((prev) => ({ ...prev, customer_type: value }))}
            />
            {accountManagerOptions.length > 0 ? (
              <EditableSelectField
                label="Account Manager"
                value={editForm.project_manager}
                options={accountManagerOptions}
                placeholder="Select account manager"
                onChange={(value) => setEditForm((prev) => ({ ...prev, project_manager: value }))}
              />
            ) : (
              <EditableField
                label="Account Manager"
                value={editForm.project_manager}
                onChange={(value) => setEditForm((prev) => ({ ...prev, project_manager: value }))}
              />
            )}
          </div>
        </ModalFrame>
      ) : null}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <AddressCard
          title="Billing Address"
          addresses={billingAddresses}
          onEdit={() => {
            setBillingEditError('');
            setIsEditingBillingAddress(true);
          }}
        />
        <LastPickupAddressCard
          addresses={lastPickupAddresses}
          onView={() => setIsPickupAddressesModalOpen(true)}
          onEdit={() => {
            setPickupEditError('');
            setIsEditingPickupAddresses(true);
          }}
        />
      </div>

      {isEditingBillingAddress ? (
        <ModalFrame panelClassName="max-w-2xl p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="label-mono">Edit Billing Address</p>
              <h3 className="font-display mt-1 text-xl font-bold tracking-tight text-fg">
                Update billing address
              </h3>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="btn-secondary px-3 py-1.5 text-xs"
                onClick={() => setIsEditingBillingAddress(false)}
                disabled={isSavingBillingAddress}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary px-3 py-1.5 text-xs"
                onClick={() => void handleBillingAddressSave()}
                disabled={isSavingBillingAddress}
              >
                {isSavingBillingAddress ? 'Saving...' : 'Save Address'}
              </button>
            </div>
          </div>
          {billingEditError ? <p className="mt-3 text-xs text-rose">{billingEditError}</p> : null}
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
            <EditableField label="Line 1" value={billingForm.line1} onChange={(value) => setBillingForm((prev) => ({ ...prev, line1: value }))} />
            <EditableField label="Line 2" value={billingForm.line2 || ''} onChange={(value) => setBillingForm((prev) => ({ ...prev, line2: value }))} />
            <EditableField label="City" value={billingForm.city} onChange={(value) => setBillingForm((prev) => ({ ...prev, city: value }))} />
            <EditableField label="State" value={billingForm.state} onChange={(value) => setBillingForm((prev) => ({ ...prev, state: value }))} />
            <EditableField label="ZIP" value={billingForm.zip} onChange={(value) => setBillingForm((prev) => ({ ...prev, zip: value }))} />
            <EditableField label="Country" value={billingForm.country} onChange={(value) => setBillingForm((prev) => ({ ...prev, country: value }))} />
          </div>
        </ModalFrame>
      ) : null}

      {isEditingPickupAddresses ? (
        <ModalFrame panelClassName="max-w-3xl p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="label-mono">Edit Pickup Addresses</p>
              <h3 className="font-display mt-1 text-xl font-bold tracking-tight text-fg">
                Add or update pickup addresses
              </h3>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="btn-secondary px-3 py-1.5 text-xs"
                onClick={() => setIsEditingPickupAddresses(false)}
                disabled={isSavingPickupAddresses}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary px-3 py-1.5 text-xs"
                onClick={() => void handlePickupAddressesSave()}
                disabled={isSavingPickupAddresses}
              >
                {isSavingPickupAddresses ? 'Saving...' : 'Save Pickup Addresses'}
              </button>
            </div>
          </div>
          {pickupEditError ? <p className="mt-3 text-xs text-rose">{pickupEditError}</p> : null}
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              className="btn-secondary px-3 py-1.5 text-xs"
              onClick={() => setPickupForm((prev) => [...prev, emptyAddress()])}
            >
              Add Pickup
            </button>
          </div>
          <div className="mt-4 space-y-4">
            {pickupForm.map((pickup, index) => (
              <div key={`pickup-edit-${index}`} className="rounded-xl border border-divider p-3">
                <div className="mb-3 flex items-center justify-between">
                  <p className="label-mono">Pickup #{index + 1}</p>
                  {pickupForm.length > 1 ? (
                    <button
                      type="button"
                      className="text-xs text-rose hover:underline"
                      onClick={() =>
                        setPickupForm((prev) => prev.filter((_, i) => i !== index))
                      }
                    >
                      Remove
                    </button>
                  ) : null}
                </div>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <EditableField label="Line 1" value={pickup.line1} onChange={(value) => setPickupForm((prev) => prev.map((item, i) => (i === index ? { ...item, line1: value } : item)))} />
                  <EditableField label="Line 2" value={pickup.line2 || ''} onChange={(value) => setPickupForm((prev) => prev.map((item, i) => (i === index ? { ...item, line2: value } : item)))} />
                  <EditableField label="City" value={pickup.city} onChange={(value) => setPickupForm((prev) => prev.map((item, i) => (i === index ? { ...item, city: value } : item)))} />
                  <EditableField label="State" value={pickup.state} onChange={(value) => setPickupForm((prev) => prev.map((item, i) => (i === index ? { ...item, state: value } : item)))} />
                  <EditableField label="ZIP" value={pickup.zip} onChange={(value) => setPickupForm((prev) => prev.map((item, i) => (i === index ? { ...item, zip: value } : item)))} />
                  <EditableField label="Country" value={pickup.country} onChange={(value) => setPickupForm((prev) => prev.map((item, i) => (i === index ? { ...item, country: value } : item)))} />
                </div>
              </div>
            ))}
          </div>
        </ModalFrame>
      ) : null}

      {isPickupAddressesModalOpen ? (
        <ModalFrame panelClassName="max-w-2xl p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="label-mono">Pickup Addresses</p>
              <p className="mt-1 text-xs text-muted">Sorted latest to oldest.</p>
            </div>
            <button
              type="button"
              className="btn-secondary px-3 py-1.5 text-xs"
              onClick={() => setIsPickupAddressesModalOpen(false)}
            >
              Close
            </button>
          </div>
          <div className="mt-4 space-y-3">
              {allOrderPickupAddresses.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-divider bg-subtle p-4 text-sm text-muted">
                  None recorded.
                </div>
              ) : (
                allOrderPickupAddresses.map((address) => (
                  <div key={address.id} className="rounded-2xl border border-divider bg-subtle p-4">
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-muted">Address #{address.id}</p>
                      <Pill tone="neutral">{address.kind}</Pill>
                    </div>
                    <p className="mt-2 text-sm font-medium leading-relaxed text-fg">
                      {address.line1}
                      {address.line2 ? <>, {address.line2}</> : null}
                    </p>
                    <p className="text-sm text-muted">
                      {address.city}, {address.state} {address.zip} · {address.country}
                    </p>
                  </div>
                ))
              )}
          </div>
        </ModalFrame>
      ) : null}

      <div className="glass-card overflow-hidden">
        <div className="flex items-center gap-2 px-6 pt-5">
          <Building2 size={14} className="text-accent" />
          <p className="label-mono">List of Orders</p>
        </div>
        <div className="mt-4 overflow-x-auto pb-2">
          <table className="w-full min-w-[1300px] table-fixed border-collapse text-sm">
            <thead className="bg-subtle/60">
              <tr>
                <Th className="w-[10%] px-3">Order ID</Th>
                <Th className="w-[14%] px-3">User</Th>
                <Th className="w-[18%] px-3">User Email</Th>
                <Th className="w-[12%] px-3">User Phone</Th>
                <Th className="w-[16%] px-3">Pickup Address</Th>
                <Th className="w-[10%] px-3">Pickup Date</Th>
                <Th className="w-[10%] px-3">Pickup Summary</Th>
                <Th className="w-[10%] px-3">Inventory Details</Th>
              </tr>
            </thead>
            <tbody>
              {company.orders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-10 text-center text-sm text-muted">
                    No orders found for this company.
                  </td>
                </tr>
              ) : (
                company.orders.map((order) => {
                  const user = getOrderCompanyUser(company, order);
                  const pickupAddress = getAddressLabelById(company, order.pickup_address_id);
                  return (
                    <tr key={order.id} className="border-t border-divider hover:bg-subtle">
                      <Td className="align-middle px-3">
                        <div className="truncate font-semibold text-fg" title={order.source_order_id || '—'}>
                          {order.source_order_id || '—'}
                        </div>
                      </Td>
                      <Td className="align-middle px-3">
                        <div className="truncate" title={user.name}>
                          {user.name}
                        </div>
                      </Td>
                      <Td className="align-middle px-3">
                        <div className="truncate" title={user.email}>
                          {user.email}
                        </div>
                      </Td>
                      <Td className="align-middle whitespace-nowrap px-3">{formatPhone(user.phone)}</Td>
                      <Td className="align-middle px-3">
                        <TableCellPopover
                          value={pickupAddress}
                          emptyLabel="—"
                          popoverTitle="Pickup address"
                          minCharsForPopover={0}
                          className="w-full"
                          textClassName="text-[13px]"
                        />
                      </Td>
                      <Td className="align-middle whitespace-nowrap px-3">{order.pickup_date ? formatDate(order.pickup_date) : '—'}</Td>
                      <Td className="align-middle px-3">
                        {(() => {
                          const summary = getPickupSummary(order);
                          return (
                            <TableCellPopover
                              value={summary.full}
                              previewValue={summary.preview}
                              emptyLabel="—"
                              popoverTitle="Pickup Summary"
                              minCharsForPopover={0}
                              className="w-full"
                              textClassName="text-[13px]"
                            />
                          );
                        })()}
                      </Td>
                      <Td className="align-middle px-3">
                        <button
                          type="button"
                          className="text-xs font-semibold text-accent hover:underline"
                          onClick={() => onOpenOrder(order.id)}
                        >
                          View inventory details
                        </button>
                      </Td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </motion.div>
  );
}

function getCompanyType(company: Company): 'New' | 'Existing' {
  const companyWithFlags = company as Company & { is_new?: boolean | number | null };
  const isNew = companyWithFlags.is_new === true || companyWithFlags.is_new === 1;
  return isNew ? 'New' : 'Existing';
}

function renderOrderRow(order: ErpOrder, onViewDetails: () => void) {
  const pickupTone =
    order.pickup_cost_status === 'approved'
      ? 'emerald'
      : order.pickup_cost_status === 'rejected'
        ? 'rose'
        : 'amber';
  const qualifyTone =
    order.qualify_status === 'qualified'
      ? 'emerald'
      : order.qualify_status === 'pending'
        ? 'amber'
        : 'rose';
  const statusTone = orderStatusTone(order.status);

  return (
    <tr key={order.id} className="border-t border-divider hover:bg-subtle">
      <Td>
        <div className="font-semibold text-fg">#{order.id}</div>
        <div className="text-xs text-muted">{order.source_order_id}</div>
      </Td>
      <Td>
        <div className="text-xs text-muted">lead</div>
        <div className="font-medium text-fg">{order.source_lead_id}</div>
      </Td>
      <Td>
        {order.services.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {order.services.map((service) => (
              <Fragment key={service}>
                <Pill tone="indigo">{service}</Pill>
              </Fragment>
            ))}
          </div>
        ) : (
          <span className="text-sm font-medium text-muted">none</span>
        )}
      </Td>
      <Td>{formatMoney(order.estimate_value)}</Td>
      <Td>
        <div className="font-medium text-fg">{formatMoney(order.pickup_cost)}</div>
        <Pill tone={pickupTone} className="mt-1">
          {order.pickup_cost_status}
        </Pill>
      </Td>
      <Td>
        <Pill tone={qualifyTone}>{order.qualify_status}</Pill>
      </Td>
      <Td>
        <Pill tone={statusTone}>{order.status.replace('_', ' ')}</Pill>
      </Td>
      <Td>
        <div className="text-xs text-muted">start</div>
        <div className="font-medium text-fg">{order.start_date ? formatDate(order.start_date) : '—'}</div>
        <div className="mt-1 text-xs text-muted">pickup {order.pickup_date ? formatDate(order.pickup_date) : '—'}</div>
      </Td>
      <Td>
        <button
          type="button"
          className="text-xs font-semibold text-accent hover:underline"
          onClick={onViewDetails}
        >
          View details
        </button>
      </Td>
    </tr>
  );
}


function AddressCard({
  title,
  addresses,
  onEdit,
}: {
  title: string;
  addresses: CompanyAddress[];
  onEdit?: () => void;
}) {
  return (
    <div className="glass-card p-6">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <MapPin size={14} className="text-accent" />
          <p className="label-mono">{title}</p>
        </div>
        {onEdit ? (
          <button type="button" className="text-xs font-semibold text-accent hover:underline" onClick={onEdit}>
            Edit
          </button>
        ) : null}
      </div>

      <div className="mt-4 space-y-3">
        {addresses.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-divider bg-subtle p-4 text-sm text-muted">
            None recorded.
          </div>
        ) : (
          addresses.map((address) => (
            <div key={address.id} className="rounded-2xl border border-divider bg-subtle p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted">Address #{address.id}</p>
                <Pill tone="neutral">{address.kind}</Pill>
              </div>
              <p className="mt-2 text-sm font-medium leading-relaxed text-fg">
                {address.line1}
                {address.line2 ? <>, {address.line2}</> : null}
              </p>
              <p className="text-sm text-muted">
                {address.city}, {address.state} {address.zip} · {address.country}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function LastPickupAddressCard({
  addresses,
  onView,
  onEdit,
}: {
  addresses: CompanyAddress[];
  onView: () => void;
  onEdit: () => void;
}) {
  return (
    <div className="glass-card p-6">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <MapPin size={14} className="text-accent" />
          <p className="label-mono">Last Pick Up Address</p>
        </div>
        <div className="flex items-center gap-3">
          <button type="button" className="text-xs font-semibold text-accent hover:underline" onClick={onEdit}>
            Edit
          </button>
          <button type="button" className="text-xs font-semibold text-accent hover:underline" onClick={onView}>
            View
          </button>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {addresses.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-divider bg-subtle p-4 text-sm text-muted">
            None recorded.
          </div>
        ) : (
          addresses.map((address) => (
            <div key={address.id} className="rounded-2xl border border-divider bg-subtle p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted">Address #{address.id}</p>
                <Pill tone="neutral">{address.kind}</Pill>
              </div>
              <p className="mt-2 text-sm font-medium leading-relaxed text-fg">
                {address.line1}
                {address.line2 ? <>, {address.line2}</> : null}
              </p>
              <p className="text-sm text-muted">
                {address.city}, {address.state} {address.zip} · {address.country}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: typeof Mail; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-divider bg-subtle px-3 py-2.5">
      <Icon size={14} className="text-muted" />
      <div className="min-w-0">
        <p className="label-mono">{label}</p>
        <p className="truncate text-sm text-fg">{value}</p>
      </div>
    </div>
  );
}

function AttrTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-divider bg-subtle p-3">
      <p className="label-mono">{label}</p>
      <p className="font-display mt-2 break-words text-base font-semibold capitalize leading-snug tracking-tight text-fg sm:text-lg">
        {value}
      </p>
    </div>
  );
}

function EditableField({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="label-mono">{label}</span>
      <input
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className={cn('input-surface mt-2 w-full', disabled ? 'cursor-not-allowed opacity-70' : '')}
      />
    </label>
  );
}

function EditableSelectField({
  label,
  value,
  options,
  placeholder,
  getOptionLabel,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  placeholder?: string;
  getOptionLabel?: (value: string) => string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="label-mono">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="input-surface mt-2 w-full"
      >
        {placeholder ? (
          <option value="">{placeholder}</option>
        ) : null}
        {options.map((option) => (
          <option key={option} value={option}>
            {getOptionLabel ? getOptionLabel(option) : toLabel(option)}
          </option>
        ))}
      </select>
    </label>
  );
}

function Th({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <th className={cn('whitespace-nowrap px-6 py-3.5 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-muted', className)}>
      {children}
    </th>
  );
}

function Td({ children, className }: { children: ReactNode; className?: string }) {
  return <td className={cn('px-6 py-4 align-middle text-fg', className)}>{children}</td>;
}

function formatDate(input: string) {
  try {
    const d = new Date(input);
    return d.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
  } catch {
    return input;
  }
}

function formatMoney(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

function orderStatusTone(status: ErpOrder['status']) {
  switch (status) {
    case 'completed':
      return 'emerald' as const;
    case 'in_progress':
      return 'sky' as const;
    case 'new':
      return 'accent' as const;
    case 'cancelled':
      return 'rose' as const;
    default:
      return 'neutral' as const;
  }
}

function getLatestPickupDate(orders: ErpOrder[]) {
  const latest = [...orders]
    .filter((order) => Boolean(order.pickup_date))
    .sort((a, b) => new Date(b.pickup_date).getTime() - new Date(a.pickup_date).getTime())[0];
  return latest?.pickup_date ? formatDate(latest.pickup_date) : '—';
}

function getLatestOrder(orders: ErpOrder[]) {
  return [...orders].sort((a, b) => {
    const aTime = new Date(a.created_at || a.pickup_date || '').getTime();
    const bTime = new Date(b.created_at || b.pickup_date || '').getTime();
    return bTime - aTime;
  })[0];
}

function getCompanyListDisplayAddress(company: Company): CompanyAddress | null {
  const billingAddress = company.addresses.find((address) => address.kind === 'billing') ?? null;
  if (billingAddress?.line1?.trim()) return billingAddress;

  const latestPickupOrder = getLastPickupOrder(company.orders);
  if (!latestPickupOrder?.pickup_address_id) return null;

  return company.addresses.find((address) => address.id === latestPickupOrder.pickup_address_id) ?? null;
}

function getLastPickupOrder(orders: ErpOrder[]) {
  const byPickupDate = [...orders]
    .filter((order) => Boolean(order.pickup_date))
    .sort((a, b) => new Date(b.pickup_date).getTime() - new Date(a.pickup_date).getTime())[0];
  return byPickupDate ?? getLatestOrder(orders);
}

function getPickupAddressesFromOrders(company: Company): CompanyAddress[] {
  const latestOrders = [...company.orders].sort((a, b) => {
    const aTime = new Date(a.created_at || a.pickup_date || '').getTime();
    const bTime = new Date(b.created_at || b.pickup_date || '').getTime();
    return bTime - aTime;
  });
  const seen = new Set<number>();
  const resolved: CompanyAddress[] = [];
  for (const order of latestOrders) {
    const addressId = order.pickup_address_id;
    if (!addressId || seen.has(addressId)) continue;
    const address = company.addresses.find((item) => item.id === addressId);
    if (!address) continue;
    seen.add(addressId);
    resolved.push(address);
  }
  return resolved;
}

function formatAddressInline(address: CompanyAddress | null) {
  if (!address) return '—';
  return `${address.line1}${address.line2 ? `, ${address.line2}` : ''}, ${address.city}, ${address.state} ${address.zip}, ${address.country}`;
}

function getAddressLabelById(company: Company, addressId: number | null | undefined) {
  if (addressId == null || addressId === 0) return '—';
  const address = company.addresses.find((item) => item.id === addressId) ?? null;
  return formatAddressInline(address);
}

function getPickupSummary(order: ErpOrder): { preview: string; full: string } {
  const payload = (order as any).crm_payload_json;
  const detail = payload?.inventory_detail ?? payload;
  const rs = detail?.rough_summary;
  const lines: Array<{ device_type: string; count: string; weight_lbs?: string }> = Array.isArray(rs?.lines) ? rs.lines : [];

  // Build device list from rough summary if available
  const devices = lines
    .filter((l: any) => l.device_type)
    .map((l: any) => {
      const ct = l.count ? `×${l.count}` : '';
      return `${l.device_type}${ct}`;
    });

  // Fallback to type_of_equipment
  const equipmentLabel = devices.length > 0 ? devices.join(', ') : (order.type_of_equipment || '—');

  // Total weight
  let totalLbs = 0;
  for (const l of lines) {
    const w = Number(l.weight_lbs ?? 0);
    if (Number.isFinite(w)) totalLbs += w;
  }
  const weightStr = totalLbs > 0 ? `${totalLbs} lbs` : '';

  const preview = equipmentLabel.length > 40
    ? equipmentLabel.slice(0, 38) + '…'
    : equipmentLabel;

  const parts = [equipmentLabel, weightStr].filter(Boolean);
  return { preview, full: parts.join(' · ') };
}

function getOrderCompanyUser(company: Company, order: ErpOrder) {
  const orderWithUser = order as ErpOrder & { company_user_id?: number | null };
  const matchedUser = (company.users ?? []).find((user) => user.id === orderWithUser.company_user_id);
  if (matchedUser) {
    return {
      name: matchedUser.name || '—',
      email: matchedUser.email || '—',
      phone: matchedUser.phone || '—',
    };
  }
  return {
    name: company.primary_contact_name || '—',
    email: company.primary_email || '—',
    phone: company.primary_phone || '—',
  };
}

function normalizeCertificateItems(
  items: any[],
): Array<{ name: string; url?: string; path?: string | null }> {
  const map = new Map<string, { name: string; url?: string; path?: string | null }>();

  for (const item of items) {
    let next: { name: string; url?: string; path?: string | null } | null = null;
    if (typeof item === 'string') {
      const name = item.trim();
      if (!name) continue;
      next = { name };
    } else if (item && typeof item === 'object') {
      const name = String(item.name ?? '').trim();
      const url = String(item.url ?? '').trim();
      const path = String(item.path ?? '').trim();
      if (!name && !url && !path) continue;
      next = {
        name: name || (path ? path.split('/').pop() || 'certificate.pdf' : 'certificate.pdf'),
        url: url || undefined,
        path: path || null,
      };
    }
    if (!next) continue;
    const key = next.name.trim().toLowerCase();
    if (!key) continue;
    const existing = map.get(key);
    if (!existing) {
      map.set(key, next);
      continue;
    }
    const existingHasUrl = Boolean(existing.url);
    const nextHasUrl = Boolean(next.url);
    if (!existingHasUrl && nextHasUrl) {
      map.set(key, next);
      continue;
    }
    const existingHasPath = Boolean(existing.path);
    const nextHasPath = Boolean(next.path);
    if (!existingHasPath && nextHasPath) {
      map.set(key, next);
    }
  }

  return Array.from(map.values());
}

function formatPhone(phone: string) {
  const raw = (phone || '').trim();
  if (!raw || raw === '—') return '—';
  const keepPlus = raw.startsWith('+');
  const digits = raw.replace(/\D/g, '');

  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  if (keepPlus) {
    return `+${digits}`;
  }
  return digits || raw;
}

function getIndustryOptions(crmIndustry: string) {
  const normalized = crmIndustry?.trim().toLowerCase();
  const base = [
    'automotive',
    'banking',
    'construction',
    'education',
    'energy',
    'finance',
    'government',
    'healthcare',
    'hospitality',
    'insurance',
    'logistics',
    'manufacturing',
    'retail',
    'technology',
    'telecommunications',
  ];
  if (normalized && !base.includes(normalized)) {
    return [normalized, ...base];
  }
  return base;
}

function toLabel(value: string) {
  if (!value) return '—';
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatIndustryType(value: string) {
  const normalized = (value || '').trim().toLowerCase();
  if (!normalized || normalized === 'new' || normalized === 'existing') {
    return '—';
  }
  return toLabel(normalized);
}

function IndustryTypeBadge({ value }: { value: string }) {
  const normalized = (value || '').trim().toLowerCase();
  const label = formatIndustryType(value);
  const dotClass =
    normalized === 'commercial'
      ? 'bg-sky'
      : normalized === 'residential'
        ? 'bg-emerald'
        : 'bg-muted';

  return (
    <span className="inline-flex items-center gap-2 rounded-lg border border-divider bg-subtle px-2.5 py-1 text-xs font-semibold text-fg">
      <span className={cn('h-1.5 w-1.5 rounded-full', dotClass)} />
      {label}
    </span>
  );
}

function toNullableString(value: string) {
  const trimmed = (value || '').trim();
  return trimmed === '' ? null : trimmed;
}

function toNullableEmail(value: string) {
  const trimmed = (value || '').trim();
  return trimmed === '' ? null : trimmed;
}

function normalizeCountryCode(value: string) {
  const trimmed = (value || '').trim();
  if (!trimmed) return 'US';
  return trimmed.toUpperCase().slice(0, 2);
}

function extractApiErrorMessage(errorData: any, fallback: string) {
  const message = typeof errorData?.message === 'string' ? errorData.message : '';
  const errors = errorData?.errors && typeof errorData.errors === 'object' ? errorData.errors : null;
  if (!errors) {
    return message || fallback;
  }
  const firstFieldErrors = Object.values(errors).find((value) => Array.isArray(value) && value.length > 0) as
    | string[]
    | undefined;
  const firstDetail = firstFieldErrors?.[0];
  if (typeof firstDetail === 'string' && firstDetail.trim()) {
    return firstDetail;
  }
  return message || fallback;
}

function getCompanyUsersForSelection(company: Company) {
  return Array.isArray(company.users) ? company.users : [];
}

function resolvePrimaryContactUserId(companyUsers: ReturnType<typeof getCompanyUsersForSelection>, company: Company) {
  if (companyUsers.length === 0) return '';
  const primary = companyUsers.find((user) => user.is_primary);
  if (primary) return String(primary.id);
  const byEmail = companyUsers.find(
    (user) =>
      (user.email ?? '').trim().toLowerCase() !== '' &&
      (user.email ?? '').trim().toLowerCase() === (company.primary_email ?? '').trim().toLowerCase(),
  );
  if (byEmail) return String(byEmail.id);
  const byName = companyUsers.find(
    (user) =>
      (user.name ?? '').trim().toLowerCase() !== '' &&
      (user.name ?? '').trim().toLowerCase() === (company.primary_contact_name ?? '').trim().toLowerCase(),
  );
  if (byName) return String(byName.id);
  return String(companyUsers[0].id);
}

function applyPrimaryContactUser(
  prev: {
    primary_contact_user_id: string;
    primary_contact_name: string;
    primary_email: string;
    primary_phone: string;
  },
  companyUsers: ReturnType<typeof getCompanyUsersForSelection>,
  userId: number,
) {
  const user = companyUsers.find((item) => item.id === userId);
  if (!user) return prev;
  return {
    ...prev,
    primary_contact_user_id: String(user.id),
    primary_contact_name: user.name ?? '',
    primary_email: user.email ?? '',
    primary_phone: user.phone ?? '',
  };
}

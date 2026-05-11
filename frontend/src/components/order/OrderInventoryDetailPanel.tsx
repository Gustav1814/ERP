import { useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from 'react';
import {
  ArrowLeft,
  Building2,
  Calendar,
  Check,
  X,
  Mail,
  MapPin,
  Phone,
  Plus,
  User2,
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { Empty, ModalFrame, ModalFrameSplit } from '@/src/components/ui';
import { normalizeManualServices, stripEquipmentOnlyServiceLabel } from '@/src/lib/crmManualServices';
import { fetchWithFallback, postFormDataExpectJson, putBlobToPresignedUrl, type FormDataPostResult } from '@/src/lib/api';
import { hydrateCompany } from '@/src/lib/hydrateCompany';
import { useCrmSharedData } from '@/src/context/CrmSharedDataContext';
import { applyAccountManagerToCompany } from '@/src/lib/companyAccountManager';
import { orderPatchFromApiData, type OrderSavedPatch } from '@/src/lib/orderPatchFromApi';
import { type Company, type CompanyAddress, type ErpOrder } from '@/src/data/companies';
import {
  computeTotalsAndUnknownRowsFromSummary,
  inventoryTypeProfilesFromApiResponse,
  quantityPerSummaryRow,
  resolveInventoryTypeForRow,
  type InventoryTypeProfile,
} from '@/src/lib/orderInventoryVolume';

function orderIdSuffixDigitsOnly(s: string): string {
  return String(s ?? '').replace(/\D/g, '');
}

/** First `-` separates locked HB prefix from numeric line suffix. Stored form always includes `-` (e.g. `HB047486-` or `HB047486-9`). */
function splitSummaryOrderId(orderId: string, sourceOrderId: string): { prefix: string; suffix: string } {
  const raw = (orderId || '').trim();
  const src = (sourceOrderId || '').trim();
  const i = raw.indexOf('-');
  if (i >= 0) {
    return { prefix: raw.slice(0, i), suffix: orderIdSuffixDigitsOnly(raw.slice(i + 1)) };
  }
  if (src) {
    const same = raw.toLowerCase() === src.toLowerCase();
    if (same) {
      return { prefix: src, suffix: '' };
    }
    if (raw.toLowerCase().startsWith(src.toLowerCase())) {
      const rest = raw.slice(src.length);
      if (rest.startsWith('-')) {
        return { prefix: src, suffix: orderIdSuffixDigitsOnly(rest.slice(1)) };
      }
      return { prefix: src, suffix: orderIdSuffixDigitsOnly(rest) };
    }
    return { prefix: src, suffix: orderIdSuffixDigitsOnly(raw) };
  }
  return { prefix: '', suffix: orderIdSuffixDigitsOnly(raw) };
}

function joinSummaryOrderId(prefix: string, suffix: string): string {
  const p = (prefix || '').trim();
  const s = orderIdSuffixDigitsOnly(suffix);
  if (!p) return s;
  return `${p}-${s}`;
}

/** Same logical line id should collide (e.g. `HB047486` vs `HB047486-` vs `hb047486-9`). */
function orderIdDuplicateKey(id: string): string {
  const t = String(id ?? '').trim().toLowerCase();
  if (!t) return '';
  return t.endsWith('-') ? t.slice(0, -1) : t;
}

function duplicateOrderIdsInSummaries(
  entries: Array<{ summaries: Array<{ order_id: string }> }>,
): string[] {
  const list: string[] = [];
  for (const e of entries) {
    for (const s of e.summaries) {
      const id = String(s.order_id ?? '').trim();
      if (id) list.push(id);
    }
  }
  const lowerCounts = new Map<string, number>();
  for (const id of list) {
    const k = orderIdDuplicateKey(id);
    if (!k) continue;
    lowerCounts.set(k, (lowerCounts.get(k) ?? 0) + 1);
  }
  const out: string[] = [];
  const added = new Set<string>();
  for (const id of list) {
    const k = orderIdDuplicateKey(id);
    if (!k) continue;
    if ((lowerCounts.get(k) ?? 0) > 1 && !added.has(k)) {
      added.add(k);
      out.push(id);
    }
  }
  return out;
}

type RoughWeightMode = 'settings' | 'manual';

type RoughSummaryLine = {
  id: string;
  device_type: string;
  count: string;
  weight_lbs: string;
  weight_mode: RoughWeightMode;
};

function newRoughLineId(): string {
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.randomUUID) {
    return `rough-${globalThis.crypto.randomUUID()}`;
  }
  return `rough-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function makeRoughLine(): RoughSummaryLine {
  return { id: newRoughLineId(), device_type: '', count: '', weight_lbs: '', weight_mode: 'settings' };
}

/** Rough estimate count: leading quantity plus optional container label (e.g. 1 box, 2 bin). */
const ROUGH_COUNT_PATTERN = /^\d{1,5}(?:\s*[A-Za-z][A-Za-z\s-]*)?$/i;

function normalizeRoughCountInput(raw: string): string {
  return raw.replace(/[^\dA-Za-z\s-]/g, '').slice(0, 40);
}

function isValidRoughCount(value: string): boolean {
  const trimmed = value.trim();
  return trimmed !== '' && ROUGH_COUNT_PATTERN.test(trimmed);
}

function roughCountMultiplier(value: string): number | null {
  const match = /^(\d{1,5})/.exec(value.trim());
  if (!match) return null;
  const parsed = Number.parseInt(match[1], 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function parseRoughSummaryLines(detail: Record<string, unknown>): RoughSummaryLine[] {
  const rs = detail?.rough_summary as Record<string, unknown> | undefined;
  const rawGlobal = String(rs?.weight_mode ?? '').toLowerCase();
  const legacyGlobalMode: RoughWeightMode = rawGlobal === 'manual' ? 'manual' : 'settings';
  const rawLines = Array.isArray(rs?.lines) ? (rs.lines as unknown[]) : [];
  if (rawLines.length === 0) {
    return [makeRoughLine()];
  }
  return rawLines.map((r) => {
    const row = r as Record<string, unknown>;
    const rowMode = String(row?.weight_mode ?? '').toLowerCase();
    const weight_mode: RoughWeightMode =
      rowMode === 'manual' ? 'manual' : rowMode === 'settings' ? 'settings' : legacyGlobalMode;
    return {
      id: newRoughLineId(),
      device_type: String(row?.device_type ?? '').trim(),
      count: String(row?.count ?? '').trim(),
      weight_lbs: String(row?.weight_lbs ?? '').trim(),
      weight_mode,
    };
  });
}

export function OrderInventoryDetailPanel({
  company,
  order,
  onBack,
  crossLinks,
  embedded = false,
  onInventoryDetailSaved,
  onCompanyUpdated,
}: {
  company: Company;
  order: ErpOrder;
  onBack: () => void;
  crossLinks?: ReactNode;
  embedded?: boolean;
  /** Called after PATCH so parent can merge order fields from API (`pickup_address_id`, dates, `crm_payload_json`). */
  onInventoryDetailSaved?: (orderId: number, patch: OrderSavedPatch) => void;
  /** Called after company PATCH (e.g. new pickup address) so parent can refresh `company.addresses`. */
  onCompanyUpdated?: (company: Company) => void;
}) {
  const crm = useCrmSharedData();
  const cosmeticGradeOptions = [
    'A+',
    'A',
    'A-',
  ];
  const csvTemplateHeaders = [
    'inventory_type',
    'inventory_number',
    'order_id',
    'location',
    'serial_number',
    'model_type',
    'processor',
    'gpu',
    'ram',
    'storage',
    'os',
    'battery_health',
    'display',
    'touch',
    'cosmetic_condition_grade',
    'notes',
    'data_wipe_enabled',
    'data_wipe_calendar',
    'hdd_model',
    'hdd_serial_number',
    'next_step',
  ];
  const payload = ((order as ErpOrder & { crm_payload_json?: any }).crm_payload_json ?? {}) as Record<string, any>;
  const inventoryDetail = (payload.inventory_detail ?? {}) as Record<string, any>;
  const manual = (payload.manual ?? {}) as Record<string, any>;
  type SummaryFormState = {
    order_id: string;
    location: string;
    device_type: string;
    serial_number: string;
    model_type: string;
    processor: string;
    gpu: string;
    ram: string;
    storage: string;
    os: string;
    battery_health: string;
    display: string;
    touch: string;
    cosmetic_condition_grade: string;
    notes: string;
    data_wipe_enabled: boolean;
    data_wipe_calendar: string;
    hdd_model: string;
    hdd_serial_number: string;
    next_step: string;
  };
  type InventoryDeviceEntry = {
    id: string;
    inventory_type: string;
    inventory_number: string; // quantity
    summaries: SummaryFormState[];
  };
  type SimpleSummaryRow = {
    id: string;
    order_number: string;
    device_type: string;
    count: string;
    weight_lbs: string;
  };

  const parseInitialSimpleRows = (detail: Record<string, any>, fallbackOrderId: string): SimpleSummaryRow[] => {
    const raw = Array.isArray(detail?.simple_summary) ? detail.simple_summary : [];
    const mapped = raw.map((r: any) => ({
      order_number: String(r.order_number ?? fallbackOrderId ?? ''),
      device_type: String(r.device_type ?? '').trim(),
      count: String(r.count ?? '1'),
      weight_lbs: String(r.weight_lbs ?? ''),
    }));
    /** Drop CRM/legacy junk rows (empty device, no weight, default count). */
    const meaningful = mapped.filter((row) => {
      if (row.device_type !== '') return true;
      if (row.weight_lbs.trim() !== '') return true;
      const c = Number.parseInt(String(row.count).trim(), 10);
      return Number.isFinite(c) && c > 1;
    });
    return meaningful.map((row, i) => ({
      id: `simple-${i}`,
      ...row,
    }));
  };

  const makeSummaryState = (summary: Record<string, any> = {}, fallbackOrderId = '', fallbackType = ''): SummaryFormState => ({
    order_id: String((summary.order_id ?? fallbackOrderId)).trim(),
    location: String(summary.location ?? '').trim(),
    device_type: String(summary.device_type ?? fallbackType).trim(),
    serial_number: String(summary.serial_number ?? '').trim(),
    model_type: String(summary.model_type ?? '').trim(),
    processor: String(summary.processor ?? '').trim(),
    gpu: String(summary.gpu ?? '').trim(),
    ram: String(summary.ram ?? '').trim(),
    storage: String(summary.storage ?? '').trim(),
    os: String(summary.os ?? '').trim(),
    battery_health: String(summary.battery_health ?? '').trim(),
    display: String(summary.display ?? '').trim(),
    touch: String(summary.touch ?? 'No').trim() || 'No',
    cosmetic_condition_grade: String(summary.cosmetic_condition_grade ?? '').trim(),
    notes: String(summary.notes ?? '').trim(),
    data_wipe_enabled: Boolean(summary.data_wipe_enabled ?? false),
    data_wipe_calendar: String(summary.data_wipe_calendar ?? '').trim(),
    hdd_model: String(summary.hdd_model ?? '').trim(),
    hdd_serial_number: String(summary.hdd_serial_number ?? '').trim(),
    next_step: String(summary.next_step ?? '').trim(),
  });

  /**
   * Save sends one API row per summary line (`inventory_number` 1..n within each device group).
   * Rebuild the in-memory grouped entries so the inventory snapshot stays aggregated like pre-save.
   */
  const regroupPersistedDeviceRows = (devices: any[], sid: string): InventoryDeviceEntry[] => {
    if (!Array.isArray(devices) || devices.length === 0) return [];

    const entries: InventoryDeviceEntry[] = [];
    let current: { type: string; summaries: SummaryFormState[]; nextExpected: number } | null = null;

    const flush = () => {
      if (!current || current.summaries.length === 0) return;
      entries.push({
        id: `device-${entries.length + 1}`,
        inventory_type: current.type,
        inventory_number: String(current.summaries.length),
        summaries: current.summaries,
      });
    };

    for (const device of devices) {
      if (!device || typeof device !== 'object') continue;
      const summaryRaw = (device.summary ?? {}) as Record<string, any>;
      const fromType = String(device.inventory_type ?? '').trim();
      const summaryType = String(summaryRaw.device_type ?? '').trim();
      const inventoryType = fromType || summaryType;

      const rawNum = String(device.inventory_number ?? '').trim();
      let seq = Number.parseInt(rawNum, 10);
      if (!Number.isFinite(seq) || seq <= 0) {
        seq = current ? current.nextExpected : 1;
      }

      const summary = makeSummaryState(summaryRaw, sid, inventoryType || summaryType);
      const rowType = (inventoryType || String(summary.device_type ?? '').trim()).trim();

      if (!current || rowType !== current.type || seq !== current.nextExpected) {
        flush();
        current = {
          type: rowType || '—',
          summaries: [summary],
          nextExpected: seq + 1,
        };
      } else {
        current.summaries.push(summary);
        current.nextExpected = seq + 1;
      }
    }
    flush();

    return entries;
  };

  const buildDeviceEntriesFromDetail = (
    detail: Record<string, any>,
    sourceOrderId: string,
    simpleRows: SimpleSummaryRow[],
  ): InventoryDeviceEntry[] => {
    if (simpleRows.length > 0) return [];
    const existing = Array.isArray(detail.devices) ? detail.devices : [];
    if (existing.length > 0) {
      return regroupPersistedDeviceRows(existing, sourceOrderId);
    }
    const legacy = (detail.summary ?? {}) as Record<string, any>;
    const legacyType = String(legacy.device_type ?? '').trim();
    if (legacyType) {
      return [
        {
          id: 'device-1',
          inventory_type: legacyType,
          inventory_number: '1',
          summaries: [makeSummaryState(legacy, sourceOrderId, legacyType)],
        },
      ];
    }
    return [];
  };
  const initialSimpleRows = parseInitialSimpleRows(inventoryDetail, String(order.source_order_id ?? ''));
  const initialDeviceEntries = buildDeviceEntriesFromDetail(
    inventoryDetail,
    String(order.source_order_id ?? ''),
    initialSimpleRows,
  );
  const inventoryDetailSig = JSON.stringify(
    ((order as ErpOrder & { crm_payload_json?: Record<string, unknown> }).crm_payload_json?.inventory_detail ??
      null) as unknown,
  );
  const orderUser = getOrderCompanyUser(company, order);
  const [isEditingContact, setIsEditingContact] = useState(false);
  const [isSavingContact, setIsSavingContact] = useState(false);
  const [contactSaveError, setContactSaveError] = useState('');
  const [contactOverride, setContactOverride] = useState<{ name: string; email: string; phone: string } | null>(null);
  const contactDisplay = contactOverride ?? orderUser;
  const [contactName, setContactName] = useState(contactDisplay.name === '—' ? '' : contactDisplay.name);
  const [contactEmail, setContactEmail] = useState(contactDisplay.email === '—' ? '' : contactDisplay.email);
  const [contactPhone, setContactPhone] = useState(contactDisplay.phone === '—' ? '' : contactDisplay.phone);
  const [pickupAddressesLocal, setPickupAddressesLocal] = useState<CompanyAddress[]>(() =>
    (company.addresses ?? []).filter((a) => a.kind === 'pickup'),
  );
  const pickupAddress =
    company.addresses.find((address) => address.id === order.pickup_address_id) ??
    company.addresses.find((address) => address.kind === 'billing') ??
    null;
  const [pickupDate, setPickupDate] = useState<string>(() => {
    const raw = String(order.pickup_date ?? '').trim();
    return raw ? raw.slice(0, 10) : '';
  });
  const [pickupAddressId, setPickupAddressId] = useState<string>(() =>
    order.pickup_address_id ? String(order.pickup_address_id) : '',
  );
  const pickupAddressResolved =
    pickupAddressesLocal.find((a) => String(a.id) === String(pickupAddressId)) ?? pickupAddress;
  const [pickupBy, setPickupBy] = useState('HB Team');
  const [pickupByOptions, setPickupByOptions] = useState<string[]>(['HB Team', 'Mubarak', 'JKA']);
  const [accountManager, setAccountManager] = useState('');
  const [accountManagerOptions, setAccountManagerOptions] = useState<string[]>([]);
  const [deliveredDate, setDeliveredDate] = useState('');
  const [bol, setBol] = useState('');
  const [isEditingPickupDetails, setIsEditingPickupDetails] = useState(false);
  const [isSavingPickupDetails, setIsSavingPickupDetails] = useState(false);
  const [pickupDetailsError, setPickupDetailsError] = useState('');
  const [addressModalOpen, setAddressModalOpen] = useState(false);
  const [addressDraft, setAddressDraft] = useState<{
    id: string;
    line1: string;
    line2: string;
    city: string;
    state: string;
    zip: string;
    country: string;
  } | null>(null);
  const [isSavingAddress, setIsSavingAddress] = useState(false);
  const [addressSaveError, setAddressSaveError] = useState('');
  const [serviceOptions, setServiceOptions] = useState<string[]>([
    'Recycling (Acknowledgement)',
    'Data wipe',
  ]);
  const [deviceTypeOptions, setDeviceTypeOptions] = useState<string[]>([]);
  const [inventoryProfiles, setInventoryProfiles] = useState<Map<string, InventoryTypeProfile>>(
    () => new Map(),
  );
  const [deviceEntries, setDeviceEntries] = useState<InventoryDeviceEntry[]>(initialDeviceEntries);
  const [simpleSummaryRows, setSimpleSummaryRows] = useState<SimpleSummaryRow[]>(initialSimpleRows);
  const [selectedServices, setSelectedServices] = useState<string[]>(() => {
    const fromPayload = stripEquipmentOnlyServiceLabel(
      normalizeManualServices(payload as Record<string, unknown>),
      String(order.type_of_equipment ?? ''),
    );
    if (fromPayload.length > 0) return fromPayload;
    return Array.isArray(order.services)
      ? stripEquipmentOnlyServiceLabel(
          order.services.map((s) => String(s).trim()).filter((s) => s !== ''),
          String(order.type_of_equipment ?? ''),
        )
      : [];
  });
  const [certificates, setCertificates] = useState<Array<{ name: string; url?: string; path?: string | null }>>(() => {
    const fromPayload = Array.isArray(inventoryDetail.certificates) ? inventoryDetail.certificates : [];
    return normalizeCertificateItems(fromPayload);
  });
  const [isSavingInventoryDetail, setIsSavingInventoryDetail] = useState(false);
  const [inventorySaveError, setInventorySaveError] = useState('');
  const [inventorySaveOk, setInventorySaveOk] = useState('');
  const [isUploadingCertificates, setIsUploadingCertificates] = useState(false);

  useEffect(() => {
    if (isEditingContact) return;
    setContactName(contactDisplay.name === '—' ? '' : contactDisplay.name);
    setContactEmail(contactDisplay.email === '—' ? '' : contactDisplay.email);
    setContactPhone(contactDisplay.phone === '—' ? '' : contactDisplay.phone);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company.id, order.id, contactDisplay.name, contactDisplay.email, contactDisplay.phone, isEditingContact]);

  const startEditContact = () => {
    setContactSaveError('');
    setContactName(contactDisplay.name === '—' ? '' : contactDisplay.name);
    setContactEmail(contactDisplay.email === '—' ? '' : contactDisplay.email);
    setContactPhone(contactDisplay.phone === '—' ? '' : contactDisplay.phone);
    setIsEditingContact(true);
  };

  const cancelEditContact = () => {
    setContactSaveError('');
    setIsEditingContact(false);
    setContactName(contactDisplay.name === '—' ? '' : contactDisplay.name);
    setContactEmail(contactDisplay.email === '—' ? '' : contactDisplay.email);
    setContactPhone(contactDisplay.phone === '—' ? '' : contactDisplay.phone);
  };

  const saveContact = async () => {
    setIsSavingContact(true);
    setContactSaveError('');
    const res = await fetchWithFallback(`/api/v1/crm/companies/${company.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: company.name,
        primary_contact_name: contactName.trim() || null,
        primary_email: contactEmail.trim() || null,
        primary_phone: contactPhone.trim() || null,
      }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setContactSaveError(json?.message || 'Unable to save contact.');
      setIsSavingContact(false);
      return;
    }
    const updated = json?.data ?? null;
    if (updated) {
      setContactOverride({
        name: String(updated?.primary_contact_name ?? '').trim() || '—',
        email: String(updated?.primary_email ?? '').trim() || '—',
        phone: String(updated?.primary_phone ?? '').trim() || '—',
      });
    }
    setIsSavingContact(false);
    setIsEditingContact(false);
  };
  const [editingSummaryRowKey, setEditingSummaryRowKey] = useState<string | null>(null);
  const [outsideEditConfirmOpen, setOutsideEditConfirmOpen] = useState(false);
  const [isAddDataModalOpen, setIsAddDataModalOpen] = useState(false);
  const [addModalInventoryType, setAddModalInventoryType] = useState('');
  const [addModalInventoryCount, setAddModalInventoryCount] = useState('1');
  const [editingSimpleRowId, setEditingSimpleRowId] = useState<string | null>(null);
  const [simpleRowDraft, setSimpleRowDraft] = useState<SimpleSummaryRow | null>(null);
  const [outsideSimpleEditConfirmOpen, setOutsideSimpleEditConfirmOpen] = useState(false);
  const summaryTableWrapRef = useRef<HTMLDivElement | null>(null);
  const outsideEditConfirmRef = useRef<HTMLDivElement | null>(null);
  const outsideEditConfirmOpenRef = useRef(false);
  outsideEditConfirmOpenRef.current = outsideEditConfirmOpen;
  const outsideSimpleEditConfirmRef = useRef<HTMLDivElement | null>(null);
  const outsideSimpleEditConfirmOpenRef = useRef(false);
  const certificateFileInputRef = useRef<HTMLInputElement | null>(null);
  outsideSimpleEditConfirmOpenRef.current = outsideSimpleEditConfirmOpen;

  const [roughSummaryLines, setRoughSummaryLines] = useState<RoughSummaryLine[]>(() =>
    parseRoughSummaryLines(inventoryDetail as Record<string, unknown>),
  );

  const parseCsvRow = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i += 1) {
      const ch = line[i];
      if (ch === '"') {
        const next = line[i + 1];
        if (inQuotes && next === '"') {
          current += '"';
          i += 1;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    result.push(current.trim());
    return result.map((value) => value.replace(/^"|"$/g, '').trim());
  };

  const asBoolean = (value: string) => {
    const v = value.trim().toLowerCase();
    return v === '1' || v === 'true' || v === 'yes' || v === 'y';
  };

  const handleDownloadCsvTemplate = () => {
    const sampleLine = [
      'Laptop',
      '1',
      String(order.source_order_id ?? ''),
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      'No',
      '',
      '',
      'No',
      '',
      '',
      '',
      '',
    ];
    const csv = `${csvTemplateHeaders.join(',')}\n${sampleLine.join(',')}\n`;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'inventory_summary_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleCsvUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setInventorySaveError('');
    setInventorySaveOk('');
    try {
      const text = await file.text();
      const lines = text
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line !== '');
      if (lines.length < 2) {
        throw new Error('CSV is empty. Please use the ERP template.');
      }
      const headerRow = parseCsvRow(lines[0]).map((header) => header.toLowerCase());
      const headerIndex = new Map<string, number>();
      headerRow.forEach((header, idx) => headerIndex.set(header, idx));
      const requiredHeaders = ['inventory_type', 'inventory_number'];
      const missing = requiredHeaders.filter((header) => !headerIndex.has(header));
      if (missing.length > 0) {
        throw new Error(`Missing CSV columns: ${missing.join(', ')}`);
      }

      const grouped = new Map<string, { inventory_type: string; summaries: SummaryFormState[] }>();
      for (let i = 1; i < lines.length; i += 1) {
        const columns = parseCsvRow(lines[i]);
        const get = (key: string) => {
          const idx = headerIndex.get(key);
          return idx == null ? '' : String(columns[idx] ?? '').trim();
        };
        const inventoryType = get('inventory_type');
        if (!inventoryType) continue;
        const summary: SummaryFormState = {
          order_id: get('order_id') || String(order.source_order_id ?? ''),
          location: get('location'),
          device_type: inventoryType,
          serial_number: get('serial_number'),
          model_type: get('model_type'),
          processor: get('processor'),
          gpu: get('gpu'),
          ram: get('ram'),
          storage: get('storage'),
          os: get('os'),
          battery_health: get('battery_health'),
          display: get('display'),
          touch: get('touch') || 'No',
          cosmetic_condition_grade: get('cosmetic_condition_grade'),
          notes: get('notes'),
          data_wipe_enabled: asBoolean(get('data_wipe_enabled')),
          data_wipe_calendar: get('data_wipe_calendar'),
          hdd_model: get('hdd_model'),
          hdd_serial_number: get('hdd_serial_number'),
          next_step: get('next_step'),
        };
        const key = inventoryType.toLowerCase();
        const existing = grouped.get(key);
        if (existing) {
          existing.summaries.push(summary);
        } else {
          grouped.set(key, { inventory_type: inventoryType, summaries: [summary] });
        }
      }

      const nextEntries: InventoryDeviceEntry[] = Array.from(grouped.values()).map((group, idx) => ({
        id: `device-csv-${Date.now()}-${idx + 1}`,
        inventory_type: group.inventory_type,
        inventory_number: String(group.summaries.length),
        summaries: group.summaries,
      }));
      if (nextEntries.length === 0) {
        throw new Error('No valid inventory rows found in CSV.');
      }
      setEditingSimpleRowId(null);
      setSimpleRowDraft(null);
      setSimpleSummaryRows([]);
      setDeviceEntries(nextEntries);
      setInventorySaveOk('CSV imported. Review and click Save Changes.');
      setIsAddDataModalOpen(false);
    } catch (error) {
      setInventorySaveError(error instanceof Error ? error.message : 'Unable to import CSV.');
    }
  };
  const patchDeviceSummary = (deviceId: string, summaryIndex: number, patch: Partial<SummaryFormState>) => {
    setDeviceEntries((prev) =>
      prev.map((entry) =>
        entry.id === deviceId
          ? {
              ...entry,
              summaries: entry.summaries.map((summary, idx) =>
                idx === summaryIndex
                  ? {
                      ...summary,
                      ...patch,
                    }
                  : summary,
              ),
            }
          : entry,
      ),
    );
  };
  const removeSummaryRow = (deviceId: string, summaryIndex: number) => {
    setDeviceEntries((prev) =>
      prev
        .map((entry) => {
          if (entry.id !== deviceId) return entry;
          const summaries = entry.summaries.filter((_, idx) => idx !== summaryIndex);
          return {
            ...entry,
            summaries,
            inventory_number: String(summaries.length),
          };
        })
        .filter((entry) => entry.summaries.length > 0),
    );
  };

  /** Appends one blank line to the last device group (full table). */
  const addEmptyDetailedSummaryRow = () => {
    const src = String(order.source_order_id ?? '');
    const blankOrderId = joinSummaryOrderId(src, '');
    const fallbackType = deviceTypeOptions[0] ?? '';
    let newRowKey: string | null = null;
    setDeviceEntries((prev) => {
      if (prev.length === 0) {
        const id = `device-${Date.now()}`;
        newRowKey = `${id}-0`;
        return [
          {
            id,
            inventory_type: fallbackType,
            inventory_number: '1',
            summaries: [
              makeSummaryState(
                { order_id: blankOrderId, device_type: fallbackType },
                src,
                fallbackType,
              ),
            ],
          },
        ];
      }
      const next = [...prev];
      const lastIdx = next.length - 1;
      const entry = next[lastIdx]!;
      const invType = entry.inventory_type || fallbackType;
      const newSummary = makeSummaryState(
        { order_id: blankOrderId, device_type: invType },
        src,
        invType,
      );
      const summaries = [...entry.summaries, newSummary];
      next[lastIdx] = {
        ...entry,
        summaries,
        inventory_number: String(Math.max(1, summaries.length)),
      };
      newRowKey = `${entry.id}-${summaries.length - 1}`;
      return next;
    });
    if (newRowKey) {
      queueMicrotask(() => setEditingSummaryRowKey(newRowKey));
    }
  };

  /** Appends one blank short-summary row (same Order # pattern as full table). */
  const addEmptySimpleSummaryRow = () => {
    const src = String(order.source_order_id ?? '');
    const newId = `simple-${Date.now()}`;
    const row: SimpleSummaryRow = {
      id: newId,
      order_number: joinSummaryOrderId(src, ''),
      device_type: deviceTypeOptions[0] ?? '',
      count: '1',
      weight_lbs: '',
    };
    setSimpleSummaryRows((prev) => [...prev, row]);
    setEditingSimpleRowId(newId);
    setSimpleRowDraft({ ...row });
  };

  const addEmptySummaryTableRow = () => {
    if (simpleSummaryRows.length > 0) {
      addEmptySimpleSummaryRow();
    } else {
      addEmptyDetailedSummaryRow();
    }
  };

  const isSimpleInventoryView = simpleSummaryRows.length > 0;
  const summaryRows = useMemo(() => {
    if (isSimpleInventoryView) return [];
    return deviceEntries.flatMap((entry) => {
      const m = Math.max(1, entry.summaries.length);
      const qtyPerRow = quantityPerSummaryRow(entry.inventory_number, m);
      return entry.summaries.map((summary, summaryIdx) => ({
        key: `${entry.id}-${summaryIdx}`,
        deviceId: entry.id,
        summaryIdx,
        inventoryType: resolveInventoryTypeForRow(entry.inventory_type, summary.device_type),
        quantityForRow: qtyPerRow,
        summary,
      }));
    });
  }, [deviceEntries, isSimpleInventoryView]);

  const inventoryAnalysis = useMemo(
    () => computeTotalsAndUnknownRowsFromSummary(summaryRows, inventoryProfiles),
    [summaryRows, inventoryProfiles],
  );

  const settingsInventoryResolved = inventoryProfiles.size > 0;
  const hasBlockingUnknownTypes =
    !isSimpleInventoryView && settingsInventoryResolved && inventoryAnalysis.unknownRowKeys.size > 0;

  const goToInventorySettings = () => {
    try {
      sessionStorage.setItem('erp_settings_focus', 'inventory-types');
    } catch {
      /* ignore */
    }
    window.location.hash = '#/settings';
  };
  const openAddDataModal = () => {
    const fallbackType =
      deviceEntries[0]?.inventory_type ||
      simpleSummaryRows[0]?.device_type ||
      deviceTypeOptions[0] ||
      '';
    setAddModalInventoryType(fallbackType);
    setAddModalInventoryCount('1');
    setIsAddDataModalOpen(true);
  };

  const patchSimpleRowDraft = (patch: Partial<SimpleSummaryRow>) => {
    setSimpleRowDraft((d) => (d ? { ...d, ...patch } : null));
  };
  const commitSimpleRowEdit = () => {
    if (!editingSimpleRowId || !simpleRowDraft) return;
    setSimpleSummaryRows((prev) =>
      prev.map((row) => (row.id === editingSimpleRowId ? { ...simpleRowDraft } : row)),
    );
    setEditingSimpleRowId(null);
    setSimpleRowDraft(null);
    setOutsideSimpleEditConfirmOpen(false);
    outsideSimpleEditConfirmOpenRef.current = false;
  };
  const discardSimpleRowEdit = () => {
    setEditingSimpleRowId(null);
    setSimpleRowDraft(null);
    setOutsideSimpleEditConfirmOpen(false);
    outsideSimpleEditConfirmOpenRef.current = false;
  };
  const startEditSimpleRow = (id: string) => {
    if (editingSimpleRowId && editingSimpleRowId !== id) {
      setInventorySaveError('Save or cancel the row you are editing before opening another.');
      return;
    }
    const row = simpleSummaryRows.find((r) => r.id === id);
    if (!row) return;
    setInventorySaveError('');
    setEditingSimpleRowId(id);
    setSimpleRowDraft({ ...row });
  };
  const removeSimpleSummaryRow = (id: string) => {
    if (editingSimpleRowId === id) {
      discardSimpleRowEdit();
    }
    setSimpleSummaryRows((prev) => prev.filter((row) => row.id !== id));
  };

  /** Short summary: `weight_lbs` is total lbs for the row (orders list Volume uses the sum as-is). */
  const simpleSummaryTotalLbs = useMemo(() => {
    let total = 0;
    for (const row of simpleSummaryRows) {
      const effective =
        editingSimpleRowId === row.id && simpleRowDraft ? simpleRowDraft : row;
      const w = Number.parseFloat(String(effective.weight_lbs ?? '0'));
      if (Number.isFinite(w) && w > 0) total += w;
    }
    return Math.round(total * 100) / 100;
  }, [simpleSummaryRows, editingSimpleRowId, simpleRowDraft]);

  const simpleSnapshotRows = useMemo(
    () =>
      simpleSummaryRows.map((row) => {
        const effective =
          editingSimpleRowId === row.id && simpleRowDraft ? simpleRowDraft : row;
        const w = Number.parseFloat(String(effective.weight_lbs ?? '0'));
        const c = Number.parseInt(String(effective.count ?? '').trim(), 10);
        return {
          id: row.id,
          deviceType: String(effective.device_type ?? '').trim() || '—',
          countDisplay: Number.isFinite(c) && c > 0 ? String(c) : '—',
          weightLbs: Number.isFinite(w) && w > 0 ? Math.round(w * 100) / 100 : null,
        };
      }),
    [simpleSummaryRows, editingSimpleRowId, simpleRowDraft],
  );

  const detailedSnapshotRows = useMemo(() => {
    if (simpleSummaryRows.length > 0 || deviceEntries.length === 0) return null;
    return deviceEntries.map((entry) => {
      const m = Math.max(1, entry.summaries.length);
      const qtyPerRow = quantityPerSummaryRow(entry.inventory_number, m);
      const parsedInv = Number.parseInt(String(entry.inventory_number || '').trim(), 10);
      const unitTotal = Number.isFinite(parsedInv) && parsedInv > 0 ? parsedInv : m;
      let weightLbs = 0;
      let unknown = false;
      for (const summary of entry.summaries) {
        const invType = resolveInventoryTypeForRow(entry.inventory_type, summary.device_type);
        const key = invType.trim().toLowerCase();
        const prof = inventoryProfiles.get(key);
        if (!invType || prof === undefined) {
          unknown = true;
          continue;
        }
        weightLbs += qtyPerRow * prof.weightLbs;
      }
      const label = String(entry.inventory_type || entry.summaries[0]?.device_type || '').trim() || '—';
      const resolved = inventoryProfiles.size > 0;
      return {
        id: entry.id,
        deviceType: label,
        lineCount: m,
        unitCount: unitTotal,
        weightLbs:
          !resolved || unknown ? null : Math.round(weightLbs * 100) / 100,
        unknown,
      };
    });
  }, [simpleSummaryRows.length, deviceEntries, inventoryProfiles]);

  const roughTotalLbs = useMemo(() => {
    let total = 0;
    for (const line of roughSummaryLines) {
      if (line.weight_mode === 'manual') {
        const w = Number.parseFloat(String(line.weight_lbs ?? '').trim());
        if (Number.isFinite(w) && w > 0) total += w;
      } else {
        const c = roughCountMultiplier(String(line.count ?? ''));
        if (c === null || c <= 0) continue;
        const key = String(line.device_type ?? '').trim().toLowerCase();
        if (!key) continue;
        const prof = inventoryProfiles.get(key);
        if (!prof) continue;
        total += c * prof.weightLbs;
      }
    }
    return Math.round(total * 100) / 100;
  }, [roughSummaryLines, inventoryProfiles]);

  const readAddModalTypeAndCount = (): { inventoryType: string; count: number } | null => {
    const inventoryType = addModalInventoryType.trim();
    const count = Number.parseInt(String(addModalInventoryCount || '').trim(), 10);
    if (!inventoryType) {
      setInventorySaveError('Select or enter a device / inventory type.');
      return null;
    }
    if (!Number.isFinite(count) || count <= 0) {
      setInventorySaveError('Inventory count must be a whole number greater than 0.');
      return null;
    }
    setInventorySaveError('');
    return { inventoryType, count };
  };

  const handleAddDetailedTableFromModal = () => {
    const parsed = readAddModalTypeAndCount();
    if (!parsed) return;
    const { inventoryType, count } = parsed;
    setEditingSimpleRowId(null);
    setSimpleRowDraft(null);
    setSimpleSummaryRows([]);
    setDeviceEntries((prev) => {
      const next = [...prev];
      const idx = next.findIndex(
        (entry) => entry.inventory_type.toLowerCase() === inventoryType.toLowerCase(),
      );
      const generated = Array.from({ length: count }).map(() =>
        makeSummaryState(
          { device_type: inventoryType },
          String(order.source_order_id ?? ''),
          inventoryType,
        ),
      );
      if (idx >= 0) {
        const entry = next[idx]!;
        const merged = [...entry.summaries, ...generated];
        next[idx] = {
          ...entry,
          summaries: merged,
          inventory_number: String(merged.length),
        };
      } else {
        next.push({
          id: `device-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          inventory_type: inventoryType,
          inventory_number: String(count),
          summaries: generated,
        });
      }
      return next;
    });
    setIsAddDataModalOpen(false);
  };

  const handleAddSimpleSummaryRowFromModal = () => {
    const parsed = readAddModalTypeAndCount();
    if (!parsed) return;
    const { inventoryType, count } = parsed;
    const newId = `simple-${Date.now()}`;
    const newRow: SimpleSummaryRow = {
      id: newId,
      order_number: joinSummaryOrderId(String(order.source_order_id ?? ''), ''),
      device_type: inventoryType,
      count: String(count),
      weight_lbs: '',
    };
    setDeviceEntries([]);
    setSimpleSummaryRows([newRow]);
    setEditingSimpleRowId(newId);
    setSimpleRowDraft({ ...newRow });
    setIsAddDataModalOpen(false);
  };
  useEffect(() => {
    if (!editingSummaryRowKey) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (event.button !== 0 && event.pointerType === 'mouse') return;
      const wrapper = summaryTableWrapRef.current;
      if (!wrapper) return;
      const target = event.target;
      if (!target || !(target instanceof Node)) return;

      if (outsideEditConfirmOpenRef.current) {
        if (outsideEditConfirmRef.current?.contains(target)) return;
        outsideEditConfirmOpenRef.current = false;
        setOutsideEditConfirmOpen(false);
        return;
      }

      let activeRow: HTMLElement | null = null;
      wrapper.querySelectorAll('tr[data-summary-row-key]').forEach((tr) => {
        if (tr.getAttribute('data-summary-row-key') === editingSummaryRowKey) {
          activeRow = tr as HTMLElement;
        }
      });
      if (!activeRow) {
        setEditingSummaryRowKey(null);
        return;
      }
      if (!activeRow.contains(target)) {
        outsideEditConfirmOpenRef.current = true;
        setOutsideEditConfirmOpen(true);
      }
    };
    document.addEventListener('pointerdown', handlePointerDown, true);
    return () => document.removeEventListener('pointerdown', handlePointerDown, true);
  }, [editingSummaryRowKey]);

  useEffect(() => {
    outsideEditConfirmOpenRef.current = false;
    setOutsideEditConfirmOpen(false);
  }, [editingSummaryRowKey]);

  useEffect(() => {
    if (!editingSimpleRowId) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (event.button !== 0 && event.pointerType === 'mouse') return;
      const wrapper = summaryTableWrapRef.current;
      if (!wrapper) return;
      const target = event.target;
      if (!target || !(target instanceof Node)) return;

      if (outsideSimpleEditConfirmOpenRef.current) {
        if (outsideSimpleEditConfirmRef.current?.contains(target)) return;
        outsideSimpleEditConfirmOpenRef.current = false;
        setOutsideSimpleEditConfirmOpen(false);
        return;
      }

      let activeRow: HTMLElement | null = null;
      wrapper.querySelectorAll('tr[data-simple-summary-row]').forEach((tr) => {
        if (tr.getAttribute('data-simple-summary-row') === editingSimpleRowId) {
          activeRow = tr as HTMLElement;
        }
      });
      if (!activeRow) {
        setEditingSimpleRowId(null);
        setSimpleRowDraft(null);
        setOutsideSimpleEditConfirmOpen(false);
        outsideSimpleEditConfirmOpenRef.current = false;
        return;
      }
      if (!activeRow.contains(target)) {
        outsideSimpleEditConfirmOpenRef.current = true;
        setOutsideSimpleEditConfirmOpen(true);
      }
    };
    document.addEventListener('pointerdown', handlePointerDown, true);
    return () => document.removeEventListener('pointerdown', handlePointerDown, true);
  }, [editingSimpleRowId]);

  useEffect(() => {
    outsideSimpleEditConfirmOpenRef.current = false;
    setOutsideSimpleEditConfirmOpen(false);
  }, [editingSimpleRowId]);

  useEffect(() => {
    const payload = ((order as ErpOrder & { crm_payload_json?: Record<string, unknown> }).crm_payload_json ??
      {}) as Record<string, unknown>;
    const detail = (payload.inventory_detail ?? {}) as Record<string, any>;
    const sid = String(order.source_order_id ?? '');
    const simple = parseInitialSimpleRows(detail, sid);
    setSimpleSummaryRows(simple);
    setDeviceEntries(buildDeviceEntriesFromDetail(detail, sid, simple));
    setEditingSimpleRowId(null);
    setSimpleRowDraft(null);
    setEditingSummaryRowKey(null);
    outsideSimpleEditConfirmOpenRef.current = false;
    setOutsideSimpleEditConfirmOpen(false);
    const certs = Array.isArray(detail.certificates) ? detail.certificates : [];
    setCertificates(normalizeCertificateItems(certs));
    setRoughSummaryLines(parseRoughSummaryLines(detail as Record<string, unknown>));
    setSelectedServices(
      stripEquipmentOnlyServiceLabel(
        normalizeManualServices(payload),
        String(order.type_of_equipment ?? ''),
      ),
    );
  }, [order.id, inventoryDetailSig]);

  useEffect(() => {
    if (!crm.loaded || crm.pickupByNames.length === 0) return;
    const options = crm.pickupByNames;
    setPickupByOptions(options);
    const preferred = String(inventoryDetail.pickup_by ?? '').trim();
    if (preferred && options.includes(preferred)) {
      setPickupBy(preferred);
    } else {
      setPickupBy((prev) => (options.includes(prev) ? prev : options[0]));
    }
  }, [crm.loaded, crm.pickupByNames, inventoryDetail.pickup_by]);

  useEffect(() => {
    if (!crm.loaded || crm.accountManagerNames.length === 0) return;
    const options = crm.accountManagerNames;
    setAccountManagerOptions(options);
    const companyManager = String(company.project_manager ?? '').trim();
    const orderManager = String(inventoryDetail.account_manager ?? '').trim();
    const preferred = companyManager || orderManager;
    if (preferred) {
      setAccountManager(preferred);
      return;
    }
    setAccountManager((prev) => (options.includes(prev) ? prev : ''));
  }, [crm.loaded, crm.accountManagerNames, inventoryDetail.account_manager, company.project_manager]);

  useEffect(() => {
    if (!crm.loaded || crm.serviceNames.length === 0) return;
    setServiceOptions(crm.serviceNames);
  }, [crm.loaded, crm.serviceNames]);

  useEffect(() => {
    if (!crm.loaded || !crm.inventoryTypesJson) return;
    const json = crm.inventoryTypesJson;
    setInventoryProfiles(inventoryTypeProfilesFromApiResponse(json));
    const options = Array.isArray((json as { data?: unknown }).data)
      ? ((json as { data: unknown[] }).data as Record<string, unknown>[])
          .map((item) => String(item?.name ?? '').trim())
          .filter((name: string) => name !== '')
      : [];
    if (options.length > 0) {
      setDeviceTypeOptions(options);
      setDeviceEntries((prev) =>
        prev.map((entry, idx) => {
          if (idx !== 0 || entry.inventory_type) return entry;
          return {
            ...entry,
            inventory_type: options[0],
            summaries: entry.summaries.map((summary) => ({
              ...summary,
              device_type: summary.device_type || options[0],
            })),
          };
        }),
      );
    }
  }, [crm.loaded, crm.inventoryTypesJson]);

  useEffect(() => {
    const savedDeliveredDate = String(inventoryDetail.delivered_date ?? '').trim();
    const savedBol = String(inventoryDetail.bol ?? '').trim();
    if (savedDeliveredDate) {
      setDeliveredDate(savedDeliveredDate);
    }
    if (savedBol) {
      setBol(savedBol);
    }
  }, [inventoryDetail.delivered_date, inventoryDetail.bol]);

  useEffect(() => {
    const raw = String(order.pickup_date ?? '').trim();
    setPickupDate(raw ? raw.slice(0, 10) : '');
    setPickupAddressId(order.pickup_address_id ? String(order.pickup_address_id) : '');
  }, [order.id, order.pickup_date, order.pickup_address_id]);

  useEffect(() => {
    setPickupAddressesLocal((company.addresses ?? []).filter((a) => a.kind === 'pickup'));
  }, [company.id, company.addresses]);

  const publishAccountManagerChange = (manager: string) => {
    const normalized = manager.trim();
    if (!normalized || !onCompanyUpdated) return;
    onCompanyUpdated(applyAccountManagerToCompany(company, normalized));
  };

  const openEditPickupDetails = () => {
    setPickupDetailsError('');
    setIsEditingPickupDetails(true);
  };

  const cancelEditPickupDetails = () => {
    setPickupDetailsError('');
    setIsEditingPickupDetails(false);
    const raw = String(order.pickup_date ?? '').trim();
    setPickupDate(raw ? raw.slice(0, 10) : '');
    setPickupAddressId(order.pickup_address_id ? String(order.pickup_address_id) : '');
    setDeliveredDate(String(inventoryDetail.delivered_date ?? '').trim());
    setBol(String(inventoryDetail.bol ?? '').trim());
    const preferred = String(inventoryDetail.pickup_by ?? '').trim();
    if (preferred) setPickupBy(preferred);
    setAccountManager(String(company.project_manager ?? inventoryDetail.account_manager ?? '').trim());
  };

  const savePickupDetails = async () => {
    setIsSavingPickupDetails(true);
    setPickupDetailsError('');
    try {
      const res = await fetchWithFallback(`/api/v1/crm/orders/${order.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pickup_date: pickupDate || null,
          pickup_address_id: pickupAddressId ? Number(pickupAddressId) : null,
          inventory_detail: {
            pickup_by: pickupBy,
            account_manager: accountManager,
            delivered_date: deliveredDate || null,
            bol: bol.trim() || null,
          },
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(extractApiErrorMessage(json, 'Unable to save pickup details.'));
      }
      const patch = orderPatchFromApiData(json?.data);
      if (onInventoryDetailSaved && Object.keys(patch).length > 0) {
        onInventoryDetailSaved(order.id, patch);
      }
      publishAccountManagerChange(accountManager);
      setIsEditingPickupDetails(false);
    } catch (e) {
      setPickupDetailsError(e instanceof Error ? e.message : 'Unable to save pickup details.');
    } finally {
      setIsSavingPickupDetails(false);
    }
  };

  const openAddressModal = () => {
    setAddressSaveError('');
    const id = String(pickupAddressId || '');
    const selected = pickupAddressesLocal.find((a) => String(a.id) === id) ?? null;
    if (!selected) {
      setAddressDraft({
        id: '',
        line1: '',
        line2: '',
        city: '',
        state: '',
        zip: '',
        country: 'US',
      });
      setAddressModalOpen(true);
      return;
    }
    setAddressDraft({
      id: String(selected.id),
      line1: String(selected.line1 ?? ''),
      line2: String(selected.line2 ?? ''),
      city: String(selected.city ?? ''),
      state: String(selected.state ?? ''),
      zip: String(selected.zip ?? ''),
      country: String(selected.country ?? 'US'),
    });
    setAddressModalOpen(true);
  };

  const closeAddressModal = () => {
    setAddressModalOpen(false);
    setAddressDraft(null);
    setAddressSaveError('');
    setIsSavingAddress(false);
  };

  const savePickupAddress = async () => {
    if (!addressDraft) return;
    setIsSavingAddress(true);
    setAddressSaveError('');
    try {
      const isNew =
        String(addressDraft.id).trim() === '' ||
        !pickupAddressesLocal.some((a) => String(a.id) === String(addressDraft.id));

      const pickupRow = (a: CompanyAddress) => ({
        id: a.id,
        line1: a.line1,
        line2: a.line2 ?? '',
        city: a.city,
        state: a.state,
        zip: a.zip,
        country: a.country ?? 'US',
      });

      const pickupsPayload = isNew
        ? [
            ...pickupAddressesLocal.map(pickupRow),
            {
              line1: addressDraft.line1,
              line2: addressDraft.line2 ?? '',
              city: addressDraft.city,
              state: addressDraft.state,
              zip: addressDraft.zip,
              country: addressDraft.country || 'US',
            },
          ]
        : pickupAddressesLocal.map((a) =>
            String(a.id) === String(addressDraft.id)
              ? {
                  id: a.id,
                  line1: addressDraft.line1,
                  line2: addressDraft.line2 ?? '',
                  city: addressDraft.city,
                  state: addressDraft.state,
                  zip: addressDraft.zip,
                  country: addressDraft.country || 'US',
                }
              : pickupRow(a),
          );

      const res = await fetchWithFallback(`/api/v1/crm/companies/${company.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: company.name,
          addresses: {
            pickups: pickupsPayload,
          },
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(extractApiErrorMessage(json, 'Unable to save pickup address.'));
      }
      const freshCompany = json?.data;
      if (freshCompany && onCompanyUpdated) {
        onCompanyUpdated(hydrateCompany(freshCompany));
      }
      const nextPickups = (freshCompany?.addresses ?? []).filter((a) => a.kind === 'pickup');
      setPickupAddressesLocal(nextPickups);

      let linkedPickupId: number | null = null;
      if (isNew && nextPickups.length > 0) {
        const match = nextPickups.find(
          (a) =>
            String(a.line1 ?? '').trim() === String(addressDraft.line1).trim() &&
            String(a.city ?? '').trim() === String(addressDraft.city).trim() &&
            String(a.zip ?? '').trim() === String(addressDraft.zip).trim(),
        );
        const created = match ?? nextPickups[nextPickups.length - 1];
        if (created) {
          linkedPickupId = created.id;
          setPickupAddressId(String(created.id));
        }
      } else if (!isNew && String(addressDraft.id).trim() !== '') {
        const idNum = Number(addressDraft.id);
        linkedPickupId = Number.isFinite(idNum) && idNum > 0 ? idNum : null;
      }

      if (linkedPickupId != null && onInventoryDetailSaved) {
        const orderRes = await fetchWithFallback(`/api/v1/crm/orders/${order.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pickup_address_id: linkedPickupId }),
        });
        const orderJson = await orderRes.json().catch(() => ({}));
        if (orderRes.ok) {
          onInventoryDetailSaved(order.id, orderPatchFromApiData(orderJson?.data));
        }
      }

      closeAddressModal();
    } catch (e) {
      setAddressSaveError(e instanceof Error ? e.message : 'Unable to save pickup address.');
    } finally {
      setIsSavingAddress(false);
    }
  };

  useEffect(() => {
    return () => {
      certificates.forEach((file) => {
        if (file.url && file.url.startsWith('blob:')) {
          URL.revokeObjectURL(file.url);
        }
      });
    };
  }, [certificates]);

  const handleCertificatesUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const list = input.files;
    if (!list?.length) return;
    const seen = new Set<string>();
    const files: File[] = [];
    for (const file of Array.from(list) as File[]) {
      const key = `${file.name}:${file.size}:${file.lastModified}`;
      if (seen.has(key)) continue;
      seen.add(key);
      files.push(file);
    }
    if (!files.length) return;
    setIsUploadingCertificates(true);
    setInventorySaveError('');
    setInventorySaveOk('');
    try {
      const presignPath = `/api/v1/crm/orders/${order.id}/certificates/presign`;
      const presignRes = await fetchWithFallback(presignPath, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify({
          files: files.map((f) => ({ name: f.name, size: f.size })),
        }),
      });

      const presignJson = (await presignRes.json().catch(() => ({}))) as Record<string, unknown>;

      if (!presignRes.ok && presignRes.status !== 409) {
        throw new Error(
          extractApiErrorMessage(presignJson, 'Unable to prepare certificate upload.'),
        );
      }

      let result: FormDataPostResult | null = null;

      if (presignRes.ok) {
        const uploadsUnknown = (presignJson?.data as Record<string, unknown> | undefined)?.uploads;
        const uploads = Array.isArray(uploadsUnknown) ? uploadsUnknown : [];
        const slotsOk =
          uploads.length === files.length &&
          uploads.every(
            (u) =>
              u &&
              typeof u === 'object' &&
              typeof (u as { url?: string }).url === 'string' &&
              typeof (u as { path?: string }).path === 'string',
          );

        if (slotsOk) {
          const slots = uploads as Array<{ path: string; url: string; headers?: Record<string, string> }>;
          try {
            await Promise.all(
              slots.map((slot, i) => putBlobToPresignedUrl(slot.url, files[i], slot.headers ?? {})),
            );
            const registerPath = `/api/v1/crm/orders/${order.id}/certificates/register`;
            const registerRes = await fetchWithFallback(registerPath, {
              method: 'POST',
              headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
                'X-Requested-With': 'XMLHttpRequest',
              },
              body: JSON.stringify({
                rows: slots.map((slot, i) => ({ path: slot.path, name: files[i].name })),
              }),
            });
            const registerJson = (await registerRes.json().catch(() => ({}))) as Record<string, unknown>;
            if (registerRes.ok) {
              result = { ok: true, status: registerRes.status, json: registerJson };
            }
          } catch {
            result = null;
          }
        }
      }

      if (!result) {
        const formData = new FormData();
        for (const file of files) {
          formData.append('certificates[]', file);
        }
        result = await postFormDataExpectJson(`/api/v1/crm/orders/${order.id}/certificates`, formData);
      }

      if (!result.ok) {
        if (result.status === 401) {
          throw new Error(
            'Not signed in for this exact site URL (session is per-origin). Use the same host you used at login—e.g. do not mix localhost and 127.0.0.1—or sign in again.',
          );
        }
        throw new Error(extractApiErrorMessage(result.json, 'Unable to upload certificates.'));
      }

      const json = result.json;
      const mergedFromServer = Array.isArray(json?.data) ? json.data : [];
      const normalized = normalizeCertificateItems(mergedFromServer);

      if (normalized.length === 0) {
        setInventorySaveError(
          String(json?.message ?? '').trim() ||
            'Upload finished but no certificate list was returned. Check API response and storage permissions.',
        );
        return;
      }

      setCertificates(normalized);
      setInventorySaveOk('Certificates uploaded.');

      const syncOrder = json?.order as Record<string, unknown> | undefined;
      if (syncOrder && onInventoryDetailSaved) {
        const patch = orderPatchFromApiData(syncOrder);
        if (Object.keys(patch).length > 0) {
          onInventoryDetailSaved(order.id, patch);
        }
      }
    } catch (error) {
      setInventorySaveError(error instanceof Error ? error.message : 'Unable to upload certificates.');
    } finally {
      setIsUploadingCertificates(false);
      input.value = '';
    }
  };

  const openCertificate = async (certIndex: number, download: boolean) => {
    const qs = download ? '?download=1' : '';
    const apiPath = `/api/v1/crm/orders/${order.id}/certificates/${certIndex}/link${qs}`;
    setInventorySaveError('');
    try {
      const res = await fetchWithFallback(apiPath, {
        headers: { Accept: 'application/json' },
      });
      const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (!res.ok) {
        if (res.status === 401) {
          setInventorySaveError(
            'Not signed in for this site URL. Use the same host as login (do not mix localhost and 127.0.0.1), or sign in again.',
          );
          return;
        }
        setInventorySaveError(extractApiErrorMessage(json, 'Unable to get certificate link.'));
        return;
      }
      const data = json?.data as Record<string, unknown> | undefined;
      const url = String(data?.url ?? '').trim();
      if (!url) {
        setInventorySaveError('No file link returned.');
        return;
      }
      const safeName = String(certificates[certIndex]?.name ?? '').trim() || 'certificate.pdf';
      if (download) {
        const a = document.createElement('a');
        a.href = url;
        a.download = safeName;
        a.rel = 'noopener';
        a.target = '_blank';
        document.body.appendChild(a);
        a.click();
        a.remove();
      } else {
        const w = window.open(url, '_blank', 'noopener,noreferrer');
        if (!w) {
          setInventorySaveError('Popup blocked. Allow popups for this site or use Download.');
        }
      }
    } catch (error) {
      setInventorySaveError(error instanceof Error ? error.message : 'Could not open certificate.');
    }
  };

  const saveInventoryDetail = async () => {
    if (hasBlockingUnknownTypes) {
      setInventorySaveError(
        'Add missing inventory types in Settings (with weight, and dimensions for volume) before saving.',
      );
      setInventorySaveOk('');
      return;
    }

    const certificatesPayload = certificates
      .map((file) => ({
        name: String(file.name ?? '').trim(),
        url: file.url ?? null,
        path: file.path ?? null,
      }))
      .filter((file) => file.name !== '');

    const roughPartialInvalid = roughSummaryLines.some((l) => {
      const d = String(l.device_type ?? '').trim();
      const c = String(l.count ?? '').trim();
      const w = String(l.weight_lbs ?? '').trim();
      if (!d && !c && !w) return false;
      if (!d || !isValidRoughCount(c)) return true;
      if (l.weight_mode === 'manual') {
        const wt = Number.parseFloat(w);
        if (!Number.isFinite(wt) || wt <= 0) return true;
      }
      return false;
    });
    if (roughPartialInvalid) {
      setInventorySaveError(
        'Rough summary: finish each started line (device type and count like 1, 2 box, or 1 bin). For rows on Manual lbs, enter weight; for Auto (settings), use a type that exists in Settings.',
      );
      setInventorySaveOk('');
      return;
    }

    const roughSummaryPayload = {
      lines: roughSummaryLines
        .map((l) => ({
          device_type: String(l.device_type ?? '').trim(),
          count: String(l.count ?? '').trim(),
          weight_lbs: String(l.weight_lbs ?? '').trim(),
          weight_mode: l.weight_mode,
        }))
        .filter((l) => {
          if (!l.device_type || !isValidRoughCount(l.count)) return false;
          if (l.weight_mode === 'manual') {
            const wt = Number.parseFloat(l.weight_lbs);
            return Number.isFinite(wt) && wt > 0;
          }
          return true;
        })
        .map((l) => ({
          device_type: l.device_type,
          count: l.count.trim(),
          weight_lbs: l.weight_mode === 'manual' ? l.weight_lbs : '',
          weight_mode: l.weight_mode,
        })),
    };

    if (isSimpleInventoryView) {
      for (const row of simpleSummaryRows) {
        if (!String(row.device_type ?? '').trim()) {
          setInventorySaveError('Each summary row needs a device type.');
          setInventorySaveOk('');
          return;
        }
        const cnt = Number.parseInt(String(row.count ?? '').trim(), 10);
        if (!Number.isFinite(cnt) || cnt <= 0) {
          setInventorySaveError('Count must be a whole number greater than 0 on each summary row.');
          setInventorySaveOk('');
          return;
        }
        const wt = Number.parseFloat(String(row.weight_lbs ?? '').trim());
        if (!Number.isFinite(wt) || wt <= 0) {
          setInventorySaveError('Enter a total weight (lbs) greater than 0 for each summary row.');
          setInventorySaveOk('');
          return;
        }
      }
      const first = simpleSummaryRows[0]!;
      const summaryStub = makeSummaryState(
        {
          device_type: first.device_type,
          order_id: first.order_number || String(order.source_order_id ?? ''),
        },
        String(order.source_order_id ?? ''),
        first.device_type,
      );
      setIsSavingInventoryDetail(true);
      setInventorySaveError('');
      setInventorySaveOk('');
      try {
        const res = await fetchWithFallback(`/api/v1/crm/orders/${order.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            services: selectedServices,
            pickup_date: pickupDate || null,
            pickup_address_id: pickupAddressId ? Number(pickupAddressId) : null,
            inventory_detail: {
              pickup_by: pickupBy,
              account_manager: accountManager,
              delivered_date: deliveredDate || null,
              bol: bol.trim() || null,
              summary_layout: 'simple',
              summary: summaryStub,
              devices: [],
              simple_summary: simpleSummaryRows.map((row) => ({
                order_number: String(row.order_number ?? '').trim(),
                device_type: String(row.device_type ?? '').trim(),
                count: String(row.count ?? '').trim(),
                weight_lbs: String(row.weight_lbs ?? '').trim(),
              })),
              rough_summary: roughSummaryPayload,
              certificates: certificatesPayload,
            },
          }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(extractApiErrorMessage(json, 'Unable to save inventory detail changes.'));
        }
      const patch = orderPatchFromApiData(json?.data);
      if (onInventoryDetailSaved && Object.keys(patch).length > 0) {
        onInventoryDetailSaved(order.id, patch);
      }
      publishAccountManagerChange(accountManager);
      setInventorySaveOk('Inventory detail changes saved.');
      } catch (error) {
        setInventorySaveError(
          error instanceof Error ? error.message : 'Unable to save inventory detail changes.',
        );
      } finally {
        setIsSavingInventoryDetail(false);
      }
      return;
    }

    const invalidCountEntry = deviceEntries.find((entry) => {
      const parsed = Number.parseInt(String(entry.inventory_number || ''), 10);
      return !Number.isFinite(parsed) || parsed <= 0;
    });
    if (invalidCountEntry) {
      setInventorySaveError('Inventory number must be greater than 0 for all device types.');
      setInventorySaveOk('');
      return;
    }

    const normalizedEntries = deviceEntries.map((entry) => {
      const parsed = Number.parseInt(String(entry.inventory_number || ''), 10);
      const count = Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
      const summaries = [...entry.summaries];
      while (summaries.length < count) {
        summaries.push(
          makeSummaryState(
            { device_type: entry.inventory_type },
            String(order.source_order_id ?? ''),
            entry.inventory_type,
          ),
        );
      }
      if (summaries.length > count) {
        summaries.length = count;
      }
      return {
        ...entry,
        inventory_number: String(count),
        summaries,
      };
    });

    const dupOrderIds = duplicateOrderIdsInSummaries(normalizedEntries);
    if (dupOrderIds.length > 0) {
      setInventorySaveError(
        `Duplicate Order ID(s), each line must be unique: ${dupOrderIds.join(', ')}`,
      );
      setInventorySaveOk('');
      return;
    }

    setDeviceEntries(normalizedEntries);
    setIsSavingInventoryDetail(true);
    setInventorySaveError('');
    setInventorySaveOk('');
    try {
      const res = await fetchWithFallback(`/api/v1/crm/orders/${order.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          services: selectedServices,
            pickup_date: pickupDate || null,
            pickup_address_id: pickupAddressId ? Number(pickupAddressId) : null,
          inventory_detail: {
            pickup_by: pickupBy,
            account_manager: accountManager,
            delivered_date: deliveredDate || null,
            bol: bol.trim() || null,
            summary_layout: 'detailed',
            summary: normalizedEntries[0]?.summaries?.[0] ?? makeSummaryState({}, String(order.source_order_id ?? ''), ''),
            devices: normalizedEntries.flatMap((entry) =>
              entry.summaries.map((summary, idx) => ({
                inventory_type: String(
                  (summary.device_type || entry.inventory_type || '') as string,
                ).trim(),
                inventory_number: String(idx + 1),
                summary,
              })),
            ),
            simple_summary: [],
            rough_summary: roughSummaryPayload,
            certificates: certificatesPayload,
          },
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(extractApiErrorMessage(json, 'Unable to save inventory detail changes.'));
      }
      const patch = orderPatchFromApiData(json?.data);
      if (onInventoryDetailSaved && Object.keys(patch).length > 0) {
        onInventoryDetailSaved(order.id, patch);
      }
      publishAccountManagerChange(accountManager);
      setInventorySaveOk('Inventory detail changes saved.');
    } catch (error) {
      setInventorySaveError(
        error instanceof Error ? error.message : 'Unable to save inventory detail changes.',
      );
    } finally {
      setIsSavingInventoryDetail(false);
    }
  };

  return (
    <div className="space-y-6">
      {embedded ? (
        <div className="flex flex-wrap items-center justify-end gap-2">
          {crossLinks}
          <button
            type="button"
            className="btn-primary px-3 py-1.5 text-xs"
            onClick={() => void saveInventoryDetail()}
            disabled={isSavingInventoryDetail || hasBlockingUnknownTypes}
          >
            {isSavingInventoryDetail ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      ) : (
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
              <p className="label-mono">Order Detail</p>
              <h2 className="font-display mt-1 text-2xl font-bold text-fg">{order.title}</h2>
              <p className="mt-1 text-sm text-muted">
                {company.name} · {order.source_order_id}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {crossLinks}
            <button
              type="button"
              className="btn-primary px-3 py-1.5 text-xs"
              onClick={() => void saveInventoryDetail()}
              disabled={isSavingInventoryDetail || hasBlockingUnknownTypes}
            >
              {isSavingInventoryDetail ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      )}
      {inventorySaveError ? <p className="text-sm text-rose">{inventorySaveError}</p> : null}
      {inventorySaveOk ? <p className="text-sm text-emerald">{inventorySaveOk}</p> : null}

      {hasBlockingUnknownTypes ? (
        <div className="rounded-xl border border-amber/40 bg-amber/10 px-4 py-3 text-sm text-fg">
          <p className="font-semibold text-amber">Device / inventory type not in ERP</p>
          <p className="mt-1 text-muted">
            Not defined under Settings → Inventory Types (match Type column or CSV{' '}
            <span className="font-mono">inventory_type</span>):{' '}
            <span className="font-medium text-fg">{inventoryAnalysis.unknownTypeLabels.join(', ')}</span>
          </p>
          <p className="mt-2 text-xs text-muted">
            Add each type with default weight (lbs). For volume, add length, width, and height in inches. Save is blocked
            until every row type exists in Settings.
          </p>
          <button type="button" className="btn-primary mt-3 px-3 py-1.5 text-xs" onClick={goToInventorySettings}>
            Open Settings — Inventory types
          </button>
        </div>
      ) : null}

      <div className="glass-card p-6">
        <div className="flex items-center justify-between gap-3">
          <p className="label-mono">Contact</p>
          {isEditingContact ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="btn-secondary px-3 py-1.5 text-xs"
                onClick={cancelEditContact}
                disabled={isSavingContact}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary px-3 py-1.5 text-xs"
                onClick={() => void saveContact()}
                disabled={isSavingContact}
              >
                {isSavingContact ? 'Saving...' : 'Save'}
              </button>
            </div>
          ) : (
            <button type="button" className="btn-secondary px-3 py-1.5 text-xs" onClick={startEditContact}>
              Edit
            </button>
          )}
        </div>
        {contactSaveError ? <p className="mt-2 text-sm text-rose">{contactSaveError}</p> : null}
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
          <InfoRow icon={Building2} label="HB Order ID" value={order.source_order_id || '—'} />
          {isEditingContact ? (
            <label className="flex items-center gap-3 rounded-xl border border-divider bg-subtle px-3 py-2.5">
              <User2 size={14} className="text-muted" />
              <div className="min-w-0 flex-1">
                <p className="label-mono">Pick up POC</p>
                <input
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  placeholder="Enter name"
                  className="mt-1 w-full bg-transparent text-sm text-fg outline-none"
                />
              </div>
            </label>
          ) : (
            <InfoRow icon={User2} label="Pick up POC" value={contactDisplay.name || '—'} />
          )}
          {isEditingContact ? (
            <label className="flex items-center gap-3 rounded-xl border border-divider bg-subtle px-3 py-2.5">
              <Mail size={14} className="text-muted" />
              <div className="min-w-0 flex-1">
                <p className="label-mono">Email</p>
                <input
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  placeholder="Enter email"
                  className="mt-1 w-full bg-transparent text-sm text-fg outline-none"
                />
              </div>
            </label>
          ) : (
            <InfoRow icon={Mail} label="Email" value={contactDisplay.email || '—'} />
          )}
          {isEditingContact ? (
            <label className="flex items-center gap-3 rounded-xl border border-divider bg-subtle px-3 py-2.5">
              <Phone size={14} className="text-muted" />
              <div className="min-w-0 flex-1">
                <p className="label-mono">Phone</p>
                <input
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  placeholder="Enter phone"
                  className="mt-1 w-full bg-transparent text-sm text-fg outline-none"
                />
              </div>
            </label>
          ) : (
            <InfoRow icon={Phone} label="Phone" value={formatPhone(contactDisplay.phone || '—')} />
          )}
        </div>
      </div>

      <div className="glass-card p-6">
        <div className="flex items-center justify-between gap-3">
          <p className="label-mono">Pickup details</p>
          {isEditingPickupDetails ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="btn-secondary px-3 py-1.5 text-xs"
                onClick={cancelEditPickupDetails}
                disabled={isSavingPickupDetails}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary px-3 py-1.5 text-xs"
                onClick={() => void savePickupDetails()}
                disabled={isSavingPickupDetails}
              >
                {isSavingPickupDetails ? 'Saving...' : 'Save'}
              </button>
            </div>
          ) : (
            <button type="button" className="btn-secondary px-3 py-1.5 text-xs" onClick={openEditPickupDetails}>
              Edit
            </button>
          )}
        </div>
        {pickupDetailsError ? <p className="mt-2 text-sm text-rose">{pickupDetailsError}</p> : null}
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
          {isEditingPickupDetails ? (
            <label className="rounded-xl border border-divider bg-subtle px-3 py-2.5">
              <p className="label-mono">Pickup Date</p>
              <input
                type="date"
                value={pickupDate}
                onChange={(event) => setPickupDate(event.target.value)}
                className="mt-1 w-full bg-transparent text-sm text-fg outline-none"
              />
            </label>
          ) : (
            <InfoRow icon={Calendar} label="Pickup Date" value={pickupDate ? formatDate(pickupDate) : '—'} />
          )}

          {isEditingPickupDetails ? (
            <label className="rounded-xl border border-divider bg-subtle px-3 py-2.5">
              <p className="label-mono">Pickup By</p>
              <select
                value={pickupBy}
                onChange={(event) => setPickupBy(event.target.value)}
                className="mt-1 w-full bg-transparent text-sm text-fg outline-none"
              >
                {pickupByOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <InfoRow icon={User2} label="Pickup By" value={pickupBy || '—'} />
          )}

          {isEditingPickupDetails ? (
            <label className="rounded-xl border border-divider bg-subtle px-3 py-2.5">
              <p className="label-mono">Account Manager</p>
              <select
                value={accountManager}
                onChange={(event) => setAccountManager(event.target.value)}
                className="mt-1 w-full bg-transparent text-sm text-fg outline-none"
              >
                <option value="">Select account manager</option>
                {accountManager && !accountManagerOptions.includes(accountManager) ? (
                  <option value={accountManager}>{accountManager}</option>
                ) : null}
                {accountManagerOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <InfoRow icon={User2} label="Account Manager" value={accountManager || '—'} />
          )}

          <div
            className="rounded-xl border border-divider bg-subtle px-3 py-2.5 md:col-span-2"
            title="Updates the company pickup address and this order without reloading."
          >
            <div className="flex items-start gap-3">
              <MapPin size={14} className="mt-0.5 shrink-0 text-muted" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                  <p className="label-mono">Pickup address</p>
                  <button
                    type="button"
                    className="text-xs font-semibold text-accent hover:underline"
                    onClick={openAddressModal}
                  >
                    Change address
                  </button>
                </div>
                <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-snug text-fg">
                  {pickupAddressResolved ? formatAddressInline(pickupAddressResolved) : '—'}
                </p>
              </div>
            </div>
          </div>

          {isEditingPickupDetails ? (
            <label className="rounded-xl border border-divider bg-subtle px-3 py-2.5">
              <p className="label-mono">Completed Date</p>
              <input
                type="date"
                value={deliveredDate}
                onChange={(event) => setDeliveredDate(event.target.value)}
                className="mt-1 w-full bg-transparent text-sm text-fg outline-none"
              />
            </label>
          ) : (
            <InfoRow icon={Calendar} label="Completed Date" value={deliveredDate ? formatDate(deliveredDate) : '—'} />
          )}

          {isEditingPickupDetails ? (
            <label className="rounded-xl border border-divider bg-subtle px-3 py-2.5">
              <p className="label-mono">BOL (Optional)</p>
              <input
                value={bol}
                onChange={(event) => setBol(event.target.value)}
                placeholder="Enter BOL number"
                className="mt-1 w-full bg-transparent text-sm text-fg outline-none"
              />
            </label>
          ) : (
            <InfoRow icon={Plus} label="BOL" value={bol.trim() ? bol.trim() : '—'} />
          )}
        </div>
      </div>

      {addressModalOpen ? (
        <ModalFrame onBackdropClick={closeAddressModal} panelClassName="max-w-xl p-0">
          <div className="border-b border-divider px-6 py-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="font-display text-xl font-semibold text-fg">
                  {addressDraft?.id ? 'Edit pickup address' : 'Add pickup address'}
                </h3>
                <p className="mt-1 text-sm text-muted">
                  {addressDraft?.id
                    ? 'Changes update the company pickup address and any linked orders.'
                    : 'Creates a company pickup address. Save pickup details below to attach it to this order.'}
                </p>
              </div>
              <button type="button" className="btn-secondary px-3 py-1.5 text-xs" onClick={closeAddressModal}>
                Close
              </button>
            </div>
          </div>
          <div className="px-6 py-5">
            {addressSaveError ? (
              <div className="mb-4 rounded-xl border border-rose/30 bg-rose/10 px-4 py-3 text-sm text-rose">
                {addressSaveError}
              </div>
            ) : null}
            {addressDraft ? (
              <div className="space-y-4">
                <div>
                  <label className="label-mono">Address line 1</label>
                  <input
                    value={addressDraft.line1}
                    onChange={(e) => setAddressDraft((p) => (p ? { ...p, line1: e.target.value } : p))}
                    className="input-surface mt-1 w-full"
                  />
                </div>
                <div>
                  <label className="label-mono">Address line 2</label>
                  <input
                    value={addressDraft.line2}
                    onChange={(e) => setAddressDraft((p) => (p ? { ...p, line2: e.target.value } : p))}
                    className="input-surface mt-1 w-full"
                  />
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="label-mono">City</label>
                    <input
                      value={addressDraft.city}
                      onChange={(e) => setAddressDraft((p) => (p ? { ...p, city: e.target.value } : p))}
                      className="input-surface mt-1 w-full"
                    />
                  </div>
                  <div>
                    <label className="label-mono">State</label>
                    <input
                      value={addressDraft.state}
                      onChange={(e) => setAddressDraft((p) => (p ? { ...p, state: e.target.value } : p))}
                      className="input-surface mt-1 w-full"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="label-mono">ZIP</label>
                    <input
                      value={addressDraft.zip}
                      onChange={(e) => setAddressDraft((p) => (p ? { ...p, zip: e.target.value } : p))}
                      className="input-surface mt-1 w-full"
                    />
                  </div>
                  <div>
                    <label className="label-mono">Country</label>
                    <input
                      value={addressDraft.country}
                      onChange={(e) => setAddressDraft((p) => (p ? { ...p, country: e.target.value } : p))}
                      className="input-surface mt-1 w-full"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    className="btn-secondary px-4 py-2 text-sm"
                    onClick={closeAddressModal}
                    disabled={isSavingAddress}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn-primary px-4 py-2 text-sm"
                    onClick={() => void savePickupAddress()}
                    disabled={isSavingAddress}
                  >
                    {isSavingAddress ? 'Saving...' : 'Save address'}
                  </button>
                </div>
              </div>
            ) : (
              <Empty label="No pickup address selected." />
            )}
          </div>
        </ModalFrame>
      ) : null}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="glass-card p-6">
          <p className="label-mono">Services</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {serviceOptions.map((service) => {
              const checked = selectedServices.includes(service);
              return (
                <button
                  key={service}
                  type="button"
                  role="checkbox"
                  aria-checked={checked}
                  onClick={() => {
                    setSelectedServices((prev) => {
                      if (prev.includes(service)) return prev.filter((item) => item !== service);
                      return [...prev, service];
                    });
                  }}
                  className={cn(
                    'inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition-colors',
                    checked
                      ? 'border-accent/35 bg-accent/10 text-fg'
                      : 'border-divider bg-subtle text-muted hover:text-fg',
                  )}
                >
                  <span
                    className={cn(
                      'flex h-5 w-5 items-center justify-center rounded-md border transition-colors',
                      checked ? 'border-accent bg-accent text-white' : 'border-divider bg-transparent text-transparent',
                    )}
                    aria-hidden
                  >
                    <Check size={14} strokeWidth={3} />
                  </span>
                  <span className="whitespace-nowrap">{service}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="glass-card p-6">
          <p className="label-mono">Certificates</p>
          <p className="mt-2 text-sm text-muted">Upload and download certificates.</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input
              ref={certificateFileInputRef}
              type="file"
              multiple
              accept="application/pdf,.pdf"
              className="sr-only"
              tabIndex={-1}
              disabled={isUploadingCertificates}
              onChange={handleCertificatesUpload}
            />
            <button
              type="button"
              aria-label="Upload certificates"
              className="btn-secondary cursor-pointer px-3 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isUploadingCertificates}
              onClick={() => certificateFileInputRef.current?.click()}
            >
              {isUploadingCertificates ? 'Uploading…' : 'Upload Certificates'}
            </button>
            {certificates.length > 0 ? (
              <button
                type="button"
                className="btn-secondary px-3 py-1.5 text-xs"
                onClick={() => setCertificates([])}
              >
                Clear All
              </button>
            ) : null}
          </div>
          <div className="mt-3 space-y-2">
            {certificates.length === 0 ? (
              <p className="text-sm text-muted">No certificates uploaded.</p>
            ) : (
              certificates.map((file, idx) => (
                <div
                  key={`${file.name}-${file.url ?? idx}`}
                  className="flex items-center justify-between rounded-lg border border-divider bg-subtle px-3 py-2"
                >
                    {file.url || file.path ? (
                      <button
                        type="button"
                        onClick={() => void openCertificate(idx, false)}
                        className="truncate text-left text-sm text-accent hover:underline"
                      >
                        {file.name}
                      </button>
                    ) : (
                      <span className="truncate text-sm text-fg">{file.name}</span>
                    )}
                  <div className="ml-3 flex items-center gap-2">
                    {file.url || file.path ? (
                      <button
                        type="button"
                        className="text-xs font-semibold text-accent hover:underline"
                        onClick={() => void openCertificate(idx, true)}
                      >
                        Download
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="text-xs font-semibold text-rose hover:underline"
                      onClick={() =>
                        setCertificates((prev) => prev.filter((_, itemIdx) => itemIdx !== idx))
                      }
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="glass-card p-5 sm:p-6">
        <div className="min-w-0">
          <p className="label-mono">Rough weight estimate</p>
        </div>

        <div className="mt-4 overflow-hidden rounded-xl border border-divider bg-subtle/20">
          <table className="w-full table-fixed border-collapse text-[13px]">
            <colgroup>
              <col />
              <col className="w-[6.5rem]" />
              <col className="w-[8.5rem]" />
              <col className="w-[6rem]" />
              <col className="w-[3rem]" />
            </colgroup>
            <thead>
              <tr className="border-b border-divider bg-subtle/60">
                <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted">
                  Device type
                </th>
                <th className="whitespace-nowrap px-2 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-muted">
                  Count
                </th>
                <th className="whitespace-nowrap px-1 py-2.5 text-center text-[11px] font-semibold uppercase tracking-wider text-muted">
                  Lbs source
                </th>
                <th className="whitespace-nowrap px-2 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-muted">
                  Lbs
                </th>
                <th className="whitespace-nowrap px-2 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-muted" />
              </tr>
            </thead>
            <tbody>
              {roughSummaryLines.map((line) => (
                <tr
                  key={line.id}
                  className="border-b border-divider/80 bg-transparent last:border-b-0 hover:bg-subtle/40"
                >
                  <td className="min-w-0 px-3 py-2.5">
                    {deviceTypeOptions.length > 0 ? (
                      <select
                        className="input-surface h-10 w-full max-w-[26rem] min-w-0 py-2 pl-3 pr-9 text-[13px] leading-normal"
                        value={line.device_type}
                        onChange={(e) =>
                          setRoughSummaryLines((prev) =>
                            prev.map((l) =>
                              l.id === line.id ? { ...l, device_type: e.target.value } : l,
                            ),
                          )
                        }
                      >
                        <option value="">—</option>
                        {line.device_type && !deviceTypeOptions.includes(line.device_type) ? (
                          <option value={line.device_type}>{line.device_type}</option>
                        ) : null}
                        {deviceTypeOptions.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        className="input-surface h-10 w-full max-w-[26rem] min-w-0 py-2 px-3 text-[13px] leading-normal"
                        value={line.device_type}
                        placeholder="Type"
                        onChange={(e) =>
                          setRoughSummaryLines((prev) =>
                            prev.map((l) =>
                              l.id === line.id ? { ...l, device_type: e.target.value } : l,
                            ),
                          )
                        }
                      />
                    )}
                  </td>
                  <td className="whitespace-nowrap px-2 py-2.5 text-right align-middle">
                    <div className="flex justify-end">
                      <input
                        type="text"
                        autoComplete="off"
                        spellCheck={false}
                        maxLength={40}
                        placeholder="1 box"
                        aria-label="Count"
                        className="input-surface box-border h-10 w-[9.5rem] min-w-[9.5rem] max-w-[9.5rem] shrink-0 py-2 px-2 text-left text-[13px] leading-normal"
                        value={line.count}
                        onChange={(e) => {
                          const next = normalizeRoughCountInput(e.target.value);
                          setRoughSummaryLines((prev) =>
                            prev.map((l) => (l.id === line.id ? { ...l, count: next } : l)),
                          );
                        }}
                        onBlur={(e) => {
                          const trimmed = e.target.value.trim();
                          if (trimmed === line.count) return;
                          setRoughSummaryLines((prev) =>
                            prev.map((l) => (l.id === line.id ? { ...l, count: trimmed } : l)),
                          );
                        }}
                      />
                    </div>
                  </td>
                  <td className="px-1 py-2.5">
                    <div className="flex justify-center">
                      <div className="flex h-10 w-full max-w-[8rem] gap-1 rounded-lg border border-divider bg-subtle p-1">
                      <button
                        type="button"
                        title="Weight from Settings (default lbs × count)"
                        className={cn(
                          'min-w-0 flex-1 rounded-md px-1.5 py-1 text-[11px] font-bold uppercase leading-tight transition-colors',
                          line.weight_mode === 'settings'
                            ? 'bg-accent text-white shadow-sm'
                            : 'text-muted hover:text-fg',
                        )}
                        onClick={() =>
                          setRoughSummaryLines((prev) =>
                            prev.map((l) =>
                              l.id === line.id ? { ...l, weight_mode: 'settings' as const } : l,
                            ),
                          )
                        }
                      >
                        Auto
                      </button>
                      <button
                        type="button"
                        title="Enter lbs manually for this row"
                        className={cn(
                          'min-w-0 flex-1 rounded-md px-1.5 py-1 text-[11px] font-bold uppercase leading-tight transition-colors',
                          line.weight_mode === 'manual'
                            ? 'bg-accent text-white shadow-sm'
                            : 'text-muted hover:text-fg',
                        )}
                        onClick={() =>
                          setRoughSummaryLines((prev) =>
                            prev.map((l) =>
                              l.id === line.id ? { ...l, weight_mode: 'manual' as const } : l,
                            ),
                          )
                        }
                      >
                        Manual
                      </button>
                      </div>
                    </div>
                  </td>
                  <td className="px-2 py-2.5 text-right">
                    {line.weight_mode === 'manual' ? (
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        className="input-surface h-10 w-full py-2 px-3 text-right text-[13px] leading-normal tabular-nums"
                        value={line.weight_lbs}
                        placeholder="lbs"
                        onChange={(e) =>
                          setRoughSummaryLines((prev) =>
                            prev.map((l) =>
                              l.id === line.id ? { ...l, weight_lbs: e.target.value } : l,
                            ),
                          )
                        }
                      />
                    ) : (
                      <div className="flex h-10 items-center justify-end tabular-nums text-[13px] font-medium text-fg">
                        {(() => {
                          const c = roughCountMultiplier(String(line.count ?? ''));
                          if (c === null || c <= 0) return '—';
                          const key = String(line.device_type ?? '').trim().toLowerCase();
                          if (!key) return '—';
                          const prof = inventoryProfiles.get(key);
                          if (!prof) return '—';
                          return (Math.round(c * prof.weightLbs * 100) / 100).toLocaleString();
                        })()}
                      </div>
                    )}
                  </td>
                  <td className="px-2 py-2.5 text-right">
                    <button
                      type="button"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted transition-colors hover:bg-rose/10 hover:text-rose"
                      onClick={() =>
                        setRoughSummaryLines((prev) =>
                          prev.length <= 1 ? [makeRoughLine()] : prev.filter((l) => l.id !== line.id),
                        )
                      }
                      aria-label="Remove row"
                    >
                      <X size={16} aria-hidden />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            className="btn-secondary inline-flex items-center gap-1 px-3 py-1.5 text-xs"
            onClick={() => setRoughSummaryLines((prev) => [...prev, makeRoughLine()])}
          >
            <Plus size={14} aria-hidden />
            Add device line
          </button>
          <div className="text-right">
            <span className="text-[12px] font-semibold text-muted">Approx. total (lbs)</span>
            <span className="ml-2 text-base font-bold tabular-nums text-fg">
              {roughTotalLbs > 0 ? roughTotalLbs.toLocaleString() : '—'}
            </span>
          </div>
        </div>
        {roughSummaryLines.some((l) => l.weight_mode === 'settings') && inventoryProfiles.size === 0 ? (
          <p className="mt-2 text-[11px] text-muted">
            Load inventory types from Settings to use Auto lbs, or set those rows to Manual.
          </p>
        ) : null}
      </div>

      {(simpleSummaryRows.length > 0 || summaryRows.length > 0) && (
        <div className="glass-card p-5 sm:p-6">
          <div className="flex flex-col gap-1">
            <p className="label-mono">Inventory snapshot</p>
            <p className="text-[12px] leading-snug text-muted">
              Quick roll-up of the summary below (totals match the table and orders list volume where applicable).
            </p>
          </div>
          {isSimpleInventoryView ? (
            <div className="mt-4 overflow-hidden rounded-lg border border-divider">
              <table className="w-full table-fixed border-collapse text-[13px]">
                <colgroup>
                  <col />
                  <col className="w-[4.5rem]" />
                  <col className="w-[5.75rem]" />
                </colgroup>
                <thead>
                  <tr className="border-b border-divider bg-subtle/60">
                    <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted">
                      Device type
                    </th>
                    <th className="whitespace-nowrap px-2 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-muted">
                      Count
                    </th>
                    <th className="whitespace-nowrap px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-muted">
                      Total (lbs)
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {simpleSnapshotRows.map((r) => (
                    <tr key={r.id} className="border-b border-divider/80 last:border-b-0">
                      <td className="min-w-0 px-3 py-2.5">
                        <span className="block truncate font-semibold text-fg">{r.deviceType}</span>
                      </td>
                      <td className="px-2 py-2.5 text-right tabular-nums font-medium text-fg">{r.countDisplay}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums font-medium text-fg">
                        {r.weightLbs != null ? r.weightLbs.toLocaleString() : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-divider bg-subtle/40">
                    <td
                      colSpan={2}
                      className="px-3 py-2.5 text-left text-[12px] font-semibold text-muted"
                    >
                      Sum of row weights
                    </td>
                    <td className="px-3 py-2.5 text-right text-sm font-bold tabular-nums text-fg">
                      {simpleSummaryTotalLbs > 0 ? simpleSummaryTotalLbs.toLocaleString() : '—'}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          ) : detailedSnapshotRows && detailedSnapshotRows.length > 0 ? (
            <div className="mt-4 overflow-hidden rounded-lg border border-divider">
              <table className="w-full table-fixed border-collapse text-[13px]">
                <colgroup>
                  <col />
                  <col className="w-[6.25rem]" />
                  <col className="w-[5.75rem]" />
                </colgroup>
                <thead>
                  <tr className="border-b border-divider bg-subtle/60">
                    <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted">
                      Device type
                    </th>
                    <th className="whitespace-nowrap px-2 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-muted">
                      Lines / units
                    </th>
                    <th className="whitespace-nowrap px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-muted">
                      Est. (lbs)
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {detailedSnapshotRows.map((r) => (
                    <tr key={r.id} className="border-b border-divider/80 last:border-b-0">
                      <td className="min-w-0 px-3 py-2.5">
                        <span className="block truncate font-semibold text-fg">{r.deviceType}</span>
                        {r.unknown ? (
                          <span className="mt-0.5 block text-[10px] font-semibold uppercase tracking-wide text-rose">
                            Not in ERP
                          </span>
                        ) : null}
                      </td>
                      <td className="px-2 py-2.5 text-right tabular-nums font-medium text-fg">
                        {r.lineCount} / {r.unitCount}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums font-medium text-fg">
                        {r.weightLbs != null ? r.weightLbs.toLocaleString() : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-divider bg-subtle/40">
                    <td
                      colSpan={2}
                      className="px-3 py-2.5 text-left text-[12px] font-semibold text-muted"
                    >
                      Grand total
                    </td>
                    <td className="px-3 py-2.5 text-right text-sm font-bold tabular-nums text-fg">
                      {settingsInventoryResolved ? inventoryAnalysis.overallWeightLbs.toLocaleString() : '—'}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          ) : null}
        </div>
      )}

      <div className="glass-card p-6">
        <div className="flex items-center justify-between gap-3">
          <p className="label-mono">Summary Table</p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="btn-secondary px-3 py-1.5 text-xs text-rose"
              onClick={() => {
                setDeviceEntries([]);
                setSimpleSummaryRows([]);
                setEditingSimpleRowId(null);
                setSimpleRowDraft(null);
                setEditingSummaryRowKey(null);
              }}
            >
              Clear Table
            </button>
            <button
              type="button"
              className="btn-secondary inline-flex items-center gap-1 px-3 py-1.5 text-xs"
              onClick={addEmptySummaryTableRow}
              title="Add empty row (base order # locked, digits after — only)"
            >
              <Plus size={14} aria-hidden />
              Row
            </button>
            <button
              type="button"
              className="btn-secondary px-3 py-1.5 text-xs"
              onClick={openAddDataModal}
            >
              Add Data
            </button>
          </div>
        </div>
        {summaryRows.length === 0 && simpleSummaryRows.length === 0 ? (
          <div className="mt-4 rounded-xl border border-dashed border-divider bg-subtle/40 px-6 py-14 text-center">
            <p className="text-sm text-muted">No inventory summary yet.</p>
            <p className="mt-1 text-xs text-muted">
              Use Add Data for a short summary line (order #, type, count, total weight lbs) or a full per-unit table.
            </p>
          </div>
        ) : isSimpleInventoryView ? (
          <div ref={summaryTableWrapRef} className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-sm">
              <thead className="bg-subtle/60">
                <tr>
                  <Th>Order #</Th>
                  <Th>Device type</Th>
                  <Th>Count</Th>
                  <Th>Total weight (lbs)</Th>
                  <Th>Actions</Th>
                </tr>
              </thead>
              <tbody>
                {simpleSummaryRows.map((row) => {
                  const isEditing = editingSimpleRowId === row.id && simpleRowDraft != null;
                  const d = isEditing ? simpleRowDraft! : row;
                  return (
                    <tr
                      key={row.id}
                      data-simple-summary-row={isEditing ? row.id : undefined}
                      className={cn('border-t border-divider hover:bg-subtle', !isEditing && 'cursor-pointer')}
                      onDoubleClick={() => {
                        if (!isEditing) startEditSimpleRow(row.id);
                      }}
                    >
                      <Td>
                        {isEditing ? (
                          <SummaryOrderIdField
                            orderId={d.order_number}
                            sourceOrderId={String(order.source_order_id ?? '')}
                            onChange={(next) => patchSimpleRowDraft({ order_number: next })}
                          />
                        ) : (
                          <span className="font-mono text-sm text-fg">{row.order_number || '—'}</span>
                        )}
                      </Td>
                      <Td>
                        {isEditing ? (
                          deviceTypeOptions.length > 0 ? (
                            <select
                              className="input-surface min-w-[160px]"
                              value={d.device_type}
                              onChange={(e) => patchSimpleRowDraft({ device_type: e.target.value })}
                            >
                              <option value="">—</option>
                              {d.device_type && !deviceTypeOptions.includes(d.device_type) ? (
                                <option value={d.device_type}>{d.device_type}</option>
                              ) : null}
                              {deviceTypeOptions.map((opt) => (
                                <option key={opt} value={opt}>
                                  {opt}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <input
                              className="input-surface min-w-[160px]"
                              value={d.device_type}
                              onChange={(e) => patchSimpleRowDraft({ device_type: e.target.value })}
                            />
                          )
                        ) : (
                          <span className="font-medium text-fg">{row.device_type || '—'}</span>
                        )}
                      </Td>
                      <Td>
                        {isEditing ? (
                          <input
                            type="number"
                            min={1}
                            step={1}
                            className="input-surface w-[100px]"
                            value={d.count}
                            onChange={(e) => patchSimpleRowDraft({ count: e.target.value })}
                          />
                        ) : (
                          <span className="tabular-nums text-fg">{row.count || '—'}</span>
                        )}
                      </Td>
                      <Td>
                        {isEditing ? (
                          <input
                            type="number"
                            min={0}
                            step={0.01}
                            className="input-surface w-[120px]"
                            placeholder="Total lbs"
                            value={d.weight_lbs}
                            onChange={(e) => patchSimpleRowDraft({ weight_lbs: e.target.value })}
                          />
                        ) : (
                          <span className="tabular-nums text-fg">{row.weight_lbs || '—'}</span>
                        )}
                      </Td>
                      <Td>
                        {isEditing ? (
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              className="btn-primary px-2 py-1 text-xs"
                              onClick={() => commitSimpleRowEdit()}
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              className="btn-secondary px-2 py-1 text-xs"
                              onClick={() => discardSimpleRowEdit()}
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              className="text-xs font-semibold text-rose hover:underline"
                              onClick={() => removeSimpleSummaryRow(row.id)}
                            >
                              Remove
                            </button>
                          </div>
                        ) : (
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              className="text-xs font-semibold text-accent hover:underline"
                              onClick={() => startEditSimpleRow(row.id)}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              className="text-xs font-semibold text-rose hover:underline"
                              onClick={() => removeSimpleSummaryRow(row.id)}
                            >
                              Remove
                            </button>
                          </div>
                        )}
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div ref={summaryTableWrapRef} className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[2140px] border-collapse text-sm">
              <thead className="bg-subtle/60">
                <tr>
                  <Th>Type</Th>
                  <Th>Order ID</Th>
                  <Th>Location</Th>
                  <Th>Serial</Th>
                  <Th>Model</Th>
                  <Th>Processor</Th>
                  <Th>GPU</Th>
                  <Th>RAM</Th>
                  <Th>Storage</Th>
                  <Th>OS</Th>
                  <Th>Battery</Th>
                  <Th>Display</Th>
                  <Th>Touch</Th>
                  <Th>Grade</Th>
                  <Th>Data Wipe</Th>
                  <Th>Wipe Date</Th>
                  <Th>HDD Model</Th>
                  <Th>HDD Serial</Th>
                  <Th>Next Step</Th>
                  <Th>Notes</Th>
                  <Th>Actions</Th>
                </tr>
              </thead>
              <tbody>
                {summaryRows.map((row) => {
                  const isEditing = editingSummaryRowKey === row.key;
                  const s = row.summary;
                  const rowUnknown = settingsInventoryResolved && inventoryAnalysis.unknownRowKeys.has(row.key);
                  const typeSelectValue = (s.device_type || row.inventoryType || '').trim();
                  return (
                    <tr
                      key={row.key}
                      data-summary-row-key={row.key}
                      className={cn(
                        'border-t border-divider hover:bg-subtle',
                        rowUnknown && 'bg-rose/[0.06] ring-1 ring-rose/30 ring-inset',
                      )}
                      onDoubleClick={() => setEditingSummaryRowKey(row.key)}
                    >
                      <Td>
                        {isEditing ? (
                          deviceTypeOptions.length > 0 ? (
                            <select
                              className="input-surface min-w-[140px]"
                              value={typeSelectValue}
                              onChange={(e) =>
                                patchDeviceSummary(row.deviceId, row.summaryIdx, {
                                  device_type: e.target.value,
                                })
                              }
                            >
                              <option value="">—</option>
                              {typeSelectValue && !deviceTypeOptions.includes(typeSelectValue) ? (
                                <option value={typeSelectValue}>{typeSelectValue}</option>
                              ) : null}
                              {deviceTypeOptions.map((opt) => (
                                <option key={opt} value={opt}>
                                  {opt}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <input
                              className="input-surface min-w-[140px]"
                              value={s.device_type}
                              onChange={(e) =>
                                patchDeviceSummary(row.deviceId, row.summaryIdx, {
                                  device_type: e.target.value,
                                })
                              }
                            />
                          )
                        ) : (
                          <>
                            <div className={cn('font-medium', rowUnknown && 'text-rose')}>
                              {row.inventoryType || '—'}
                            </div>
                            {rowUnknown ? (
                              <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-rose">
                                Not in ERP
                              </p>
                            ) : null}
                          </>
                        )}
                      </Td>
                      <Td>
                        {isEditing ? (
                          <SummaryOrderIdField
                            orderId={s.order_id}
                            sourceOrderId={String(order.source_order_id ?? '')}
                            onChange={(next) =>
                              patchDeviceSummary(row.deviceId, row.summaryIdx, { order_id: next })
                            }
                          />
                        ) : (
                          <span className="font-mono text-sm text-fg">{s.order_id || '—'}</span>
                        )}
                      </Td>
                      <Td>{isEditing ? <input className="input-surface w-[140px]" value={s.location} onChange={(e) => patchDeviceSummary(row.deviceId, row.summaryIdx, { location: e.target.value })} /> : s.location || '—'}</Td>
                      <Td>{isEditing ? <input className="input-surface w-[140px]" value={s.serial_number} onChange={(e) => patchDeviceSummary(row.deviceId, row.summaryIdx, { serial_number: e.target.value })} /> : s.serial_number || '—'}</Td>
                      <Td>{isEditing ? <input className="input-surface w-[140px]" value={s.model_type} onChange={(e) => patchDeviceSummary(row.deviceId, row.summaryIdx, { model_type: e.target.value })} /> : s.model_type || '—'}</Td>
                      <Td>{isEditing ? <input className="input-surface w-[140px]" value={s.processor} onChange={(e) => patchDeviceSummary(row.deviceId, row.summaryIdx, { processor: e.target.value })} /> : s.processor || '—'}</Td>
                      <Td>{isEditing ? <input className="input-surface w-[140px]" value={s.gpu} onChange={(e) => patchDeviceSummary(row.deviceId, row.summaryIdx, { gpu: e.target.value })} /> : s.gpu || '—'}</Td>
                      <Td>{isEditing ? <input className="input-surface w-[100px]" value={s.ram} onChange={(e) => patchDeviceSummary(row.deviceId, row.summaryIdx, { ram: e.target.value })} /> : s.ram || '—'}</Td>
                      <Td>{isEditing ? <input className="input-surface w-[120px]" value={s.storage} onChange={(e) => patchDeviceSummary(row.deviceId, row.summaryIdx, { storage: e.target.value })} /> : s.storage || '—'}</Td>
                      <Td>{isEditing ? <input className="input-surface w-[120px]" value={s.os} onChange={(e) => patchDeviceSummary(row.deviceId, row.summaryIdx, { os: e.target.value })} /> : s.os || '—'}</Td>
                      <Td>{isEditing ? <input className="input-surface w-[120px]" value={s.battery_health} onChange={(e) => patchDeviceSummary(row.deviceId, row.summaryIdx, { battery_health: e.target.value })} /> : s.battery_health || '—'}</Td>
                      <Td>{isEditing ? <input className="input-surface w-[120px]" value={s.display} onChange={(e) => patchDeviceSummary(row.deviceId, row.summaryIdx, { display: e.target.value })} /> : s.display || '—'}</Td>
                      <Td>
                        {isEditing ? (
                          <select className="input-surface w-[90px]" value={s.touch} onChange={(e) => patchDeviceSummary(row.deviceId, row.summaryIdx, { touch: e.target.value })}>
                            <option value="Yes">Yes</option>
                            <option value="No">No</option>
                          </select>
                        ) : (s.touch || 'No')}
                      </Td>
                      <Td>
                        {isEditing ? (
                          <select className="input-surface w-[90px]" value={s.cosmetic_condition_grade} onChange={(e) => patchDeviceSummary(row.deviceId, row.summaryIdx, { cosmetic_condition_grade: e.target.value })}>
                            <option value="">-</option>
                            {cosmeticGradeOptions.map((gradeOption) => (
                              <option key={gradeOption} value={gradeOption}>{gradeOption}</option>
                            ))}
                          </select>
                        ) : (s.cosmetic_condition_grade || '—')}
                      </Td>
                      <Td>
                        {isEditing ? (
                          <select className="input-surface w-[90px]" value={s.data_wipe_enabled ? 'Yes' : 'No'} onChange={(e) => patchDeviceSummary(row.deviceId, row.summaryIdx, { data_wipe_enabled: e.target.value === 'Yes' })}>
                            <option value="No">No</option>
                            <option value="Yes">Yes</option>
                          </select>
                        ) : (s.data_wipe_enabled ? 'Yes' : 'No')}
                      </Td>
                      <Td>{isEditing ? <input type="date" className="input-surface w-[140px]" value={s.data_wipe_calendar} onChange={(e) => patchDeviceSummary(row.deviceId, row.summaryIdx, { data_wipe_calendar: e.target.value })} /> : s.data_wipe_calendar || '—'}</Td>
                      <Td>{isEditing ? <input className="input-surface w-[130px]" value={s.hdd_model} onChange={(e) => patchDeviceSummary(row.deviceId, row.summaryIdx, { hdd_model: e.target.value })} /> : s.hdd_model || '—'}</Td>
                      <Td>{isEditing ? <input className="input-surface w-[130px]" value={s.hdd_serial_number} onChange={(e) => patchDeviceSummary(row.deviceId, row.summaryIdx, { hdd_serial_number: e.target.value })} /> : s.hdd_serial_number || '—'}</Td>
                      <Td>{isEditing ? <input className="input-surface w-[140px]" value={s.next_step} onChange={(e) => patchDeviceSummary(row.deviceId, row.summaryIdx, { next_step: e.target.value })} /> : s.next_step || '—'}</Td>
                      <Td>{isEditing ? <input className="input-surface w-[180px]" value={s.notes} onChange={(e) => patchDeviceSummary(row.deviceId, row.summaryIdx, { notes: e.target.value })} /> : s.notes || '—'}</Td>
                      <Td>
                        {isEditing ? (
                          <div className="flex gap-2">
                            <button type="button" className="btn-secondary px-2 py-1 text-xs" onClick={() => setEditingSummaryRowKey(null)}>Save Row</button>
                            <button type="button" className="btn-secondary px-2 py-1 text-xs" onClick={() => setEditingSummaryRowKey(null)}>Close</button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            className="text-xs font-semibold text-rose hover:underline"
                            onClick={() => removeSummaryRow(row.deviceId, row.summaryIdx)}
                          >
                            Delete
                          </button>
                        )}
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {isSimpleInventoryView ? (
          <div className="mt-4 flex flex-wrap items-center justify-end gap-3 border-t border-divider pt-4 text-sm">
            <span className="label-mono text-muted">Total weight (lbs)</span>
            <span className="text-lg font-bold tabular-nums text-fg">{simpleSummaryTotalLbs.toLocaleString()}</span>
            <span className="text-xs text-muted">
              Sum of total weight (lbs) per row. The orders list Volume column shows this value (no count × weight).
            </span>
          </div>
        ) : summaryRows.length > 0 ? (
          <div className="mt-4 flex flex-wrap items-center justify-end gap-3 border-t border-divider pt-4 text-sm">
            <span className="label-mono text-muted">Total weight (lbs)</span>
            <span className="text-lg font-bold tabular-nums text-fg">
              {settingsInventoryResolved ? inventoryAnalysis.overallWeightLbs.toLocaleString() : '—'}
            </span>
            <span className="text-xs text-muted">
              Sum of (inventory # for that line ÷ rows on line) × default weight for each row&apos;s type.
            </span>
          </div>
        ) : null}
      </div>
      {outsideEditConfirmOpen ? (
        <ModalFrameSplit
          ref={outsideEditConfirmRef}
          backdropZClass="z-[55]"
          shellZClass="z-[56]"
          panelClassName="max-w-md p-6 shadow-xl"
        >
          <div role="alertdialog" aria-labelledby="outside-edit-confirm-title">
            <p id="outside-edit-confirm-title" className="text-base font-semibold text-primary">
              Save changes?
            </p>
            <p className="mt-2 text-sm text-secondary">
              You clicked outside the row while editing. Close the editor? Your edits stay in the table until you save the
              order.
            </p>
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                className="btn-secondary px-4 py-2 text-sm"
                onClick={() => setOutsideEditConfirmOpen(false)}
              >
                No, keep editing
              </button>
              <button
                type="button"
                className="btn-primary px-4 py-2 text-sm"
                onClick={() => {
                  setOutsideEditConfirmOpen(false);
                  setEditingSummaryRowKey(null);
                }}
              >
                Yes, close editor
              </button>
            </div>
          </div>
        </ModalFrameSplit>
      ) : null}
      {outsideSimpleEditConfirmOpen ? (
        <ModalFrameSplit
          ref={outsideSimpleEditConfirmRef}
          backdropZClass="z-[57]"
          shellZClass="z-[58]"
          panelClassName="max-w-md p-6 shadow-xl"
        >
          <div role="alertdialog" aria-labelledby="outside-simple-edit-confirm-title">
            <p id="outside-simple-edit-confirm-title" className="text-base font-semibold text-primary">
              Save changes?
            </p>
            <p className="mt-2 text-sm text-secondary">
              You clicked outside the summary row while editing. Save your changes to the row, keep editing, or discard
              them?
            </p>
            <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
              <button
                type="button"
                className="btn-secondary px-4 py-2 text-sm"
                onClick={() => setOutsideSimpleEditConfirmOpen(false)}
              >
                Keep editing
              </button>
              <button
                type="button"
                className="btn-secondary px-4 py-2 text-sm"
                onClick={() => {
                  setOutsideSimpleEditConfirmOpen(false);
                  discardSimpleRowEdit();
                }}
              >
                Discard changes
              </button>
              <button
                type="button"
                className="btn-primary px-4 py-2 text-sm"
                onClick={() => {
                  setOutsideSimpleEditConfirmOpen(false);
                  commitSimpleRowEdit();
                }}
              >
                Save row
              </button>
            </div>
          </div>
        </ModalFrameSplit>
      ) : null}
      {isAddDataModalOpen ? (
        <ModalFrame
          panelClassName="max-w-lg p-6"
          onBackdropClick={() => setIsAddDataModalOpen(false)}
        >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <p className="label-mono">Add Data</p>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  className="btn-secondary px-2.5 py-1 text-[11px] leading-tight"
                  onClick={handleDownloadCsvTemplate}
                >
                  Download CSV Template
                </button>
                <label className="btn-secondary cursor-pointer px-2.5 py-1 text-[11px] leading-tight">
                  Upload CSV
                  <input type="file" accept=".csv,text/csv" className="hidden" onChange={handleCsvUpload} />
                </label>
                <button
                  type="button"
                  className="btn-secondary px-2.5 py-1 text-[11px] leading-tight"
                  onClick={() => setIsAddDataModalOpen(false)}
                >
                  Cancel
                </button>
              </div>
            </div>
            <div className="mt-5 space-y-4">
              <label className="block">
                <span className="label-mono">Device / inventory type</span>
                {deviceTypeOptions.length > 0 ? (
                  <select
                    className="input-surface mt-2 w-full"
                    value={addModalInventoryType}
                    onChange={(e) => setAddModalInventoryType(e.target.value)}
                  >
                    <option value="">— Select —</option>
                    {deviceTypeOptions.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    className="input-surface mt-2 w-full"
                    value={addModalInventoryType}
                    onChange={(e) => setAddModalInventoryType(e.target.value)}
                    placeholder="e.g. Laptop"
                  />
                )}
              </label>
              <label className="block">
                <span className="label-mono">Inventory count</span>
                <input
                  type="number"
                  min={1}
                  step={1}
                  className="input-surface mt-2 w-full"
                  value={addModalInventoryCount}
                  onChange={(e) => setAddModalInventoryCount(e.target.value)}
                />
              </label>
            </div>
            <div className="mt-6 flex flex-col gap-2">
              <button
                type="button"
                className="btn-primary w-full px-3 py-2 text-center text-[11px] leading-snug"
                onClick={handleAddSimpleSummaryRowFromModal}
              >
                Short summary
              </button>
              <button
                type="button"
                className="btn-secondary w-full px-3 py-2 text-center text-[11px] leading-snug"
                onClick={handleAddDetailedTableFromModal}
              >
                Full per-unit table
              </button>
            </div>
        </ModalFrame>
      ) : null}
    </div>
  );
}

function SummaryOrderIdField({
  orderId,
  sourceOrderId,
  onChange,
}: {
  orderId: string;
  sourceOrderId: string;
  onChange: (nextFullOrderId: string) => void;
}) {
  const { prefix, suffix } = splitSummaryOrderId(orderId, sourceOrderId);
  if (!prefix) {
    return (
      <input
        className="input-surface w-[180px] font-mono text-sm"
        value={orderId}
        onChange={(e) => onChange(e.target.value)}
        aria-label="Order ID"
      />
    );
  }
  return (
    <div className="flex min-w-[168px] max-w-[280px] items-stretch overflow-hidden rounded-lg border border-divider bg-subtle">
      <span
        className="pointer-events-none select-none whitespace-nowrap bg-subtle px-2 py-1.5 text-sm text-fg/90"
        tabIndex={-1}
        title="HB order prefix (read-only)"
      >
        {prefix || '—'}
      </span>
      <span
        className="flex select-none items-center border-l border-divider bg-subtle px-0.5 text-sm text-muted"
        aria-hidden
      >
        -
      </span>
      <input
        type="text"
        inputMode="numeric"
        autoComplete="off"
        pattern="[0-9]*"
        className="min-w-[2.5rem] flex-1 border-0 bg-subtle py-1.5 pl-2 pr-2 font-mono text-sm text-fg outline-none focus:ring-2 focus:ring-inset focus:ring-accent/35"
        value={suffix}
        onChange={(e) => onChange(joinSummaryOrderId(prefix, e.target.value))}
        placeholder="0"
        aria-label="Order line number (digits only)"
      />
    </div>
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

function formatDate(input: string) {
  try {
    const d = new Date(input);
    return d.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
  } catch {
    return input;
  }
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

function formatAddressInline(address: CompanyAddress | null) {
  if (!address) return '—';
  return `${address.line1}${address.line2 ? `, ${address.line2}` : ''}, ${address.city}, ${address.state} ${address.zip}, ${address.country}`;
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

  items.forEach((item, idx) => {
    let next: { name: string; url?: string; path?: string | null } | null = null;
    if (typeof item === 'string') {
      const name = item.trim();
      if (!name) return;
      next = { name };
    } else if (item && typeof item === 'object') {
      const name = String(item.name ?? '').trim();
      const url = String(item.url ?? '').trim();
      const path = String(item.path ?? '').trim();
      if (!name && !url && !path) return;
      next = {
        name: name || (path ? path.split('/').pop() || 'certificate.pdf' : 'certificate.pdf'),
        url: url || undefined,
        path: path || null,
      };
    }
    if (!next) return;
    const pathKey = String(next.path ?? '').trim();
    const urlKey = String(next.url ?? '').trim();
    const dedupeKey = pathKey
      ? `path:${pathKey}`
      : urlKey
        ? `url:${urlKey}`
        : `legacy:${idx}:${next.name.trim().toLowerCase()}`;
    const existing = map.get(dedupeKey);
    if (!existing) {
      map.set(dedupeKey, next);
      return;
    }
    const existingHasUrl = Boolean(existing.url);
    const nextHasUrl = Boolean(next.url);
    if (!existingHasUrl && nextHasUrl) {
      map.set(dedupeKey, next);
      return;
    }
    const existingHasPath = Boolean(existing.path);
    const nextHasPath = Boolean(next.path);
    if (!existingHasPath && nextHasPath) {
      map.set(dedupeKey, next);
    }
  });

  return Array.from(map.values());
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

/**
 * Per–inventory-type profile from GET /api/v1/crm/settings/inventory-types.
 * Keys are lowercased type names.
 * Volume assumes length/width/height are in **inches**; stored as cubic feet per unit (L×W×H / 1728).
 */
export type InventoryTypeProfile = {
  weightLbs: number;
  /** Cubic feet per unit when L, W, H are all present and positive; otherwise 0 */
  volumeCuFt: number;
};

function parsePositiveNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) return value;
  const n = Number.parseFloat(String(value ?? ''));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** default_weight_lbs from API (decimal/string); 0 is valid */
function parseNonNegativeWeightLbs(value: unknown): number {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) return value;
  const n = Number.parseFloat(String(value).trim());
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

/**
 * Per summary row: use the row's device_type when set (CSV / line item), else the parent inventory line type.
 * Case is preserved for display; lookups should use .toLowerCase().
 */
export function resolveInventoryTypeForRow(
  parentInventoryType: string,
  summaryDeviceType: string,
): string {
  const fromRow = String(summaryDeviceType ?? '').trim();
  if (fromRow) return fromRow;
  return String(parentInventoryType ?? '').trim();
}

/**
 * `inventory_number` on the device line is total units of that type; split evenly across summary rows.
 * Example: inventory_number 2, 1 row → 2 units/row; 2 rows → 1 unit each.
 */
export function quantityPerSummaryRow(
  parentInventoryNumber: string | number | undefined,
  summaryRowCount: number,
): number {
  const m = Math.max(1, summaryRowCount);
  const parsed = Number.parseInt(String(parentInventoryNumber ?? '').trim(), 10);
  const totalUnits = Number.isFinite(parsed) && parsed > 0 ? parsed : m;
  return totalUnits / m;
}

export function inventoryTypeProfilesFromApiResponse(json: unknown): Map<string, InventoryTypeProfile> {
  const map = new Map<string, InventoryTypeProfile>();
  if (!json || typeof json !== 'object') return map;
  const data = (json as { data?: unknown }).data;
  const rows = Array.isArray(data) ? data : [];
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    const rec = row as Record<string, unknown>;
    const name = String(rec.name ?? '').trim().toLowerCase();
    if (!name) continue;
    const weightLbs = parseNonNegativeWeightLbs(rec.default_weight_lbs);
    const L = parsePositiveNumber(rec.default_length);
    const W = parsePositiveNumber(rec.default_width);
    const H = parsePositiveNumber(rec.default_height);
    const volumeCuFt = L > 0 && W > 0 && H > 0 ? (L * W * H) / 1728 : 0;
    map.set(name, { weightLbs, volumeCuFt });
  }
  return map;
}

/** @deprecated Prefer inventoryTypeProfilesFromApiResponse; kept for callers that only need weights */
export function inventoryTypeWeightsFromApiResponse(json: unknown): Map<string, number> {
  const profiles = inventoryTypeProfilesFromApiResponse(json);
  const map = new Map<string, number>();
  profiles.forEach((p, k) => map.set(k, p.weightLbs));
  return map;
}

type LooseDevice = {
  inventory_type?: string;
  inventory_number?: string | number;
  summary?: Record<string, unknown>;
  summaries?: unknown[];
};

/**
 * Volume (lbs) from saved inventory_detail — counts × configured type weights.
 */
export function computeVolumeLbsFromInventoryDetail(
  inventoryDetail: Record<string, unknown> | null | undefined,
  weightByLowerName: Map<string, number>,
): number {
  if (!inventoryDetail || typeof inventoryDetail !== 'object') return 0;

  const simpleRows = Array.isArray((inventoryDetail as { simple_summary?: unknown }).simple_summary)
    ? ((inventoryDetail as { simple_summary: unknown[] }).simple_summary as Record<string, unknown>[])
    : [];
  /** Short summary rows: `weight_lbs` is total weight for the line (not multiplied by count). */
  if (simpleRows.length > 0) {
    let simpleTotal = 0;
    for (const r of simpleRows) {
      if (!r || typeof r !== 'object') continue;
      const wt = Number.parseFloat(String((r as { weight_lbs?: unknown }).weight_lbs ?? '0'));
      const w = Number.isFinite(wt) && wt > 0 ? wt : 0;
      simpleTotal += w;
    }
    return Math.round(simpleTotal * 100) / 100;
  }

  const rowVolume = (typeRaw: string, count: number) => {
    const key = typeRaw.trim().toLowerCase();
    const w = weightByLowerName.get(key) ?? 0;
    const c = Number.isFinite(count) && count > 0 ? count : 0;
    return c * w;
  };

  const devices = Array.isArray(inventoryDetail.devices) ? (inventoryDetail.devices as LooseDevice[]) : [];
  let total = 0;

  if (devices.length > 0) {
    // One CRM device record with a single summary = either (a) bulk quantity in inventory_number, or
    // (b) a flattened line where inventory_number is just a line index. Many records ⇒ one unit per record.
    if (devices.length === 1) {
      const d0 = devices[0]!;
      const summary0 =
        d0?.summary && typeof d0.summary === 'object' ? (d0.summary as Record<string, unknown>) : null;
      const type0 = String(summary0?.device_type ?? d0?.inventory_type ?? '').trim();
      const parsed0 = Number.parseInt(String(d0?.inventory_number ?? ''), 10);
      const count0 = Number.isFinite(parsed0) && parsed0 > 0 ? parsed0 : 1;
      total += rowVolume(type0, count0);
      return Math.round(total * 100) / 100;
    }

    for (const d of devices) {
      const summary = d?.summary && typeof d.summary === 'object' ? (d.summary as Record<string, unknown>) : null;
      const typeRaw = String(
        summary?.device_type ?? d?.inventory_type ?? '',
      ).trim();
      total += rowVolume(typeRaw, 1);
    }
    return Math.round(total * 100) / 100;
  }

  const summary = (inventoryDetail.summary ?? {}) as Record<string, unknown>;
  const typeRaw = String(summary.device_type ?? '').trim();
  if (typeRaw) total += rowVolume(typeRaw, 1);
  return Math.round(total * 100) / 100;
}

export function computeVolumeLbsFromOrderPayload(
  crmPayloadJson: Record<string, unknown> | null | undefined,
  weightByLowerName: Map<string, number>,
): number {
  if (!crmPayloadJson || typeof crmPayloadJson !== 'object') return 0;
  const inv = (crmPayloadJson as { inventory_detail?: Record<string, unknown> }).inventory_detail;
  return computeVolumeLbsFromInventoryDetail(inv, weightByLowerName);
}

export type SummaryRowLike = {
  key: string;
  inventoryType: string;
  /** Units represented by this summary row (inventory_number ÷ row count for that device line). Default 1. */
  quantityForRow?: number;
};

/**
 * Weight/volume = quantityForRow × settings default for that row's resolved inventory/device type.
 */
export function computeTotalsAndUnknownRowsFromSummary(
  rows: SummaryRowLike[],
  profiles: Map<string, InventoryTypeProfile>,
): {
  overallWeightLbs: number;
  overallVolumeCuFt: number;
  unknownRowKeys: Set<string>;
  unknownTypeLabels: string[];
} {
  const unknownRowKeys = new Set<string>();
  const unknownLabels = new Set<string>();
  let overallWeightLbs = 0;
  let overallVolumeCuFt = 0;

  for (const row of rows) {
    const t = String(row.inventoryType ?? '').trim();
    const key = t.toLowerCase();
    const profile = t ? profiles.get(key) : undefined;
    const unknown = !t || profile === undefined;
    if (unknown) {
      unknownRowKeys.add(row.key);
      unknownLabels.add(t || '(blank type)');
      continue;
    }
    const q =
      row.quantityForRow != null && Number.isFinite(row.quantityForRow) && row.quantityForRow > 0
        ? row.quantityForRow
        : 1;
    overallWeightLbs += q * profile.weightLbs;
    overallVolumeCuFt += q * profile.volumeCuFt;
  }

  return {
    overallWeightLbs: Math.round(overallWeightLbs * 100) / 100,
    overallVolumeCuFt: Math.round(overallVolumeCuFt * 10000) / 10000,
    unknownRowKeys,
    unknownTypeLabels: [...unknownLabels].sort(),
  };
}

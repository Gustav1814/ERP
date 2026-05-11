/**
 * Volume (lbs) from CRM inventory summary + Settings → Inventory Types default weights.
 * Each row in `inventory_detail.devices` counts as one unit at that row's device type weight.
 */

export function inventoryTypeWeightsFromApiResponse(data: unknown): Map<string, number> {
  const list = Array.isArray((data as { data?: unknown })?.data) ? (data as { data: any[] }).data : [];
  const map = new Map<string, number>();
  for (const item of list) {
    const name = String(item?.name ?? '').trim().toLowerCase();
    const w = Number(item?.default_weight_lbs);
    if (!name || !Number.isFinite(w) || w < 0) continue;
    map.set(name, w);
  }
  return map;
}

function weightForType(weightByLowerName: Map<string, number>, typeName: string): number {
  const key = typeName.trim().toLowerCase();
  if (!key) return 0;
  const w = weightByLowerName.get(key);
  return typeof w === 'number' && Number.isFinite(w) && w > 0 ? w : 0;
}

/**
 * @returns total lbs from summary rows, or `null` if there is no inventory summary to sum (caller may fall back to order.quantity).
 */
export function computeVolumeLbsFromInventorySummary(
  crmPayloadJson: unknown,
  weightByLowerName: Map<string, number>,
): number | null {
  if (weightByLowerName.size === 0) return null;

  const payload = (crmPayloadJson ?? {}) as Record<string, unknown>;
  const inv = (payload.inventory_detail ?? {}) as Record<string, unknown>;
  const devices = Array.isArray(inv.devices) ? inv.devices : [];

  if (devices.length > 0) {
    let total = 0;
    for (const d of devices) {
      const row = d as Record<string, unknown>;
      const type =
        String(row.inventory_type ?? '').trim() ||
        String((row.summary as Record<string, unknown> | undefined)?.device_type ?? '').trim();
      if (!type) continue;
      total += weightForType(weightByLowerName, type);
    }
    return total;
  }

  const summary = (inv.summary ?? {}) as Record<string, unknown>;
  const legacyType = String(summary.device_type ?? '').trim();
  if (legacyType) {
    const w = weightForType(weightByLowerName, legacyType);
    return w > 0 ? w : 0;
  }

  return null;
}

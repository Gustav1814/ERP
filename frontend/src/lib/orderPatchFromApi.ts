/**
 * Fields from `PATCH /api/v1/crm/orders/:id` response `data` that parent lists should merge
 * so `pickup_address_id` / `pickup_date` stay in sync (not only `crm_payload_json`).
 */
export type OrderSavedPatch = {
  crm_payload_json?: Record<string, unknown> | null;
  pickup_address_id?: number | null;
  pickup_date?: string | null;
};

export function orderPatchFromApiData(data: unknown): OrderSavedPatch {
  if (!data || typeof data !== 'object') return {};
  const o = data as Record<string, unknown>;
  const patch: OrderSavedPatch = {};

  if ('crm_payload_json' in o) {
    patch.crm_payload_json =
      o.crm_payload_json === undefined ? undefined : ((o.crm_payload_json as Record<string, unknown>) ?? null);
  }
  if ('pickup_address_id' in o) {
    const v = o.pickup_address_id;
    if (v === null || v === undefined || v === '') {
      patch.pickup_address_id = null;
    } else {
      const n = Number(v);
      patch.pickup_address_id = Number.isFinite(n) && n > 0 ? n : null;
    }
  }
  if ('pickup_date' in o) {
    const d = o.pickup_date;
    if (d === null || d === undefined || d === '') {
      patch.pickup_date = null;
    } else {
      patch.pickup_date = String(d).slice(0, 10);
    }
  }

  return patch;
}

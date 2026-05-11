function toTrimmedList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((s) => String(s ?? '').trim()).filter(Boolean);
}

function splitCommaServices(raw: unknown): string[] {
  if (typeof raw !== 'string') return [];
  return raw
    .split(/[,;|]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function dedupePreserveOrder(labels: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of labels) {
    const k = s.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(s);
  }
  return out;
}

function servicesFromOrderBlock(order: Record<string, unknown> | undefined): string[] {
  if (!order) return [];
  return dedupePreserveOrder([
    ...toTrimmedList(order.services),
    ...toTrimmedList(order.service_names),
    ...splitCommaServices(order.selected_services),
  ]);
}

/**
 * Services selected for an order, resolved from `crm_payload_json` wherever the CRM / ERP layers store them.
 *
 * - **Inventory panel** persists under `manual.services` when that object defines a `services` key (including `[]`
 *   after the user clears all services).
 * - **CRM ingest** full payload: `order.services`, `order.service_names`, `order.selected_services` (comma string),
 *   root `services`, `lead.order.*` mirrors.
 */
export function normalizeManualServices(
  crmPayloadJson: Record<string, unknown> | null | undefined,
): string[] {
  if (!crmPayloadJson || typeof crmPayloadJson !== 'object') return [];

  const manual = crmPayloadJson.manual as Record<string, unknown> | undefined;
  const order = crmPayloadJson.order as Record<string, unknown> | undefined;
  const lead = crmPayloadJson.lead as Record<string, unknown> | undefined;
  const leadOrder = lead?.order as Record<string, unknown> | undefined;

  const fromOrder = servicesFromOrderBlock(order);
  const fromRoot = dedupePreserveOrder(toTrimmedList(crmPayloadJson.services));
  const fromLead = servicesFromOrderBlock(leadOrder);

  if (manual != null && Object.prototype.hasOwnProperty.call(manual, 'services')) {
    return dedupePreserveOrder(toTrimmedList(manual.services));
  }

  if (fromOrder.length > 0) return fromOrder;
  if (fromRoot.length > 0) return fromRoot;
  if (fromLead.length > 0) return fromLead;

  return [];
}

/**
 * Order labels like **Settings → Services** (remaining labels alphabetically at the end).
 */
/**
 * Legacy rows sometimes stored `type_of_equipment` as the sole `manual.services` entry.
 * Treat that as “no services” for list/detail display so empty state shows correctly.
 */
export function stripEquipmentOnlyServiceLabel(labels: string[], typeOfEquipment: string): string[] {
  const eq = String(typeOfEquipment ?? '').trim();
  if (eq.length === 0 || labels.length !== 1) return labels;
  if (labels[0].trim().toLowerCase() === eq.toLowerCase()) return [];
  return labels;
}

export function sortServiceLabelsByCatalogOrder(
  labels: string[],
  catalogNamesInOrder: string[],
): string[] {
  if (labels.length === 0) return [];
  const lower = new Map(labels.map((l) => [l.toLowerCase(), l]));
  const used = new Set<string>();
  const out: string[] = [];
  for (const name of catalogNamesInOrder) {
    const key = name.toLowerCase();
    const canon = lower.get(key);
    if (canon) {
      out.push(canon);
      used.add(key);
    }
  }
  const extras = labels.filter((l) => !used.has(l.toLowerCase()));
  extras.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  return [...out, ...extras];
}

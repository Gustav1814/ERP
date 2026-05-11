import { type Company } from '@/src/data/companies';
import { normalizeManualServices, stripEquipmentOnlyServiceLabel } from '@/src/lib/crmManualServices';

/** Normalize CRM API company payload into `Company` shape used by the ERP UI. */
export function hydrateCompany(company: any): Company {
  const c = company ?? {};
  const orders = Array.isArray(c?.orders) ? c.orders : [];
  const addresses = Array.isArray(c?.addresses) ? c.addresses : [];

  return {
    ...c,
    primary_contact_name: c?.primary_contact_name ?? '',
    project_manager: c?.project_manager ?? '',
    primary_email: c?.primary_email ?? '',
    primary_phone: c?.primary_phone ?? '',
    customer_type: c?.customer_type ?? '',
    lead_channel: c?.lead_channel ?? '',
    hear_about_us: c?.hear_about_us ?? '',
    created_at: c?.created_at ?? new Date().toISOString(),
    addresses,
    orders: orders.map((order: any) => ({
      ...order,
      crm_payload_json: order?.crm_payload_json ?? null,
      source_order_id: order?.source_order_id ?? '',
      title: order?.title ?? '',
      type_of_equipment: order?.type_of_equipment ?? '',
      quantity: order?.quantity ?? '',
      estimate_value: Number(order?.estimate_value ?? 0),
      pickup_cost: Number(order?.pickup_cost ?? 0),
      pickup_cost_status: order?.pickup_cost_status ?? 'pending',
      status: order?.status ?? 'new',
      qualify_status: order?.qualify_status ?? 'pending',
      start_date: order?.start_date ?? '',
      pickup_date: order?.pickup_date ?? '',
      services: stripEquipmentOnlyServiceLabel(
        normalizeManualServices(order?.crm_payload_json ?? null),
        String(order?.type_of_equipment ?? ''),
      ),
      attachments: order?.attachments_json ?? [],
      detail_rows: Array.isArray(order?.detail_rows) ? order.detail_rows : [],
    })),
  };
}

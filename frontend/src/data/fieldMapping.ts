export type MappingCategory =
  | 'company'
  | 'billing_address'
  | 'pickup_address'
  | 'order_core'
  | 'order_value'
  | 'schedule'
  | 'attachments'
  | 'meta';

export type FieldMapping = {
  category: MappingCategory;
  crm_source: string;
  erp_target: string;
  required: boolean;
  notes?: string;
};

export const categoryLabels: Record<MappingCategory, string> = {
  company: 'Company',
  billing_address: 'Billing Address',
  pickup_address: 'Pickup Address',
  order_core: 'Order Core',
  order_value: 'Order Value',
  schedule: 'Schedule',
  attachments: 'Attachments',
  meta: 'Meta / Source',
};

export const fieldMappings: FieldMapping[] = [
  // Company
  { category: 'company', crm_source: 'lead.company_name', erp_target: 'companies.name', required: true },
  { category: 'company', crm_source: 'lead.contact_name', erp_target: 'companies.primary_contact_name', required: true },
  { category: 'company', crm_source: 'lead.email', erp_target: 'companies.primary_email', required: true },
  { category: 'company', crm_source: 'lead.phone', erp_target: 'companies.primary_phone', required: true },
  { category: 'company', crm_source: 'lead.customer_type', erp_target: 'companies.customer_type', required: false, notes: 'Enum: commercial | residential | government' },
  { category: 'company', crm_source: 'lead.channel', erp_target: 'companies.lead_channel', required: false },
  { category: 'company', crm_source: 'lead.hear_about_us', erp_target: 'companies.hear_about_us', required: false },

  // Billing
  { category: 'billing_address', crm_source: 'lead.billing.line1', erp_target: 'company_addresses.line1 (kind=billing)', required: true },
  { category: 'billing_address', crm_source: 'lead.billing.line2', erp_target: 'company_addresses.line2', required: false },
  { category: 'billing_address', crm_source: 'lead.billing.city', erp_target: 'company_addresses.city', required: true },
  { category: 'billing_address', crm_source: 'lead.billing.state', erp_target: 'company_addresses.state', required: true },
  { category: 'billing_address', crm_source: 'lead.billing.zip', erp_target: 'company_addresses.zip', required: true },
  { category: 'billing_address', crm_source: 'lead.billing.country', erp_target: 'company_addresses.country', required: true },

  // Pickup
  { category: 'pickup_address', crm_source: 'lead.pickup.line1', erp_target: 'company_addresses.line1 (kind=pickup)', required: true },
  { category: 'pickup_address', crm_source: 'lead.pickup.line2', erp_target: 'company_addresses.line2', required: false },
  { category: 'pickup_address', crm_source: 'lead.pickup.city', erp_target: 'company_addresses.city', required: true },
  { category: 'pickup_address', crm_source: 'lead.pickup.state', erp_target: 'company_addresses.state', required: true },
  { category: 'pickup_address', crm_source: 'lead.pickup.zip', erp_target: 'company_addresses.zip', required: true },

  // Order core
  { category: 'order_core', crm_source: 'lead.order.title', erp_target: 'erp_orders.title', required: true },
  { category: 'order_core', crm_source: 'lead.order.equipment_type', erp_target: 'erp_orders.type_of_equipment', required: true },
  { category: 'order_core', crm_source: 'lead.order.quantity', erp_target: 'erp_orders.quantity', required: true },
  { category: 'order_core', crm_source: 'lead.order.data_destruction_type', erp_target: 'erp_orders.data_destruction_type', required: false },
  { category: 'order_core', crm_source: 'lead.order.message', erp_target: 'erp_orders.message', required: false },
  { category: 'order_core', crm_source: 'lead.order.qualify_status', erp_target: 'erp_orders.qualify_status', required: true },

  // Order value
  { category: 'order_value', crm_source: 'lead.order.estimate_value', erp_target: 'erp_orders.estimate_value', required: true, notes: 'Always stored as integer minor units' },
  { category: 'order_value', crm_source: 'lead.order.pickup_cost', erp_target: 'erp_orders.pickup_cost', required: true },
  { category: 'order_value', crm_source: 'lead.order.pickup_cost_status', erp_target: 'erp_orders.pickup_cost_status', required: true, notes: 'pending | approved | rejected' },

  // Schedule
  { category: 'schedule', crm_source: 'lead.order.start_date', erp_target: 'erp_orders.start_date', required: true, notes: 'ISO 8601 (YYYY-MM-DD)' },
  { category: 'schedule', crm_source: 'lead.order.pickup_date', erp_target: 'erp_orders.pickup_date', required: true },

  // Attachments
  { category: 'attachments', crm_source: 'lead.order.attachments[]', erp_target: 'erp_orders.attachments (jsonb)', required: false, notes: 'Array of signed URLs' },

  // Meta
  { category: 'meta', crm_source: 'static "hb-leads-crm"', erp_target: 'erp_orders.source_system', required: true },
  { category: 'meta', crm_source: 'lead.id', erp_target: 'erp_orders.source_lead_id', required: true },
  { category: 'meta', crm_source: 'lead.order.reference', erp_target: 'erp_orders.source_order_id', required: true, notes: 'Natural key, e.g. HB-2026-0412' },
  { category: 'meta', crm_source: 'handoff_token.jti', erp_target: 'erp_handoff_tokens.jti', required: true, notes: 'Replay-protected' },
  { category: 'meta', crm_source: 'request.header[X-Idempotency-Key]', erp_target: 'erp_order_idempotency.key', required: true },
];
